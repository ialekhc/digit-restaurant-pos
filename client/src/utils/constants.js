export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  RESTAURANT_OWNER: 'RESTAURANT_OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  WAITER: 'WAITER',
  CHEF: 'CHEF',
  KITCHEN: 'KITCHEN',
  INVENTORY_MANAGER: 'INVENTORY_MANAGER',
  ACCOUNTANT: 'ACCOUNTANT',
  DELIVERY_PARTNER: 'DELIVERY_PARTNER',
  CUSTOMER_SUPPORT: 'CUSTOMER_SUPPORT',
  BARISTA: 'BARISTA',
  CUSTOMER: 'CUSTOMER'
};

export const PERMISSIONS = {
  PLATFORM_VIEW: 'platform.view',
  PLATFORM_MANAGE: 'platform.manage',
  PLATFORM_RESTAURANTS_MANAGE: 'platform.restaurants.manage',
  PLATFORM_SUBSCRIPTIONS_MANAGE: 'platform.subscriptions.manage',
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_VIEW_LIMITED: 'dashboard.view_limited',
  USER_VIEW: 'user.view',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.deactivate',
  USER_DEACTIVATE: 'user.deactivate',
  USER_ASSIGN_ROLE: 'user.assign_role',
  USER_ASSIGN_BRANCH: 'user.assign_branch',
  MENU_VIEW: 'menu.view',
  MENU_CREATE: 'menu.create',
  MENU_UPDATE: 'menu.update',
  MENU_UPDATE_AVAILABILITY: 'menu.update_availability',
  TABLE_VIEW: 'table.view',
  TABLE_MANAGE: 'table.manage',
  TABLE_ASSIGN: 'table.assign',
  ORDER_VIEW: 'order.view',
  ORDER_READ: 'order.view',
  ORDER_CREATE: 'order.create',
  ORDER_UPDATE: 'order.update',
  ORDER_STATUS_UPDATE: 'order.update',
  ORDER_CANCEL: 'order.cancel',
  ORDER_DELETE: 'order.delete',
  ORDER_ITEM_READ: 'order.view',
  ORDER_ITEM_UPDATE: 'order.update',
  ORDER_TRANSFER: 'order.transfer',
  ORDER_MERGE: 'order.merge',
  ORDER_SPLIT: 'order.split',
  ORDER_SEND_TO_KITCHEN: 'order.send_to_kitchen',
  PAYMENT_VIEW: 'payment.view',
  BILL_READ: 'payment.view',
  PAYMENT_COLLECT: 'payment.collect',
  BILL_CREATE: 'payment.collect',
  BILL_UPDATE: 'payment.collect',
  BILL_DELETE: 'payment.delete',
  PAYMENT_SPLIT: 'payment.split',
  DISCOUNT_VIEW: 'discount.view',
  DISCOUNT_APPLY: 'discount.apply',
  DISCOUNT_APPLY_LIMITED: 'discount.apply_limited',
  RECEIPT_PRINT: 'receipt.print',
  RECEIPT_REPRINT: 'receipt.reprint',
  CASH_REGISTER_OPEN: 'cash_register.open',
  CASH_REGISTER_VIEW: 'cash_register.view',
  CASH_REGISTER_CLOSE: 'cash_register.close',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_RECORD_WASTAGE: 'inventory.record_wastage',
  INVENTORY_MANAGE: 'inventory.manage',
  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_CREATE: 'purchase.create',
  SUPPLIER_VIEW: 'supplier.view',
  CUSTOMER_VIEW: 'customer.view',
  CUSTOMER_CREATE: 'customer.create',
  CUSTOMER_UPDATE: 'customer.update',
  REPORT_OWN_SHIFT: 'report.own_shift',
  REPORT_OWN_ORDERS: 'report.own_orders',
  REPORT_BRANCH_SALES: 'report.branch_sales',
  REPORT_RESTAURANT_SALES: 'report.restaurant_sales',
  REPORT_EXPORT: 'report.export',
  KITCHEN_VIEW_ORDERS: 'kitchen.view_orders',
  KITCHEN_UPDATE_STATUS: 'kitchen.update_status',
  SETTINGS_VIEW: 'settings.view',
  SUBSCRIPTION_VIEW: 'subscription.view',
  SUBSCRIPTION_READ: 'subscription.view',
  SUBSCRIPTION_MANAGE: 'subscription.manage',
  SUBSCRIPTION_CREATE: 'platform.subscriptions.manage',
  SUBSCRIPTION_UPDATE: 'platform.subscriptions.manage',
  SUBSCRIPTION_DELETE: 'platform.subscriptions.manage'
};

export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.RESTAURANT_OWNER]: Object.values(PERMISSIONS).filter((permission) => !permission.startsWith('platform.')),
  [ROLES.ADMIN]: Object.values(PERMISSIONS).filter(
    (permission) =>
      !permission.startsWith('platform.') &&
      ![
        PERMISSIONS.USER_VIEW,
        PERMISSIONS.USER_CREATE,
        PERMISSIONS.USER_UPDATE,
        PERMISSIONS.USER_ASSIGN_ROLE,
        PERMISSIONS.ORDER_DELETE,
        PERMISSIONS.BILL_DELETE,
        PERMISSIONS.SUBSCRIPTION_MANAGE
      ].includes(permission)
  ),
  [ROLES.MANAGER]: [
    PERMISSIONS.DASHBOARD_VIEW_LIMITED,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.ORDER_TRANSFER,
    PERMISSIONS.ORDER_MERGE,
    PERMISSIONS.ORDER_SPLIT,
    PERMISSIONS.ORDER_SEND_TO_KITCHEN,
    PERMISSIONS.TABLE_VIEW,
    PERMISSIONS.TABLE_MANAGE,
    PERMISSIONS.TABLE_ASSIGN,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_COLLECT,
    PERMISSIONS.PAYMENT_SPLIT,
    PERMISSIONS.DISCOUNT_VIEW,
    PERMISSIONS.DISCOUNT_APPLY,
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    PERMISSIONS.KITCHEN_VIEW_ORDERS,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_RECORD_WASTAGE,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.REPORT_BRANCH_SALES,
    PERMISSIONS.REPORT_OWN_SHIFT,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.USER_ASSIGN_BRANCH
  ],
  [ROLES.CASHIER]: [
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_COLLECT,
    PERMISSIONS.PAYMENT_SPLIT,
    PERMISSIONS.DISCOUNT_APPLY_LIMITED,
    PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_REPRINT,
    PERMISSIONS.REPORT_OWN_SHIFT,
    PERMISSIONS.REPORT_OWN_ORDERS
  ],
  [ROLES.WAITER]: [
    PERMISSIONS.TABLE_VIEW,
    PERMISSIONS.TABLE_ASSIGN,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.ORDER_TRANSFER,
    PERMISSIONS.KITCHEN_VIEW_ORDERS,
    PERMISSIONS.KITCHEN_UPDATE_STATUS,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE
  ],
  [ROLES.KITCHEN]: [PERMISSIONS.KITCHEN_VIEW_ORDERS, PERMISSIONS.KITCHEN_UPDATE_STATUS, PERMISSIONS.MENU_VIEW],
  [ROLES.CHEF]: [PERMISSIONS.KITCHEN_VIEW_ORDERS, PERMISSIONS.KITCHEN_UPDATE_STATUS, PERMISSIONS.MENU_VIEW],
  [ROLES.BARISTA]: [
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.KITCHEN_VIEW_ORDERS,
    PERMISSIONS.KITCHEN_UPDATE_STATUS,
    PERMISSIONS.MENU_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE
  ],
  [ROLES.INVENTORY_MANAGER]: [
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.PURCHASE_VIEW,
    PERMISSIONS.PURCHASE_CREATE,
    PERMISSIONS.SUPPLIER_VIEW
  ],
  [ROLES.ACCOUNTANT]: [PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.REPORT_BRANCH_SALES, PERMISSIONS.REPORT_RESTAURANT_SALES],
  [ROLES.CUSTOMER_SUPPORT]: [PERMISSIONS.ORDER_VIEW, PERMISSIONS.CUSTOMER_VIEW],
  [ROLES.DELIVERY_PARTNER]: [PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_UPDATE],
  [ROLES.CUSTOMER]: [
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_UPDATE,
    PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.PAYMENT_VIEW
  ]
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
  },
  {
    role: ROLES.BARISTA,
    label: 'Barista',
    email: 'barista@restaurant.local',
    password: 'Barista@12345',
    description: 'Bar display and liquor preparation updates'
  }
];

export const ORDER_STATUSES = ['PENDING', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'];
export const ORDER_TYPES = ['DINE_IN', 'TAKEAWAY'];
export const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'Unavailable'];
export const PAYMENT_METHODS = ['CASH', 'CARD', 'QR', 'ONLINE', 'SPLIT'];
export const MENU_TYPES = ['FOOD', 'DRINK', 'SMOKE'];

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
  '/drink/items': 'Drink Items',
  '/smoke/items': 'Smoke Items',
  '/tables': 'Tables',
  '/orders': 'Orders',
  '/orders/create': 'Create Order',
  '/kitchen': 'Kitchen Display',
  '/bar': 'Bar Display',
  '/smoke-display': 'Smoke Display',
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
  [ROLES.RESTAURANT_OWNER]: '/dashboard',
  [ROLES.ADMIN]: '/dashboard',
  [ROLES.MANAGER]: '/orders',
  [ROLES.CASHIER]: '/billing',
  [ROLES.WAITER]: '/orders/create',
  [ROLES.KITCHEN]: '/kitchen',
  [ROLES.BARISTA]: '/bar',
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
  TAKEAWAY_ORDERS: 'takeaway_orders'
};
