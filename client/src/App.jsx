import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import { PERMISSIONS } from './utils/constants';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const CustomerQrOrderPage = lazy(() => import('./pages/CustomerQrOrderPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const MenuCategoriesPage = lazy(() => import('./pages/MenuCategoriesPage'));
const MenuItemsPage = lazy(() => import('./pages/MenuItemsPage'));
const DrinkItemsPage = lazy(() => import('./pages/DrinkItemsPage'));
const SmokeItemsPage = lazy(() => import('./pages/SmokeItemsPage'));
const TablesPage = lazy(() => import('./pages/TablesPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderCreatePage = lazy(() => import('./pages/OrderCreatePage'));
const KitchenPage = lazy(() => import('./pages/KitchenPage'));
const BarDisplayPage = lazy(() => import('./pages/BarDisplayPage'));
const SmokeDisplayPage = lazy(() => import('./pages/SmokeDisplayPage'));
const BillingPage = lazy(() => import('./pages/BillingPage'));
const RegisterDashboardPage = lazy(() => import('./pages/RegisterDashboardPage'));
const CashRegisterPage = lazy(() => import('./pages/CashRegisterPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const PurchaseFlowPage = lazy(() => import('./pages/PurchaseFlowPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PrintStationPage = lazy(() => import('./pages/PrintStationPage'));
const SuperAdminDashboardPage = lazy(() => import('./pages/SuperAdminDashboardPage'));
const SuperAdminVendorsPage = lazy(() => import('./pages/SuperAdminVendorsPage'));
const SuperAdminSubscriptionsPage = lazy(() => import('./pages/SuperAdminSubscriptionsPage'));
const SuperAdminPlansPage = lazy(() => import('./pages/SuperAdminPlansPage'));
const SuperAdminUsersPage = lazy(() => import('./pages/SuperAdminUsersPage'));
const SuperAdminSettingsPage = lazy(() => import('./pages/SuperAdminSettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const RouteLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-600">
    Loading Digit POS…
  </div>
);

const App = () => {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/scan/:tableId" element={<CustomerQrOrderPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route element={<ProtectedRoute anyPermissions={[PERMISSIONS.PLATFORM_VIEW, PERMISSIONS.PLATFORM_MANAGE]} />}>
            <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
            <Route path="/super-admin/dashboard" element={<SuperAdminDashboardPage />} />
            <Route path="/super-admin/vendors" element={<SuperAdminVendorsPage />} />
            <Route path="/super-admin/subscriptions" element={<SuperAdminSubscriptionsPage />} />
            <Route path="/super-admin/plans" element={<SuperAdminPlansPage />} />
            <Route path="/super-admin/users" element={<SuperAdminUsersPage />} />
            <Route path="/super-admin/settings" element={<SuperAdminSettingsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.DASHBOARD_VIEW} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.USER_VIEW} />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>

          <Route element={<ProtectedRoute anyPermissions={[PERMISSIONS.MENU_VIEW, PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.SUPPLIER_VIEW, PERMISSIONS.PURCHASE_VIEW]} />}>
            <Route path="/menu/categories" element={<MenuCategoriesPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/purchase-in" element={<PurchaseFlowPage />} />
            <Route path="/purchase-out" element={<PurchaseFlowPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.MENU_VIEW} />}>
            <Route path="/menu/items" element={<MenuItemsPage />} />
            <Route path="/drink/items" element={<DrinkItemsPage />} />
            <Route path="/smoke/items" element={<SmokeItemsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.TABLE_VIEW} />}>
            <Route path="/tables" element={<TablesPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.ORDER_CREATE} />}>
            <Route path="/orders/create" element={<OrderCreatePage />} />
          </Route>

          <Route element={<ProtectedRoute anyPermissions={[PERMISSIONS.ORDER_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS]} />}>
            <Route path="/orders" element={<OrdersPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.KITCHEN_VIEW_ORDERS} />}>
            <Route path="/kitchen" element={<KitchenPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.KITCHEN_VIEW_ORDERS} />}>
            <Route path="/bar" element={<BarDisplayPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.KITCHEN_VIEW_ORDERS} />}>
            <Route path="/smoke-display" element={<SmokeDisplayPage />} />
          </Route>

          <Route element={<ProtectedRoute anyPermissions={[PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.CASH_REGISTER_VIEW, PERMISSIONS.REPORT_OWN_SHIFT, PERMISSIONS.REPORT_BRANCH_SALES]} />}>
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/register-dashboard" element={<RegisterDashboardPage />} />
            <Route path="/cash-register" element={<CashRegisterPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>

          <Route element={<ProtectedRoute permission={PERMISSIONS.CUSTOMER_VIEW} />}>
            <Route path="/customers" element={<CustomersPage />} />
          </Route>

          <Route element={<ProtectedRoute anyPermissions={[PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.ORDER_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS]} />}>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/print-station" element={<PrintStationPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
      </Routes>
    </Suspense>
  );
};

export default App;
