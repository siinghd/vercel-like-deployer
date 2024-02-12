import express, { Request, Response } from 'express';
import Docker from 'dockerode';
import validator from 'validator';
import portfinder from 'portfinder';
import { URL } from 'url';
import Redis from 'ioredis';
import { PassThrough, Duplex } from 'stream';
import 'dotenv/config';
import cors from 'cors';

const app = express();
const docker = new Docker();
const redisClient = new Redis(process.env.REDIS_URL || '');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

portfinder.basePort = 3001;

const generateSlug = (githubUrl: string): string => {
  const parsedUrl = new URL(githubUrl);
  const pathname = parsedUrl.pathname;
  return pathname.split('/').slice(1, 3).join('-').toLowerCase();
};

const parseEnvFile = (envFile: string): string[] =>
  envFile
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => line.trim());

const shouldDestroy = (message: string): boolean => {
  const lowerCaseMessage = message.toLowerCase();
  return [
    'error',
    'ERROR',
    'err',
    'ERR',
    'fatal',
    'uncaughtException',
    'critical',
  ].some((keyword) => lowerCaseMessage.includes(keyword.toLowerCase()));
};
const findContainerByName = async (containerName: string) => {
  const containers = await docker.listContainers({ all: true });
  return containers.find((container) =>
    container.Names.some((name) => name === `/${containerName}`)
  );
};
const destroyContainer = async (
  slug: string
): Promise<[boolean, string] | undefined> => {
  const containerId = await redisClient.get(`container:${slug}`);
  if (!containerId) {
    console.error('Container not found for slug:', slug);
    return;
  }

  try {
    const container = docker.getContainer(containerId);
    await container.stop();
    await container.remove();
    await redisClient.del(`container:${slug}`);
    return [true, `Container for ${slug} has been destroyed.`];
  } catch (error) {
    return [false, `Error destroying container for ${slug}: ${error}`];
  }
};
app.post('/deploy', async (req: Request, res: Response) => {
  try {
    const { githubUrl, envFile, installCmd, buildCmd, runCmd } = req.body;
    if (!githubUrl || !validator.isURL(githubUrl, { require_protocol: true })) {
      return res.status(400).send('A valid GitHub URL is required');
    }

    const slug = generateSlug(githubUrl);
    deployApplication(
      githubUrl,
      envFile || '',
      slug,
      installCmd,
      buildCmd,
      runCmd
    )
      .then(() => {
        redisClient.append(
          `logs:${slug}`,
          `Deployment process done for ${slug}\n`
        );
        console.log(`Deployment process done for ${slug}`);
      })
      .catch((error) =>
        console.error(`Error during deployment for ${slug}: `, error)
      );

    res.send({
      message: 'Deployment started',
      siteUrl: `https://${slug}-x.hsingh.site`,
      logUrl: `https://api-deployer.hsingh.site/logs/${slug}`,
    });
  } catch (error) {
    console.error('ERROR:', error);
  }
});

app.get('/logs/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const logs = await redisClient.get(`logs:${slug}`);
  res.send({ logs: logs || 'No logs available yet.' });
});

app.post('/destroy/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const result = await destroyContainer(slug);

  if (result) {
    const [success, message] = result;
    if (success) {
      res.send({ message });
    } else {
      res.status(500).send({ message });
    }
  } else {
    res.status(500).send({ message: 'Error destroying container' });
  }
});

const deployApplication = async (
  githubUrl: string,
  envFile: string,
  slug: string,
  installCmd: string,
  buildCmd: string,
  runCmd: string
) => {
  let startLogging = false;
  try {
    const existingContainerId = await redisClient.get(`container:${slug}`);
    const existingContainerByName = await findContainerByName(slug);

    if (existingContainerByName && existingContainerByName.Id) {
      try {
        const existingContainer = docker.getContainer(
          existingContainerByName.Id
        );
        await existingContainer.stop();
        await existingContainer.remove();
        await redisClient.del(`container:${slug}`);
        await redisClient.del(`port:${slug}`);
        await redisClient.del(`logs:${slug}`);
      } catch (error) {
        console.error(
          `Error destroying existing container for ${slug}: `,
          error
        );
        redisClient.append(`logs:${slug}`, `Error: ${error}\n`);
      }
    }

    const availablePort = await portfinder.getPortPromise();
    await handleDockerImage('ubuntu:focal', slug);
    const container = await docker.createContainer({
      name: slug,
      Image: 'ubuntu:focal',
      Cmd: ['/bin/bash'],
      Tty: true,
      ExposedPorts: { [availablePort]: {} },
      HostConfig: {
        PortBindings: { [availablePort]: [{ HostPort: `${availablePort}` }] },
      },
    });
    await container.start();
    await redisClient.set(`container:${slug}`, container.id);
    await redisClient.set(`port:${slug}`, availablePort.toString());

    const setupScript = buildSetupScript(
      githubUrl,
      envFile,
      availablePort,
      installCmd,
      buildCmd,
      runCmd
    );
    const exec = await container.exec({
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ['bash', '-c', setupScript],
    });
    redisClient.append(`logs:${slug}`, `Deployment started.\n`);
    await executeSetupScript(exec, slug);
  } catch (error) {
    await redisClient.append(`logs:${slug}`, `Error: ${error}\n`);
  }
};

const handleDockerImage = async (imageName: string, slug: string) => {
  try {
    await docker.getImage(imageName).inspect();
  } catch (error: any) {
    if (error.statusCode === 404) {
      await docker.pull(imageName);
      redisClient.append(`logs:${slug}`, `Pulled ${imageName} image.\n`);
    } else {
      throw error;
    }
  }
};

const buildSetupScript = (
  githubUrl: string,
  envFile: string,
  availablePort: number,
  installCmd: string,
  buildCmd: string,
  runCmd: string
): string => `
    export DEBIAN_FRONTEND=noninteractive &&
    apt-get update &&
    apt-get install -y curl &&
    curl -sL https://deb.nodesource.com/setup_20.x | bash - &&
    apt-get upgrade -y &&
    apt-get install -y git nodejs &&
    git clone ${githubUrl} /app &&
    cd /app &&
    echo -e "${envFile.split('\n').join('\\n')}" > .env &&
    npm install -g pnpm &&
    npm install -g pm2 &&
    npm install -g yarn
    npm install -g sharp &&
    ${installCmd || 'pnpm install'} &&
    pnpm add sharp &&
    ${buildCmd || 'pnpm run build'} &&
    PORT=${availablePort} port=${availablePort} pm2 start "${
  runCmd || 'pnpm run start'
} --port ${availablePort}" --no-daemon -o out.log -e err.log 
`;

const executeSetupScript = async (exec: Docker.Exec, slug: string) => {
  let startLogging = false;
  const execStream: Duplex = (await exec.start({
    Detach: false,
  })) as unknown as Duplex;
  const logStream = new PassThrough();
  docker.modem.demuxStream(execStream, logStream, logStream);

  logStream.on('data', async (chunk) => {
    const message = chunk.toString();
    if (message.includes('npm')) startLogging = true;
    if (startLogging) {
      console.error(`${slug}:`, message);
      await redisClient.append(`logs:${slug}`, message);
      if (shouldDestroy(message)) {
        console.error(
          `Destructive error identified for ${slug}, initiating container destruction.`
        );
        await destroyContainer(slug);
        throw new Error(
          `Deployment aborted for ${slug} due to critical errors.`
        );
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    logStream.on('end', resolve);
    logStream.on('error', reject);
    execStream.on('end', resolve);
    execStream.on('error', reject);
  });
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
