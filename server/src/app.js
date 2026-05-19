import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

export const app = express();

const configuredClient = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = new Set(
  configuredClient
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
allowedOrigins.add('https://digit-pos.vercel.app');
allowedOrigins.add('https://digit-restaurant-pos.vercel.app');
allowedOrigins.add('http://localhost:5173');
allowedOrigins.add('http://127.0.0.1:5173');
allowedOrigins.add('http://[::1]:5173');
const vercelPreviewPattern = /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin) || vercelPreviewPattern.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadPath = path.resolve(__dirname, 'uploads');
app.use('/uploads', express.static(uploadPath));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);
