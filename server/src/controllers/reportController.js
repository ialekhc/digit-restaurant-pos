import { asyncHandler } from '../utils/asyncHandler.js';
import { Payment } from '../models/Payment.js';
import { Order } from '../models/Order.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { getDashboardData, getSuperAdminOverviewData } from '../services/reportService.js';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getISOWeek = (date) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
};

const getISOWeekRange = (year, week) => {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  if (dayOfWeek <= 4) {
    monday.setUTCDate(simple.getUTCDate() - dayOfWeek + 1);
  } else {
    monday.setUTCDate(simple.getUTCDate() + 8 - dayOfWeek);
  }
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday, end: sunday };
};

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
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ message: 'Year must be between 2000 and 2100' });
  }

  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const rows = await Payment.aggregate([
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

  const byMonth = new Map(rows.map((item) => [item._id.month, item]));
  const data = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const row = byMonth.get(month);
    return {
      month,
      monthLabel: monthNames[index],
      totalSales: row?.totalSales || 0,
      transactionCount: row?.transactionCount || 0
    };
  });

  res.json({ data });
});

export const weeklySalesReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year || new Date().getFullYear());
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ message: 'Year must be between 2000 and 2100' });
  }

  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));

  const rows = await Payment.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: {
          isoYear: { $isoWeekYear: '$createdAt' },
          isoWeek: { $isoWeek: '$createdAt' }
        },
        totalSales: { $sum: '$amountPaid' },
        transactionCount: { $sum: 1 }
      }
    },
    { $match: { '_id.isoYear': year } },
    { $sort: { '_id.isoWeek': 1 } }
  ]);

  const lastWeek = getISOWeek(new Date(Date.UTC(year, 11, 28)));
  const byWeek = new Map(rows.map((item) => [item._id.isoWeek, item]));

  const data = Array.from({ length: lastWeek }, (_, index) => {
    const week = index + 1;
    const row = byWeek.get(week);
    const range = getISOWeekRange(year, week);
    return {
      year,
      week,
      weekLabel: `W${String(week).padStart(2, '0')}`,
      startDate: range.start.toISOString().slice(0, 10),
      endDate: range.end.toISOString().slice(0, 10),
      totalSales: row?.totalSales || 0,
      transactionCount: row?.transactionCount || 0
    };
  });

  res.json({ data });
});

export const yearlySalesReport = asyncHandler(async (req, res) => {
  const nowYear = new Date().getFullYear();
  const fromYear = Number(req.query.fromYear || nowYear - 4);
  const toYear = Number(req.query.toYear || nowYear);

  if (!Number.isFinite(fromYear) || !Number.isFinite(toYear) || fromYear > toYear) {
    return res.status(400).json({ message: 'Invalid year range' });
  }
  if (fromYear < 2000 || toYear > 2100 || toYear - fromYear > 20) {
    return res.status(400).json({ message: 'Year range must be between 2000 and 2100 and within 20 years' });
  }

  const start = new Date(Date.UTC(fromYear, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(toYear + 1, 0, 1, 0, 0, 0, 0));

  const rows = await Payment.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { year: { $year: '$createdAt' } },
        totalSales: { $sum: '$amountPaid' },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1 } }
  ]);

  const byYear = new Map(rows.map((item) => [item._id.year, item]));
  const data = [];
  for (let year = fromYear; year <= toYear; year += 1) {
    const row = byYear.get(year);
    data.push({
      year,
      totalSales: row?.totalSales || 0,
      transactionCount: row?.transactionCount || 0
    });
  }

  res.json({
    data
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
