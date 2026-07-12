import { createPostgresModel } from './base/PostgresModel.js';

export const Table = createPostgresModel('Table', {
  collection: 'tables',
  defaults: {
    status: 'AVAILABLE'
  },
  unique: [['restaurantId', 'tableNumber']]
});
