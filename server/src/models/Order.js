import mongoose from 'mongoose';
import { ORDER_STATUSES, ORDER_TYPES } from '../config/constants.js';

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    notes: { type: String, default: '' }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    orderType: { type: String, enum: ORDER_TYPES, required: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: { type: [orderItemSchema], validate: [(v) => v.length > 0, 'Order must have at least one item'] },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ORDER_STATUSES, default: 'PENDING' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledReason: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Order = mongoose.model('Order', orderSchema);
