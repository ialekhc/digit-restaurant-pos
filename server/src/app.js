import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import {
  apiRateLimiter,
  authRateLimiter,
  corsOptions,
  publicOrderRateLimiter,
  requestContext
} from './middleware/security.js';
import { query } from './database/query.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');
app.use(requestContext);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req) => req.path === '/api/health'
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadPath = process.env.UPLOAD_DIR || path.resolve(__dirname, 'uploads');
fs.mkdirSync(uploadPath, { recursive: true });
app.use('/uploads', express.static(uploadPath, {
  dotfiles: 'deny',
  fallthrough: false,
  immutable: true,
  maxAge: '7d',
  setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
}));

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      success: true,
      data: {
        service: 'core-service',
        database: 'connected'
      }
    });
  } catch (_error) {
    res.status(503).json({
      success: false,
      data: {
        service: 'core-service',
        database: 'unavailable'
      }
    });
  }
});

app.use('/api/auth/login', authRateLimiter);
app.use('/api/public', publicOrderRateLimiter);
app.use('/api', apiRateLimiter, apiRoutes);

app.use(notFound);
app.use(errorHandler);
