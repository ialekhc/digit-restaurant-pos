import jwt from 'jsonwebtoken';
import { forbidden, unauthorized } from '../utils/HttpError.js';

const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(unauthorized('Unauthorized: token missing'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return next(unauthorized(error?.name === 'TokenExpiredError' ? 'Unauthorized: token expired' : 'Unauthorized: invalid token'));
  }
};

export const authorizeSuperAdmin = (req, res, next) => {
  if (req.user?.role !== SUPER_ADMIN_ROLE) {
    return next(forbidden('Forbidden: super admin only'));
  }
  return next();
};
