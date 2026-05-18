import mongoose from 'mongoose';
import { TABLE_STATUSES } from '../config/constants.js';

const tableSchema = new mongoose.Schema(
  {
    tableNumber: { type: String, required: true, unique: true, trim: true },
    seatingCapacity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: TABLE_STATUSES, default: 'AVAILABLE' }
  },
  { timestamps: true }
);

export const Table = mongoose.model('Table', tableSchema);
