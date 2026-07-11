import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import vendorRoutes from './routes/vendors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { query } from './database/query.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      success: true,
      data: {
        service: 'vendor-service',
        database: 'connected'
      }
    });
  } catch (_error) {
    res.status(503).json({
      success: false,
      data: {
        service: 'vendor-service',
        database: 'unavailable'
      }
    });
  }
});

app.use('/api/vendors', vendorRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
