import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import CustomerQrOrderPage from './pages/CustomerQrOrderPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import MenuCategoriesPage from './pages/MenuCategoriesPage';
import MenuItemsPage from './pages/MenuItemsPage';
import TablesPage from './pages/TablesPage';
import OrdersPage from './pages/OrdersPage';
import OrderCreatePage from './pages/OrderCreatePage';
import KitchenPage from './pages/KitchenPage';
import BillingPage from './pages/BillingPage';
import InventoryPage from './pages/InventoryPage';
import PurchaseFlowPage from './pages/PurchaseFlowPage';
import SuppliersPage from './pages/SuppliersPage';
import CustomersPage from './pages/CustomersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import SuperAdminDashboardPage from './pages/SuperAdminDashboardPage';
import SuperAdminVendorsPage from './pages/SuperAdminVendorsPage';
import SuperAdminSubscriptionsPage from './pages/SuperAdminSubscriptionsPage';
import SuperAdminPlansPage from './pages/SuperAdminPlansPage';
import SuperAdminUsersPage from './pages/SuperAdminUsersPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuth } from './hooks/useAuth';
import { ROLES, getDefaultRouteForRole } from './utils/constants';

const allStaff = [
  ROLES.SUPER_ADMIN,
  ROLES.RESTAURANT_OWNER,
  ROLES.ADMIN,
  ROLES.MANAGER,
  ROLES.CASHIER,
  ROLES.WAITER,
  ROLES.KITCHEN
];

const RoleHomeRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
};

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/scan/:tableId" element={<CustomerQrOrderPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<RoleHomeRedirect />} />

          <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
            <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
            <Route path="/super-admin/dashboard" element={<SuperAdminDashboardPage />} />
            <Route path="/super-admin/vendors" element={<SuperAdminVendorsPage />} />
            <Route path="/super-admin/subscriptions" element={<SuperAdminSubscriptionsPage />} />
            <Route path="/super-admin/plans" element={<SuperAdminPlansPage />} />
            <Route path="/super-admin/users" element={<SuperAdminUsersPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.RESTAURANT_OWNER]} />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER]} />}>
            <Route path="/menu/categories" element={<MenuCategoriesPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/purchase-in" element={<PurchaseFlowPage />} />
            <Route path="/purchase-out" element={<PurchaseFlowPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER]} />}>
            <Route path="/menu/items" element={<MenuItemsPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/orders/create" element={<OrderCreatePage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={allStaff} />}>
            <Route path="/orders" element={<OrdersPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.KITCHEN]} />}>
            <Route path="/kitchen" element={<KitchenPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER]} />}>
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route
            element={<ProtectedRoute allowedRoles={[ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER, ROLES.CASHIER]} />}
          >
            <Route path="/customers" element={<CustomersPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={allStaff} />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default App;
