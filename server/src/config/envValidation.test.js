import assert from 'node:assert/strict';
import test from 'node:test';
import { validateEnvironment } from './envValidation.js';

const managedKeys = ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'PORT', 'CLIENT_URL', 'CORS_ORIGINS', 'ALLOW_NULL_ORIGIN'];

const withEnvironment = (values, callback) => {
  const previous = Object.fromEntries(managedKeys.map((key) => [key, process.env[key]]));
  for (const key of managedKeys) delete process.env[key];
  Object.assign(process.env, values);

  try {
    return callback();
  } finally {
    for (const key of managedKeys) {
      if (typeof previous[key] === 'undefined') delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

test('production rejects a placeholder JWT secret', () => {
  withEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:password@db.example/app',
    JWT_SECRET: 'replace-with-a-strong-random-secret',
    CLIENT_URL: 'https://pos.example.com'
  }, () => assert.throws(() => validateEnvironment(), /unique production secret/));
});

test('production requires an explicit allowed origin', () => {
  withEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:password@db.example/app',
    JWT_SECRET: 'a-secure-random-production-secret-with-entropy'
  }, () => assert.throws(() => validateEnvironment(), /Production requires/));
});

test('valid production configuration is normalized', () => {
  withEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:password@db.example/app',
    JWT_SECRET: 'a-secure-random-production-secret-with-entropy',
    CORS_ORIGINS: 'https://pos.example.com',
    PORT: '5500'
  }, () => {
    const config = validateEnvironment();
    assert.equal(config.NODE_ENV, 'production');
    assert.equal(config.PORT, '5500');
    assert.equal(config.DATABASE_URL, 'post.../app');
  });
});
