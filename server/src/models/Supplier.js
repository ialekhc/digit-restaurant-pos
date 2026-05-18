import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    address: { type: String, default: '' },
    companyName: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Supplier = mongoose.model('Supplier', supplierSchema);
