import { MenuItem } from '../models/MenuItem.js';
import { Order } from '../models/Order.js';
import { Table } from '../models/Table.js';
import { User } from '../models/User.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { generateOrderNumber } from '../utils/serialGenerators.js';
import { syncTableStatusFromOrders } from '../services/tableWorkflowService.js';
import { ensureFeatureEnabled } from '../services/planService.js';

const QR_ORDER_ROLES = [ROLES.WAITER, ROLES.MANAGER, ROLES.ADMIN, ROLES.RESTAURANT_OWNER];

const findQrOrderCreator = async () => {
  const user = await User.findOne({
    isActive: true,
    role: { $in: QR_ORDER_ROLES }
  }).sort({ createdAt: 1 });

  if (!user) {
    throw new ApiError(500, 'No active staff user found to register QR order');
  }
  return user;
};

export const getQrMenuByTable = asyncHandler(async (req, res) => {
  await ensureFeatureEnabled(FEATURE_KEYS.QR_MENU_SYSTEM, 'QR menu system is not available in the active plan');
  await ensureFeatureEnabled(FEATURE_KEYS.DINE_IN_ORDERS, 'Dine-in orders are not available in the active plan');

  const table = await Table.findById(req.params.tableId);
  if (!table) throw new ApiError(404, 'Table not found');
  if (table.status === 'RESERVED' || table.status === 'CLEANING') {
    throw new ApiError(400, `Table ${table.tableNumber} is currently ${table.status}`);
  }

  const menuItems = await MenuItem.find({ isAvailable: true }).populate('category').sort({ name: 1 });

  res.json({
    data: {
      table,
      menuItems
    }
  });
});

export const getQrMetaByTable = asyncHandler(async (req, res) => {
  await ensureFeatureEnabled(FEATURE_KEYS.QR_MENU_SYSTEM, 'QR menu system is not available in the active plan');
  await ensureFeatureEnabled(FEATURE_KEYS.DINE_IN_ORDERS, 'Dine-in orders are not available in the active plan');

  const table = await Table.findById(req.params.tableId);
  if (!table) throw new ApiError(404, 'Table not found');

  const latestMenuItem = await MenuItem.findOne().sort({ updatedAt: -1 }).select('updatedAt');
  const menuVersion = latestMenuItem?.updatedAt ? String(new Date(latestMenuItem.updatedAt).getTime()) : '0';

  res.json({
    data: {
      table: {
        _id: table._id,
        tableNumber: table.tableNumber
      },
      menuVersion
    }
  });
});

export const createQrOrder = asyncHandler(async (req, res) => {
  await ensureFeatureEnabled(FEATURE_KEYS.QR_MENU_SYSTEM, 'QR menu system is not available in the active plan');
  await ensureFeatureEnabled(FEATURE_KEYS.DINE_IN_ORDERS, 'Dine-in orders are not available in the active plan');

  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, 'Order must include at least one item');
  }

  const table = await Table.findById(req.params.tableId);
  if (!table) throw new ApiError(404, 'Table not found');
  if (table.status === 'RESERVED' || table.status === 'CLEANING') {
    throw new ApiError(400, `Table ${table.tableNumber} is currently ${table.status}`);
  }

  const menuIds = items.map((item) => item.menuItem);
  const menuItems = await MenuItem.find({ _id: { $in: menuIds } });
  const menuMap = new Map(menuItems.map((item) => [String(item._id), item]));

  const normalizedItems = items.map((item) => {
    const menu = menuMap.get(String(item.menuItem));
    if (!menu) throw new ApiError(404, `Menu item not found: ${item.menuItem}`);
    if (!menu.isAvailable) throw new ApiError(400, `${menu.name} is not available right now`);

    const quantity = Number(item.quantity || 1);
    if (quantity <= 0) throw new ApiError(400, 'Item quantity must be at least 1');

    return {
      menuItem: menu._id,
      name: menu.name,
      price: menu.price,
      quantity,
      notes: item.notes || '',
      kitchenSection: menu.kitchenSection || 'FOOD'
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const creator = await findQrOrderCreator();

  const created = await Order.create({
    orderNumber: generateOrderNumber(),
    orderType: 'DINE_IN',
    table: table._id,
    items: normalizedItems,
    subtotal,
    discount: 0,
    total: subtotal,
    status: 'PENDING',
    createdBy: creator._id
  });

  await syncTableStatusFromOrders(created.table);

  const populated = await Order.findById(created._id)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');

  res.status(201).json({ data: populated });
});
