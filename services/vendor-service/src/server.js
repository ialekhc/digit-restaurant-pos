import 'dotenv/config';
import { app } from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5601;

const start = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Vendor Service running on http://localhost:${PORT}`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Update PORT in services/vendor-service/.env and restart.`);
      process.exit(1);
    }
    throw error;
  });
};

start().catch((error) => {
  console.error('Failed to start vendor service', error);
  process.exit(1);
});
