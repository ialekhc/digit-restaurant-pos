const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];

const redact = (value = '') => {
  if (!value) return '';
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

export const validateEnvironment = () => {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
  }

  if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = String(process.env.JWT_SECRET);
  const unsafeSecrets = new Set(['replace-with-a-strong-random-secret', 'supersecretkey', 'changeme']);
  if (nodeEnv === 'production' && (jwtSecret.length < 32 || unsafeSecrets.has(jwtSecret.toLowerCase()))) {
    throw new Error('JWT_SECRET must be a unique production secret with at least 32 characters.');
  }
  if (nodeEnv !== 'production' && jwtSecret.length < 24) {
    console.warn('[startup] JWT_SECRET is short. Use at least 24 characters before production deployment.');
  }

  const port = Number.parseInt(process.env.PORT || '5500', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const hasAllowedOrigin = Boolean(process.env.CORS_ORIGINS || process.env.CLIENT_URL || process.env.ALLOW_NULL_ORIGIN === 'true');
  if (nodeEnv === 'production' && !hasAllowedOrigin) {
    throw new Error('Production requires CORS_ORIGINS, CLIENT_URL, or ALLOW_NULL_ORIGIN=true for desktop-only mode.');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: String(port),
    DATABASE_URL: redact(process.env.DATABASE_URL),
    DATABASE_SSL: process.env.DATABASE_SSL || 'false',
    CLIENT_URL: process.env.CLIENT_URL || ''
  };
};
