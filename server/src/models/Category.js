import mongoose from 'mongoose';

export const CATEGORY_MENU_TYPES = ['FOOD', 'DRINK', 'SMOKE'];

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    menuType: { type: String, enum: CATEGORY_MENU_TYPES, default: 'FOOD' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

categorySchema.index({ name: 1, menuType: 1 }, { unique: true });

export const Category = mongoose.model('Category', categorySchema);
