const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];
const requiredFiles = [
  'build/icon.ico',
  'client/package-lock.json',
  'server/package-lock.json',
  'client/dist/index.html'
];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(`Missing release file: ${relativePath}`);
}

if (!process.env.CSC_LINK) failures.push('CSC_LINK must point to the Windows code-signing certificate.');
if (!process.env.CSC_KEY_PASSWORD) failures.push('CSC_KEY_PASSWORD is required for the signing certificate.');

const configuredApi = process.env.DIGIT_DESKTOP_API_BASE_URL;
if (configuredApi) {
  try {
    const url = new URL(configuredApi);
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (!loopback && url.protocol !== 'https:') failures.push('A remote desktop API must use HTTPS.');
  } catch {
    failures.push('DIGIT_DESKTOP_API_BASE_URL must be a valid URL.');
  }
}

if (failures.length) {
  console.error('Windows release preflight failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Windows release preflight passed.');
