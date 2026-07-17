import { Order } from '../models/Order.js';
import { MenuItem } from '../models/MenuItem.js';
import { Table } from '../models/Table.js';
import { Customer } from '../models/Customer.js';
import { Payment } from '../models/Payment.js';
import { ORDER_STATUSES, ORDER_TYPES, PERMISSIONS, ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { generateOrderNumber } from '../utils/serialGenerators.js';
import { syncTableStatusFromOrders } from '../services/tableWorkflowService.js';
import { ensureFeatureEnabled } from '../services/planService.js';
import { hasPermission } from '../services/permissionService.js';
import { buildTenantScopedQuery, withTenantFields } from '../services/tenantScopeService.js';
import {
  createAddedItemPrintJobs,
  createCancellationPrintJob,
  createStationPrintJobs,
  stationFromMenu,
  stationToKitchenSection
} from '../services/printService.js';

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

const OWNER_OVERRIDE_ROLES = [ROLES.SUPER_ADMIN, ROLES.RESTAURANT_OWNER];

const STATUS_BY_ROLE = {
  [ROLES.KITCHEN]: ['PREPARING', 'READY'],
  [ROLES.BARISTA]: ['PREPARING', 'READY'],
  [ROLES.WAITER]: ['PREPARING', 'READY', 'SERVED'],
  [ROLES.CASHIER]: ['SERVED', 'COMPLETED'],
  [ROLES.MANAGER]: ['PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED'],
  [ROLES.ADMIN]: ['PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED']
};

const ensureStatusAllowedForRole = (user, status) => {
  if (OWNER_OVERRIDE_ROLES.includes(user?.role)) return;
  const allowed = STATUS_BY_ROLE[user?.role] || [];
  if (!allowed.includes(status)) {
    throw new ApiError(403, 'You are not allowed to set this order status');
  }
};

const findScopedOrderById = async (req, id) => {
  const query = await buildTenantScopedQuery(req.user, { _id: id }, { userFields: ['createdBy'] });
  return Order.findOne(query);
};

const findPopulatedScopedOrderById = async (req, id) => {
  const query = await buildTenantScopedQuery(req.user, { _id: id }, { userFields: ['createdBy'] });
  return Order.findOne(query)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');
};

const recalculateOrderTotals = (order) => {
  order.subtotal = order.items.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
  order.total = Math.max(0, Number(order.subtotal || 0) - Number(order.discount || 0));
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

const includesAny = (value, patterns) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return patterns.some((pattern) => normalized.includes(pattern));
};

const isInstantServeSmokeItem = (menu) => {
  const menuType = String(menu.menuType || '').toUpperCase();
  if (menuType !== 'SMOKE') return false;

  const categoryName = menu.category?.name || '';
  const itemName = menu.name || '';
  return includesAny(categoryName, ['cigarette', 'cigar']) || includesAny(itemName, ['cigarette', 'cigar']);
};

const resolveProductionSection = (menu) => {
  const menuType = String(menu.menuType || '').toUpperCase();

  if (menuType === 'DRINK') return 'BAR';

  if (menuType === 'SMOKE') {
    return 'SMOKE';
  }

  return menu.kitchenSection || 'FOOD';
};

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
  if (orderType && !ORDER_TYPES.includes(orderType)) {
    throw new ApiError(400, `Invalid order type. Allowed: ${ORDER_TYPES.join(', ')}`);
  }
  query.orderType = orderType || { $in: ORDER_TYPES };
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

  const scopedQuery = await buildTenantScopedQuery(req.user, query, { userFields: ['createdBy'] });
  const data = await Order.find(scopedQuery)
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
    const foundTable = await Table.findOne(
      await buildTenantScopedQuery(req.user, { _id: table }, {
        userFields: ['createdBy'],
        includeCustomerTenant: true
      })
    );
    if (!foundTable) throw new ApiError(404, 'Table not found');
    if (foundTable.status === 'RESERVED' || foundTable.status === 'Unavailable') {
      throw new ApiError(400, `Table ${foundTable.tableNumber} is currently ${foundTable.status}`);
    }
  }

  if (customer) {
    const foundCustomer = await Customer.findOne(
      await buildTenantScopedQuery(req.user, { _id: customer }, {
        userFields: ['createdBy'],
        includeCustomerTenant: true
      })
    );
    if (!foundCustomer) throw new ApiError(404, 'Customer not found');
  }

  const menuIds = items.map((item) => item.menuItem);
  const menuItems = await MenuItem.find(
    await buildTenantScopedQuery(req.user, { _id: { $in: menuIds } }, {
      userFields: ['createdBy'],
      includeCustomerTenant: true
    })
  ).populate('category', 'name');
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

    const preparationStation = stationFromMenu(menu);
    const kitchenSection = stationToKitchenSection(preparationStation) || resolveProductionSection(menu);
    const instantServe = isInstantServeSmokeItem(menu);
    return {
      menuItem: menu._id,
      name: menu.name,
      price: menu.price,
      quantity,
      notes: item.notes || '',
      kitchenSection,
      preparationStation,
      readyQuantity: instantServe ? quantity : 0,
      servedQuantity: 0
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const initialStatus = normalizedItems.every((item) => Number(item.readyQuantity || 0) >= Number(item.quantity || 0))
    ? 'READY'
    : 'PENDING';

  const data = await Order.create(await withTenantFields(req.user, {
    orderNumber: await generateOrderNumber(req.user),
    orderType,
    table: table || undefined,
    customer: customer || undefined,
    items: normalizedItems,
    subtotal,
    discount: Number(discount || 0),
    total,
    status: initialStatus,
    createdBy: req.user._id
  }));

  await syncTableStatusFromOrders(data.table);

  const populated = await Order.findById(data._id)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');

  const printJobs = await createStationPrintJobs({ user: req.user, order: populated, source: 'INITIAL_ORDER' });

  res.status(201).json({
    data: {
      ...(populated.toJSON ? populated.toJSON() : populated),
      printJobs
    }
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const data = await findPopulatedScopedOrderById(req, req.params.id);

  if (!data) throw new ApiError(404, 'Order not found');
  await reconcileOrderStatusFromItems(data);
  res.json({ data });
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, itemIndex, quantity = 1 } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status. Allowed: ${ORDER_STATUSES.join(', ')}`);
  }

  const canKitchenUpdate = hasPermission(req.user, PERMISSIONS.KITCHEN_UPDATE_STATUS);
  const canOrderUpdate = hasPermission(req.user, PERMISSIONS.ORDER_UPDATE);
  ensureStatusAllowedForRole(req.user, status);
  if (canKitchenUpdate && !canOrderUpdate && !['PREPARING', 'READY'].includes(status)) {
    throw new ApiError(403, 'Kitchen and bar can only mark orders as PREPARING or READY');
  }
  if (canKitchenUpdate) {
    await ensureFeatureEnabled(
      FEATURE_KEYS.KITCHEN_DISPLAY_SYSTEM,
      'Kitchen display is not available in the active plan'
    );
  }

  const order = await findScopedOrderById(req, req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  const currentStatus = order.status;
  if (currentStatus === 'CANCELLED' || currentStatus === 'COMPLETED') {
    throw new ApiError(400, `Cannot update status for ${currentStatus} order`);
  }

  ensureItemProgressBounds(order);

  if (status === 'READY') {
    if (!canKitchenUpdate) {
      throw new ApiError(403, 'Only kitchen, bar, or admin roles can mark dishes ready');
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

export const updateOrderItems = asyncHandler(async (req, res) => {
  const { items = [] } = req.body;

  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, 'Order must include at least one item');
  }

  const order = await findScopedOrderById(req, req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
    throw new ApiError(400, `Cannot edit items for ${order.status} order`);
  }

  const existingPayment = await Payment.findOne({ order: order._id });
  if (existingPayment) {
    throw new ApiError(409, 'Cannot edit order items after payment has been created');
  }

  const existingItemsById = new Map((order.items || []).map((item) => [String(item._id), item]));
  const existingItemsByMenu = new Map((order.items || []).map((item) => [String(item.menuItem), item]));

  const normalizedItems = items.map((item) => {
    const existingItem = item._id
      ? existingItemsById.get(String(item._id))
      : existingItemsByMenu.get(String(item.menuItem));

    if (!existingItem) {
      throw new ApiError(400, 'Only existing order items can be edited during billing');
    }

    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, 'Item quantity must be greater than 0');
    }

    return {
      ...existingItem,
      quantity,
      notes: typeof item.notes === 'undefined' ? existingItem.notes || '' : String(item.notes || ''),
      preparationStation: existingItem.preparationStation || (existingItem.kitchenSection === 'FOOD' ? 'KITCHEN' : existingItem.kitchenSection),
      readyQuantity: Math.min(quantity, Math.max(0, Number(existingItem.readyQuantity || 0))),
      servedQuantity: Math.min(quantity, Math.max(0, Number(existingItem.servedQuantity || 0)))
    };
  });

  order.items = normalizedItems;
  recalculateOrderTotals(order);
  await order.save();
  await syncTableStatusFromOrders(order.table);

  const data = await Order.findById(order._id)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');

  res.json({ data });
});

export const cancelOrder = asyncHandler(async (req, res) => {
  const { reason = '' } = req.body;

  const order = await findScopedOrderById(req, req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
    throw new ApiError(400, `${order.status} order cannot be cancelled`);
  }
  if (req.user?.role === ROLES.CUSTOMER && order.status !== 'PENDING') {
    throw new ApiError(403, 'Customers can only cancel pending orders');
  }

  order.status = 'CANCELLED';
  order.cancelledReason = String(reason || '').trim();
  order.cancellationHistory = [
    ...(order.cancellationHistory || []),
    {
      type: 'ORDER',
      reason: order.cancelledReason,
      cancelledBy: req.user?._id,
      cancelledAt: new Date().toISOString(),
      items: (order.items || []).map((item) => ({
        itemId: item._id,
        menuItem: item.menuItem,
        name: item.name,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 0)
      }))
    }
  ];
  await order.save();

  await syncTableStatusFromOrders(order.table);

  const data = await Order.findById(order._id)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');

  res.json({ data });
});

export const cancelOrderItems = asyncHandler(async (req, res) => {
  const { items = [], reason = '' } = req.body;

  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, 'Select at least one item to cancel');
  }

  const order = await findScopedOrderById(req, req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  if (['COMPLETED', 'CANCELLED'].includes(order.status)) {
    throw new ApiError(400, `Cannot cancel items from ${order.status} order`);
  }
  if (req.user?.role === ROLES.CUSTOMER && order.status !== 'PENDING') {
    throw new ApiError(403, 'Customers can only cancel items from pending orders');
  }

  const existingPayment = await Payment.findOne({ order: order._id });
  if (existingPayment) {
    throw new ApiError(409, 'Cannot cancel individual items after payment has been created');
  }

  const requestedById = new Map();
  items.forEach((selection) => {
    const itemId = String(selection?.itemId || '');
    const quantity = Number(selection?.quantity);
    if (!itemId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      throw new ApiError(400, 'Each cancelled item must have a valid itemId and whole-number quantity');
    }
    if (requestedById.has(itemId)) {
      throw new ApiError(400, 'Each order item can only be selected once');
    }
    requestedById.set(itemId, quantity);
  });

  const cancelledItems = [];
  const remainingItems = [];
  for (const item of order.items || []) {
    const cancelledQuantity = requestedById.get(String(item._id));
    if (!cancelledQuantity) {
      remainingItems.push(item);
      continue;
    }

    const currentQuantity = Number(item.quantity || 0);
    if (cancelledQuantity > currentQuantity) {
      throw new ApiError(400, `Cannot cancel more than ${currentQuantity} x ${item.name}`);
    }

    cancelledItems.push({
      itemId: item._id,
      menuItem: item.menuItem,
      name: item.name,
      price: Number(item.price || 0),
      quantity: cancelledQuantity,
      preparationStation: item.preparationStation,
      kitchenSection: item.kitchenSection,
      notes: item.notes || ''
    });

    const quantity = currentQuantity - cancelledQuantity;
    if (quantity > 0) {
      item.quantity = quantity;
      item.readyQuantity = Math.min(quantity, Math.max(0, Number(item.readyQuantity || 0)));
      item.servedQuantity = Math.min(item.readyQuantity, Math.max(0, Number(item.servedQuantity || 0)));
      remainingItems.push(item);
    }
  }

  if (cancelledItems.length !== requestedById.size) {
    throw new ApiError(400, 'One or more selected items are not part of this order');
  }
  if (!remainingItems.length) {
    throw new ApiError(400, 'Use entire order cancellation when cancelling every item');
  }

  order.items = remainingItems;
  order.cancellationHistory = [
    ...(order.cancellationHistory || []),
    {
      type: 'ITEMS',
      reason: String(reason || '').trim(),
      cancelledBy: req.user?._id,
      cancelledAt: new Date().toISOString(),
      items: cancelledItems
    }
  ];
  recalculateOrderTotals(order);
  ensureItemProgressBounds(order);
  await order.save();
  await reconcileOrderStatusFromItems(order);
  await syncTableStatusFromOrders(order.table);

  const data = await Order.findById(order._id)
    .populate('table')
    .populate('customer')
    .populate('createdBy', 'name role');

  res.json({ data, cancelledItems });
});

export const deleteOrder = asyncHandler(async (req, res) => {
  if (!OWNER_OVERRIDE_ROLES.includes(req.user?.role)) {
    throw new ApiError(403, 'Only super admins and restaurant owners can delete orders');
  }

  const order = await findScopedOrderById(req, req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');

  await order.deleteOne();
  await syncTableStatusFromOrders(order.table);

  res.json({ message: 'Order deleted' });
});

export const printStationTickets = asyncHandler(async (req, res) => {
  const order = await findPopulatedScopedOrderById(req, req.params.orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const data = await createStationPrintJobs({ user: req.user, order, source: req.body?.source || 'INITIAL_ORDER' });
  res.status(201).json({ data });
});

export const printAddedItems = asyncHandler(async (req, res) => {
  const order = await findPopulatedScopedOrderById(req, req.params.orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const itemIds = new Set((req.body?.itemIds || []).map(String));
  const items = itemIds.size ? (order.items || []).filter((item) => itemIds.has(String(item._id))) : req.body?.items || [];
  if (!items.length) throw new ApiError(400, 'At least one added item is required');

  const data = await createAddedItemPrintJobs({ user: req.user, order, items });
  res.status(201).json({ data });
});

export const printCancellation = asyncHandler(async (req, res) => {
  const order = await findPopulatedScopedOrderById(req, req.params.orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const itemIds = new Set((req.body?.itemIds || []).map(String));
  const items = itemIds.size ? (order.items || []).filter((item) => itemIds.has(String(item._id))) : req.body?.items || [];
  if (!items.length) throw new ApiError(400, 'At least one cancelled item is required');

  const data = await createCancellationPrintJob({
    user: req.user,
    order,
    items,
    reason: req.body?.reason || '',
    cancelledBy: req.user?.name || req.user?.email || ''
  });
  res.status(201).json({ data });
});

export const printReceipt = asyncHandler(async (req, res) => {
  const order = await findScopedOrderById(req, req.params.orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  const payment = await Payment.findOne({ order: order._id }).populate('paidBy', 'name role');
  if (!payment) throw new ApiError(404, 'Payment not found for this order');

  const data = await createCounterReceiptJob({ user: req.user, payment, force: true });
  res.status(201).json({ data });
});
