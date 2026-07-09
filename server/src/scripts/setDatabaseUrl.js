import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Missing DATABASE_URL environment variable.');
  console.error('Example: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/restaurant_pos" npm run db:use');
  process.exit(1);
}

if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
  console.error('DATABASE_URL must start with postgres:// or postgresql://');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
const envExamplePath = path.resolve(__dirname, '../../.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
  } else {
    fs.writeFileSync(envPath, '', 'utf8');
  }
}

const current = fs.readFileSync(envPath, 'utf8');
const next = /^DATABASE_URL=/m.test(current)
  ? current.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${databaseUrl}`)
  : `${current.trim()}\nDATABASE_URL=${databaseUrl}\n`;

fs.writeFileSync(envPath, `${next.replace(/\n{3,}/g, '\n\n').trim()}\n`, 'utf8');
console.log(`PostgreSQL database URL saved to ${envPath}`);
