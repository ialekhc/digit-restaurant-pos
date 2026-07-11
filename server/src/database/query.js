import { Pool } from 'pg';
import { EnvExt } from '../EnvironmentExt.js';

const connectionString = process.env.CORE_DATABASE_URL || process.env.DATABASE_URL || EnvExt.DATABASE_URL;
const sslFlag = process.env.DATABASE_SSL || EnvExt.DATABASE_SSL;

export const pool = new Pool({
  connectionString,
  ssl: sslFlag === 'true' ? { rejectUnauthorized: false } : undefined,
  statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 30000),
  query_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT_MS || 30000)
});

export const query = (text, params = []) => pool.query(text, params);

export const closePool = async () => pool.end();
