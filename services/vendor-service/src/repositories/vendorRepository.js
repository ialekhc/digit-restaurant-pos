import { Vendor } from '../models/Vendor.js';

export const vendorRepository = {
  baseQuery(query = {}) {
    return Vendor.find(query).populate('createdBy', 'name role').populate('loginUser', 'name email role isActive');
  },

  findMany(query) {
    return this.baseQuery(query).sort({ createdAt: -1 });
  },

  findById(id) {
    return Vendor.findById(id).populate('createdBy', 'name role').populate('loginUser', 'name email role isActive');
  },

  create(payload) {
    return Vendor.create(payload);
  }
};
