import { useEffect, useMemo, useState } from 'react';
import Panel from '../components/ui/Panel';
import StatusBadge from '../components/StatusBadge';
import { reportService, vendorService } from '../api/services';
import { currency, formatDateTime } from '../utils/format';

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

  const cards = useMemo(() => {
    const summary = overview?.summary || {};
    const vendorSummary = vendorOverview?.summary || {};
    return [
      { label: 'Subscription Income', value: currency(vendorSummary.totalSubscriptionIncome || 0), tone: 'emerald' },
      { label: 'Monthly Recurring Rev.', value: currency(vendorSummary.monthlyRecurringRevenue || 0), tone: 'sky' },
      { label: 'Total Vendors', value: vendorSummary.totalVendors || 0, tone: 'violet' },
      { label: 'Active Subscriptions', value: vendorSummary.activeSubscriptions || 0, tone: 'amber' },
      { label: 'Total Platform Revenue', value: currency(summary.totalRevenue || 0), tone: 'indigo' },
      { label: 'Total Users', value: summary.totalUsers || 0, tone: 'fuchsia' }
    ];
  }, [overview, vendorOverview]);

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <Panel
        title="Super Admin Dashboard"
        subtitle="Track all vendors, subscriptions, and platform-level subscription income"
        right={<button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium" onClick={load}>Refresh</button>}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className={`rounded-xl border px-4 py-3 ${
              card.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50'
                : card.tone === 'sky'
                  ? 'border-sky-200 bg-sky-50'
                  : card.tone === 'violet'
                    ? 'border-violet-200 bg-violet-50'
                    : card.tone === 'amber'
                      ? 'border-amber-200 bg-amber-50'
                      : card.tone === 'indigo'
                        ? 'border-indigo-200 bg-indigo-50'
                        : 'border-fuchsia-200 bg-fuchsia-50'
            }`}>
              <p className="text-xs font-semibold uppercase text-slate-600">{card.label}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Vendors By Plan">
          <div className="space-y-2">
            {(vendorOverview?.distributions?.byPlan || []).map((row) => (
              <div key={row.planId} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm font-medium text-slate-700">{row.planId}</span>
                <span className="text-sm font-bold text-slate-900">{row.count}</span>
              </div>
            ))}
            {!vendorOverview?.distributions?.byPlan?.length ? (
              <p className="text-sm text-slate-500">No vendor data</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Vendors By Subscription Status">
          <div className="space-y-2">
            {(vendorOverview?.distributions?.byStatus || []).map((row) => (
              <div key={row.status} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <StatusBadge value={row.status} />
                <span className="text-sm font-bold text-slate-900">{row.count}</span>
              </div>
            ))}
            {!vendorOverview?.distributions?.byStatus?.length ? (
              <p className="text-sm text-slate-500">No status data</p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Recent Vendor Subscription Payments" subtitle="Latest bill collections from vendors">
        <div className="hidden overflow-x-auto md:block">
          <table className="table-ui">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Plan</th>
                <th>Cycle</th>
                <th>Total Paid</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.recent?.vendors || []).map((vendor) => (
                <tr key={vendor._id}>
                  <td className="font-semibold">{vendor.vendorName}</td>
                  <td>{vendor.subscription?.planId || '-'}</td>
                  <td>{vendor.subscription?.billingCycle || '-'}</td>
                  <td>{currency(vendor.totalPaid || 0)}</td>
                  <td><StatusBadge value={vendor.subscription?.status || '-'} /></td>
                  <td>{formatDateTime(vendor.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!overview?.recent?.vendors?.length ? <p className="p-4 text-sm text-slate-500">No vendor records yet</p> : null}
        </div>

        <div className="space-y-3 md:hidden">
          {(overview?.recent?.vendors || []).map((vendor) => (
            <article key={vendor._id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{vendor.vendorName}</p>
                  <p className="text-xs text-slate-500">{vendor.subscription?.planId || '-'} | {vendor.subscription?.billingCycle || '-'}</p>
                </div>
                <StatusBadge value={vendor.subscription?.status || '-'} />
              </div>
              <p className="mt-2 text-sm text-slate-700">Total Paid: {currency(vendor.totalPaid || 0)}</p>
              <p className="text-xs text-slate-500">Created: {formatDateTime(vendor.createdAt)}</p>
            </article>
          ))}
          {!overview?.recent?.vendors?.length ? (
            <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No vendor records yet</p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
};

export default SuperAdminDashboardPage;
