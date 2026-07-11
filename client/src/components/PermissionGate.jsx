import { usePermissions } from '../hooks/usePermissions';

const PermissionGate = ({ permission, anyPermissions, allPermissions, fallback = null, children }) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const allowed = permission
    ? hasPermission(permission)
    : anyPermissions
      ? hasAnyPermission(anyPermissions)
      : allPermissions
        ? hasAllPermissions(allPermissions)
        : true;

  return allowed ? children : fallback;
};

export default PermissionGate;
