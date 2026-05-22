import { MenuItem } from '../models/MenuItem.js';
import { Category } from '../models/Category.js';
import { KITCHEN_SECTIONS } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

const CATEGORY_KEYS = ['category', 'Category', 'CATEGORY'];
const ITEM_KEYS = ['item', 'Item', 'ITEM', 'name', 'Name', 'NAME'];
const PRICE_KEYS = ['price', 'Price', 'PRICE', 'Price (Rs.)', 'Price (Rs)', 'Price Rs', 'Price(Rs.)'];
const DESCRIPTION_KEYS = ['description', 'Description', 'DESCRIPTION'];
const PREPARATION_TIME_KEYS = ['preparationTime', 'Preparation Time', 'Prep Time', 'prepTime'];
const AVAILABILITY_KEYS = ['isAvailable', 'Is Available', 'Available', 'Status'];
const KITCHEN_SECTION_KEYS = ['kitchenSection', 'Kitchen Section', 'Section'];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getFirstValue = (row, keys) => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && typeof row[key] !== 'undefined') {
      return row[key];
    }
  }
  return '';
};

const getTrimmedString = (row, keys) => {
  const value = getFirstValue(row, keys);
  return String(value ?? '').trim();
};

const parsePriceValue = (value) => {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const parsePreparationTime = (value) => {
  if (value === '' || value === null || typeof value === 'undefined') return 10;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 10;
  return parsed;
};

const parseAvailability = (value, defaultValue = true) => {
  if (value === '' || value === null || typeof value === 'undefined') return defaultValue;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'available', 'active'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', 'unavailable', 'inactive'].includes(normalized)) return false;
  return defaultValue;
};

const normalizeKitchenSection = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (KITCHEN_SECTIONS.includes(normalized)) return normalized;
  return 'FOOD';
};

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
  const { name, category, description, price, preparationTime, isAvailable, kitchenSection } = req.body;

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
    isAvailable: typeof isAvailable === 'string' ? isAvailable === 'true' : isAvailable,
    kitchenSection: kitchenSection || 'FOOD',
    image
  });

  const populated = await MenuItem.findById(data._id).populate('category');
  res.status(201).json({ data: populated });
});

export const importMenuItems = asyncHandler(async (req, res) => {
  const { rows, upsert = true } = req.body;

  if (!Array.isArray(rows) || !rows.length) {
    throw new ApiError(400, 'Rows array is required for menu import');
  }

  if (rows.length > 2000) {
    throw new ApiError(400, 'Maximum 2000 rows can be imported at once');
  }

  const summary = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    categoriesCreated: 0,
    errors: []
  };

  const categoryCache = new Map();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] || {};
    const rowNumber = Number(row.rowNumber) || index + 2;

    try {
      const categoryName = getTrimmedString(row, CATEGORY_KEYS);
      const itemName = getTrimmedString(row, ITEM_KEYS);
      const priceRaw = getFirstValue(row, PRICE_KEYS);

      const rowIsEmpty = !categoryName && !itemName && String(priceRaw ?? '').trim() === '';
      if (rowIsEmpty) {
        summary.skipped += 1;
        continue;
      }

      if (!categoryName || !itemName) {
        throw new Error('Category and Item are required');
      }

      const price = parsePriceValue(priceRaw);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error('Valid Price is required');
      }

      const preparationTime = parsePreparationTime(getFirstValue(row, PREPARATION_TIME_KEYS));
      const isAvailable = parseAvailability(getFirstValue(row, AVAILABILITY_KEYS), true);
      const kitchenSection = normalizeKitchenSection(getFirstValue(row, KITCHEN_SECTION_KEYS));
      const description = getTrimmedString(row, DESCRIPTION_KEYS);

      const categoryKey = categoryName.toLowerCase();
      let categoryDoc = categoryCache.get(categoryKey);

      if (!categoryDoc) {
        categoryDoc = await Category.findOne({ name: new RegExp(`^${escapeRegex(categoryName)}$`, 'i') });
        if (!categoryDoc) {
          categoryDoc = await Category.create({ name: categoryName });
          summary.categoriesCreated += 1;
        }
        categoryCache.set(categoryKey, categoryDoc);
      }

      const existing = await MenuItem.findOne({
        category: categoryDoc._id,
        name: new RegExp(`^${escapeRegex(itemName)}$`, 'i')
      });

      const payload = {
        name: itemName,
        category: categoryDoc._id,
        description,
        price,
        preparationTime,
        isAvailable,
        kitchenSection
      };

      if (existing) {
        if (!upsert) {
          summary.skipped += 1;
          continue;
        }
        Object.assign(existing, payload);
        await existing.save();
        summary.updated += 1;
      } else {
        await MenuItem.create(payload);
        summary.created += 1;
      }
    } catch (error) {
      if (summary.errors.length < 100) {
        summary.errors.push({
          row: rowNumber,
          message: error?.message || 'Failed to import row'
        });
      }
    }
  }

  res.json({ data: summary });
});

export const getMenuItemById = asyncHandler(async (req, res) => {
  const data = await MenuItem.findById(req.params.id).populate('category');
  if (!data) throw new ApiError(404, 'Menu item not found');
  res.json({ data });
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  const payload = { ...req.body };

  if (typeof payload.isAvailable === 'string') {
    payload.isAvailable = payload.isAvailable === 'true';
  }

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
