import { Table } from '../models/Table.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { ACTIVE_ORDER_STATUSES, TABLE_STATUSES } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { syncTableStatusFromOrders } from '../services/tableWorkflowService.js';
import { buildTenantScopedQuery, withTenantFields } from '../services/tenantScopeService.js';
import { generateBillNumber, generateOrderNumber } from '../utils/serialGenerators.js';

const money = (value) => Math.round(Number(value || 0) * 100) / 100;

const orderStatusFromItems = (items, previousStatus = 'PENDING') => {
  const allReady = items.every((item) => Number(item.readyQuantity || 0) >= Number(item.quantity || 0));
  const allServed = items.every((item) => Number(item.servedQuantity || 0) >= Number(item.quantity || 0));
  const hasProgress = items.some(
    (item) => Number(item.readyQuantity || 0) > 0 || Number(item.servedQuantity || 0) > 0
  );

  if (allServed) return 'SERVED';
  if (allReady) return 'READY';
  if (hasProgress || ['PREPARING', 'READY', 'SERVED'].includes(previousStatus)) return 'PREPARING';
  return 'PENDING';
};

export const getTables = asyncHandler(async (req, res) => {
  const { status = '', search = '' } = req.query;
  const query = {};

  if (status) query.status = status;
  if (search) query.tableNumber = { $regex: search, $options: 'i' };

  const scopedQuery = await buildTenantScopedQuery(req.user, query, { includeCustomerTenant: true });
  const data = await Table.find(scopedQuery).sort({ tableNumber: 1 });
  res.json({ data });
});

export const createTable = asyncHandler(async (req, res) => {
  const { tableNumber, seatingCapacity, status } = req.body;
  if (!tableNumber || !seatingCapacity) {
    throw new ApiError(400, 'Table number and seating capacity are required');
  }

  const data = await Table.create(await withTenantFields(req.user, { tableNumber, seatingCapacity, status }));
  res.status(201).json({ data });
});

export const updateTable = asyncHandler(async (req, res) => {
  if (req.body?.status === 'AVAILABLE') {
    const activeOrders = await Order.countDocuments({
      table: req.params.id,
      status: { $in: ACTIVE_ORDER_STATUSES }
    });
    if (activeOrders > 0) {
      throw new ApiError(400, 'This table has active orders. Complete/cancel them before marking as AVAILABLE');
    }
  }

  const data = await Table.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  if (!data) throw new ApiError(404, 'Table not found');
  res.json({ data });
});

export const deleteTable = asyncHandler(async (req, res) => {
  const data = await Table.findById(req.params.id);
  if (!data) throw new ApiError(404, 'Table not found');

  const activeOrders = await Order.countDocuments({
    table: req.params.id,
    status: { $in: ACTIVE_ORDER_STATUSES }
  });
  if (activeOrders > 0) {
    throw new ApiError(400, 'Cannot delete table with active orders');
  }

  await data.deleteOne();
  res.json({ message: 'Table deleted' });
});

export const updateTableStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!TABLE_STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${TABLE_STATUSES.join(', ')}`);
  }

  if (status === 'AVAILABLE') {
    const activeOrders = await Order.countDocuments({
      table: req.params.id,
      status: { $in: ACTIVE_ORDER_STATUSES }
    });
    if (activeOrders > 0) {
      throw new ApiError(400, 'This table has active orders. Complete/cancel them before marking as AVAILABLE');
    }
  }

  const data = await Table.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );

  if (!data) throw new ApiError(404, 'Table not found');
  res.json({ data });
});

export const transferTable = asyncHandler(async (req, res) => {
  const { fromTableId = '', toTableId = '', itemSelections, orderIds } = req.body;

  if (!fromTableId || !toTableId) {
    throw new ApiError(400, 'Source table and target table are required');
  }

  if (fromTableId === toTableId) {
    throw new ApiError(400, 'Source and target table cannot be the same');
  }

  if (itemSelections !== undefined && !Array.isArray(itemSelections)) {
    throw new ApiError(400, 'Item selections must be provided as a list');
  }

  if (orderIds !== undefined && !Array.isArray(orderIds)) {
    throw new ApiError(400, 'Order IDs must be provided as a list');
  }

  const selectionByOrder = new Map();
  (itemSelections || []).forEach((selection) => {
    const orderId = String(selection?.orderId || '');
    const requestedItems = Array.isArray(selection?.items)
      ? selection.items
      : Array.isArray(selection?.itemIds)
        ? selection.itemIds.map((itemId) => ({ itemId, quantity: null }))
        : null;
    if (!orderId || !requestedItems) {
      throw new ApiError(400, 'Each item selection requires an order ID and item quantity list');
    }
    const current = selectionByOrder.get(orderId) || new Map();
    requestedItems.forEach((item) => {
      const itemId = String(item?.itemId || '');
      if (!itemId) return;
      const quantity = item.quantity === null ? null : Number(item.quantity);
      if (quantity !== null && (!Number.isInteger(quantity) || quantity <= 0)) {
        throw new ApiError(400, 'Transfer quantity must be a positive whole number');
      }
      current.set(itemId, quantity);
    });
    selectionByOrder.set(orderId, current);
  });
  [...selectionByOrder.entries()].forEach(([orderId, items]) => {
    if (!items.size) selectionByOrder.delete(orderId);
  });

  if (itemSelections !== undefined && ![...selectionByOrder.values()].some((items) => items.size > 0)) {
    throw new ApiError(400, 'Select at least one item to transfer');
  }

  const selectedOrderIds = itemSelections !== undefined
    ? [...selectionByOrder.keys()]
    : orderIds === undefined
      ? null
      : [...new Set(orderIds.filter(Boolean).map(String))];

  if (selectedOrderIds && !selectedOrderIds.length) {
    throw new ApiError(400, 'Select at least one item to transfer');
  }

  const [fromTableQuery, toTableQuery] = await Promise.all([
    buildTenantScopedQuery(req.user, { _id: fromTableId }, { includeCustomerTenant: true }),
    buildTenantScopedQuery(req.user, { _id: toTableId }, { includeCustomerTenant: true })
  ]);
  const [fromTable, toTable] = await Promise.all([
    Table.findOne(fromTableQuery),
    Table.findOne(toTableQuery)
  ]);

  if (!fromTable) throw new ApiError(404, 'Source table not found');
  if (!toTable) throw new ApiError(404, 'Target table not found');

  if (toTable.status === 'RESERVED' || toTable.status === 'Unavailable') {
    throw new ApiError(400, `Target table ${toTable.tableNumber} is currently ${toTable.status}`);
  }

  const activeSourceOrderQuery = {
    table: fromTable._id,
    orderType: 'DINE_IN',
    status: { $in: ACTIVE_ORDER_STATUSES },
    ...(selectedOrderIds ? { _id: { $in: selectedOrderIds } } : {})
  };
  const scopedActiveSourceOrderQuery = await buildTenantScopedQuery(
    req.user,
    activeSourceOrderQuery,
    { userFields: ['createdBy'] }
  );
  const activeSourceOrders = await Order.find(scopedActiveSourceOrderQuery);

  if (!activeSourceOrders.length) {
    throw new ApiError(400, `No active dine-in orders found on table ${fromTable.tableNumber}`);
  }

  if (selectedOrderIds && activeSourceOrders.length !== selectedOrderIds.length) {
    throw new ApiError(400, 'One or more selected orders are no longer active on the source table');
  }

  const paymentByOrderId = new Map();
  if (itemSelections !== undefined) {
    activeSourceOrders.forEach((order) => {
      const requestedItems = selectionByOrder.get(String(order._id)) || new Map();
      const availableItems = new Map((order.items || []).map((item) => [String(item._id), item]));
      [...requestedItems.entries()].forEach(([itemId, requestedQuantity]) => {
        const availableItem = availableItems.get(itemId);
        if (!availableItem) {
          throw new ApiError(400, `One or more selected items are no longer available on order ${order.orderNumber}`);
        }
        const quantity = requestedQuantity === null ? Number(availableItem.quantity || 0) : requestedQuantity;
        if (quantity > Number(availableItem.quantity || 0)) {
          throw new ApiError(400, `Transfer quantity for ${availableItem.name} exceeds the ordered quantity`);
        }
        requestedItems.set(itemId, quantity);
      });
    });

    const partiallySelectedOrderIds = activeSourceOrders
      .filter((order) => {
        const requestedItems = selectionByOrder.get(String(order._id)) || new Map();
        if (!requestedItems.size) return false;
        return (order.items || []).some((item) => (
          Number(requestedItems.get(String(item._id)) || 0) < Number(item.quantity || 0)
        ));
      })
      .map((order) => order._id);
    if (partiallySelectedOrderIds.length) {
      const billedPartialOrders = await Payment.find({
        order: { $in: partiallySelectedOrderIds }
      });
      const unsettledPayment = billedPartialOrders.find((payment) => payment.paymentStatus !== 'PAID');
      if (unsettledPayment) {
        throw new ApiError(400, 'Settle the partial or credit payment before splitting items from this order');
      }
      billedPartialOrders.forEach((payment) => paymentByOrderId.set(String(payment.order), payment));
    }
  }

  const targetActiveCount = await Order.countDocuments({
    table: toTable._id,
    orderType: 'DINE_IN',
    status: { $in: ACTIVE_ORDER_STATUSES }
  });

  if (targetActiveCount > 0) {
    throw new ApiError(400, `Target table ${toTable.tableNumber} already has active orders`);
  }

  const movedOrders = [];
  const movedItems = [];

  for (const order of activeSourceOrders) {
    const originalStatus = order.status;
    const requestedItems = itemSelections === undefined
      ? new Map((order.items || []).map((item) => [String(item._id), Number(item.quantity || 0)]))
      : selectionByOrder.get(String(order._id)) || new Map();
    const selectedItems = [];
    const remainingItems = [];

    (order.items || []).forEach((item) => {
      const originalQuantity = Number(item.quantity || 0);
      const requestedQuantity = Number(requestedItems.get(String(item._id)) || 0);
      if (requestedQuantity <= 0) {
        remainingItems.push({ ...item });
        return;
      }

      const originalReadyQuantity = Math.min(originalQuantity, Number(item.readyQuantity || 0));
      const originalServedQuantity = Math.min(originalReadyQuantity, Number(item.servedQuantity || 0));
      const movedReadyQuantity = Math.min(requestedQuantity, originalReadyQuantity);
      const movedServedQuantity = Math.min(movedReadyQuantity, originalServedQuantity);
      const movedItem = {
        ...item,
        quantity: requestedQuantity,
        readyQuantity: movedReadyQuantity,
        servedQuantity: movedServedQuantity
      };

      if (requestedQuantity < originalQuantity) {
        delete movedItem._id;
        remainingItems.push({
          ...item,
          quantity: originalQuantity - requestedQuantity,
          readyQuantity: originalReadyQuantity - movedReadyQuantity,
          servedQuantity: originalServedQuantity - movedServedQuantity
        });
      }

      selectedItems.push(movedItem);
    });

    if (!selectedItems.length) continue;

    if (!remainingItems.length) {
      order.table = toTable._id;
      await order.save();
      movedOrders.push(order.orderNumber);
      movedItems.push(...selectedItems.map((item) => ({ name: item.name, quantity: item.quantity })));
      continue;
    }

    const originalSubtotal = money(
      (order.items || []).reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      )
    );
    const movedSubtotal = money(
      selectedItems.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      )
    );
    const remainingSubtotal = money(originalSubtotal - movedSubtotal);
    const originalDiscount = money(order.discount);
    const movedDiscount = money(
      originalSubtotal > 0 ? Math.min(movedSubtotal, originalDiscount * (movedSubtotal / originalSubtotal)) : 0
    );
    const remainingDiscount = money(Math.min(remainingSubtotal, Math.max(0, originalDiscount - movedDiscount)));

    order.items = remainingItems;
    order.subtotal = remainingSubtotal;
    order.discount = remainingDiscount;
    order.total = money(Math.max(0, remainingSubtotal - remainingDiscount));
    order.status = orderStatusFromItems(remainingItems, originalStatus);
    await order.save();

    const splitOrder = await Order.create(await withTenantFields(req.user, {
      orderNumber: await generateOrderNumber(req.user),
      orderType: 'DINE_IN',
      table: toTable._id,
      customer: order.customer || undefined,
      items: selectedItems.map((item) => ({ ...item })),
      subtotal: movedSubtotal,
      discount: movedDiscount,
      total: money(Math.max(0, movedSubtotal - movedDiscount)),
      status: orderStatusFromItems(selectedItems, originalStatus),
      createdBy: order.createdBy || req.user._id
    }));

    const linkedPayment = paymentByOrderId.get(String(order._id));
    if (linkedPayment) {
      const originalChangeAmount = money(linkedPayment.changeAmount);
      linkedPayment.amountPaid = money(order.total + originalChangeAmount);
      linkedPayment.changeAmount = originalChangeAmount;
      await linkedPayment.save();

      await Payment.create(await withTenantFields(req.user, {
        order: splitOrder._id,
        billNumber: await generateBillNumber(req.user),
        paymentMethod: linkedPayment.paymentMethod,
        amountPaid: splitOrder.total,
        changeAmount: 0,
        paymentStatus: 'PAID',
        paidBy: linkedPayment.paidBy || req.user._id,
        creditNote: `Created by item transfer from ${linkedPayment.billNumber}`,
        creditHistory: []
      }));
    }

    movedOrders.push(splitOrder.orderNumber);
    movedItems.push(...selectedItems.map((item) => ({ name: item.name, quantity: item.quantity })));
  }

  await Promise.all([
    syncTableStatusFromOrders(fromTable._id),
    syncTableStatusFromOrders(toTable._id)
  ]);

  const [updatedFromTable, updatedToTable] = await Promise.all([
    Table.findById(fromTable._id),
    Table.findById(toTable._id)
  ]);

  const movedQuantity = movedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const movedQuantityLabel = movedQuantity === 1 ? 'unit' : 'units';
  res.json({
    message: `Transferred ${movedQuantity} ${movedQuantityLabel} from ${fromTable.tableNumber} to ${toTable.tableNumber}`,
    data: {
      movedOrders,
      movedItems,
      fromTable: updatedFromTable,
      toTable: updatedToTable
    }
  });
});
