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
  if (nodeEnv === 'production' && String(process.env.JWT_SECRET).length < 24) {
    throw new Error('JWT_SECRET must be at least 24 characters for production-safe token signing.');
  }
  if (nodeEnv !== 'production' && String(process.env.JWT_SECRET).length < 24) {
    console.warn('[startup] JWT_SECRET is short. Use at least 24 characters before production deployment.');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: process.env.PORT || '5500',
    DATABASE_URL: redact(process.env.DATABASE_URL),
    DATABASE_SSL: process.env.DATABASE_SSL || 'false',
    CLIENT_URL: process.env.CLIENT_URL || ''
  };
};
