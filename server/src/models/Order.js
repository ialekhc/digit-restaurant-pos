import { createPostgresModel } from './base/PostgresModel.js';

export const Order = createPostgresModel('Order', {
  collection: 'orders',
  refs: {
    table: 'Table',
    customer: 'Customer',
    createdBy: 'User',
    'items.menuItem': 'MenuItem'
  },
  defaults: {
    items: [],
    discount: 0,
    status: 'PENDING',
    cancelledReason: ''
  },
  unique: [['orderNumber']]
});
