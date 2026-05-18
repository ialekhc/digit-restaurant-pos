import { asyncHandler } from '../utils/asyncHandler.js';
import { Payment } from '../models/Payment.js';
import { Order } from '../models/Order.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { getDashboardData, getSuperAdminOverviewData } from '../services/reportService.js';

export const dashboardReport = asyncHandler(async (_req, res) => {
  const data = await getDashboardData();
  res.json({ data });
});

export const dailySalesReport = asyncHandler(async (req, res) => {
  const dateParam = req.query.date || new Date().toISOString().slice(0, 10);
  const from = new Date(dateParam);
  const to = new Date(dateParam);
  to.setDate(to.getDate() + 1);

  const payments = await Payment.find({
    createdAt: { $gte: from, $lt: to }
  }).populate('order');

  const totalSales = payments.reduce((sum, p) => sum + p.amountPaid, 0);

  res.json({
    data: {
      date: dateParam,
      totalSales,
      totalTransactions: payments.length,
      payments
    }
  });
});

export const monthlySalesReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const data = await Payment.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { month: { $month: '$createdAt' } },
        totalSales: { $sum: '$amountPaid' },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.month': 1 } }
  ]);

  res.json({
    data: data.map((item) => ({
      month: item._id.month,
      totalSales: item.totalSales,
      transactionCount: item.transactionCount
    }))
  });
});

export const bestSellingItemsReport = asyncHandler(async (_req, res) => {
  const data = await Order.aggregate([
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.name',
        quantitySold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
      }
    },
    { $sort: { quantitySold: -1 } },
    { $limit: 20 }
  ]);

  res.json({
    data: data.map((x) => ({ name: x._id, quantitySold: x.quantitySold, revenue: x.revenue }))
  });
});

export const lowStockReport = asyncHandler(async (_req, res) => {
  const data = await InventoryItem.find({
    $expr: { $lte: ['$quantity', '$minimumStockLevel'] }
  }).populate('supplier');

  res.json({ data });
});

export const superAdminOverviewReport = asyncHandler(async (_req, res) => {
  const data = await getSuperAdminOverviewData();
  res.json({ data });
});
