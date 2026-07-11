import { ALL_PERMISSIONS, ROLE_PERMISSIONS } from '../config/constants.js';
import { describePermissionRegistry, getDefaultPermissions, resolveUserAccess } from '../services/permissionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getPermissions = asyncHandler(async (_req, res) => {
  res.json({ data: describePermissionRegistry().permissions });
});

export const getRoles = asyncHandler(async (_req, res) => {
  res.json({ data: describePermissionRegistry().roles });
});

export const getRolePermissions = asyncHandler(async (req, res) => {
  const role = String(req.params.role || '').toUpperCase();
  res.json({
    data: {
      role,
      permissions: getDefaultPermissions(role),
      known: Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)
    }
  });
});

export const getMyPermissions = asyncHandler(async (req, res) => {
  res.json({ data: resolveUserAccess(req.user).permissions });
});

export const getMyAccessScope = asyncHandler(async (req, res) => {
  const access = resolveUserAccess(req.user);
  res.json({
    data: {
      userId: access.userId,
      role: access.role,
      restaurantId: access.restaurantId,
      branchIds: access.branchIds,
      limits: access.limits
    }
  });
});

export const getPermissionRegistrySummary = asyncHandler(async (_req, res) => {
  res.json({ data: { count: ALL_PERMISSIONS.length, permissions: ALL_PERMISSIONS } });
});
