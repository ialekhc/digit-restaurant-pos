import mongoose from 'mongoose';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from '../config/constants.js';

const creditHistorySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    note: { type: String, default: '' },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    billNumber: { type: String, required: true, unique: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    amountPaid: { type: Number, required: true, min: 0 },
    changeAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'PAID' },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    creditNote: { type: String, default: '' },
    settledAt: { type: Date },
    creditHistory: { type: [creditHistorySchema], default: [] }
  },
  { timestamps: true }
);

export const Payment = mongoose.model('Payment', paymentSchema);
