import { Supplier } from '../models/Supplier.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildTenantScopedQuery, withTenantFields } from '../services/tenantScopeService.js';

export const getSuppliers = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const query = search
    ? {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { companyName: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }
    : {};

  const scopedQuery = await buildTenantScopedQuery(req.user, query);
  const data = await Supplier.find(scopedQuery).sort({ createdAt: -1 });
  res.json({ data });
});

export const createSupplier = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) throw new ApiError(400, 'Name and phone are required');

  const data = await Supplier.create(await withTenantFields(req.user, req.body));
  res.status(201).json({ data });
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const data = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!data) throw new ApiError(404, 'Supplier not found');
  res.json({ data });
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  const data = await Supplier.findById(req.params.id);
  if (!data) throw new ApiError(404, 'Supplier not found');

  await data.deleteOne();
  res.json({ message: 'Supplier deleted' });
});
