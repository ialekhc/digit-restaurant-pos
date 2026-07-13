export const FEATURE_KEYS = {
  AUTH_LOGIN: 'auth_login',
  DASHBOARD_OVERVIEW: 'dashboard_overview',
  MENU_MANAGEMENT: 'menu_management',
  CATEGORY_MANAGEMENT: 'category_management',
  TABLE_MANAGEMENT: 'table_management',
  DINE_IN_ORDERS: 'dine_in_orders',
  TAKEAWAY_ORDERS: 'takeaway_orders',
  BASIC_BILLING: 'basic_billing',
  CASH_PAYMENT: 'cash_payment',
  CARD_PAYMENT: 'card_payment',
  QR_PAYMENT: 'qr_payment',
  ONLINE_PAYMENT: 'online_payment',
  SPLIT_BILLING: 'split_billing',
  BASIC_REPORTS: 'basic_reports',
  ADVANCED_SALES_REPORTS: 'advanced_sales_reports',
  DAILY_MONTHLY_ANALYTICS: 'daily_monthly_analytics',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  PERFORMANCE_REPORTS: 'performance_reports',
  CUSTOM_REPORTS: 'custom_reports',
  ORDER_HISTORY: 'order_history',
  KITCHEN_DISPLAY_SYSTEM: 'kitchen_display_system',
  INVENTORY_MANAGEMENT: 'inventory_management',
  ADVANCED_INVENTORY_TRACKING: 'advanced_inventory_tracking',
  LOW_STOCK_ALERTS: 'low_stock_alerts',
  SUPPLIER_MANAGEMENT: 'supplier_management',
  CUSTOMER_MANAGEMENT: 'customer_management',
  QR_MENU_SYSTEM: 'qr_menu_system',
  DISCOUNT_MANAGEMENT: 'discount_management',
  CUSTOM_DISCOUNT_RULES: 'custom_discount_rules',
  LOYALTY_POINTS_SYSTEM: 'loyalty_points_system',
  STAFF_ACTIVITY_LOGS: 'staff_activity_logs',
  MULTI_DEVICE_ACCESS: 'multi_device_access',
  EXPENSE_TRACKING: 'expense_tracking',
  PRIORITY_DASHBOARD_WIDGETS: 'priority_dashboard_widgets',
  MULTI_BRANCH_MANAGEMENT: 'multi_branch_management',
  CENTRALIZED_ADMIN_DASHBOARD: 'centralized_admin_dashboard',
  CUSTOM_BRANDING: 'custom_branding',
  API_INTEGRATION: 'api_integration',
  ADVANCED_SECURITY: 'advanced_security',
  ROLE_BASED_PERMISSIONS: 'role_based_permissions',
  CLOUD_BACKUP: 'cloud_backup',
  DEDICATED_ACCOUNT_MANAGER: 'dedicated_account_manager',
  CUSTOM_FEATURE_REQUESTS: 'custom_feature_requests',
  RESPONSIVE_DASHBOARD: 'responsive_dashboard',
  ONLINE_ORDERING_SYSTEM: 'online_ordering_system',
  SMS_NOTIFICATION: 'sms_notification',
  WHATSAPP_NOTIFICATION: 'whatsapp_notification',
  CUSTOM_DOMAIN: 'custom_domain'
};

const planFeatureMap = {
  STARTER: [
    FEATURE_KEYS.AUTH_LOGIN,
    FEATURE_KEYS.DASHBOARD_OVERVIEW,
    FEATURE_KEYS.MENU_MANAGEMENT,
    FEATURE_KEYS.CATEGORY_MANAGEMENT,
    FEATURE_KEYS.TABLE_MANAGEMENT,
    FEATURE_KEYS.DINE_IN_ORDERS,
    FEATURE_KEYS.TAKEAWAY_ORDERS,
    FEATURE_KEYS.BASIC_BILLING,
    FEATURE_KEYS.CASH_PAYMENT,
    FEATURE_KEYS.BASIC_REPORTS,
    FEATURE_KEYS.ORDER_HISTORY,
    FEATURE_KEYS.RESPONSIVE_DASHBOARD
  ],
  STANDARD: [
    FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM,
    FEATURE_KEYS.INVENTORY_MANAGEMENT,
    FEATURE_KEYS.CUSTOMER_MANAGEMENT,
    FEATURE_KEYS.QR_MENU_SYSTEM,
    FEATURE_KEYS.DISCOUNT_MANAGEMENT,
    FEATURE_KEYS.CARD_PAYMENT,
    FEATURE_KEYS.QR_PAYMENT,
    FEATURE_KEYS.ADVANCED_SALES_REPORTS,
    FEATURE_KEYS.DAILY_MONTHLY_ANALYTICS,
    FEATURE_KEYS.LOW_STOCK_ALERTS,
    FEATURE_KEYS.SUPPLIER_MANAGEMENT,
    FEATURE_KEYS.STAFF_ACTIVITY_LOGS
  ],
  PREMIUM: [
    FEATURE_KEYS.ADVANCED_INVENTORY_TRACKING,
    FEATURE_KEYS.LOYALTY_POINTS_SYSTEM,
    FEATURE_KEYS.ADVANCED_ANALYTICS,
    FEATURE_KEYS.PERFORMANCE_REPORTS,
    FEATURE_KEYS.MULTI_DEVICE_ACCESS,
    FEATURE_KEYS.SPLIT_BILLING,
    FEATURE_KEYS.EXPENSE_TRACKING,
    FEATURE_KEYS.CUSTOM_DISCOUNT_RULES,
    FEATURE_KEYS.PRIORITY_DASHBOARD_WIDGETS
  ],
  ENTERPRISE: [
    FEATURE_KEYS.MULTI_BRANCH_MANAGEMENT,
    FEATURE_KEYS.CENTRALIZED_ADMIN_DASHBOARD,
    FEATURE_KEYS.CUSTOM_BRANDING,
    FEATURE_KEYS.CUSTOM_REPORTS,
    FEATURE_KEYS.API_INTEGRATION,
    FEATURE_KEYS.ADVANCED_SECURITY,
    FEATURE_KEYS.ROLE_BASED_PERMISSIONS,
    FEATURE_KEYS.CLOUD_BACKUP,
    FEATURE_KEYS.DEDICATED_ACCOUNT_MANAGER,
    FEATURE_KEYS.CUSTOM_FEATURE_REQUESTS
  ]
};

const addonFeatureMap = {
  'Online Ordering System': FEATURE_KEYS.ONLINE_ORDERING_SYSTEM,
  'QR Menu System': FEATURE_KEYS.QR_MENU_SYSTEM,
  'Loyalty Program': FEATURE_KEYS.LOYALTY_POINTS_SYSTEM,
  'SMS Notification': FEATURE_KEYS.SMS_NOTIFICATION,
  'WhatsApp Notification': FEATURE_KEYS.WHATSAPP_NOTIFICATION,
  'Advanced Analytics': FEATURE_KEYS.ADVANCED_ANALYTICS,
  'Cloud Backup': FEATURE_KEYS.CLOUD_BACKUP,
  'Custom Domain': FEATURE_KEYS.CUSTOM_DOMAIN
};

const plans = [
  {
    id: 'STARTER',
    name: 'Starter Plan',
    pricing: { monthly: 1499, semiAnnual: 8990, annual: 17990 },
    suitableFor: ['Small Cafes', 'Food Stalls', 'Startup Restaurants'],
    limits: { staffAccounts: 3, branches: 1 },
    features: [
      'Authentication & Login',
      'Dashboard Overview',
      'Menu Management',
      'Category Management',
      'Table Management',
      'Dine-In Orders',
      'Takeaway Orders',
      'Basic Billing',
      'Cash Payment',
      'Basic Reports',
      'Order History',
      'Responsive Dashboard'
    ],
    support: { prioritySupport: false, trainingIncluded: false },
    featureKeys: planFeatureMap.STARTER
  },
  {
    id: 'STANDARD',
    name: 'Standard Plan',
    pricing: { monthly: 2499, semiAnnual: 14990, annual: 29990 },
    suitableFor: ['Growing Restaurants', 'Medium Cafes', 'Busy Food Businesses'],
    limits: { staffAccounts: 8, branches: 1 },
    features: [
      'Everything in Starter',
      'Kitchen Display System',
      'Inventory Management',
      'Customer Management',
      'QR Menu System',
      'Discount Management',
      'Card Payments',
      'QR Payments',
      'Advanced Sales Reports',
      'Daily & Monthly Analytics',
      'Low Stock Alerts',
      'Supplier Management',
      'Staff Activity Logs'
    ],
    support: { prioritySupport: true, trainingIncluded: true },
    recommended: true,
    featureKeys: [...planFeatureMap.STARTER, ...planFeatureMap.STANDARD]
  },
  {
    id: 'PREMIUM',
    name: 'Premium Plan',
    pricing: { monthly: 3999, semiAnnual: 23990, annual: 47990 },
    suitableFor: ['High Volume Restaurants', 'Large Cafes', 'Multi Floor Restaurants'],
    limits: { staffAccounts: 15, branches: 2 },
    features: [
      'Everything in Standard',
      'Advanced Inventory Tracking',
      'Loyalty Points System',
      'Advanced Analytics',
      'Performance Reports',
      'Multi Device Access',
      'Split Billing',
      'Expense Tracking',
      'Custom Discount Rules',
      'Priority Dashboard Widgets'
    ],
    support: { prioritySupport: true, trainingIncluded: true },
    featureKeys: [...planFeatureMap.STARTER, ...planFeatureMap.STANDARD, ...planFeatureMap.PREMIUM]
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise Plan',
    pricing: { monthly: 5999, semiAnnual: 35990, annual: 71990 },
    suitableFor: ['Restaurant Chains', 'Hotel Restaurants', 'Multi Branch Businesses'],
    limits: { staffAccounts: 'Unlimited', branches: 'Unlimited' },
    features: [
      'Everything in Premium',
      'Multi Branch Management',
      'Centralized Admin Dashboard',
      'Custom Branding',
      'Unlimited Staff Accounts',
      'Custom Reports',
      'API Integration',
      'Advanced Security',
      'Role Based Permissions',
      'Cloud Backup',
      'Dedicated Account Manager',
      'Custom Feature Requests'
    ],
    support: { prioritySupport: true, trainingIncluded: true, dedicatedSupport: true },
    featureKeys: [
      ...planFeatureMap.STARTER,
      ...planFeatureMap.STANDARD,
      ...planFeatureMap.PREMIUM,
      ...planFeatureMap.ENTERPRISE
    ]
  }
];

export const PLAN_CATALOG = {
  currency: 'NPR',
  profitMargin: '41.6%',
  plans,
  addons: [
    { name: 'Online Ordering System', monthlyPrice: 999 },
    { name: 'QR Menu System', monthlyPrice: 499 },
    { name: 'Loyalty Program', monthlyPrice: 799 },
    { name: 'SMS Notification', monthlyPrice: 499 },
    { name: 'WhatsApp Notification', monthlyPrice: 699 },
    { name: 'Advanced Analytics', monthlyPrice: 999 },
    { name: 'Cloud Backup', monthlyPrice: 499 },
    { name: 'Custom Domain', monthlyPrice: 299 }
  ],
  setupCharges: {
    basicSetup: { min: 5000, max: 15000 },
    menuDataEntry: { min: 3000, max: 10000 },
    staffTraining: { min: 3000, max: 7000 },
    customBranding: { startingFrom: 5000 },
    extraBranchSetup: { perBranch: 5000 }
  }
};

export const PLAN_FEATURES = planFeatureMap;
export const ADDON_FEATURES = addonFeatureMap;

