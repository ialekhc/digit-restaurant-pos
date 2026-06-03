export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  RESTAURANT_OWNER: 'RESTAURANT_OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  WAITER: 'WAITER',
  KITCHEN: 'KITCHEN',
  CUSTOMER: 'CUSTOMER'
};

export const ROLE_LOGIN_PRESETS = [
  {
    role: ROLES.SUPER_ADMIN,
    label: 'Super Admin',
    email: 'superadmin@restaurant.local',
    password: 'SuperAdmin@12345',
    description: 'Platform owner with full control'
  },
  {
    role: ROLES.RESTAURANT_OWNER,
    label: 'Vendor Owner',
    email: 'vendor.himalayan@restaurant.local',
    password: 'Vendor@12345',
    description: 'Restaurant owner account for vendor portal'
  },
  {
    role: ROLES.ADMIN,
    label: 'Admin',
    email: 'admin@restaurant.local',
    password: 'Admin@12345',
    description: 'Full access to all modules'
  },
  {
    role: ROLES.MANAGER,
    label: 'Manager',
    email: 'manager@restaurant.local',
    password: 'Manager@12345',
    description: 'Manage menu, orders, inventory, reports'
  },
  {
    role: ROLES.CASHIER,
    label: 'Cashier',
    email: 'cashier@restaurant.local',
    password: 'Cashier@12345',
    description: 'Billing, payments, and sales tracking'
  },
  {
    role: ROLES.WAITER,
    label: 'Waiter',
    email: 'waiter@restaurant.local',
    password: 'Waiter@12345',
    description: 'Create and serve dine-in orders'
  },
  {
    role: ROLES.KITCHEN,
    label: 'Kitchen',
    email: 'kitchen@restaurant.local',
    password: 'Kitchen@12345',
    description: 'Kitchen display and order prep updates'
  }
];

export const ORDER_STATUSES = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
export const ORDER_TYPES = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];
export const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];
export const PAYMENT_METHODS = ['CASH', 'CARD', 'QR', 'ONLINE', 'SPLIT'];

export const PAGE_TITLES = {
  '/super-admin': 'Super Admin',
  '/super-admin/dashboard': 'Super Admin Dashboard',
  '/super-admin/vendors': 'Vendors',
  '/super-admin/subscriptions': 'Subscriptions',
  '/super-admin/plans': 'Plans & Features',
  '/super-admin/users': 'Users',
  '/dashboard': 'Dashboard',
  '/users': 'Users',
  '/menu/categories': 'Menu Categories',
  '/menu/items': 'Menu Items',
  '/tables': 'Tables',
  '/orders': 'Orders',
  '/orders/create': 'Create Order',
  '/kitchen': 'Kitchen Display',
  '/billing': 'Billing & Payments',
  '/register-dashboard': 'Register Dashboard',
  '/cash-register': 'Cash Register',
  '/purchase-in': 'Purchase In',
  '/purchase-out': 'Purchase Out',
  '/inventory': 'Inventory',
  '/suppliers': 'Suppliers',
  '/customers': 'Customers',
  '/reports': 'Reports',
  '/settings': 'Settings'
};

export const DEFAULT_ROUTE_BY_ROLE = {
  [ROLES.SUPER_ADMIN]: '/super-admin/dashboard',
  [ROLES.RESTAURANT_OWNER]: '/orders',
  [ROLES.ADMIN]: '/dashboard',
  [ROLES.MANAGER]: '/orders',
  [ROLES.CASHIER]: '/billing',
  [ROLES.WAITER]: '/orders/create',
  [ROLES.KITCHEN]: '/kitchen',
  [ROLES.CUSTOMER]: '/orders'
};

export const getDefaultRouteForRole = (role) => {
  return DEFAULT_ROUTE_BY_ROLE[role] || '/orders';
};

export const FEATURE_KEYS = {
  MENU_MANAGEMENT: 'menu_management',
  CATEGORY_MANAGEMENT: 'category_management',
  TABLE_MANAGEMENT: 'table_management',
  ORDER_HISTORY: 'order_history',
  KITCHEN_DISPLAY_SYSTEM: 'kitchen_display_system',
  BASIC_BILLING: 'basic_billing',
  CASH_PAYMENT: 'cash_payment',
  CARD_PAYMENT: 'card_payment',
  QR_PAYMENT: 'qr_payment',
  ONLINE_ORDERING_SYSTEM: 'online_ordering_system',
  SPLIT_BILLING: 'split_billing',
  INVENTORY_MANAGEMENT: 'inventory_management',
  SUPPLIER_MANAGEMENT: 'supplier_management',
  CUSTOMER_MANAGEMENT: 'customer_management',
  BASIC_REPORTS: 'basic_reports',
  DINE_IN_ORDERS: 'dine_in_orders',
  TAKEAWAY_ORDERS: 'takeaway_orders',
  DELIVERY_ORDER_MANAGEMENT: 'delivery_order_management'
};
