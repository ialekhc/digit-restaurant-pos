import { Category } from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const getCategories = asyncHandler(async (req, res) => {
  const { search = '' } = req.query;
  const query = search ? { name: { $regex: search, $options: 'i' } } : {};
  const data = await Category.find(query).sort({ name: 1 });
  res.json({ data });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) throw new ApiError(400, 'Category name is required');

  const data = await Category.create({ name, description });
  res.status(201).json({ data });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const data = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!data) throw new ApiError(404, 'Category not found');
  res.json({ data });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const data = await Category.findById(req.params.id);
  if (!data) throw new ApiError(404, 'Category not found');
  await data.deleteOne();
  res.json({ message: 'Category deleted' });
});
