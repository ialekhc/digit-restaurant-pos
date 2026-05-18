import { InventoryItem } from '../models/InventoryItem.js';
import { Supplier } from '../models/Supplier.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const getInventory = asyncHandler(async (req, res) => {
  const { search = '', lowStock = '' } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
      { unit: { $regex: search, $options: 'i' } }
    ];
  }

  let data = await InventoryItem.find(query).populate('supplier').sort({ createdAt: -1 });

  if (lowStock === 'true') {
    data = data.filter((item) => item.quantity <= item.minimumStockLevel);
  }

  res.json({ data });
});

export const createInventoryItem = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (payload.supplier) {
    const supplier = await Supplier.findById(payload.supplier);
    if (!supplier) throw new ApiError(404, 'Supplier not found');
  }

  const data = await InventoryItem.create(payload);
  const populated = await InventoryItem.findById(data._id).populate('supplier');

  res.status(201).json({ data: populated });
});

export const updateInventoryItem = asyncHandler(async (req, res) => {
  if (req.body.supplier) {
    const supplier = await Supplier.findById(req.body.supplier);
    if (!supplier) throw new ApiError(404, 'Supplier not found');
  }

  const data = await InventoryItem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  }).populate('supplier');

  if (!data) throw new ApiError(404, 'Inventory item not found');
  res.json({ data });
});

export const deleteInventoryItem = asyncHandler(async (req, res) => {
  const data = await InventoryItem.findById(req.params.id);
  if (!data) throw new ApiError(404, 'Inventory item not found');
  await data.deleteOne();

  res.json({ message: 'Inventory item deleted' });
});

export const updateStock = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (typeof quantity === 'undefined' || Number(quantity) < 0) {
    throw new ApiError(400, 'Quantity must be a non-negative number');
  }

  const data = await InventoryItem.findByIdAndUpdate(
    req.params.id,
    { quantity: Number(quantity) },
    { new: true, runValidators: true }
  ).populate('supplier');

  if (!data) throw new ApiError(404, 'Inventory item not found');
  res.json({ data });
});
