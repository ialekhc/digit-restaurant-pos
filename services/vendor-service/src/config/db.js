import { connectPostgres } from '../../../../server/src/config/postgres.js';

export const connectDB = async () => {
  await connectPostgres();
  console.log('[vendor-service] PostgreSQL connected');
};
