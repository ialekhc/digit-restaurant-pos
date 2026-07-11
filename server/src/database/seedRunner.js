import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { closePool } from './query.js';
import { withTransaction } from './transaction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, 'seeds');

const run = async () => {
  const files = (await fs.readdir(seedsDir)).filter((file) => file.endsWith('.js')).sort();
  for (const file of files) {
    const seed = await import(pathToFileURL(path.join(seedsDir, file)).href);
    await withTransaction(async (client) => seed.run(client));
    console.log(`[core-db] seeded ${file}`);
  }
};

try {
  await run();
} finally {
  await closePool();
}
