import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { reportService } from '../api/services';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import Loader from '../components/Loader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Panel from '../components/ui/Panel';
import { currency } from '../utils/format';

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchDashboard = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await reportService.dashboard();
      setData(response);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useAutoRefresh(() => fetchDashboard(false));

  const topItems = useMemo(() => data?.bestSellingItems || [], [data]);

  if (loading) return <Loader text="Loading dashboard metrics..." />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Sales" value={data?.totalSales || 0} money accent="emerald" />
        <StatCard label="Total Orders" value={data?.totalOrders || 0} />
        <StatCard label="Pending Orders" value={data?.pendingOrders || 0} accent="amber" />
        <StatCard label="Completed Orders" value={data?.completedOrders || 0} accent="emerald" />
        <StatCard label="Cancelled Orders" value={data?.cancelledOrders || 0} accent="rose" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available Tables" value={data?.availableTables || 0} accent="emerald" />
        <StatCard label="Occupied Tables" value={data?.occupiedTables || 0} accent="amber" />
        <StatCard label="Low Stock Items" value={data?.lowStockItems?.length || 0} accent="rose" />
        <StatCard label="Best Sellers" value={topItems.length} accent="brand" />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Panel title="Daily Revenue" subtitle="Recent payment trend" className="xl:col-span-3">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.dailyRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => currency(v)} />
                <Line type="monotone" dataKey="total" stroke="#1f6ff5" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Best Selling Items" subtitle="Top sold menu items">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="_id" width={120} />
                <Tooltip />
                <Bar dataKey="totalQuantity" fill="#1f6ff5" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Low Stock Alert" subtitle="Items that require restock now">
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Minimum</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.lowStockItems || []).map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 py-2">{item.category}</td>
                  <td className="px-3 py-2">{item.quantity} {item.unit}</td>
                  <td className="px-3 py-2">{item.minimumStockLevel} {item.unit}</td>
                  <td className="px-3 py-2"><StatusBadge value={item.quantity <= item.minimumStockLevel ? 'LOW' : 'OK'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.lowStockItems?.length ? <p className="py-4 text-center text-sm text-slate-500">No low stock alerts</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default DashboardPage;
