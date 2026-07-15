import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Panel from '../components/ui/Panel';
import StatusBadge from '../components/StatusBadge';
import { reportService, vendorService } from '../api/services';
import { currency, formatDateTime } from '../utils/format';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const percent = (value, total) => {
  if (!total) return 0;
  return Math.round((Number(value || 0) / Number(total || 0)) * 100);
};

const moneyCompact = (value) => currency(Number(value || 0));

const KpiCard = ({ label, value, helper, tone = 'orange', marker }) => {
  const tones = {
    orange: 'border-brand-100 bg-brand-50/90 text-brand-800',
    emerald: 'border-emerald-100 bg-emerald-50/90 text-emerald-800',
    cyan: 'border-cyan-100 bg-cyan-50/90 text-cyan-800',
    amber: 'border-amber-100 bg-amber-50/90 text-amber-800',
    rose: 'border-rose-100 bg-rose-50/90 text-rose-800',
    slate: 'border-slate-100 bg-slate-50/90 text-slate-800',
    indigo: 'border-indigo-100 bg-indigo-50/90 text-indigo-800'
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.orange}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
          <p className="mt-2 truncate font-display text-2xl font-extrabold tracking-tight">{value}</p>
        </div>
        {marker ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-base font-black shadow-sm">
            {marker}
          </span>
        ) : null}
      </div>
      {helper ? <p className="mt-2 text-sm font-medium opacity-75">{helper}</p> : null}
    </div>
  );
};

const ProgressRow = ({ label, value, total, displayValue, tone = 'bg-brand-500' }) => {
  const width = Math.min(100, percent(value, total));

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

const DistributionList = ({ rows, labelKey, valueKey = 'count', emptyText, tone = 'bg-brand-500' }) => {
  const max = Math.max(...rows.map((row) => Number(row[valueKey] || 0)), 1);

  if (!rows.length) {
    return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const value = Number(row[valueKey] || 0);
        return (
          <div key={row[labelKey]} className="rounded-2xl border border-slate-100 bg-white/80 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-bold text-slate-800">{String(row[labelKey] || 'UNKNOWN').replaceAll('_', ' ')}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{value}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${tone}`} style={{ width: `${percent(value, max)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SuperAdminDashboardPage = () => {
  const [overview, setOverview] = useState(null);
  const [vendorOverview, setVendorOverview] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [overviewData, vendorData] = await Promise.all([reportService.superAdmin(), vendorService.overview()]);
      setOverview(overviewData);
      setVendorOverview(vendorData);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load super admin dashboard');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useAutoRefresh(load);

  const summary = overview?.summary || {};
  const vendorSummary = vendorOverview?.summary || {};
  const platformRevenue = Number(summary.totalRevenue || 0);
  const subscriptionIncome = Number(vendorSummary.totalSubscriptionIncome || summary.totalVendorSubscriptionIncome || 0);
  const monthlyRecurringRevenue = Number(vendorSummary.monthlyRecurringRevenue || 0);
  const totalVendors = Number(vendorSummary.totalVendors || summary.totalVendors || 0);
  const activeVendors = Number(vendorSummary.activeVendors || summary.activeVendors || 0);
  const activeSubscriptions = Number(vendorSummary.activeSubscriptions || 0);
  const vendorActivationRate = percent(activeVendors, totalVendors);
  const subscriptionAttachRate = percent(activeSubscriptions, totalVendors);
  const activeUserRate = percent(summary.activeUsers || 0, summary.totalUsers || 0);
  const paidRevenue = platformRevenue + subscriptionIncome;

  const vendorPlanRows = useMemo(
    () => vendorOverview?.distributions?.byPlan || overview?.distributions?.vendorsByPlan || [],
    [overview, vendorOverview]
  );
  const vendorStatusRows = useMemo(
    () => vendorOverview?.distributions?.byStatus || overview?.distributions?.vendorsBySubscriptionStatus || [],
    [overview, vendorOverview]
  );
  const orderStatusRows = overview?.distributions?.ordersByStatus || [];
  const paymentMethodRows = overview?.distributions?.paymentsByMethod || [];
  const recentVendors = overview?.recent?.vendors || [];
  const recentPayments = overview?.recent?.payments || [];
  const recentOrders = overview?.recent?.orders || [];

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      <Panel
        title="Super Admin Dashboard"
        subtitle="Platform control center for vendors, subscriptions, users, orders, and revenue."
        right={
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-800 transition hover:bg-brand-100"
            onClick={load}
          >
            Refresh
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Subscription Income" value={moneyCompact(subscriptionIncome)} helper="Collected from vendors" tone="emerald" marker="₨" />
          <KpiCard label="Monthly Recurring Revenue" value={moneyCompact(monthlyRecurringRevenue)} helper="Estimated active MRR" tone="cyan" marker="MRR" />
          <KpiCard label="Active Vendors" value={`${activeVendors}/${totalVendors}`} helper={`${vendorActivationRate}% vendor activation`} tone="orange" marker="V" />
          <KpiCard label="Active Subscriptions" value={activeSubscriptions} helper={`${subscriptionAttachRate}% attached to vendors`} tone="amber" marker="S" />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Platform Revenue" value={moneyCompact(platformRevenue)} helper={`${summary.totalPayments || 0} payments`} tone="indigo" />
          <KpiCard label="Total Users" value={summary.totalUsers || 0} helper={`${summary.activeUsers || 0} active`} tone="slate" />
          <KpiCard label="Total Orders" value={summary.totalOrders || 0} helper="Across all vendors" tone="orange" />
          <KpiCard label="Low Stock Alerts" value={summary.lowStockCount || 0} helper="Across inventory" tone={(summary.lowStockCount || 0) ? 'rose' : 'emerald'} />
          <KpiCard label="Total Income" value={moneyCompact(paidRevenue)} helper="Platform + subscription" tone="emerald" />
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-12">
        <Panel title="Platform Health" subtitle="High-level readiness indicators" className="xl:col-span-4">
          <div className="space-y-5">
            <ProgressRow label="Vendor activation" value={activeVendors} total={Math.max(totalVendors, 1)} displayValue={`${vendorActivationRate}%`} tone="bg-brand-500" />
            <ProgressRow label="Subscription attach rate" value={activeSubscriptions} total={Math.max(totalVendors, 1)} displayValue={`${subscriptionAttachRate}%`} tone="bg-amber-500" />
            <ProgressRow label="Active user rate" value={summary.activeUsers || 0} total={Math.max(summary.totalUsers || 1, 1)} displayValue={`${activeUserRate}%`} tone="bg-emerald-500" />
            <ProgressRow label="Inactive vendors" value={summary.inactiveVendors || 0} total={Math.max(summary.totalVendors || 1, 1)} tone="bg-rose-500" />
          </div>
        </Panel>

        <Panel title="Quick Actions" subtitle="Common platform management tasks" className="xl:col-span-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { to: '/super-admin/vendors', label: 'Manage Vendors', hint: `${totalVendors} vendors` },
              { to: '/super-admin/subscriptions', label: 'Subscriptions', hint: `${activeSubscriptions} active` },
              { to: '/super-admin/plans', label: 'Plans & Features', hint: 'Pricing and feature limits' },
              { to: '/super-admin/users', label: 'Platform Users', hint: `${summary.totalUsers || 0} users` }
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

        <Panel title="Revenue Mix" subtitle="Where platform income is coming from" className="xl:col-span-4">
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Subscription income</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-emerald-900">{moneyCompact(subscriptionIncome)}</p>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Restaurant payment volume</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-indigo-900">{moneyCompact(platformRevenue)}</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel title="Vendors By Plan" subtitle="Plan adoption across vendors">
          <DistributionList rows={vendorPlanRows} labelKey="planId" emptyText="No vendor plan data yet." tone="bg-brand-500" />
        </Panel>

        <Panel title="Subscription Status" subtitle="Current vendor subscription health">
          <DistributionList rows={vendorStatusRows} labelKey="status" emptyText="No subscription status data yet." tone="bg-emerald-500" />
        </Panel>

        <Panel title="Order Status Mix" subtitle="Operational activity across vendors">
          <DistributionList rows={orderStatusRows} labelKey="status" emptyText="No order status data yet." tone="bg-cyan-500" />
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Panel title="Recent Vendor Subscription Payments" subtitle="Latest vendor billing records" className="xl:col-span-7">
          <div className="hidden overflow-hidden rounded-2xl border border-brand-100 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-gradient-to-r from-brand-50 via-white to-secondary-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Cycle</th>
                    <th className="px-4 py-3 text-right">Total Paid</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-100/70">
                  {recentVendors.map((vendor) => (
                    <tr key={vendor._id} className="align-top transition hover:bg-brand-50/35">
                      <td className="px-4 py-3 font-bold text-slate-900">{vendor.vendorName}</td>
                      <td className="px-4 py-3">{vendor.subscription?.planId || '-'}</td>
                      <td className="px-4 py-3">{vendor.subscription?.billingCycle || '-'}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{currency(vendor.totalPaid || 0)}</td>
                      <td className="px-4 py-3"><StatusBadge value={vendor.subscription?.status || '-'} /></td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(vendor.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!recentVendors.length ? <p className="p-4 text-sm text-slate-500">No vendor records yet</p> : null}
          </div>

          <div className="space-y-3 md:hidden">
            {recentVendors.map((vendor) => (
              <article key={vendor._id} className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{vendor.vendorName}</p>
                    <p className="text-xs text-slate-500">{vendor.subscription?.planId || '-'} · {vendor.subscription?.billingCycle || '-'}</p>
                  </div>
                  <StatusBadge value={vendor.subscription?.status || '-'} />
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-700">Total Paid: {currency(vendor.totalPaid || 0)}</p>
                <p className="text-xs text-slate-500">Created: {formatDateTime(vendor.createdAt)}</p>
              </article>
            ))}
            {!recentVendors.length ? (
              <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No vendor records yet</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Payment Methods" subtitle="Revenue by collection method" className="xl:col-span-5">
          <div className="space-y-3">
            {paymentMethodRows.map((row) => (
              <div key={row.method} className="rounded-2xl border border-slate-100 bg-white/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{String(row.method || 'UNKNOWN').replaceAll('_', ' ')}</p>
                    <p className="text-xs text-slate-500">{row.count} transaction{row.count === 1 ? '' : 's'}</p>
                  </div>
                  <p className="font-display text-lg font-extrabold text-slate-900">{currency(row.totalAmount || 0)}</p>
                </div>
              </div>
            ))}
            {!paymentMethodRows.length ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No payment method data yet.</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Recent Orders" subtitle="Latest operational activity">
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3">
                <div>
                  <p className="font-bold text-slate-900">{order.orderNumber}</p>
                  <p className="text-xs text-slate-500">
                    {order.orderType} · {order.table?.tableNumber || 'No table'} · {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-slate-900">{currency(order.total || 0)}</p>
                  <StatusBadge value={order.status} />
                </div>
              </div>
            ))}
            {!recentOrders.length ? <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No recent orders.</p> : null}
          </div>
        </Panel>

        <Panel title="Recent Payments" subtitle="Latest platform-wide bill payments">
          <div className="space-y-3">
            {recentPayments.map((payment) => (
              <div key={payment._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/80 p-3">
                <div>
                  <p className="font-bold text-slate-900">{payment.billNumber}</p>
                  <p className="text-xs text-slate-500">
                    {payment.paymentMethod} · {formatDateTime(payment.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold text-slate-900">{currency(payment.amountPaid || 0)}</p>
                  <StatusBadge value={payment.paymentStatus} />
                </div>
              </div>
            ))}
            {!recentPayments.length ? <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No recent payments.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default SuperAdminDashboardPage;
