import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { getDefaultRouteForRole } from '../utils/constants';

const ProtectedRoute = ({ allowedRoles, permission, anyPermissions, allPermissions }) => {
  const { isAuthenticated, user } = useAuth();
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  const roleAllowed = !allowedRoles?.length || allowedRoles.includes(user?.role);
  const permissionAllowed = permission
    ? hasPermission(permission)
    : anyPermissions?.length
      ? hasAnyPermission(anyPermissions)
      : allPermissions?.length
        ? hasAllPermissions(allPermissions)
        : true;

  if (!roleAllowed || !permissionAllowed) {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
