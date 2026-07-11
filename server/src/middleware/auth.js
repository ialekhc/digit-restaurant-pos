import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { PERMISSIONS } from '../config/constants.js';
import { hasPermission } from '../services/permissionService.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Unauthorized: token missing');
  }

  const token = authHeader.split(' ')[1];
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new ApiError(401, 'Unauthorized: invalid token');
  }

  const user = await User.findById(decoded.id).select('-password');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Unauthorized: user not found or inactive');
  }

  req.user = user;
  next();
});

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Unauthorized');
    }

    if (hasPermission(req.user, PERMISSIONS.PLATFORM_MANAGE)) {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, 'Forbidden: insufficient permissions');
    }

    next();
  };
};
