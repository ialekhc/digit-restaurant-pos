import { pool } from '../database/query.js';

export { pool };

export const connectPostgres = async () => {
  if (!process.env.DATABASE_URL && !EnvExt.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in environment variables');
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('SELECT 1');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_documents (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (collection, id)
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_app_documents_collection ON app_documents (collection)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_app_documents_data ON app_documents USING GIN (data)');
    console.log('PostgreSQL connected');
  } catch (error) {
    const code = error?.code || error?.errors?.[0]?.code;
    if (code === 'ECONNREFUSED') {
      throw new Error('PostgreSQL is not reachable. Start Postgres or update DATABASE_URL in server/.env.');
    }
    if (code === 'EPERM') {
      throw new Error('PostgreSQL connection was blocked by local permissions. Run outside the sandbox or check local security settings.');
    }
    throw error;
  } finally {
    client?.release();
  }
};
