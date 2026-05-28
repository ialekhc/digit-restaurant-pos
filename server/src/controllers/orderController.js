import { Order } from '../models/Order.js';
import { MenuItem } from '../models/MenuItem.js';
import { Table } from '../models/Table.js';
import { Customer } from '../models/Customer.js';
import { ORDER_STATUSES, ORDER_TYPES, ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { generateOrderNumber } from '../utils/serialGenerators.js';
import { syncTableStatusFromOrders } from '../services/tableWorkflowService.js';
import { ensureFeatureEnabled } from '../services/planService.js';

const validTransitions = {
  PENDING: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

const assertValidTransition = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) return;
  if (!validTransitions[currentStatus]?.includes(nextStatus)) {
    throw new ApiError(400, `Invalid status transition from ${currentStatus} to ${nextStatus}`);
  }
};

const ensureItemProgressBounds = (order) => {
  order.items.forEach((item) => {
    const quantity = Number(item.quantity || 0);
    item.readyQuantity = Math.min(quantity, Math.max(0, Number(item.readyQuantity || 0)));
    item.servedQuantity = Math.min(item.readyQuantity, Math.max(0, Number(item.servedQuantity || 0)));
  });
};

const allItemsReady = (order) =>
  order.items.every((item) => Number(item.readyQuantity || 0) >= Number(item.quantity || 0));

const allItemsServed = (order) =>
  order.items.every((item) => Number(item.servedQuantity || 0) >= Number(item.quantity || 0));

const reconcileOrderStatusFromItems = async (order) => {
  if (!order || order.status === 'CANCELLED' || order.status === 'COMPLETED') return order;

  ensureItemProgressBounds(order);

  const wasStatus = order.status;
  if (allItemsServed(order)) {
    order.status = 'SERVED';
  } else if (allItemsReady(order)) {
    order.status = 'READY';
  } else if (order.status === 'READY' || order.status === 'SERVED') {
    order.status = 'PREPARING';
  }

  if (order.isModified('items') || order.status !== wasStatus) {
    await order.save();
  }

  return order;
};

export const getOrders = asyncHandler(async (req, res) => {
  const { status = '', orderType = '', table = '', date = '', search = '', kitchenSection = '' } = req.query;

  const query = {};
  if (status) query.status = status;
  if (orderType) query.orderType = orderType;
  if (table) query.table = table;
  if (kitchenSection) query['items.kitchenSection'] = kitchenSection;

  if (date) {
    const from = new Date(date);
    const to = new Date(date);
    to.setDate(to.getDate() + 1);
    query.createdAt = { $gte: from, $lt: to };
  }

  if (search) {
    query.$or = [
      { orderNumber: { $regex: search, $options: 'i' } },
      { 'items.name': { $regex: search, $options: 'i' } }
    ];
  }

  const data = await Order.find(query)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role')
    .sort({ createdAt: -1 });

  await Promise.all(data.map((order) => reconcileOrderStatusFromItems(order)));

  res.json({ data });
});

export const createOrder = asyncHandler(async (req, res) => {
  const { orderType, table, customer, items, discount = 0 } = req.body;

  if (!ORDER_TYPES.includes(orderType)) {
    throw new ApiError(400, `Invalid order type. Allowed: ${ORDER_TYPES.join(', ')}`);
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Order must include at least one item');
  }

  if (orderType === 'DINE_IN') {
    await ensureFeatureEnabled(FEATURE_KEYS.DINE_IN_ORDERS, 'Dine-in orders are not available in the active plan');
  }
  if (orderType === 'TAKEAWAY') {
    await ensureFeatureEnabled(FEATURE_KEYS.TAKEAWAY_ORDERS, 'Takeaway orders are not available in the active plan');
  }
  if (orderType === 'DELIVERY') {
    await ensureFeatureEnabled(
      FEATURE_KEYS.DELIVERY_ORDER_MANAGEMENT,
      'Delivery order management is not available in the active plan'
    );
  }
  if (Number(discount || 0) > 0) {
    await ensureFeatureEnabled(
      FEATURE_KEYS.DISCOUNT_MANAGEMENT,
      'Discount management is not available in the active plan'
    );
  }

  if (orderType === 'DINE_IN' && !table) {
    throw new ApiError(400, 'Table is required for DINE_IN orders');
  }

  if (table) {
    const foundTable = await Table.findById(table);
    if (!foundTable) throw new ApiError(404, 'Table not found');
    if (foundTable.status === 'RESERVED' || foundTable.status === 'CLEANING') {
      throw new ApiError(400, `Table ${foundTable.tableNumber} is currently ${foundTable.status}`);
    }
  }

  if (customer) {
    const foundCustomer = await Customer.findById(customer);
    if (!foundCustomer) throw new ApiError(404, 'Customer not found');
  }

  const menuIds = items.map((item) => item.menuItem);
  const menuItems = await MenuItem.find({ _id: { $in: menuIds } });
  const menuMap = new Map(menuItems.map((m) => [String(m._id), m]));

  const normalizedItems = items.map((item) => {
    const menu = menuMap.get(String(item.menuItem));
    if (!menu) {
      throw new ApiError(404, `Menu item not found: ${item.menuItem}`);
    }
    if (!menu.isAvailable) {
      throw new ApiError(400, `${menu.name} is not available right now`);
    }

    const quantity = Number(item.quantity || 1);
    if (quantity <= 0) throw new ApiError(400, 'Item quantity must be at least 1');

    return {
      menuItem: menu._id,
      name: menu.name,
      price: menu.price,
      quantity,
      notes: item.notes || '',
      kitchenSection: menu.kitchenSection || 'FOOD',
      readyQuantity: 0,
      servedQuantity: 0
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));

  const data = await Order.create({
    orderNumber: generateOrderNumber(),
    orderType,
    table: table || undefined,
    customer: customer || undefined,
    items: normalizedItems,
    subtotal,
    discount: Number(discount || 0),
    total,
    status: 'PENDING',
    createdBy: req.user._id
  });

  await syncTableStatusFromOrders(data.table);

  const populated = await Order.findById(data._id)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');

  res.status(201).json({ data: populated });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const data = await Order.findById(req.params.id)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');

  if (!data) throw new ApiError(404, 'Order not found');
  await reconcileOrderStatusFromItems(data);
  res.json({ data });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, itemIndex, quantity = 1 } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status. Allowed: ${ORDER_STATUSES.join(', ')}`);
  }

  const role = req.user?.role;
  if (role === ROLES.KITCHEN && !['PREPARING', 'READY'].includes(status)) {
    throw new ApiError(403, 'Kitchen can only mark orders as PREPARING or READY');
  }
  if (role === ROLES.KITCHEN) {
    await ensureFeatureEnabled(
      FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM,
      'Kitchen display is not available in the active plan'
    );
  }
  if (role === ROLES.WAITER && status !== 'SERVED') {
    throw new ApiError(403, 'Waiter can only mark orders as SERVED');
  }

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  const currentStatus = order.status;
  if (currentStatus === 'CANCELLED' || currentStatus === 'COMPLETED') {
    throw new ApiError(400, `Cannot update status for ${currentStatus} order`);
  }

  ensureItemProgressBounds(order);

  if (status === 'READY') {
    if (role !== ROLES.KITCHEN && role !== ROLES.ADMIN && role !== ROLES.RESTAURANT_OWNER && role !== ROLES.MANAGER) {
      throw new ApiError(403, 'Only kitchen/admin roles can mark dishes ready');
    }
    if (currentStatus !== 'PREPARING' && currentStatus !== 'READY') {
      throw new ApiError(400, 'Order must be PREPARING or READY to mark dishes ready');
    }
    if (!Number.isInteger(Number(itemIndex))) {
      throw new ApiError(400, 'itemIndex is required to mark a dish ready');
    }

    const idx = Number(itemIndex);
    const dish = order.items[idx];
    if (!dish) throw new ApiError(400, 'Invalid itemIndex');

    const step = Number(quantity);
    if (!Number.isFinite(step) || step <= 0) {
      throw new ApiError(400, 'quantity must be a positive number');
    }

    dish.readyQuantity = Math.min(Number(dish.quantity || 0), Number(dish.readyQuantity || 0) + step);
    if (Number(dish.servedQuantity || 0) > Number(dish.readyQuantity || 0)) {
      dish.servedQuantity = Number(dish.readyQuantity || 0);
    }

    order.status = allItemsReady(order) ? 'READY' : 'PREPARING';
    await order.save();
  } else if (status === 'SERVED') {
    if (currentStatus !== 'PREPARING' && currentStatus !== 'READY' && currentStatus !== 'SERVED') {
      throw new ApiError(400, 'Order must be PREPARING, READY or SERVED to mark dishes served');
    }
    if (!Number.isInteger(Number(itemIndex))) {
      throw new ApiError(400, 'itemIndex is required to mark a dish served');
    }

    const idx = Number(itemIndex);
    const dish = order.items[idx];
    if (!dish) throw new ApiError(400, 'Invalid itemIndex');

    const step = Number(quantity);
    if (!Number.isFinite(step) || step <= 0) {
      throw new ApiError(400, 'quantity must be a positive number');
    }

    const maxServeable = Math.max(0, Number(dish.readyQuantity || 0) - Number(dish.servedQuantity || 0));
    if (maxServeable <= 0) {
      throw new ApiError(400, 'This dish has no ready quantity left to serve');
    }
    dish.servedQuantity = Math.min(Number(dish.readyQuantity || 0), Number(dish.servedQuantity || 0) + step);

    order.status = allItemsServed(order) ? 'SERVED' : 'READY';
    await order.save();
  } else {
    assertValidTransition(currentStatus, status);
    order.status = status;
    await order.save();
  }

  await syncTableStatusFromOrders(order.table);

  const data = await Order.findById(order._id)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');

  res.json({ data });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { reason = '' } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  if (order.status === 'COMPLETED') {
    throw new ApiError(400, 'Completed order cannot be cancelled');
  }

  order.status = 'CANCELLED';
  order.cancelledReason = reason;
  await order.save();

  await syncTableStatusFromOrders(order.table);

  const data = await Order.findById(order._id)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');

  res.json({ data });
});
