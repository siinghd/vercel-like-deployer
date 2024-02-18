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

const generateSlug = (githubUrl: string, projectPath: string): string => {
  const parsedUrl = new URL(githubUrl);
  const pathname = parsedUrl.pathname;
  const slugBase = projectPath
    ? `${projectPath}-${pathname.split('/').slice(1, 3).join('-')}`
    : pathname.split('/').slice(1, 3).join('-');

  // Remove characters that are not letters or numbers
  const cleanSlug = slugBase.replace(/[^a-zA-Z0-9-]/g, '');

  return cleanSlug.toLowerCase();
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
    await redisClient.del(`port:${slug}`);
    return [true, `Container for ${slug} has been destroyed.`];
  } catch (error) {
    return [false, `Error destroying container for ${slug}: ${error}`];
  }
};
app.post('/deploy', async (req: Request, res: Response) => {
  try {
    const { githubUrl, envFile, installCmd, buildCmd, runCmd, projectPath } =
      req.body;
    if (!githubUrl || !validator.isURL(githubUrl, { require_protocol: true })) {
      return res.status(400).send('A valid GitHub URL is required');
    }

    const slug = generateSlug(githubUrl, projectPath);

    deployApplication(
      githubUrl,
      envFile || '',
      slug,
      installCmd,
      buildCmd,
      runCmd,
      projectPath
    )
      .then(() => {
        redisClient.append(
          `logs:${slug}`,
          `Deployment process done for ${slug}\n`
        );
      })
      .catch((error) => {
        redisClient.append(
          `logs:${slug}`,
          `Error during deployment for ${slug}:  ${error}\n`
        );
      });

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
  runCmd: string,
  projectPath: string
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
    await redisClient.del(`logs:${slug}`);

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
      runCmd,
      projectPath
    );
    const exec = await container.exec({
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ['bash', '-c', setupScript],
    });
    redisClient.append(`logs:${slug}`, `Deployment started.\n`);
    await executeSetupScript(exec, slug);
  } catch (error) {
    console.error('Error during deployment:', error);
    await redisClient.append(`logs:${slug}`, `Error: ${error}\n`);
  }
};

const handleDockerImage = async (imageName: string, slug: string) => {
  try {
    await docker.getImage(imageName).inspect();
  } catch (error: any) {
    console.error('Error inspecting image:', error);
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
  runCmd: string,
  projectPath: string
): string => `
    export DEBIAN_FRONTEND=noninteractive &&
    apt-get update &&
    apt-get upgrade -y &&
    apt-get install -y curl unzip &&
    curl -fsSL https://bun.sh/install | bash && 
    ln -s $HOME/.bun/bin/bun /usr/local/bin/bun &&
    curl -sL https://deb.nodesource.com/setup_20.x | bash - &&
    apt-get install -y git nodejs jq &&
    git clone ${githubUrl} /app &&
    cd /app &&
    ${projectPath ? `cd ${projectPath}` : 'cd ./'} &&
    echo -e "${envFile.split('\n').join('\\n')}" > .env &&
    npm install -g pnpm pm2 yarn sharp serve &&
    ${installCmd || 'pnpm install'} &&
    if [ -n "${buildCmd}" ]; then
    ${buildCmd}
    elif jq -e '.scripts.build' package.json >/dev/null; then
        pnpm run build
    fi &&
    if [ -d dist ] && [ -f dist/index.html ]; then
        pm2 serve dist --port=${availablePort} --spa --no-daemon
    elif [ -d out ] && [ -f out/index.html ]; then
        pm2 serve out --port=${availablePort} --spa --no-daemon
    elif [ -d build ]&& [ -f build/index.html ]; then
        pm2 serve build --port=${availablePort} --spa --no-daemon
    else
        PORT=${availablePort} port=${availablePort} pm2 start "${
  runCmd || 'pnpm run start'
} --port ${availablePort}" --no-daemon -o out.log -e err.log 
    fi
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
