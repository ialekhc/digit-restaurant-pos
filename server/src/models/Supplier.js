import { createPostgresModel } from './base/PostgresModel.js';

export const Supplier = createPostgresModel('Supplier', {
  collection: 'suppliers',
  defaults: {
    email: '',
    address: '',
    companyName: ''
  }
});
