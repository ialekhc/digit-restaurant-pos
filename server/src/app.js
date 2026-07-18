import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { query } from './database/query.js';

export const app = express();

app.use(cors())
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadPath = process.env.UPLOAD_DIR || path.resolve(__dirname, 'uploads');
fs.mkdirSync(uploadPath, { recursive: true });
app.use('/uploads', express.static(uploadPath));

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

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);
