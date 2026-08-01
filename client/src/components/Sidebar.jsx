import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { planService } from '../api/services';
import { FEATURE_KEYS, PERMISSIONS } from '../utils/constants';
import { usePermissions } from '../hooks/usePermissions';
import { getReceiptSettings, RECEIPT_SETTINGS_EVENT, RECEIPT_SETTINGS_KEY } from '../utils/receiptSettings';

const navItems = [
  { path: '/super-admin/dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_VIEW] },
  { path: '/super-admin/vendors', label: 'Vendors', icon: 'vendors', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE] },
  { path: '/super-admin/subscriptions', label: 'Subscriptions', icon: 'subscription', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE] },
  { path: '/super-admin/plans', label: 'Plans & Features', icon: 'plans', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE] },
  { path: '/super-admin/users', label: 'Users', icon: 'users', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_VIEW] },
  { path: '/super-admin/settings', label: 'Settings', icon: 'settings', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_VIEW] },
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Overview', anyPermissions: [PERMISSIONS.DASHBOARD_VIEW], featureKey: FEATURE_KEYS.DASHBOARD_OVERVIEW },
  { path: '/orders', label: 'Orders', icon: 'orders', group: 'Operations', anyPermissions: [PERMISSIONS.ORDER_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS], featureKey: FEATURE_KEYS.ORDER_HISTORY },
  { path: '/orders/create', label: 'Create Order', icon: 'create', group: 'Operations', anyPermissions: [PERMISSIONS.ORDER_CREATE], featureKey: FEATURE_KEYS.ORDER_HISTORY },
  { path: '/kitchen', label: 'Kitchen Display', icon: 'kitchen', group: 'Operations', anyPermissions: [PERMISSIONS.KITCHEN_VIEW_ORDERS], featureKey: FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM },
  { path: '/bar', label: 'Bar Display', icon: 'bar', group: 'Operations', anyPermissions: [PERMISSIONS.KITCHEN_VIEW_ORDERS], featureKey: FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM },
  { path: '/smoke-display', label: 'Smoke Display', icon: 'smoke', group: 'Operations', anyPermissions: [PERMISSIONS.KITCHEN_VIEW_ORDERS], featureKey: FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM },
  { path: '/print-station', label: 'Print Station', icon: 'printer', group: 'Operations', anyPermissions: [PERMISSIONS.KITCHEN_VIEW_ORDERS, PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.ORDER_VIEW], featureKey: FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM },
  { path: '/billing', label: 'Billing', icon: 'billing', group: 'Billing', anyPermissions: [PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_COLLECT], featureKey: FEATURE_KEYS.BASIC_BILLING },
  { path: '/purchase-in', label: 'Purchase In', icon: 'purchaseIn', group: 'Billing', anyPermissions: [PERMISSIONS.PURCHASE_VIEW, PERMISSIONS.PURCHASE_CREATE], featureKey: FEATURE_KEYS.INVENTORY_MANAGEMENT },
  { path: '/purchase-out', label: 'Purchase Out', icon: 'purchaseOut', group: 'Billing', anyPermissions: [PERMISSIONS.PURCHASE_VIEW, PERMISSIONS.PURCHASE_CREATE], featureKey: FEATURE_KEYS.INVENTORY_MANAGEMENT },
  { path: '/tables', label: 'Tables', icon: 'tables', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.TABLE_VIEW], featureKey: FEATURE_KEYS.TABLE_MANAGEMENT },
  { path: '/menu/categories', label: 'Menu Categories', icon: 'categories', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.MENU_VIEW], featureKey: FEATURE_KEYS.CATEGORY_MANAGEMENT },
  { path: '/menu/items', label: 'Menu Items', icon: 'menu', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.MENU_VIEW], featureKey: FEATURE_KEYS.MENU_MANAGEMENT },
  { path: '/drink/items', label: 'Drink Items', icon: 'drink', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.MENU_VIEW], featureKey: FEATURE_KEYS.MENU_MANAGEMENT },
  { path: '/smoke/items', label: 'Smoke Items', icon: 'smoke', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.MENU_VIEW], featureKey: FEATURE_KEYS.MENU_MANAGEMENT },
  { path: '/combo-platter/items', label: 'Combo Platter Items', icon: 'menu', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.MENU_VIEW], featureKey: FEATURE_KEYS.MENU_MANAGEMENT },
  { path: '/inventory', label: 'Inventory', icon: 'inventory', group: 'Resources', anyPermissions: [PERMISSIONS.INVENTORY_VIEW], featureKey: FEATURE_KEYS.INVENTORY_MANAGEMENT },
  { path: '/suppliers', label: 'Suppliers', icon: 'suppliers', group: 'Resources', anyPermissions: [PERMISSIONS.SUPPLIER_VIEW], featureKey: FEATURE_KEYS.SUPPLIER_MANAGEMENT },
  { path: '/customers', label: 'Customers', icon: 'customers', group: 'Resources', anyPermissions: [PERMISSIONS.CUSTOMER_VIEW], featureKey: FEATURE_KEYS.CUSTOMER_MANAGEMENT },
  // Cash Register navigation is temporarily hidden for all users.
  // { path: '/register-dashboard', label: 'Register Dashboard', group: 'Cash Register', anyPermissions: [PERMISSIONS.CASH_REGISTER_VIEW], featureKey: FEATURE_KEYS.BASIC_BILLING },
  // { path: '/cash-register', label: 'Cash Register', group: 'Cash Register', anyPermissions: [PERMISSIONS.CASH_REGISTER_VIEW], featureKey: FEATURE_KEYS.BASIC_BILLING },
  { path: '/reports', label: 'Reports', icon: 'reports', group: 'Insights', anyPermissions: [PERMISSIONS.REPORT_OWN_SHIFT, PERMISSIONS.REPORT_BRANCH_SALES, PERMISSIONS.REPORT_RESTAURANT_SALES], featureKey: FEATURE_KEYS.BASIC_REPORTS },
  { path: '/users', label: 'Users', icon: 'users', group: 'System', anyPermissions: [PERMISSIONS.USER_VIEW] },
  { path: '/settings', label: 'Settings', icon: 'settings', group: 'System', anyPermissions: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.ORDER_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS] }
];

const navGroups = ['Super Admin', 'Overview', 'Operations', 'Billing', 'Restaurant Setup', 'Resources', 'Cash Register', 'Insights', 'System'];
const linkBase = 'flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition border';

const iconPaths = {
  dashboard: ['M3 13h8V3H3v10Z', 'M13 21h8V11h-8v10Z', 'M13 3v6h8V3h-8Z', 'M3 21h8v-6H3v6Z'],
  vendors: ['M4 21V7l8-4 8 4v14', 'M9 21v-7h6v7', 'M8 10h.01', 'M16 10h.01'],
  subscription: ['M4 7h16v10H4z', 'M4 11h16', 'M8 15h4'],
  plans: ['M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8L6.8 19l1-5.8L3.6 9.1l5.8-.8L12 3Z'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  orders: ['M8 4h8l1 2h3v15H4V6h3l1-2Z', 'M8 11h8', 'M8 15h6'],
  create: ['M12 5v14', 'M5 12h14'],
  kitchen: ['M6 3v7', 'M10 3v7', 'M8 10v11', 'M16 3c2 2 2 6 0 8v10'],
  bar: ['M6 3h12l-1 7a5 5 0 0 1-10 0L6 3Z', 'M12 15v6', 'M9 21h6'],
  smoke: ['M4 17h10', 'M4 20h10', 'M17 17c2-1 2-3 0-4', 'M19 11c2-2 1-5-2-6'],
  printer: ['M6 9V3h12v6', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v7H6z'],
  billing: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h.01', 'M11 15h3'],
  purchaseIn: ['M12 3v12', 'M7 10l5 5 5-5', 'M4 21h16'],
  purchaseOut: ['M12 21V9', 'M7 14l5-5 5 5', 'M4 3h16'],
  tables: ['M4 10h16', 'M6 10v10', 'M18 10v10', 'M8 4h8a2 2 0 0 1 2 2v4H6V6a2 2 0 0 1 2-2Z'],
  categories: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h10'],
  drink: ['M6 3h12l-2 18H8L6 3Z', 'M8 8h8'],
  inventory: ['M21 8l-9-5-9 5 9 5 9-5Z', 'M3 8v8l9 5 9-5V8', 'M12 13v8'],
  suppliers: ['M3 7h11v10H3z', 'M14 11h4l3 3v3h-7z', 'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  customers: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M23 21v-2a4 4 0 0 0-3-3.87'],
  reports: ['M4 19V5', 'M4 19h17', 'M8 16v-5', 'M13 16V8', 'M18 16v-8'],
  settings: ['M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .34 1.7 1.7 0 0 1-2 0 1.7 1.7 0 0 0-1-.34 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.34-1 1.7 1.7 0 0 1 0-2 1.7 1.7 0 0 0 .34-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.34 1.7 1.7 0 0 1 2 0 1.7 1.7 0 0 0 1 .34 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c0 .35.12.7.34 1a1.7 1.7 0 0 1 0 2 1.7 1.7 0 0 0-.34 1Z']
};

const NavIcon = ({ name }) => {
  const paths = iconPaths[name] || iconPaths.menu;
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
};

const APP_NAME = 'Digit Restaurant Management System';

const getUserVendorName = (user = {}) =>
  user.vendorName ||
  user.restaurantName ||
  user.businessName ||
  user.tenantName ||
  user.accessScope?.vendorName ||
  user.accessScope?.restaurantName ||
  '';

const Sidebar = ({ user, userRole, open, onClose }) => {
  const [enabledFeatures, setEnabledFeatures] = useState(null);
  const [receiptBusinessName, setReceiptBusinessName] = useState(() => getReceiptSettings().businessName || 'Restaurant RMS');
  const { hasAnyPermission } = usePermissions();
  const roleLabel = userRole ? userRole.replaceAll('_', ' ') : 'GUEST';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const sidebarTitle = isSuperAdmin ? APP_NAME : getUserVendorName(user) || receiptBusinessName || 'Restaurant RMS';
  const sidebarSubtitle = isSuperAdmin ? 'Platform Control' : 'Management Panel';
  const getItemLabel = (item) => {
    if (item.path === '/users' && userRole === 'RESTAURANT_OWNER') return 'My Users';
    return item.label;
  };

  useEffect(() => {
    let mounted = true;
    planService
      .active()
      .then((data) => {
        if (!mounted) return;
        setEnabledFeatures(new Set(data?.enabledFeatureKeys || []));
      })
      .catch(() => {
        if (!mounted) return;
        setEnabledFeatures(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const syncReceiptBusinessName = () => {
      setReceiptBusinessName(getReceiptSettings().businessName || 'Restaurant RMS');
    };

    const handleStorage = (event) => {
      if (event.key === RECEIPT_SETTINGS_KEY) syncReceiptBusinessName();
    };

    window.addEventListener(RECEIPT_SETTINGS_EVENT, syncReceiptBusinessName);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(RECEIPT_SETTINGS_EVENT, syncReceiptBusinessName);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const items = useMemo(() => {
    const permissionItems = navItems.filter((item) => hasAnyPermission(item.anyPermissions));

    if (userRole === 'SUPER_ADMIN') {
      return permissionItems.filter((item) => item.group === 'Super Admin');
    }

    return permissionItems.filter((item) => {
      if (hasAnyPermission([PERMISSIONS.PLATFORM_VIEW])) return true;
      if (!item.featureKey) return true;
      if (!enabledFeatures) return true;
      return enabledFeatures.has(item.featureKey);
    });
  }, [enabledFeatures, hasAnyPermission, userRole]);

  return (
    <>
      {open ? <button className="fixed inset-0 z-20 bg-brand-900/15 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={`fixed z-30 flex h-full w-72 flex-col overflow-y-auto border-r border-white/80 bg-gradient-to-b from-white via-brand-50 to-secondary-50 text-slate-700 shadow-xl shadow-brand-100/60 transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-brand-100 p-5">
          <div className="flex items-start gap-3">
            <img src="/digit-nepal/mark-light.png" alt="Digit Nepal" className="h-11 w-11 rounded-2xl object-cover shadow-sm ring-1 ring-brand-100" />
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold leading-tight text-slate-900">{sidebarTitle}</h1>
              <p className="mt-1 text-xs font-semibold text-brand-700">{sidebarSubtitle}</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-brand-200 bg-white/85 px-3 py-2 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-brand-600">Signed in role</p>
            <p className="text-sm font-semibold text-slate-700">{roleLabel}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 p-4">
          {navGroups.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (!groupItems.length) return null;

            return (
              <div key={group}>
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group}</p>
                <div className="space-y-1">
                  {groupItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `${linkBase} ${
                          isActive
                            ? 'border-brand-300 bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-md shadow-brand-200/70'
                            : 'border-brand-100 bg-white/70 text-slate-700 hover:border-brand-200 hover:bg-white'
                        }`
                      }
                    >
                      <NavIcon name={item.icon} />
                      <span className="truncate">{getItemLabel(item)}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-brand-100 p-4">
          <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white/85 px-4 py-3 shadow-sm">
            <img src="/digit-nepal/mark-light.png" alt="" className="h-9 w-9 rounded-xl object-cover ring-1 ring-brand-100" />
            <div>
              <p className="font-display text-sm font-extrabold text-slate-900">Digit RMS</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">Powered by Digit Nepal</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
