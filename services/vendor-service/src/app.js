import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import vendorRoutes from './routes/vendors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'vendor-service',
    architecture: 'layered-service-repository',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/vendors', vendorRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
