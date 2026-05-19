export const PLAN_CATALOG = {
  plans: [
    { id: 'STARTER', pricing: { monthly: 1499, semiAnnual: 8990, annual: 17990 } },
    { id: 'STANDARD', pricing: { monthly: 2499, semiAnnual: 14990, annual: 29990 } },
    { id: 'PREMIUM', pricing: { monthly: 3999, semiAnnual: 23990, annual: 47990 } },
    { id: 'ENTERPRISE', pricing: { monthly: 5999, semiAnnual: 35990, annual: 71990 } }
  ],
  addons: [
    { name: 'Online Ordering System', monthlyPrice: 999 },
    { name: 'QR Menu System', monthlyPrice: 499 },
    { name: 'Loyalty Program', monthlyPrice: 799 },
    { name: 'SMS Notification', monthlyPrice: 499 },
    { name: 'WhatsApp Notification', monthlyPrice: 699 },
    { name: 'Advanced Analytics', monthlyPrice: 999 },
    { name: 'Cloud Backup', monthlyPrice: 499 },
    { name: 'Custom Domain', monthlyPrice: 299 }
  ]
};
