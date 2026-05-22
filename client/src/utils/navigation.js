import { FEATURE_KEYS, ROLES } from './constants';

export const NAV_ITEMS = [
  { path: '/super-admin/dashboard', label: 'Dashboard', group: 'Super Admin', roles: [ROLES.SUPER_ADMIN] },
  { path: '/super-admin/vendors', label: 'Vendors', group: 'Super Admin', roles: [ROLES.SUPER_ADMIN] },
  { path: '/super-admin/subscriptions', label: 'Subscriptions', group: 'Super Admin', roles: [ROLES.SUPER_ADMIN] },
  { path: '/super-admin/plans', label: 'Plans', group: 'Super Admin', roles: [ROLES.SUPER_ADMIN] },
  { path: '/super-admin/users', label: 'Users', group: 'Super Admin', roles: [ROLES.SUPER_ADMIN] },
  { path: '/dashboard', label: 'Dashboard', group: 'Overview', roles: [ROLES.ADMIN], featureKey: FEATURE_KEYS.DASHBOARD_OVERVIEW },
  {
    path: '/orders',
    label: 'Orders',
    group: 'Operations',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER, ROLES.WAITER, ROLES.KITCHEN],
    featureKey: FEATURE_KEYS.ORDER_HISTORY
  },
  {
    path: '/orders/create',
    label: 'Create',
    group: 'Operations',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER],
    featureKey: FEATURE_KEYS.ORDER_HISTORY
  },
  {
    path: '/kitchen',
    label: 'Kitchen',
    group: 'Operations',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.KITCHEN],
    featureKey: FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM
  },
  {
    path: '/billing',
    label: 'Billing',
    group: 'Billing',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER],
    featureKey: FEATURE_KEYS.BASIC_BILLING
  },
  {
    path: '/tables',
    label: 'Tables',
    group: 'Restaurant Setup',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER],
    featureKey: FEATURE_KEYS.TABLE_MANAGEMENT
  },
  {
    path: '/menu/categories',
    label: 'Categories',
    group: 'Restaurant Setup',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER],
    featureKey: FEATURE_KEYS.CATEGORY_MANAGEMENT
  },
  {
    path: '/menu/items',
    label: 'Menu',
    group: 'Restaurant Setup',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER],
    featureKey: FEATURE_KEYS.MENU_MANAGEMENT
  },
  {
    path: '/inventory',
    label: 'Inventory',
    group: 'Resources',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER],
    featureKey: FEATURE_KEYS.INVENTORY_MANAGEMENT
  },
  {
    path: '/suppliers',
    label: 'Suppliers',
    group: 'Resources',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER],
    featureKey: FEATURE_KEYS.SUPPLIER_MANAGEMENT
  },
  {
    path: '/customers',
    label: 'Customers',
    group: 'Resources',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER, ROLES.CASHIER],
    featureKey: FEATURE_KEYS.CUSTOMER_MANAGEMENT
  },
  {
    path: '/reports',
    label: 'Reports',
    group: 'Insights',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER],
    featureKey: FEATURE_KEYS.BASIC_REPORTS
  },
  { path: '/users', label: 'Users', group: 'System', roles: [ROLES.ADMIN] },
  {
    path: '/settings',
    label: 'Settings',
    group: 'System',
    roles: [ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER, ROLES.WAITER, ROLES.KITCHEN]
  }
];

export const NAV_GROUPS = [
  'Super Admin',
  'Overview',
  'Operations',
  'Billing',
  'Restaurant Setup',
  'Resources',
  'Insights',
  'System'
];

export const getVisibleNavItems = ({ role, enabledFeatures }) => {
  const roleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  if (role === ROLES.SUPER_ADMIN) return roleItems;
  if (!enabledFeatures) return roleItems;

  return roleItems.filter((item) => {
    if (!item.featureKey) return true;
    return enabledFeatures.has(item.featureKey);
  });
};

const MOBILE_NAV_PATHS_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: ['/super-admin/dashboard', '/super-admin/vendors', '/super-admin/subscriptions', '/super-admin/plans', '/super-admin/users'],
  [ROLES.ADMIN]: ['/dashboard', '/orders', '/billing', '/reports', '/settings'],
  [ROLES.RESTAURANT_OWNER]: ['/orders', '/tables', '/billing', '/reports', '/settings'],
  [ROLES.MANAGER]: ['/orders', '/tables', '/inventory', '/reports', '/settings'],
  [ROLES.CASHIER]: ['/orders', '/billing', '/customers', '/reports', '/settings'],
  [ROLES.WAITER]: ['/orders/create', '/orders', '/tables', '/customers', '/settings'],
  [ROLES.KITCHEN]: ['/kitchen', '/orders', '/settings']
};

export const getMobileNavItems = ({ role, enabledFeatures }) => {
  const visible = getVisibleNavItems({ role, enabledFeatures });
  const visibleByPath = new Map(visible.map((item) => [item.path, item]));
  const preferred = MOBILE_NAV_PATHS_BY_ROLE[role] || ['/orders', '/settings'];

  return preferred
    .map((path) => visibleByPath.get(path))
    .filter(Boolean)
    .slice(0, 5);
};

