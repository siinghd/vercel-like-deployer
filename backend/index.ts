import express, { type Request, type Response } from 'express';
import Docker from 'dockerode';
import validator from 'validator';
import portfinder from 'portfinder';
import { URL } from 'url';
import Redis from 'ioredis';
import { PassThrough, Duplex } from 'stream';
import 'dotenv/config';
import { env } from 'bun';

const app = express();
const docker = new Docker();
const redisClient = new Redis(process.env.REDIS_URL || '');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

portfinder.basePort = 3001;

app.post('/deploy', async (req: Request, res: Response) => {
  const { githubUrl, envFile } = req.body;
  console.log(githubUrl, envFile);
  if (!githubUrl || !validator.isURL(githubUrl, { require_protocol: true })) {
    res.status(400).send('A valid GitHub URL is required');
    return;
  }

  const slug = generateSlug(githubUrl);
  const multiLine = envFile || '';

  // let normalizedEnv = multiLine.trim().replace(/\s*=\s*"/g, '="');
  // normalizedEnv = multiLine.trim().replace(/\s+/g, ' ');

  // // Split the string into individual environment variable declarations
  // // This regex looks for a pattern of 'key=value' pairs
  // const envVariables = normalizedEnv.match(/(\w+=[^\s]+)/g);

  // // Join the variables with a newline character to create a multiline string
  // const envMultiline = envVariables.join('\n');

  deployApplication(githubUrl, envFile || '', slug)
    .then(() => console.log(`Deployment process started for ${slug}`))
    .catch((error) =>
      console.error(`Error during deployment for ${slug}: `, error)
    );

  res.send({ message: 'Deployment started', logUrl: `/logs/${slug}` });
});

app.get('/logs/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const logs = await redisClient.get(slug);
  res.send({ logs: logs || 'No logs available yet.' });
});

const shouldLogMessage = (message: string): boolean => {
  const lowerCaseMessage = message.toLowerCase();
  const keywords = ['error', 'ERROR', 'err', 'ERR'];
  return keywords.some((keyword) =>
    lowerCaseMessage.includes(keyword.toLowerCase())
  );
};
const deployApplication = async (
  githubUrl: string,
  envFile: string,
  slug: string
) => {
  let startLogging = false;
  try {
    const availablePort = await portfinder.getPortPromise();
    try {
      await docker.getImage('ubuntu').inspect();
    } catch (error: any) {
      if (error.statusCode === 404) {
        console.log('Pulling ubuntu:focal image...');
        await docker.pull('ubuntu:focal');
      } else {
        throw error;
      }
    }
    const container = await docker.createContainer({
      name: slug,
      Image: 'ubuntu:focal',
      Cmd: ['/bin/bash'],
      Tty: true,
      ExposedPorts: { [availablePort]: {} },
      HostConfig: {
        PortBindings: { [availablePort]: [{ HostPort: `${availablePort}` }] },
      },
      //   Env: parseEnvFile(envFile),
    });

    await container.start();
    const containerId = container.id;
    await redisClient.set(`container:${slug}`, containerId);
    await redisClient.set(`port:${slug}`, availablePort);
    const envContent = envFile.split('\n').join('\\n');

    const setupScript = `
            export DEBIAN_FRONTEND=noninteractive &&
            apt-get update &&
            apt-get install -y curl &&
            curl -sL https://deb.nodesource.com/setup_20.x | bash - &&
            apt-get upgrade -y &&
            apt-get install -y git nodejs &&
            git clone ${githubUrl} /app &&
            cd /app &&
            echo -e "${envContent}" > .env &&
            npm install -g pnpm
            npm install -g pm2 &&
            pnpm install &&
            pnpm run build &&
            PORT=${availablePort} pm2 start "pnpm run start" --no-daemon -o out.log -e err.log
        `;

    const exec = await container.exec({
      AttachStdout: true,
      AttachStderr: true,
      Cmd: ['bash', '-c', setupScript],
    });

    const execStream: Duplex = (await exec.start({
      Detach: false,
    })) as unknown as Duplex;
    const logStream = new PassThrough();
    docker.modem.demuxStream(execStream, logStream, logStream);

    logStream.on('data', async (chunk) => {
      const message = chunk.toString();
      if (message.includes('npm')) {
        startLogging = true;
      }
      if (startLogging) {
        console.error(`${slug}:`, message);
        await redisClient.append(slug, message);
      }
      // await redisClient.append(slug, message);
    });

    await new Promise<void>((resolve, reject) => {
      logStream.on('end', resolve);
      logStream.on('error', reject);
      execStream.on('end', resolve);
      execStream.on('error', reject);
    });

    await redisClient.append(slug, 'Deployment completed successfully.\n');
  } catch (error) {
    console.error(`Error deploying ${slug}:`, error);
    await redisClient.append(slug, `Error: ${error}\n`);
  }
};

const generateSlug = (githubUrl: string): string => {
  const parsedUrl = new URL(githubUrl);
  const pathname = parsedUrl.pathname;
  return pathname.split('/').slice(1, 3).join('-').toLowerCase();
};

const parseEnvFile = (envFile: string): string[] => {
  return envFile
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .map((line) => line.trim());
};

app.post('/destroy/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const containerId = await redisClient.get(`container:${slug}`);
    if (!containerId) {
      res.status(404).send('Container not found');
      return;
    }

    const container = docker.getContainer(containerId);
    await container.stop();
    await container.remove();

    await redisClient.del(`container:${slug}`); // Remove the container ID from Redis

    res.send({ message: `Container for ${slug} has been destroyed.` });
  } catch (error) {
    console.error(error);
    res.status(500).send(`Error destroying container for ${slug}: ${error}`);
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
