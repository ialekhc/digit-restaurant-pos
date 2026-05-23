import 'dotenv/config';
import { app } from './src/app.js';
import { connectDB } from './src/config/db.js';
import { EnvExt } from './src/EnvironmentExt.js';

const PORT = EnvExt.PORT || 5500;

const start = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Update PORT in server/.env and restart.`);
      process.exit(1);
    }
    throw error;
  });
};

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
