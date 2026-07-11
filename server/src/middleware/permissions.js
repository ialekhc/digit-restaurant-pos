import { ApiError } from '../utils/ApiError.js';
import {
  getApprovalLimits,
  getRoleLevel,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  resolveUserAccess
} from '../services/permissionService.js';

const forbidden = (res, details = {}) =>
  res.status(403).json({
    success: false,
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
    ...details
  });

const getRequestValue = (req, keys) => {
  for (const key of keys) {
    const value = req.params?.[key] ?? req.body?.[key] ?? req.query?.[key];
    if (value) return String(value);
  }
  return null;
};

export const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  if (!hasPermission(req.user, permission)) return forbidden(res, { requiredPermission: permission });
  next();
};

export const requireAnyPermission = (permissions = []) => (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  if (!hasAnyPermission(req.user, permissions)) return forbidden(res, { requiredAnyPermission: permissions });
  next();
};

export const requireAllPermissions = (permissions = []) => (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  if (!hasAllPermissions(req.user, permissions)) return forbidden(res, { requiredPermissions: permissions });
  next();
};

export const requireRestaurantAccess = (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const access = resolveUserAccess(req.user);
  const restaurantId = getRequestValue(req, ['restaurantId', 'tenantId']);
  if (restaurantId && access.restaurantId && String(access.restaurantId) !== restaurantId && !hasPermission(req.user, 'platform.manage')) {
    return forbidden(res, { requiredScope: 'restaurant', restaurantId });
  }
  next();
};

export const requireBranchAccess = (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const access = resolveUserAccess(req.user);
  const branchId = getRequestValue(req, ['branchId']);
  if (branchId && access.branchIds.length && !access.branchIds.includes(branchId) && !hasPermission(req.user, 'platform.manage')) {
    return forbidden(res, { requiredScope: 'branch', branchId });
  }
  next();
};

export const requireRoleLevel = (minimumRoleOrLevel) => (req, res, next) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized');
  const minimumLevel = typeof minimumRoleOrLevel === 'number' ? minimumRoleOrLevel : getRoleLevel(minimumRoleOrLevel);
  if (getRoleLevel(req.user.role) < minimumLevel) return forbidden(res, { requiredRoleLevel: minimumLevel });
  next();
};

export const requireDiscountLimit = (field = 'discountPercent') => (req, res, next) => {
  const requested = Number(req.body?.[field] || 0);
  const { discountLimitPercent } = getApprovalLimits(req.user || {});
  if (requested > discountLimitPercent) return forbidden(res, { limit: discountLimitPercent, requested });
  next();
};

export const requireRefundLimit = (field = 'amount') => (req, res, next) => {
  const requested = Number(req.body?.[field] || 0);
  const { refundLimitAmount } = getApprovalLimits(req.user || {});
  if (requested > refundLimitAmount) return forbidden(res, { limit: refundLimitAmount, requested });
  next();
};

export const requireVoidLimit = (field = 'amount') => (req, res, next) => {
  const requested = Number(req.body?.[field] || 0);
  const { voidLimitAmount } = getApprovalLimits(req.user || {});
  if (requested > voidLimitAmount) return forbidden(res, { limit: voidLimitAmount, requested });
  next();
};
