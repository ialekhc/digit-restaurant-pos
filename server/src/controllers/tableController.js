import { Table } from '../models/Table.js';
import { Order } from '../models/Order.js';
import { ACTIVE_ORDER_STATUSES, TABLE_STATUSES } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { syncTableStatusFromOrders } from '../services/tableWorkflowService.js';
import { buildTenantScopedQuery, withTenantFields } from '../services/tenantScopeService.js';

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
  const { fromTableId = '', toTableId = '' } = req.body;

  if (!fromTableId || !toTableId) {
    throw new ApiError(400, 'Source table and target table are required');
  }

  if (fromTableId === toTableId) {
    throw new ApiError(400, 'Source and target table cannot be the same');
  }

  const [fromTable, toTable] = await Promise.all([
    Table.findById(fromTableId),
    Table.findById(toTableId)
  ]);

  if (!fromTable) throw new ApiError(404, 'Source table not found');
  if (!toTable) throw new ApiError(404, 'Target table not found');

  if (toTable.status === 'RESERVED' || toTable.status === 'CLEANING') {
    throw new ApiError(400, `Target table ${toTable.tableNumber} is currently ${toTable.status}`);
  }

  const activeSourceOrders = await Order.find({
    table: fromTable._id,
    orderType: 'DINE_IN',
    status: { $in: ACTIVE_ORDER_STATUSES }
  }).select('_id orderNumber');

  if (!activeSourceOrders.length) {
    throw new ApiError(400, `No active dine-in orders found on table ${fromTable.tableNumber}`);
  }

  const targetActiveCount = await Order.countDocuments({
    table: toTable._id,
    orderType: 'DINE_IN',
    status: { $in: ACTIVE_ORDER_STATUSES }
  });

  if (targetActiveCount > 0) {
    throw new ApiError(400, `Target table ${toTable.tableNumber} already has active orders`);
  }

  await Order.updateMany(
    { _id: { $in: activeSourceOrders.map((order) => order._id) } },
    { $set: { table: toTable._id } }
  );

  await Promise.all([
    syncTableStatusFromOrders(fromTable._id),
    syncTableStatusFromOrders(toTable._id)
  ]);

  const [updatedFromTable, updatedToTable] = await Promise.all([
    Table.findById(fromTable._id),
    Table.findById(toTable._id)
  ]);

  res.json({
    message: `Transferred ${activeSourceOrders.length} active order(s) from ${fromTable.tableNumber} to ${toTable.tableNumber}`,
    data: {
      movedOrders: activeSourceOrders.map((order) => order.orderNumber),
      fromTable: updatedFromTable,
      toTable: updatedToTable
    }
  });
});
