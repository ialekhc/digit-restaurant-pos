const { spawn } = require('node:child_process');

const services = [
  { name: 'core-service', command: ['npm', 'run', 'dev:server'] },
  { name: 'vendor-service', command: ['npm', 'run', 'dev:vendor-service'] },
  { name: 'api-gateway', command: ['npm', 'run', 'dev:gateway'] }
];

const processes = [];
let shuttingDown = false;

const killAll = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  processes.forEach(({ child }) => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
  setTimeout(() => process.exit(0), 150);
};

services.forEach((service) => {
  const [cmd, ...args] = service.command;
  const child = spawn(cmd, args, {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  });

  const prefix = `[${service.name}]`;

  child.stdout.on('data', (data) => {
    process.stdout.write(`${prefix} ${String(data)}`);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(`${prefix} ${String(data)}`);
  });

  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      process.stderr.write(`${prefix} exited with code ${code}\n`);
      killAll();
    }
  });

  processes.push({ service, child });
});

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);
