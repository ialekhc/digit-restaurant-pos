import { createPostgresModel } from './base/PostgresModel.js';

export const InventoryItem = createPostgresModel('InventoryItem', {
  collection: 'inventory_items',
  refs: {
    supplier: 'Supplier'
  },
  defaults: {
    minimumStockLevel: 10,
    supplier: null,
    purchasePrice: 0
  },
  unique: [['restaurantId', 'name']]
});
