import { Customer } from '../models/Customer.js';
import { Order } from '../models/Order.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildTenantScopedQuery, withTenantFields } from '../services/tenantScopeService.js';

export const getCustomers = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;

  const query = search
    ? {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }
    : {};

  const scopedQuery = await buildTenantScopedQuery(req.user, query);
  const data = await Customer.find(scopedQuery).sort({ createdAt: -1 });
  res.json({ data });
});

export const createCustomer = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !phone) throw new ApiError(400, 'Name and phone are required');

  const data = await Customer.create(await withTenantFields(req.user, req.body));
  res.status(201).json({ data });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const data = await Customer.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!data) throw new ApiError(404, 'Customer not found');

  res.json({ data });
});

export const deleteCustomer = asyncHandler(async (req, res) => {
  const data = await Customer.findById(req.params.id);
  if (!data) throw new ApiError(404, 'Customer not found');
  await data.deleteOne();

  res.json({ message: 'Customer deleted' });
});

export const getCustomerOrderHistory = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const orders = await Order.find({ customer: customer._id })
    .populate('table')
    .sort({ createdAt: -1 });

  res.json({
    customer,
    orders
  });
});
