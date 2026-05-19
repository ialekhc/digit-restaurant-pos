import { Vendor } from '../models/Vendor.js';

export const vendorRepository = {
  baseQuery(query = {}) {
    return Vendor.find(query).populate('createdBy', 'name role').populate('loginUser', 'name email role isActive');
  },

  findMany(query) {
    return this.baseQuery(query).sort({ createdAt: -1 });
  },

  findById(id) {
    return this.baseQuery({ _id: id }).findOne();
  },

  create(payload) {
    return Vendor.create(payload);
  }
};
