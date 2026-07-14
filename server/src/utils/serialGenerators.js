import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PurchaseEntry } from '../models/PurchaseEntry.js';

const compactSerial = (prefix, value) => `${prefix}-${String(value).padStart(4, '0')}`;

const generateScopedSerial = async ({ model, field, prefix }) => {
  let nextNumber = (await model.countDocuments({})) + 1001;

  while (await model.findOne({ [field]: compactSerial(prefix, nextNumber) })) {
    nextNumber += 1;
  }

  return compactSerial(prefix, nextNumber);
};

export const generateOrderNumber = (user) =>
  generateScopedSerial({ model: Order, field: 'orderNumber', prefix: 'ORD', user });

export const generateBillNumber = (user) =>
  generateScopedSerial({ model: Payment, field: 'billNumber', prefix: 'BILL', user });

export const generatePurchaseNumber = (user) =>
  generateScopedSerial({ model: PurchaseEntry, field: 'purchaseNumber', prefix: 'PUR', user });
