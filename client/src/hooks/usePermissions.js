import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { ROLE_PERMISSIONS } from '../utils/constants';

const unique = (values = []) => [...new Set(values.filter(Boolean))];
const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export const resolveClientPermissions = (user) => {
  if (!user) return [];
  return unique(user.permissions?.length ? user.permissions : ROLE_PERMISSIONS[user.role] || []);
};

export const usePermissions = () => {
  const { user } = useAuth();

  return useMemo(() => {
    const permissions = resolveClientPermissions(user);
    const permissionSet = new Set(permissions);
    const branchIds = asArray(user?.accessScope?.branchIds || user?.branchIds).map(String);

    return {
      permissions,
      hasPermission: (permission) => !permission || permissionSet.has(permission),
      hasAnyPermission: (required = []) => {
        const items = asArray(required);
        return !items.length || items.some((permission) => permissionSet.has(permission));
      },
      hasAllPermissions: (required = []) => {
        const items = asArray(required);
        return !items.length || items.every((permission) => permissionSet.has(permission));
      },
      canAccessBranch: (branchId) => !branchId || !branchIds.length || branchIds.includes(String(branchId)),
      limits: user?.limits || {},
      accessScope: user?.accessScope || { restaurantId: user?.restaurantId || null, branchIds }
    };
  }, [user]);
};
