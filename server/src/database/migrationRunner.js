import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { closePool, query } from './query.js';
import { withTransaction } from './transaction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

const ensureHistory = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const loadMigrations = async () => {
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.js')).sort();
  return Promise.all(
    files.map(async (file) => {
      const migration = await import(pathToFileURL(path.join(migrationsDir, file)).href);
      return { name: migration.name || file.replace(/\.js$/, ''), file, up: migration.up, down: migration.down };
    })
  );
};

export const migrate = async () => {
  const migrations = await loadMigrations();
  await withTransaction(async (client) => ensureHistory(client));
  const executed = new Set((await query('SELECT migration_name FROM schema_migrations')).rows.map((row) => row.migration_name));

  for (const migration of migrations) {
    if (executed.has(migration.name)) continue;
    await withTransaction(async (client) => {
      await migration.up(client);
      await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [migration.name]);
    });
    console.log(`[core-db] migrated ${migration.name}`);
  }
};

export const rollback = async () => {
  await withTransaction(async (client) => ensureHistory(client));
  const { rows } = await query('SELECT migration_name FROM schema_migrations ORDER BY id DESC LIMIT 1');
  if (!rows.length) {
    console.log('[core-db] no migrations to rollback');
    return;
  }
  const migration = (await loadMigrations()).find((item) => item.name === rows[0].migration_name);
  if (!migration?.down) throw new Error(`Down migration not found for ${rows[0].migration_name}`);
  await withTransaction(async (client) => {
    await migration.down(client);
    await client.query('DELETE FROM schema_migrations WHERE migration_name = $1', [migration.name]);
  });
  console.log(`[core-db] rolled back ${migration.name}`);
};

export const status = async () => {
  await withTransaction(async (client) => ensureHistory(client));
  const migrations = await loadMigrations();
  const executed = new Set((await query('SELECT migration_name FROM schema_migrations')).rows.map((row) => row.migration_name));
  migrations.forEach((migration) => {
    console.log(`${executed.has(migration.name) ? 'up' : 'down'} ${migration.name}`);
  });
};

const command = process.argv[2] || 'up';
try {
  if (command === 'up' || command === 'migrate') await migrate();
  else if (command === 'down' || command === 'rollback') await rollback();
  else if (command === 'status') await status();
  else throw new Error(`Unknown migration command: ${command}`);
} finally {
  await closePool();
}
