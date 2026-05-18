import fs from 'fs';
import path from 'path';

const atlasUri = process.env.ATLAS_URI;
if (!atlasUri) {
  console.error('Missing ATLAS_URI environment variable.');
  console.error('Example: ATLAS_URI="mongodb+srv://user:pass@cluster.mongodb.net/restaurant_pos?retryWrites=true&w=majority" npm run atlas:use');
  process.exit(1);
}

if (!atlasUri.startsWith('mongodb+srv://') && !atlasUri.startsWith('mongodb://')) {
  console.error('ATLAS_URI must start with mongodb+srv:// or mongodb://');
  process.exit(1);
}

const hasPlaceholders =
  atlasUri.includes('<') ||
  atlasUri.includes('>') ||
  atlasUri.includes('xxxxx') ||
  atlasUri.includes('cluster-url');

if (hasPlaceholders) {
  console.error('ATLAS_URI still contains placeholder text.');
  console.error('Use the real host from Atlas Connect > Drivers, e.g. cluster0.ab12c.mongodb.net');
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), '.env');
const envExamplePath = path.resolve(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
  } else {
    fs.writeFileSync(envPath, '', 'utf8');
  }
}

const current = fs.readFileSync(envPath, 'utf8');
const hasMongo = /^MONGO_URI=/m.test(current);

let next;
if (hasMongo) {
  next = current.replace(/^MONGO_URI=.*$/m, `MONGO_URI=${atlasUri}`);
} else {
  next = `${current.trim()}\nMONGO_URI=${atlasUri}\n`;
}

fs.writeFileSync(envPath, `${next.replace(/\n{3,}/g, '\n\n').trim()}\n`, 'utf8');
console.log(`Atlas URI saved to ${envPath}`);
