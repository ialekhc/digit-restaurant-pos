import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { planService } from '../api/services';
import { FEATURE_KEYS, ROLES } from '../utils/constants';

const navItems = [
  { path: '/super-admin', label: 'Super Admin Portal', group: 'Overview', roles: [ROLES.SUPER_ADMIN] },
  { path: '/dashboard', label: 'Dashboard', group: 'Overview', roles: [ROLES.ADMIN], featureKey: FEATURE_KEYS.DASHBOARD_OVERVIEW },
  { path: '/orders', label: 'Orders', group: 'Operations', roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER, ROLES.WAITER, ROLES.KITCHEN], featureKey: FEATURE_KEYS.ORDER_HISTORY },
  { path: '/orders/create', label: 'Create Order', group: 'Operations', roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.WAITER], featureKey: FEATURE_KEYS.ORDER_HISTORY },
  { path: '/kitchen', label: 'Kitchen Display', group: 'Operations', roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.KITCHEN], featureKey: FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM },
  { path: '/billing', label: 'Billing', group: 'Billing', roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER], featureKey: FEATURE_KEYS.BASIC_BILLING },
  { path: '/tables', label: 'Tables', group: 'Restaurant Setup', roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.WAITER], featureKey: FEATURE_KEYS.TABLE_MANAGEMENT },
  { path: '/menu/categories', label: 'Menu Categories', group: 'Restaurant Setup', roles: [ROLES.ADMIN, ROLES.MANAGER], featureKey: FEATURE_KEYS.CATEGORY_MANAGEMENT },
  { path: '/menu/items', label: 'Menu Items', group: 'Restaurant Setup', roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.WAITER], featureKey: FEATURE_KEYS.MENU_MANAGEMENT },
  { path: '/inventory', label: 'Inventory', group: 'Resources', roles: [ROLES.ADMIN, ROLES.MANAGER], featureKey: FEATURE_KEYS.INVENTORY_MANAGEMENT },
  { path: '/suppliers', label: 'Suppliers', group: 'Resources', roles: [ROLES.ADMIN, ROLES.MANAGER], featureKey: FEATURE_KEYS.SUPPLIER_MANAGEMENT },
  { path: '/customers', label: 'Customers', group: 'Resources', roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.WAITER, ROLES.CASHIER], featureKey: FEATURE_KEYS.CUSTOMER_MANAGEMENT },
  { path: '/reports', label: 'Reports', group: 'Insights', roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER], featureKey: FEATURE_KEYS.BASIC_REPORTS },
  { path: '/users', label: 'Users', group: 'System', roles: [ROLES.ADMIN] },
  { path: '/settings', label: 'Settings', group: 'System', roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER, ROLES.WAITER, ROLES.KITCHEN] }
];

const navGroups = ['Overview', 'Operations', 'Billing', 'Restaurant Setup', 'Resources', 'Insights', 'System'];
const linkBase = 'block rounded-xl px-4 py-2.5 text-sm font-medium transition border border-transparent';

const Sidebar = ({ userRole, open, onClose }) => {
  const [enabledFeatures, setEnabledFeatures] = useState(null);
  const roleLabel = userRole ? userRole.replace('_', ' ') : 'GUEST';

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
    const roleItems =
      userRole === ROLES.SUPER_ADMIN
        ? navItems
        : navItems.filter((item) => item.roles.includes(userRole));

    return roleItems.filter((item) => {
      if (userRole === ROLES.SUPER_ADMIN) return true;
      if (!item.featureKey) return true;
      if (!enabledFeatures) return true;
      return enabledFeatures.has(item.featureKey);
    });
  }, [enabledFeatures, userRole]);

  return (
    <>
      {open ? <button className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={`fixed z-30 h-full w-72 overflow-y-auto bg-slate-950 text-slate-100 transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-slate-800 p-5">
          <h1 className="text-xl font-bold text-white">Restaurant RMS</h1>
          <p className="text-xs text-slate-300">Management Panel</p>
          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Signed in role</p>
            <p className="text-sm font-semibold text-slate-100">{roleLabel}</p>
          </div>
        </div>

        <nav className="space-y-4 p-4">
          {navGroups.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (!groupItems.length) return null;

            return (
              <div key={group}>
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                <div className="space-y-1">
                  {groupItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `${linkBase} ${
                          isActive
                            ? 'border-brand-500 bg-brand-600 text-white shadow-md shadow-brand-900/30'
                            : 'text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                        }`
                      }
                    >
                      {item.label}
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
