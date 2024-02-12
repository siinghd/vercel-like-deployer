import express, { type Request, type Response, type NextFunction } from 'express';
import Redis from 'ioredis';
import httpProxy from 'http-proxy';

const app = express();
const proxy = httpProxy.createProxyServer();
const redisClient = new Redis(process.env.REDIS_URL || '');


app.use((req: Request, res: Response, next: NextFunction) => {
  const host = req.headers.host;
  const suffix = '-x.hsingh.site';
  const subdomain =
    host && host.endsWith(suffix) ? host.slice(0, -suffix.length) : null;

  if (!subdomain) {
    res.status(404).send('Invalid subdomain format');
    return;
  }

  const redisKey = `port:${subdomain}`;

  redisClient.get(redisKey, (err, port) => {
    if (err || !port) {
      res.status(404).send('Service not found');
      return;
    }

    proxy.web(req, res, { target: `http://localhost:${port}` });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
