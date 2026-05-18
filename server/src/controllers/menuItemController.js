import { MenuItem } from '../models/MenuItem.js';
import { Category } from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const getMenuItems = asyncHandler(async (req, res) => {
  const { search = '', category = '', available } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  if (category) query.category = category;
  if (typeof available !== 'undefined') query.isAvailable = available === 'true';

  const data = await MenuItem.find(query).populate('category').sort({ createdAt: -1 });
  res.json({ data });
});

export const createMenuItem = asyncHandler(async (req, res) => {
  const { name, category, description, price, preparationTime, isAvailable } = req.body;

  if (!name || !category || typeof price === 'undefined') {
    throw new ApiError(400, 'Name, category and price are required');
  }

  const categoryExists = await Category.findById(category);
  if (!categoryExists) throw new ApiError(404, 'Category not found');

  const image = req.file ? `/uploads/${req.file.filename}` : '';

  const data = await MenuItem.create({
    name,
    category,
    description,
    price,
    preparationTime,
    isAvailable,
    image
  });

  const populated = await MenuItem.findById(data._id).populate('category');
  res.status(201).json({ data: populated });
});

export const getMenuItemById = asyncHandler(async (req, res) => {
  const data = await MenuItem.findById(req.params.id).populate('category');
  if (!data) throw new ApiError(404, 'Menu item not found');
  res.json({ data });
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (req.file) {
    payload.image = `/uploads/${req.file.filename}`;
  }

  const data = await MenuItem.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  }).populate('category');

  if (!data) throw new ApiError(404, 'Menu item not found');
  res.json({ data });
});

export const deleteMenuItem = asyncHandler(async (req, res) => {
  const data = await MenuItem.findById(req.params.id);
  if (!data) throw new ApiError(404, 'Menu item not found');

  await data.deleteOne();
  res.json({ message: 'Menu item deleted' });
});
