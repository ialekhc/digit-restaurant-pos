import { HttpError } from '../utils/HttpError.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Not found: ${req.originalUrl}`
  });
};

export const errorHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      details: error.details || undefined
    });
  }

  const statusCode = Number(error?.statusCode || error?.status) || 500;
  const message = error?.message || 'Internal server error';

  if (statusCode >= 500) {
    console.error('[vendor-service] unhandled error', error);
  }

  return res.status(statusCode).json({
    success: false,
    message
  });
};
