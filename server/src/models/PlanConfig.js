import mongoose from 'mongoose';

const planConfigSchema = new mongoose.Schema(
  {
    activePlanId: { type: String, required: true, default: 'STANDARD', trim: true },
    billingCycle: { type: String, enum: ['monthly', 'semiAnnual', 'annual'], default: 'monthly' },
    addons: { type: [String], default: [] },
    currency: { type: String, default: 'NPR', trim: true },
    profitMargin: { type: String, default: '41.6%', trim: true }
  },
  { timestamps: true }
);

export const PlanConfig = mongoose.model('PlanConfig', planConfigSchema);
