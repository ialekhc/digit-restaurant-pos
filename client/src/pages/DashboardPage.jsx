import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { reportService } from '../api/services';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import Loader from '../components/Loader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Panel from '../components/ui/Panel';
import { currency } from '../utils/format';

const percent = (value, total) => {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total || 0)) * 100);
};

const DashboardWidget = ({ label, value, helper, tone = 'orange', marker }) => {
  const tones = {
    orange: 'border-brand-100 bg-brand-50/80 text-brand-800',
    emerald: 'border-emerald-100 bg-emerald-50/80 text-emerald-800',
    cyan: 'border-cyan-100 bg-cyan-50/80 text-cyan-800',
    amber: 'border-amber-100 bg-amber-50/80 text-amber-800',
    rose: 'border-rose-100 bg-rose-50/80 text-rose-800',
    slate: 'border-slate-100 bg-slate-50/80 text-slate-800'
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.orange}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-2 font-display text-2xl font-extrabold tracking-tight">{value}</p>
        </div>
        {marker ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-lg font-black shadow-sm">
            {marker}
          </span>
        ) : null}
      </div>
      {helper ? <p className="mt-2 text-sm font-medium opacity-75">{helper}</p> : null}
    </div>
  );
};

const ProgressRow = ({ label, value, total, tone = 'bg-brand-500', displayValue }) => {
  const width = percent(value, total);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-bold text-slate-900">{displayValue ?? value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

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
  const tableTotal = Number(data?.availableTables || 0) + Number(data?.occupiedTables || 0);
  const activeOrders = Number(data?.pendingOrders || 0);
  const averageOrderValue = data?.totalOrders ? Number(data.totalSales || 0) / Number(data.totalOrders || 1) : 0;
  const completionRate = percent(data?.completedOrders || 0, data?.totalOrders || 0);
  const cancellationRate = percent(data?.cancelledOrders || 0, data?.totalOrders || 0);
  const occupancyRate = percent(data?.occupiedTables || 0, tableTotal);
  const topSeller = topItems[0];

  if (loading) return <Loader text="Loading dashboard metrics..." />;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardWidget
          label="Sales Collected"
          value={currency(data?.totalSales || 0)}
          helper={`Average order ${currency(averageOrderValue)}`}
          tone="emerald"
          marker="₨"
        />
        <DashboardWidget
          label="Order Queue"
          value={activeOrders}
          helper={`${data?.completedOrders || 0} completed · ${data?.cancelledOrders || 0} cancelled`}
          tone={activeOrders ? 'amber' : 'cyan'}
          marker="Q"
        />
        <DashboardWidget
          label="Table Occupancy"
          value={`${occupancyRate}%`}
          helper={`${data?.occupiedTables || 0} occupied of ${tableTotal || 0} tables`}
          tone="cyan"
          marker="T"
        />
        <DashboardWidget
          label="Low Stock"
          value={data?.lowStockItems?.length || 0}
          helper={(data?.lowStockItems?.length || 0) ? 'Restock required' : 'Inventory looks clear'}
          tone={(data?.lowStockItems?.length || 0) ? 'rose' : 'emerald'}
          marker="!"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Orders" value={data?.totalOrders || 0} />
        <StatCard label="Pending / Active" value={data?.pendingOrders || 0} accent="amber" />
        <StatCard label="Completed" value={data?.completedOrders || 0} accent="emerald" />
        <StatCard label="Cancelled" value={data?.cancelledOrders || 0} accent="rose" />
        <StatCard label="Best Sellers" value={topItems.length} accent="brand" />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Panel title="Operations Snapshot" subtitle="Current restaurant health" className="xl:col-span-4">
          <div className="space-y-5">
            <ProgressRow label="Completion rate" value={completionRate} total={100} tone="bg-emerald-500" displayValue={`${completionRate}%`} />
            <ProgressRow label="Active order load" value={activeOrders} total={Math.max(data?.totalOrders || 1, 1)} tone="bg-amber-500" />
            <ProgressRow label="Table occupancy" value={occupancyRate} total={100} tone="bg-cyan-500" displayValue={`${occupancyRate}%`} />
            <ProgressRow label="Cancellation rate" value={cancellationRate} total={100} tone="bg-rose-500" displayValue={`${cancellationRate}%`} />
          </div>
        </Panel>

        <Panel title="Quick Actions" subtitle="Common staff tasks" className="xl:col-span-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { to: '/orders/create', label: 'Create Order', hint: 'Dine-in, takeaway, delivery' },
              { to: '/kitchen', label: 'Kitchen Queue', hint: `${activeOrders} active orders` },
              { to: '/billing', label: 'Billing', hint: 'Collect payment' },
              { to: '/tables', label: 'Tables', hint: `${data?.availableTables || 0} available` }
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-2xl border border-brand-100 bg-white/80 p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
              >
                <p className="font-display text-base font-bold text-slate-900">{item.label}</p>
                <p className="mt-1 text-sm text-slate-500">{item.hint}</p>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Top Seller" subtitle="Most ordered item" className="xl:col-span-4">
          {topSeller ? (
            <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-emerald-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Best performer</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-slate-900">{topSeller._id}</p>
              <p className="mt-3 text-sm font-semibold text-slate-600">{topSeller.totalQuantity} sold units</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              No best-selling item yet.
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Panel title="Daily Revenue" subtitle="Recent payment trend" className="xl:col-span-8">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Total revenue</p>
              <p className="mt-1 font-display text-xl font-extrabold text-emerald-900">{currency(data?.totalSales || 0)}</p>
            </div>
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/80 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Revenue days</p>
              <p className="mt-1 font-display text-xl font-extrabold text-cyan-900">{data?.dailyRevenue?.length || 0}</p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-brand-50/80 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Average order</p>
              <p className="mt-1 font-display text-xl font-extrabold text-brand-900">{currency(averageOrderValue)}</p>
            </div>
          </div>
          <div className="h-56 rounded-2xl border border-slate-100 bg-white/70 p-2 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.dailyRevenue || []} margin={{ top: 12, right: 18, bottom: 8, left: 4 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={8} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => Number(value).toLocaleString()} width={72} />
                <Tooltip formatter={(v) => currency(v)} />
                <Line type="monotone" dataKey="total" stroke="#1f6ff5" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Best Selling Items" subtitle="Top sold menu items" className="xl:col-span-4">
          <div className="space-y-3">
            {topItems.slice(0, 6).map((item, index) => {
              const max = Number(topItems[0]?.totalQuantity || 1);
              const width = percent(item.totalQuantity, max);
              return (
                <div key={item._id} className="rounded-2xl border border-slate-100 bg-white/80 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{index + 1}. {item._id}</p>
                      <p className="text-xs text-slate-500">{item.totalQuantity} sold</p>
                    </div>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                      {item.totalQuantity}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-brand-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
            {!topItems.length ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
                No item sales yet.
              </div>
            ) : null}
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
