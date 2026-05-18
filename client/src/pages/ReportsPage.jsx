import { useEffect, useState } from 'react';
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
import { currency } from '../utils/format';

const colors = ['#1f6ff5', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#a855f7'];

const ReportsPage = () => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailySales, setDailySales] = useState(null);
  const [monthlySales, setMonthlySales] = useState([]);
  const [bestSelling, setBestSelling] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  const load = async () => {
    const year = new Date(date).getFullYear();

    const [daily, monthly, best, low] = await Promise.all([
      reportService.dailySales({ date }),
      reportService.monthlySales({ year }),
      reportService.bestSelling(),
      reportService.lowStock()
    ]);

    setDailySales(daily);
    setMonthlySales(monthly);
    setBestSelling(best);
    setLowStock(low);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-5">
      <Panel
        title="Report Filters"
        right={
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button onClick={load}>Refresh Reports</Button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Daily Sales</p>
            <p className="text-2xl font-bold text-emerald-700">{currency(dailySales?.totalSales || 0)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Transactions</p>
            <p className="text-2xl font-bold text-brand-700">{dailySales?.totalTransactions || 0}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Low Stock Count</p>
            <p className="text-2xl font-bold text-rose-700">{lowStock.length}</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-5">
        <Panel title="Monthly Sales" className="xl:col-span-3">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySales}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(v) => currency(v)} />
                <Bar dataKey="totalSales" fill="#1f6ff5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Best-Selling Items">
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
      </div>

      <Panel title="Best-Selling Items Table">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
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

      <Panel title="Low Stock Report">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
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
                  <td className="px-3 py-2">{item.quantity} {item.unit}</td>
                  <td className="px-3 py-2">{item.minimumStockLevel} {item.unit}</td>
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
