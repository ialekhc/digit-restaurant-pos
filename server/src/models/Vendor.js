import mongoose from 'mongoose';

const vendorPaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'CARD', 'QR', 'ONLINE', 'BANK_TRANSFER'],
      default: 'ONLINE'
    },
    paymentDate: { type: Date, default: Date.now },
    reference: { type: String, default: '' },
    note: { type: String, default: '' }
  }
);

const vendorSubscriptionSchema = new mongoose.Schema(
  {
    planId: { type: String, required: true, trim: true, default: 'STARTER' },
    billingCycle: { type: String, enum: ['monthly', 'semiAnnual', 'annual'], default: 'monthly' },
    amount: { type: Number, required: true, min: 0, default: 0 },
    addons: { type: [String], default: [] },
    status: { type: String, enum: ['ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'], default: 'ACTIVE' },
    startsOn: { type: Date, default: Date.now },
    endsOn: { type: Date },
    nextBillingDate: { type: Date }
  },
  { _id: false }
);

const vendorSchema = new mongoose.Schema(
  {
    vendorName: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    isActive: { type: Boolean, default: true },
    subscription: { type: vendorSubscriptionSchema, default: () => ({}) },
    paymentHistory: { type: [vendorPaymentSchema], default: [] },
    totalPaid: { type: Number, default: 0, min: 0 },
    lastPaymentDate: { type: Date },
    notes: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

vendorSchema.index({ vendorName: 1 }, { unique: true });
vendorSchema.index({ 'subscription.status': 1 });
vendorSchema.index({ 'subscription.planId': 1 });

export const Vendor = mongoose.model('Vendor', vendorSchema);
