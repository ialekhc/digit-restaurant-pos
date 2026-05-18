import mongoose from 'mongoose';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '../config/constants.js';

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    billNumber: { type: String, required: true, unique: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    amountPaid: { type: Number, required: true, min: 0 },
    changeAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'PAID' },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
