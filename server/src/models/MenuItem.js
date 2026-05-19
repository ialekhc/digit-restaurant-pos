import mongoose from 'mongoose';
import { KITCHEN_SECTIONS } from '../config/constants.js';

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: '' },
    preparationTime: { type: Number, default: 10, min: 0 },
    isAvailable: { type: Boolean, default: true },
    kitchenSection: { type: String, enum: KITCHEN_SECTIONS, default: 'FOOD' }
  },
  { timestamps: true }
);

menuItemSchema.index({ name: 1, category: 1 }, { unique: true });

export const MenuItem = mongoose.model('MenuItem', menuItemSchema);
