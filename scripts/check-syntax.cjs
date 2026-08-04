const { readdirSync, statSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const roots = ['desktop', 'server/src', 'server/server.js', 'scripts'];
const extensions = new Set(['.js', '.cjs', '.mjs']);
const excludedDirectories = new Set(['node_modules', 'dist', 'release', 'coverage']);

const collect = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  const stat = statSync(absolutePath);
  if (stat.isFile()) return extensions.has(path.extname(absolutePath)) ? [absolutePath] : [];

  return readdirSync(absolutePath).flatMap((entry) => {
    if (excludedDirectories.has(entry)) return [];
    return collect(path.join(relativePath, entry));
  });
};

const files = roots.flatMap(collect);
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push({ file: path.relative(root, file), error: result.stderr.trim() });
}

if (failures.length) {
  for (const failure of failures) console.error(`${failure.file}\n${failure.error}`);
  process.exit(1);
}

console.log(`Syntax check passed (${files.length} files)`);
