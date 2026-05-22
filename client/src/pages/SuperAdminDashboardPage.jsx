import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService, vendorService } from '../api/services';
import StatusBadge from '../components/StatusBadge';
import {
  SuperAdminSection,
  SuperAdminStatCard
} from '../components/super-admin/SuperAdminUI';
import { currency, formatDateTime } from '../utils/format';

const SuperAdminDashboardPage = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [vendorOverview, setVendorOverview] = useState(null);
  const [error, setError] = useState('');
  const [lastChecked, setLastChecked] = useState(null);

  const load = async () => {
    setError('');
    try {
      const [overviewData, vendorData] = await Promise.all([reportService.superAdmin(), vendorService.overview()]);
      setOverview(overviewData);
      setVendorOverview(vendorData);
      setLastChecked(new Date().toISOString());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load super admin dashboard');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = overview?.summary || {};
  const vendorSummary = vendorOverview?.summary || {};

  const cards = useMemo(() => {
    return [
      { label: 'Total Vendors', value: summary.totalVendors || vendorSummary.totalVendors || 0 },
      { label: 'Active Vendors', value: summary.activeVendors || vendorSummary.activeVendors || 0 },
      { label: 'Inactive/Suspended', value: summary.inactiveVendors || 0 },
      { label: 'Platform Users', value: summary.totalUsers || 0 },
      { label: 'Total Orders', value: summary.totalOrders || 0 },
      {
        label: 'Revenue (All Vendors)',
        value: currency(vendorSummary.totalSubscriptionIncome || summary.totalVendorSubscriptionIncome || 0)
      }
    ];
  }, [summary, vendorSummary]);

  const platformStatus = error ? 'DOWN' : 'UP';

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <SuperAdminStatCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SuperAdminSection
          title="Platform Health"
          subtitle="Live infrastructure status and quick operator actions"
        >
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              API: <span className="font-semibold">{platformStatus}</span>
            </p>
            <p>
              Database: <span className="font-semibold">{vendorOverview ? 'UP' : platformStatus}</span>
            </p>
            <p>Last Checked: {formatDateTime(lastChecked)}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/super-admin/vendors')}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
            >
              Manage Vendors
            </button>
            <button
              type="button"
              onClick={() => navigate('/super-admin/users')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Manage Users
            </button>
            <button
              type="button"
              onClick={() => navigate('/super-admin/subscriptions')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Manage Subscriptions
            </button>
          </div>
        </SuperAdminSection>

        <SuperAdminSection
          title="Plan Distribution"
          subtitle="How vendors are spread across pricing plans"
        >
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="superadmin-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Code</th>
                  <th>Vendors</th>
                </tr>
              </thead>
              <tbody>
                {(vendorOverview?.distributions?.byPlan || []).map((row) => (
                  <tr key={row.planId}>
                    <td>{row.planId}</td>
                    <td>{row.planId}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!vendorOverview?.distributions?.byPlan?.length ? (
              <p className="p-4 text-sm text-slate-500">No plan distribution yet.</p>
            ) : null}
          </div>
        </SuperAdminSection>
      </div>

      <SuperAdminSection
        title="Subscription Status"
        subtitle="Current status of all vendor subscriptions"
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="superadmin-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {(vendorOverview?.distributions?.byStatus || []).map((row) => (
                <tr key={row.status}>
                  <td>
                    <StatusBadge value={row.status} />
                  </td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!vendorOverview?.distributions?.byStatus?.length ? (
            <p className="p-4 text-sm text-slate-500">No subscription status records yet.</p>
          ) : null}
        </div>
      </SuperAdminSection>

      <SuperAdminSection
        title="Recent Vendor Activity"
        subtitle="System-level vendor events for support and governance"
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="superadmin-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Total Paid</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.recent?.vendors || []).map((vendor) => (
                <tr key={vendor._id}>
                  <td className="font-semibold">{vendor.vendorName}</td>
                  <td>{vendor.subscription?.planId || '-'}</td>
                  <td>
                    <StatusBadge value={vendor.subscription?.status || '-'} />
                  </td>
                  <td>{currency(vendor.totalPaid || 0)}</td>
                  <td>{formatDateTime(vendor.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!overview?.recent?.vendors?.length ? (
            <p className="p-4 text-sm text-slate-500">No vendor activity available yet.</p>
          ) : null}
        </div>
      </SuperAdminSection>
    </div>
  );
};

export default SuperAdminDashboardPage;
