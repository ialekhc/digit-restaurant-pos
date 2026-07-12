import { createPostgresModel } from './base/PostgresModel.js';

export const Vendor = createPostgresModel('Vendor', {
  collection: 'vendors',
  refs: {
    createdBy: 'User',
    loginUser: 'User'
  },
  defaults: {
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    isActive: true,
    subscription: () => ({
      planId: 'STARTER',
      billingCycle: 'monthly',
      amount: 0,
      addons: [],
      status: 'ACTIVE',
      startsOn: new Date().toISOString()
    }),
    subscriptionHistory: [],
    paymentHistory: [],
    totalPaid: 0,
    notes: '',
    loginUser: null,
    loginEmail: '',
    loginEnabled: false
  },
  unique: [['vendorName']]
});
