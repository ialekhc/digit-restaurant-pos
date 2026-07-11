import { ApiError } from '../utils/ApiError.js';
import { hasPermission, resolveUserAccess } from '../services/permissionService.js';

export const buildRestaurantScope = (user, restaurantId) => {
  const access = resolveUserAccess(user);
  if (hasPermission(user, 'platform.manage') || hasPermission(user, 'platform.view')) {
    return { restaurantId: restaurantId || access.restaurantId || null, branchIds: access.branchIds };
  }
  if (!access.restaurantId) throw new ApiError(403, 'Restaurant access is not assigned');
  if (restaurantId && String(restaurantId) !== String(access.restaurantId)) {
    throw new ApiError(403, 'Restaurant access denied');
  }
  return { restaurantId: access.restaurantId, branchIds: access.branchIds };
};

export const buildBranchScope = (user, restaurantId, branchId) => {
  const scope = buildRestaurantScope(user, restaurantId);
  if (hasPermission(user, 'platform.manage') || hasPermission(user, 'platform.view')) {
    return { ...scope, branchId: branchId || null };
  }
  if (branchId && scope.branchIds.length && !scope.branchIds.includes(String(branchId))) {
    throw new ApiError(403, 'Branch access denied');
  }
  return { ...scope, branchId: branchId || null };
};

export const assertRestaurantAccess = (user, restaurantId) => buildRestaurantScope(user, restaurantId);
export const assertBranchAccess = (user, restaurantId, branchId) => buildBranchScope(user, restaurantId, branchId);

export const branchFilter = (branchIds = [], startIndex = 1) => {
  if (!branchIds.length) return { sql: '', params: [] };
  return { sql: ` AND branch_id = ANY($${startIndex}::uuid[])`, params: [branchIds] };
};
