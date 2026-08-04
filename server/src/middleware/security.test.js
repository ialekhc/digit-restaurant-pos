import assert from 'node:assert/strict';
import test from 'node:test';
import { corsOptions, requestContext } from './security.js';

const checkOrigin = (origin) => new Promise((resolve) => {
  corsOptions.origin(origin, (error, allowed) => resolve({ error, allowed }));
});

test('CORS allows requests without an Origin header', async () => {
  const result = await checkOrigin(undefined);
  assert.equal(result.error, null);
  assert.equal(result.allowed, true);
});

test('CORS rejects an unconfigured production origin', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousOrigins = process.env.CORS_ORIGINS;
  const previousClientUrl = process.env.CLIENT_URL;
  process.env.NODE_ENV = 'production';
  process.env.CORS_ORIGINS = 'https://pos.example.com';
  delete process.env.CLIENT_URL;

  try {
    const result = await checkOrigin('https://attacker.example');
    assert.equal(result.allowed, undefined);
    assert.equal(result.error?.statusCode, 403);
  } finally {
    if (typeof previousNodeEnv === 'undefined') delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (typeof previousOrigins === 'undefined') delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigins;
    if (typeof previousClientUrl === 'undefined') delete process.env.CLIENT_URL;
    else process.env.CLIENT_URL = previousClientUrl;
  }
});

test('request context returns a bounded request ID', () => {
  const req = { get: () => 'request-id-from-client' };
  const headers = {};
  const res = {
    locals: {},
    setHeader: (name, value) => { headers[name] = value; }
  };
  let continued = false;

  requestContext(req, res, () => { continued = true; });

  assert.equal(req.id, 'request-id-from-client');
  assert.equal(res.locals.requestId, 'request-id-from-client');
  assert.equal(headers['X-Request-ID'], 'request-id-from-client');
  assert.equal(continued, true);
});
