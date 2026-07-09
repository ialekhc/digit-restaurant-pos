import { createPostgresModel } from './base/PostgresModel.js';

export const Customer = createPostgresModel('Customer', {
  collection: 'customers',
  defaults: {
    email: '',
    address: '',
    loyaltyPoints: 0
  },
  unique: [['phone']]
});
