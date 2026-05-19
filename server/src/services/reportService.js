import { Payment } from '../models/Payment.js';
import { Order } from '../models/Order.js';
import { Table } from '../models/Table.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { User } from '../models/User.js';
import { Vendor } from '../models/Vendor.js';

export const getDashboardData = async () => {
  const [
    totalSalesAgg,
    totalOrders,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    availableTables,
    occupiedTables,
    lowStockItems,
    bestSellingItems,
    dailyRevenue
  ] = await Promise.all([
    Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
    Order.countDocuments(),
    Order.countDocuments({ status: { $in: ['PENDING', 'PREPARING', 'READY', 'SERVED'] } }),
    Order.countDocuments({ status: 'COMPLETED' }),
    Order.countDocuments({ status: 'CANCELLED' }),
    Table.countDocuments({ status: 'AVAILABLE' }),
    Table.countDocuments({ status: 'OCCUPIED' }),
    InventoryItem.find({
      $expr: { $lte: ['$quantity', '$minimumStockLevel'] }
    }).limit(10),
    Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          totalQuantity: { $sum: '$items.quantity' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 10 }
    ]),
    Payment.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          total: { $sum: '$amountPaid' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
      { $limit: 14 }
    ])
  ]);

  return {
    totalSales: totalSalesAgg[0]?.total || 0,
    totalOrders,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    availableTables,
    occupiedTables,
    lowStockItems,
    bestSellingItems,
    dailyRevenue: dailyRevenue.map((d) => ({
      date: `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`,
      total: d.total
    }))
  };
};

export const getSuperAdminOverviewData = async () => {
  const [
    totalUsers,
    activeUsers,
    usersByRole,
    totalOrders,
    ordersByStatus,
    totalPayments,
    paymentsByMethod,
    totalRevenueAgg,
    totalVendors,
    activeVendors,
    vendorsByPlan,
    vendorsBySubscriptionStatus,
    vendorIncomeAgg,
    lowStockCount,
    tablesByStatus,
    recentUsers,
    recentOrders,
    recentPayments,
    recentVendors
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } }
    ]),
    Order.countDocuments(),
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Payment.countDocuments(),
    Payment.aggregate([
      { $group: { _id: '$paymentMethod', count: { $sum: 1 }, totalAmount: { $sum: '$amountPaid' } } },
      { $sort: { totalAmount: -1 } }
    ]),
    Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
    Vendor.countDocuments(),
    Vendor.countDocuments({ isActive: true }),
    Vendor.aggregate([
      { $group: { _id: '$subscription.planId', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Vendor.aggregate([
      { $group: { _id: '$subscription.status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    Vendor.aggregate([{ $group: { _id: null, total: { $sum: '$totalPaid' } } }]),
    InventoryItem.countDocuments({
      $expr: { $lte: ['$quantity', '$minimumStockLevel'] }
    }),
    Table.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
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

  return {
    summary: {
      totalUsers,
      activeUsers,
      inactiveUsers: Math.max(0, totalUsers - activeUsers),
      totalOrders,
      totalPayments,
      totalRevenue: totalRevenueAgg[0]?.total || 0,
      totalVendors,
      activeVendors,
      inactiveVendors: Math.max(0, totalVendors - activeVendors),
      totalVendorSubscriptionIncome: vendorIncomeAgg[0]?.total || 0,
      lowStockCount
    },
    distributions: {
      usersByRole: usersByRole.map((row) => ({ role: row._id, count: row.count })),
      ordersByStatus: ordersByStatus.map((row) => ({ status: row._id, count: row.count })),
      paymentsByMethod: paymentsByMethod.map((row) => ({
        method: row._id,
        count: row.count,
        totalAmount: row.totalAmount
      })),
      vendorsByPlan: vendorsByPlan.map((row) => ({ planId: row._id, count: row.count })),
      vendorsBySubscriptionStatus: vendorsBySubscriptionStatus.map((row) => ({
        status: row._id,
        count: row.count
      })),
      tablesByStatus: tablesByStatus.map((row) => ({ status: row._id, count: row.count }))
    },
    recent: {
      users: recentUsers,
      orders: recentOrders,
      payments: recentPayments,
      vendors: recentVendors
    }
  };
};
