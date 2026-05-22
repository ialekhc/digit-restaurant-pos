import mongoose from 'mongoose';
import { PURCHASE_TYPES } from '../config/constants.js';

const PURCHASE_PAYMENT_MODES = ['CASH', 'CREDIT', 'CARD', 'ONLINE', 'OTHER'];

const purchaseEntrySchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true, trim: true },
    type: { type: String, enum: PURCHASE_TYPES, required: true },
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    itemName: { type: String, required: true, trim: true },
    category: { type: String, default: '', trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    unitPrice: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    paymentMode: { type: String, enum: PURCHASE_PAYMENT_MODES, default: 'CASH' },
    invoiceNumber: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
    previousStock: { type: Number, required: true, min: 0 },
    nextStock: { type: Number, required: true, min: 0 },
    transactionDate: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

purchaseEntrySchema.index({ transactionDate: -1 });
purchaseEntrySchema.index({ type: 1, transactionDate: -1 });

export const PurchaseEntry = mongoose.model('PurchaseEntry', purchaseEntrySchema);
