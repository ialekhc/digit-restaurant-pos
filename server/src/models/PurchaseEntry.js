import { createPostgresModel } from './base/PostgresModel.js';

export const PurchaseEntry = createPostgresModel('PurchaseEntry', {
  collection: 'purchase_entries',
  refs: {
    inventoryItem: 'InventoryItem',
    supplier: 'Supplier',
    createdBy: 'User'
  },
  defaults: {
    supplier: null,
    category: '',
    unitPrice: 0,
    totalAmount: 0,
    paymentMode: 'CASH',
    invoiceNumber: '',
    notes: '',
    transactionDate: () => new Date().toISOString()
  },
  unique: [['purchaseNumber']]
});
