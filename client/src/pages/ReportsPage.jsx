import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { reportService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { currency, formatDateTime } from '../utils/format';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const colors = ['#1f6ff5', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#a855f7'];
const SALES_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

const ReportsPage = () => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [salesPeriod, setSalesPeriod] = useState('DAILY');

  const [dailySales, setDailySales] = useState(null);
  const [weeklySales, setWeeklySales] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  const [yearlySales, setYearlySales] = useState([]);
  const [bestSelling, setBestSelling] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (showLoading = true) => {
    setError('');
    if (showLoading) setLoading(true);
    try {
      const selectedYear = Number(year) || new Date().getFullYear();
      const [dailyResult, weeklyResult, monthlyResult, yearlyResult, bestResult, lowResult] = await Promise.allSettled([
        reportService.dailySales({ date }),
        reportService.weeklySales({ year: selectedYear }),
        reportService.monthlySales({ year: selectedYear }),
        reportService.yearlySales({ fromYear: selectedYear - 4, toYear: selectedYear }),
        reportService.bestSelling(),
        reportService.lowStock()
      ]);

      setDailySales(dailyResult.status === 'fulfilled' ? dailyResult.value : null);
      setWeeklySales(weeklyResult.status === 'fulfilled' ? weeklyResult.value : []);
      setMonthlySales(monthlyResult.status === 'fulfilled' ? monthlyResult.value : []);
      setYearlySales(yearlyResult.status === 'fulfilled' ? yearlyResult.value : []);
      setBestSelling(bestResult.status === 'fulfilled' ? bestResult.value : []);
      setLowStock(lowResult.status === 'fulfilled' ? lowResult.value : []);

      const failed = [dailyResult, weeklyResult, monthlyResult, yearlyResult, bestResult, lowResult].find(
        (result) => result.status === 'rejected'
      );
      if (failed?.reason) {
        setError(failed.reason?.response?.data?.message || 'Some reports are unavailable for the current plan.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useAutoRefresh(() => load(false));

  const dailyMethodBreakdown = useMemo(() => {
    const payments = dailySales?.payments || [];
    const methodMap = new Map();
    for (const payment of payments) {
      const key = payment.paymentMethod || 'UNKNOWN';
      const prev = methodMap.get(key) || 0;
      methodMap.set(key, prev + Number(payment.amountPaid || 0));
    }
    return Array.from(methodMap.entries()).map(([method, totalSales]) => ({ label: method, totalSales }));
  }, [dailySales]);

  const activeSalesData = useMemo(() => {
    if (salesPeriod === 'DAILY') return dailyMethodBreakdown;
    if (salesPeriod === 'WEEKLY') return weeklySales.map((x) => ({ ...x, label: x.weekLabel }));
    if (salesPeriod === 'MONTHLY') return monthlySales.map((x) => ({ ...x, label: x.monthLabel }));
    return yearlySales.map((x) => ({ ...x, label: String(x.year) }));
  }, [dailyMethodBreakdown, monthlySales, salesPeriod, weeklySales, yearlySales]);

  const activeTotals = useMemo(() => {
    if (salesPeriod === 'DAILY') {
      return {
        totalSales: Number(dailySales?.totalSales || 0),
        transactions: Number(dailySales?.totalTransactions || 0),
        records: Number((dailySales?.payments || []).length)
      };
    }

    return activeSalesData.reduce(
      (acc, row) => ({
        totalSales: acc.totalSales + Number(row.totalSales || 0),
        transactions: acc.transactions + Number(row.transactionCount || 0),
        records: acc.records + 1
      }),
      { totalSales: 0, transactions: 0, records: 0 }
    );
  }, [activeSalesData, dailySales, salesPeriod]);

  return (
    <div className="space-y-5">
      <Panel
        title="Sales Section"
        subtitle="Vendor sales reports by daily, weekly, monthly, and yearly basis"
        right={
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Input
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-28"
            />
            <Button onClick={load} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh Reports'}</Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {SALES_PERIODS.map((period) => (
            <Button
              key={period}
              variant={salesPeriod === period ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSalesPeriod(period)}
            >
              {period}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Total Sales</p>
            <p className="text-2xl font-bold text-emerald-700">{currency(activeTotals.totalSales)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Transactions</p>
            <p className="text-2xl font-bold text-brand-700">{activeTotals.transactions}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Rows</p>
            <p className="text-2xl font-bold text-slate-700">{activeTotals.records}</p>
          </div>
        </div>

        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activeSalesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => currency(value)} />
              <Bar dataKey="totalSales" fill="#1f6ff5" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {salesPeriod === 'DAILY' ? (
          <div className="mt-4 overflow-x-auto">
            <table className="table-ui">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Bill</th>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {(dailySales?.payments || []).map((payment) => (
                  <tr key={payment._id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-xs">{formatDateTime(payment.createdAt)}</td>
                    <td className="px-3 py-2">{payment.billNumber}</td>
                    <td className="px-3 py-2">{payment.order?.orderNumber || '-'}</td>
                    <td className="px-3 py-2">{payment.paymentMethod}</td>
                    <td className="px-3 py-2">{currency(payment.amountPaid)}</td>
                    <td className="px-3 py-2">{payment.paymentStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dailySales?.payments?.length ? <p className="p-4 text-sm text-slate-500">No daily sales found.</p> : null}
          </div>
        ) : null}

        {salesPeriod === 'WEEKLY' ? (
          <div className="mt-4 overflow-x-auto">
            <table className="table-ui">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Week</th>
                  <th className="px-3 py-2">Start Date</th>
                  <th className="px-3 py-2">End Date</th>
                  <th className="px-3 py-2">Transactions</th>
                  <th className="px-3 py-2">Sales</th>
                </tr>
              </thead>
              <tbody>
                {weeklySales.map((row) => (
                  <tr key={row.week} className="border-b border-slate-100">
                    <td className="px-3 py-2">{row.weekLabel}</td>
                    <td className="px-3 py-2">{row.startDate}</td>
                    <td className="px-3 py-2">{row.endDate}</td>
                    <td className="px-3 py-2">{row.transactionCount}</td>
                    <td className="px-3 py-2">{currency(row.totalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {salesPeriod === 'MONTHLY' ? (
          <div className="mt-4 overflow-x-auto">
            <table className="table-ui">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Transactions</th>
                  <th className="px-3 py-2">Sales</th>
                </tr>
              </thead>
              <tbody>
                {monthlySales.map((row) => (
                  <tr key={row.month} className="border-b border-slate-100">
                    <td className="px-3 py-2">{row.monthLabel}</td>
                    <td className="px-3 py-2">{row.transactionCount}</td>
                    <td className="px-3 py-2">{currency(row.totalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {salesPeriod === 'YEARLY' ? (
          <div className="mt-4 overflow-x-auto">
            <table className="table-ui">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Year</th>
                  <th className="px-3 py-2">Transactions</th>
                  <th className="px-3 py-2">Sales</th>
                </tr>
              </thead>
              <tbody>
                {yearlySales.map((row) => (
                  <tr key={row.year} className="border-b border-slate-100">
                    <td className="px-3 py-2">{row.year}</td>
                    <td className="px-3 py-2">{row.transactionCount}</td>
                    <td className="px-3 py-2">{currency(row.totalSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      {error ? (
        <Panel title="Report Error">
          <p className="text-sm text-rose-600">{error}</p>
        </Panel>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-5">
        <Panel title="Best-Selling Items Distribution" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bestSelling.slice(0, 6)}
                  dataKey="quantitySold"
                  nameKey="name"
                  outerRadius={90}
                  label
                >
                  {bestSelling.slice(0, 6).map((_, index) => (
                    <Cell key={index} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Best-Selling Items Table" className="xl:col-span-3">
          <div className="overflow-x-auto">
            <table className="table-ui">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Quantity Sold</th>
                  <th className="px-3 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestSelling.map((item) => (
                  <tr key={item.name} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-3 py-2">{item.quantitySold}</td>
                    <td className="px-3 py-2">{currency(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Low Stock Report">
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Minimum</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2">{item.category}</td>
                  <td className="px-3 py-2">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-3 py-2">
                    {item.minimumStockLevel} {item.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lowStock.length ? <p className="p-4 text-sm text-slate-500">No low stock items</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default ReportsPage;
