export const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}`, requestId: req.id });
};

export const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message = isProduction && statusCode >= 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error');

  if (statusCode >= 500) {
    console.error('[request-error]', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      message: err.message,
      ...(isProduction ? {} : { stack: err.stack })
    });
  }

  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON payload', requestId: req.id });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => e.message),
      requestId: req.id
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      message: 'Duplicate value error',
      field: Object.keys(err.keyValue || {})[0],
      requestId: req.id
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format', requestId: req.id });
  }

  res.status(statusCode).json({
    message,
    requestId: req.id,
    ...(!isProduction ? { stack: err.stack } : {})
  });
};
