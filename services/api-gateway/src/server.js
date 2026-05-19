import 'dotenv/config';
import { app } from './app.js';

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Update PORT in services/api-gateway/.env and restart.`);
    process.exit(1);
  }
  throw error;
});
