import mongoose from 'mongoose';
import { LOW_STOCK_THRESHOLD_DEFAULT } from '../config/constants.js';

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
    minimumStockLevel: { type: Number, default: LOW_STOCK_THRESHOLD_DEFAULT, min: 0 },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    purchasePrice: { type: Number, default: 0, min: 0 },
    expiryDate: { type: Date }
  },
  { timestamps: true }
);

inventoryItemSchema.index({ name: 1 }, { unique: true });

export const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
