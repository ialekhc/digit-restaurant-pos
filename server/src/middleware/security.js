import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const configuredOrigins = () => {
  const values = [process.env.CORS_ORIGINS, process.env.CLIENT_URL]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if ((process.env.NODE_ENV || 'development') !== 'production') {
    values.push(
      'http://localhost:5400',
      'http://127.0.0.1:5400',
      'http://localhost:3005',
      'http://127.0.0.1:3005'
    );
  }

  return new Set(values);
};

export const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');
    const allowOpaqueOrigin =
      normalizedOrigin === 'null' &&
      (process.env.ALLOW_NULL_ORIGIN === 'true' || (process.env.NODE_ENV || 'development') !== 'production');

    if (allowOpaqueOrigin || configuredOrigins().has(normalizedOrigin)) {
      return callback(null, true);
    }

    const error = new Error('Origin is not allowed by the CORS policy');
    error.statusCode = 403;
    return callback(error);
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400
};

export const requestContext = (req, res, next) => {
  const requestId = req.get('X-Request-ID')?.trim().slice(0, 128) || crypto.randomUUID();
  req.id = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

const rateLimitHandler = (message) => (req, res) => {
  res.status(429).json({ message, requestId: req.id });
};

const commonRateLimitOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
};

export const apiRateLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: positiveInteger(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: positiveInteger(process.env.API_RATE_LIMIT_MAX, 1000),
  handler: rateLimitHandler('Too many requests. Please try again shortly.')
});

export const authRateLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: positiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: positiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 10),
  skipSuccessfulRequests: true,
  handler: rateLimitHandler('Too many login attempts. Please try again later.')
});

export const publicOrderRateLimiter = rateLimit({
  ...commonRateLimitOptions,
  windowMs: positiveInteger(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS, 5 * 60 * 1000),
  limit: positiveInteger(process.env.PUBLIC_RATE_LIMIT_MAX, 60),
  handler: rateLimitHandler('Too many public requests. Please try again shortly.')
});
