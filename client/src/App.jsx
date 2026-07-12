import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import CustomerQrOrderPage from './pages/CustomerQrOrderPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import MenuCategoriesPage from './pages/MenuCategoriesPage';
import MenuItemsPage from './pages/MenuItemsPage';
import DrinkItemsPage from './pages/DrinkItemsPage';
import SmokeItemsPage from './pages/SmokeItemsPage';
import TablesPage from './pages/TablesPage';
import OrdersPage from './pages/OrdersPage';
import OrderCreatePage from './pages/OrderCreatePage';
import KitchenPage from './pages/KitchenPage';
import BarDisplayPage from './pages/BarDisplayPage';
import SmokeDisplayPage from './pages/SmokeDisplayPage';
import BillingPage from './pages/BillingPage';
import RegisterDashboardPage from './pages/RegisterDashboardPage';
import CashRegisterPage from './pages/CashRegisterPage';
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
import { PERMISSIONS } from './utils/constants';

const App = () => {
  return (
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
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default App;
