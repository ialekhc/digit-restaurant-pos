import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    address: { type: String, default: '' },
    loyaltyPoints: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

customerSchema.index({ phone: 1 }, { unique: true });

export const Customer = mongoose.model('Customer', customerSchema);
