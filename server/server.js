import 'dotenv/config';
import { app } from './src/app.js';
import { connectDB } from './src/config/db.js';
import { validateEnvironment } from './src/config/envValidation.js';
import { closePool } from './src/database/query.js';
import { EnvExt } from './src/EnvironmentExt.js';

const PORT = EnvExt.PORT || 5500;
const HOST = process.env.HOST || '0.0.0.0';
let server;
let shuttingDown = false;

const start = async () => {
  const environment = validateEnvironment();
  console.log('[startup]', environment);
  await connectDB();

  server = app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Update PORT in server/.env and restart.`);
      process.exit(1);
    }
    throw error;
  });
};

const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal}`);

  const forceExit = setTimeout(() => {
    console.error('[shutdown] Forced exit after timeout');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closePool();
  clearTimeout(forceExit);
  process.exit(exitCode);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  console.error('[process] Unhandled rejection', error);
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  console.error('[process] Uncaught exception', error);
  shutdown('uncaughtException', 1);
});

start().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
