import { Category, CATEGORY_MENU_TYPES } from '../models/Category.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildTenantScopedQuery, withTenantFields } from '../services/tenantScopeService.js';

const normalizeMenuType = (value, fallback = 'FOOD') => {
  const normalized = String(value ?? fallback).trim().toUpperCase();
  return CATEGORY_MENU_TYPES.includes(normalized) ? normalized : fallback;
};

const buildCategoryMenuTypeFilter = (menuType) => {
  if (menuType === 'DRINK') {
    return {
      $or: [{ menuType: 'DRINK' }]
    };
  }

  if (menuType === 'SMOKE') {
    return {
      $or: [{ menuType: 'SMOKE' }]
    };
  }

  return {
    $or: [
      { menuType: 'FOOD' },
      { menuType: { $exists: false } },
      { menuType: null }
    ]
  };
};

export const getCategories = asyncHandler(async (req, res) => {
  const { search = '', menuType = '' } = req.query;
  const andConditions = [];

  if (search) andConditions.push({ name: { $regex: search, $options: 'i' } });
  if (menuType) andConditions.push(buildCategoryMenuTypeFilter(normalizeMenuType(menuType)));

  const query = await buildTenantScopedQuery(req.user, andConditions.length ? { $and: andConditions } : {});
  const data = await Category.find(query).sort({ name: 1 });
  res.json({ data });
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, menuType } = req.body;
  if (!name) throw new ApiError(400, 'Category name is required');

  const data = await Category.create(await withTenantFields(req.user, { name, description, menuType: normalizeMenuType(menuType) }));
  res.status(201).json({ data });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (typeof payload.menuType !== 'undefined') {
    payload.menuType = normalizeMenuType(payload.menuType);
  }

  const data = await Category.findByIdAndUpdate(req.params.id, payload, {
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
