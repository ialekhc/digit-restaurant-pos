import { Payment } from '../models/Payment.js';
import { Order } from '../models/Order.js';
import { Table } from '../models/Table.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { User } from '../models/User.js';
import { Vendor } from '../models/Vendor.js';
import { buildTenantScopedQuery } from './tenantScopeService.js';

const sumBy = (rows, selector) => rows.reduce((sum, row) => sum + Number(selector(row) || 0), 0);

const groupCount = (rows, selector) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = selector(row) || 'UNKNOWN';
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).map(([_id, count]) => ({ _id, count }));
};

const groupPaymentMethods = (payments) => {
  const map = new Map();
  payments.forEach((payment) => {
    const key = payment.paymentMethod || 'UNKNOWN';
    const current = map.get(key) || { _id: key, count: 0, totalAmount: 0 };
    current.count += 1;
    current.totalAmount += Number(payment.amountPaid || 0);
    map.set(key, current);
  });
  return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
};

const bestSellingFromOrders = (orders, limit = 10) => {
  const map = new Map();
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = item.name;
      const current = map.get(key) || { _id: key, totalQuantity: 0 };
      current.totalQuantity += Number(item.quantity || 0);
      map.set(key, current);
    });
  });
  return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, limit);
};

const dailyRevenueFromPayments = (payments) => {
  const map = new Map();
  payments.forEach((payment) => {
    const date = new Date(payment.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + Number(payment.amountPaid || 0));
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, total]) => ({ date, total }));
};

export const getDashboardData = async (user) => {
  const [paymentQuery, orderQuery, tableQuery, inventoryQuery] = await Promise.all([
    buildTenantScopedQuery(user, {}, { userFields: ['paidBy', 'receivedBy'] }),
    buildTenantScopedQuery(user, {}, { userFields: ['createdBy'] }),
    buildTenantScopedQuery(user, {}),
    buildTenantScopedQuery(user, {})
  ]);

  const [
    payments,
    orders,
    tables,
    inventoryItems
  ] = await Promise.all([
    Payment.find(paymentQuery),
    Order.find(orderQuery),
    Table.find(tableQuery),
    InventoryItem.find(inventoryQuery)
  ]);

  return {
    totalSales: sumBy(payments, (payment) => payment.amountPaid),
    totalOrders: orders.length,
    pendingOrders: orders.filter((order) => ['PENDING', 'PREPARING', 'READY', 'SERVED'].includes(order.status)).length,
    completedOrders: orders.filter((order) => order.status === 'COMPLETED').length,
    cancelledOrders: orders.filter((order) => order.status === 'CANCELLED').length,
    availableTables: tables.filter((table) => table.status === 'AVAILABLE').length,
    occupiedTables: tables.filter((table) => table.status === 'OCCUPIED').length,
    lowStockItems: inventoryItems
      .filter((item) => Number(item.quantity || 0) <= Number(item.minimumStockLevel || 0))
      .slice(0, 10),
    bestSellingItems: bestSellingFromOrders(orders, 10),
    dailyRevenue: dailyRevenueFromPayments(payments)
  };
};

export const getSuperAdminOverviewData = async () => {
  const [
    users,
    orders,
    payments,
    vendors,
    inventoryItems,
    tables,
    recentUsers,
    recentOrders,
    recentPayments,
    recentVendors
  ] = await Promise.all([
    User.find({}),
    Order.find({}),
    Payment.find({}),
    Vendor.find({}),
    InventoryItem.find({}),
    Table.find({}),
    User.find({}).select('name email role isActive createdAt').sort({ createdAt: -1 }).limit(6),
    Order.find({})
      .select('orderNumber orderType status total createdAt')
      .populate('table', 'tableNumber')
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(8),
    Payment.find({})
      .select('billNumber paymentMethod paymentStatus amountPaid createdAt')
      .populate({ path: 'order', select: 'orderNumber', populate: { path: 'table', select: 'tableNumber' } })
      .populate('paidBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(8),
    Vendor.find({})
      .select('vendorName contactPerson subscription totalPaid isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(8)
  ]);

  const activeUsers = users.filter((user) => user.isActive).length;
  const activeVendors = vendors.filter((vendor) => vendor.isActive).length;

  return {
    summary: {
      totalUsers: users.length,
      activeUsers,
      inactiveUsers: Math.max(0, users.length - activeUsers),
      totalOrders: orders.length,
      totalPayments: payments.length,
      totalRevenue: sumBy(payments, (payment) => payment.amountPaid),
      totalVendors: vendors.length,
      activeVendors,
      inactiveVendors: Math.max(0, vendors.length - activeVendors),
      totalVendorSubscriptionIncome: sumBy(vendors, (vendor) => vendor.totalPaid),
      lowStockCount: inventoryItems.filter((item) => Number(item.quantity || 0) <= Number(item.minimumStockLevel || 0)).length
    },
    distributions: {
      usersByRole: groupCount(users, (user) => user.role).map((row) => ({ role: row._id, count: row.count })),
      ordersByStatus: groupCount(orders, (order) => order.status).map((row) => ({ status: row._id, count: row.count })),
      paymentsByMethod: groupPaymentMethods(payments).map((row) => ({
        method: row._id,
        count: row.count,
        totalAmount: row.totalAmount
      })),
      vendorsByPlan: groupCount(vendors, (vendor) => vendor.subscription?.planId).map((row) => ({ planId: row._id, count: row.count })),
      vendorsBySubscriptionStatus: groupCount(vendors, (vendor) => vendor.subscription?.status).map((row) => ({
        status: row._id,
        count: row.count
      })),
      tablesByStatus: groupCount(tables, (table) => table.status).map((row) => ({ status: row._id, count: row.count }))
    },
    recent: {
      users: recentUsers,
      orders: recentOrders,
      payments: recentPayments,
      vendors: recentVendors
    }
  };
};
