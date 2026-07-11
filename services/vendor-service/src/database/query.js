import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../server/.env') });

export const pool = new Pool({
  connectionString: process.env.VENDOR_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS || 30000),
  query_timeout: Number(process.env.DATABASE_QUERY_TIMEOUT_MS || 30000)
});

export const query = (text, params = []) => pool.query(text, params);
export const closePool = async () => pool.end();
