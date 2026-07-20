const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.cjs'), 'utf8');
const scriptMatch = mainSource.match(/const windowsRawPrintScript = `([\s\S]*?)`;\r?\n/);
if (!scriptMatch) throw new Error('Unable to locate the embedded Windows RAW print script');

const encodedScript = Buffer.from(scriptMatch[1], 'utf16le').toString('base64');
try {
  execFileSync('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', encodedScript
  ], {
    env: {
      ...process.env,
      DIGIT_POS_PRINTER_NAME: '__DIGIT_POS_NON_EXISTENT_PRINTER__',
      DIGIT_POS_PRINT_FILE: __filename
    },
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'pipe'
  });
  throw new Error('RAW print smoke test unexpectedly opened a nonexistent printer');
} catch (error) {
  const output = `${error.stdout || ''}\n${error.stderr || ''}`;
  if (!output.includes('Unable to open Windows printer queue')) throw error;
  console.log('Windows RAW spooler smoke test passed');
}
