import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { planService } from '../api/services';
import { FEATURE_KEYS, PERMISSIONS } from '../utils/constants';
import { usePermissions } from '../hooks/usePermissions';

const navItems = [
  { path: '/super-admin/dashboard', label: 'Dashboard', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_VIEW] },
  { path: '/super-admin/vendors', label: 'Vendors', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE] },
  { path: '/super-admin/subscriptions', label: 'Subscriptions', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE] },
  { path: '/super-admin/plans', label: 'Plans & Features', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE] },
  { path: '/super-admin/users', label: 'Users', group: 'Super Admin', anyPermissions: [PERMISSIONS.PLATFORM_VIEW] },
  { path: '/dashboard', label: 'Dashboard', group: 'Overview', anyPermissions: [PERMISSIONS.DASHBOARD_VIEW], featureKey: FEATURE_KEYS.DASHBOARD_OVERVIEW },
  { path: '/orders', label: 'Orders', group: 'Operations', anyPermissions: [PERMISSIONS.ORDER_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS], featureKey: FEATURE_KEYS.ORDER_HISTORY },
  { path: '/orders/create', label: 'Create Order', group: 'Operations', anyPermissions: [PERMISSIONS.ORDER_CREATE], featureKey: FEATURE_KEYS.ORDER_HISTORY },
  { path: '/kitchen', label: 'Kitchen Display', group: 'Operations', anyPermissions: [PERMISSIONS.KITCHEN_VIEW_ORDERS], featureKey: FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM },
  { path: '/bar', label: 'Bar Display', group: 'Operations', anyPermissions: [PERMISSIONS.KITCHEN_VIEW_ORDERS], featureKey: FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM },
  { path: '/smoke-display', label: 'Smoke Display', group: 'Operations', anyPermissions: [PERMISSIONS.KITCHEN_VIEW_ORDERS], featureKey: FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM },
  { path: '/billing', label: 'Billing', group: 'Billing', anyPermissions: [PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_COLLECT], featureKey: FEATURE_KEYS.BASIC_BILLING },
  { path: '/purchase-in', label: 'Purchase In', group: 'Billing', anyPermissions: [PERMISSIONS.PURCHASE_VIEW, PERMISSIONS.PURCHASE_CREATE], featureKey: FEATURE_KEYS.INVENTORY_MANAGEMENT },
  { path: '/purchase-out', label: 'Purchase Out', group: 'Billing', anyPermissions: [PERMISSIONS.PURCHASE_VIEW, PERMISSIONS.PURCHASE_CREATE], featureKey: FEATURE_KEYS.INVENTORY_MANAGEMENT },
  { path: '/tables', label: 'Tables', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.TABLE_VIEW], featureKey: FEATURE_KEYS.TABLE_MANAGEMENT },
  { path: '/menu/categories', label: 'Menu Categories', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.MENU_VIEW], featureKey: FEATURE_KEYS.CATEGORY_MANAGEMENT },
  { path: '/menu/items', label: 'Menu Items', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.MENU_VIEW], featureKey: FEATURE_KEYS.MENU_MANAGEMENT },
  { path: '/drink/items', label: 'Drink Items', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.MENU_VIEW], featureKey: FEATURE_KEYS.MENU_MANAGEMENT },
  { path: '/smoke/items', label: 'Smoke Items', group: 'Restaurant Setup', anyPermissions: [PERMISSIONS.MENU_VIEW], featureKey: FEATURE_KEYS.MENU_MANAGEMENT },
  { path: '/inventory', label: 'Inventory', group: 'Resources', anyPermissions: [PERMISSIONS.INVENTORY_VIEW], featureKey: FEATURE_KEYS.INVENTORY_MANAGEMENT },
  { path: '/suppliers', label: 'Suppliers', group: 'Resources', anyPermissions: [PERMISSIONS.SUPPLIER_VIEW], featureKey: FEATURE_KEYS.SUPPLIER_MANAGEMENT },
  { path: '/customers', label: 'Customers', group: 'Resources', anyPermissions: [PERMISSIONS.CUSTOMER_VIEW], featureKey: FEATURE_KEYS.CUSTOMER_MANAGEMENT },
  // Cash Register navigation is temporarily hidden for all users.
  // { path: '/register-dashboard', label: 'Register Dashboard', group: 'Cash Register', anyPermissions: [PERMISSIONS.CASH_REGISTER_VIEW], featureKey: FEATURE_KEYS.BASIC_BILLING },
  // { path: '/cash-register', label: 'Cash Register', group: 'Cash Register', anyPermissions: [PERMISSIONS.CASH_REGISTER_VIEW], featureKey: FEATURE_KEYS.BASIC_BILLING },
  { path: '/reports', label: 'Reports', group: 'Insights', anyPermissions: [PERMISSIONS.REPORT_OWN_SHIFT, PERMISSIONS.REPORT_BRANCH_SALES, PERMISSIONS.REPORT_RESTAURANT_SALES], featureKey: FEATURE_KEYS.BASIC_REPORTS },
  { path: '/users', label: 'Users', group: 'System', anyPermissions: [PERMISSIONS.USER_VIEW] },
  { path: '/settings', label: 'Settings', group: 'System', anyPermissions: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.ORDER_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS] }
];

const navGroups = ['Super Admin', 'Overview', 'Operations', 'Billing', 'Restaurant Setup', 'Resources', 'Cash Register', 'Insights', 'System'];
const linkBase = 'block rounded-xl px-4 py-2.5 text-sm font-semibold transition border';

const Sidebar = ({ userRole, open, onClose }) => {
  const [enabledFeatures, setEnabledFeatures] = useState(null);
  const { hasAnyPermission } = usePermissions();
  const roleLabel = userRole ? userRole.replaceAll('_', ' ') : 'GUEST';
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

  const items = useMemo(() => {
    const permissionItems = navItems.filter((item) => hasAnyPermission(item.anyPermissions));

    return permissionItems.filter((item) => {
      if (hasAnyPermission([PERMISSIONS.PLATFORM_VIEW])) return true;
      if (!item.featureKey) return true;
      if (!enabledFeatures) return true;
      return enabledFeatures.has(item.featureKey);
    });
  }, [enabledFeatures, hasAnyPermission]);

  return (
    <>
      {open ? <button className="fixed inset-0 z-20 bg-orange-900/15 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={`fixed z-30 h-full w-72 overflow-y-auto border-r border-white/80 bg-gradient-to-b from-orange-50 via-amber-50 to-cyan-50 text-slate-700 shadow-xl shadow-orange-100/60 transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-orange-100 p-5">
          <h1 className="font-display text-xl font-bold text-slate-800">Restaurant RMS</h1>
          <p className="text-xs text-slate-500">Management Panel</p>
          <div className="mt-3 rounded-xl border border-orange-200 bg-white/85 px-3 py-2 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-orange-600">Signed in role</p>
            <p className="text-sm font-semibold text-slate-700">{roleLabel}</p>
          </div>
        </div>

        <nav className="space-y-4 p-4">
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
                            : 'border-orange-100 bg-white/70 text-slate-700 hover:border-brand-200 hover:bg-white'
                        }`
                      }
                    >
                      {getItemLabel(item)}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
