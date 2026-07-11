import { ALL_PERMISSIONS, APPROVAL_LIMIT_DEFAULTS, ROLE_LEVELS, ROLE_PERMISSIONS, ROLES } from '../config/constants.js';

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value];
};

const normalizeNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const getDefaultPermissions = (role) => unique(ROLE_PERMISSIONS[role] || []);

export const getRoleLevel = (role) => ROLE_LEVELS[role] || 0;

export const getApprovalLimits = (user = {}) => {
  const defaults = APPROVAL_LIMIT_DEFAULTS[user.role] || { discountLimitPercent: 0, refundLimitAmount: 0, voidLimitAmount: 0 };
  return {
    discountLimitPercent: normalizeNumber(user.discountLimitPercent, defaults.discountLimitPercent),
    refundLimitAmount: normalizeNumber(user.refundLimitAmount, defaults.refundLimitAmount),
    voidLimitAmount: normalizeNumber(user.voidLimitAmount, defaults.voidLimitAmount)
  };
};

export const resolveUserAccess = (user = {}) => {
  const base = getDefaultPermissions(user.role);
  const additional = normalizeArray(user.additionalPermissions).filter((permission) => ALL_PERMISSIONS.includes(permission));
  const denied = new Set(normalizeArray(user.deniedPermissions));
  const permissions = unique([...base, ...additional]).filter((permission) => !denied.has(permission));

  return {
    userId: user._id,
    role: user.role,
    restaurantId: user.restaurantId || user.ownerUser || null,
    branchIds: normalizeArray(user.branchIds).map(String),
    permissions,
    additionalPermissions: additional,
    deniedPermissions: [...denied],
    limits: getApprovalLimits(user)
  };
};

export const hasPermission = (user, permission) => {
  if (!permission) return true;
  return resolveUserAccess(user).permissions.includes(permission);
};

export const hasAnyPermission = (user, permissions = []) => {
  const required = normalizeArray(permissions);
  if (!required.length) return true;
  const effective = new Set(resolveUserAccess(user).permissions);
  return required.some((permission) => effective.has(permission));
};

export const hasAllPermissions = (user, permissions = []) => {
  const required = normalizeArray(permissions);
  if (!required.length) return true;
  const effective = new Set(resolveUserAccess(user).permissions);
  return required.every((permission) => effective.has(permission));
};

export const canAssignRole = (actor, targetRole) => {
  if (!targetRole) return true;
  if (actor?.role === ROLES.SUPER_ADMIN) return true;
  if ([ROLES.SUPER_ADMIN, ROLES.RESTAURANT_OWNER].includes(targetRole)) return false;
  return getRoleLevel(actor?.role) > getRoleLevel(targetRole);
};

export const buildPublicUser = (user = {}) => {
  const access = resolveUserAccess(user);
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    isActive: user.isActive,
    ownerUser: user.ownerUser || null,
    restaurantId: access.restaurantId,
    branchIds: access.branchIds,
    permissions: access.permissions,
    additionalPermissions: access.additionalPermissions,
    deniedPermissions: access.deniedPermissions,
    limits: access.limits,
    accessScope: {
      restaurantId: access.restaurantId,
      branchIds: access.branchIds
    },
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

export const describePermissionRegistry = () => ({
  permissions: ALL_PERMISSIONS.map((permission) => {
    const [module, action] = permission.split('.');
    return { key: permission, module, action };
  }),
  roles: Object.keys(ROLE_PERMISSIONS).map((role) => ({
    role,
    level: getRoleLevel(role),
    permissions: getDefaultPermissions(role),
    limits: APPROVAL_LIMIT_DEFAULTS[role] || null
  }))
});
