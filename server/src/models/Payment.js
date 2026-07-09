import { createPostgresModel } from './base/PostgresModel.js';

export const Payment = createPostgresModel('Payment', {
  collection: 'payments',
  refs: {
    order: 'Order',
    paidBy: 'User',
    receivedBy: 'User',
    'creditHistory.receivedBy': 'User'
  },
  defaults: {
    changeAmount: 0,
    paymentStatus: 'PAID',
    creditNote: '',
    creditHistory: []
  },
  unique: [['order'], ['billNumber']]
});
