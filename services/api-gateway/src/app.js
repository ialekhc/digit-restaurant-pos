import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { routeMappings, resolveUpstreamUrl } from './config/serviceRoutes.js';

export const app = express();

app.use(cors());
app.use(morgan('dev'));

const makeProxy = (target, serviceName) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    onError(error, _req, res) {
      const statusCode = error?.code === 'ECONNREFUSED' ? 503 : 502;
      res.status(statusCode).json({
        success: false,
        message: `Upstream service unavailable: ${serviceName}`
      });
    }
  });

app.get('/health', (_req, res) => {
  const upstreams = Object.fromEntries(
    ['core', 'vendor'].map((serviceName) => [serviceName, resolveUpstreamUrl(serviceName)])
  );

  res.json({
    status: 'ok',
    service: 'api-gateway',
    pattern: 'api-gateway',
    upstreams,
    timestamp: new Date().toISOString()
  });
});

routeMappings.forEach(({ mountPath, service }) => {
  const target = resolveUpstreamUrl(service);
  app.use(mountPath, makeProxy(target, service));
});
