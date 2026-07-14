import { ACTIVE_ORDER_STATUSES } from '../config/constants.js';
import { Order } from '../models/Order.js';
import { Table } from '../models/Table.js';

export const syncTableStatusFromOrders = async (tableId) => {
  if (!tableId) return null;

  const table = await Table.findById(tableId);
  if (!table) return null;

  // Manual operational states should not be auto-overridden by order sync.
  if (table.status === 'RESERVED' || table.status === 'Unavailable') {
    return table;
  }

  const activeCount = await Order.countDocuments({
    table: table._id,
    status: { $in: ACTIVE_ORDER_STATUSES }
  });

  const nextStatus = activeCount > 0 ? 'OCCUPIED' : 'AVAILABLE';
  if (table.status !== nextStatus) {
    table.status = nextStatus;
    await table.save();
  }

  return table;
};

