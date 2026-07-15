import crypto from 'crypto';

const nowIso = () => new Date().toISOString();

export const requestContext = (req, res, next) => {
  const inboundRequestId = req.headers['x-request-id'];
  const requestId = Array.isArray(inboundRequestId) ? inboundRequestId[0] : inboundRequestId;
  req.requestId = requestId || crypto.randomUUID();
  req.startedAt = Date.now();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

export const requestLogger = (req, res, next) => {
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;

    const durationMs = Date.now() - (req.startedAt || Date.now());
    const user = req.user
      ? {
          id: req.user._id,
          role: req.user.role,
          restaurantId: req.user.restaurantId || null
        }
      : null;

    const log = {
      timestamp: nowIso(),
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      user
    };

    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    console[level](JSON.stringify(log));
  });

  next();
};
