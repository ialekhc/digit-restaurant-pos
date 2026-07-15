import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { planService, reportService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { currency, formatDateTime } from '../utils/format';

const SuperAdminSettingsPage = () => {
  const [catalog, setCatalog] = useState(null);
  const [overview, setOverview] = useState(null);
  const [form, setForm] = useState({ currency: 'NPR', profitMargin: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const [catalogData, overviewData] = await Promise.all([
        planService.catalog(),
        reportService.superAdmin()
      ]);
      setCatalog(catalogData);
      setOverview(overviewData);
      setForm({
        currency: catalogData?.currency || 'NPR',
        profitMargin: catalogData?.profitMargin || ''
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load platform settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = overview?.summary || {};
  const platformHealth = useMemo(() => {
    const totalVendors = Number(summary.totalVendors || 0);
    const activeVendors = Number(summary.activeVendors || 0);
    const totalUsers = Number(summary.totalUsers || 0);
    const activeUsers = Number(summary.activeUsers || 0);
    return [
      {
        label: 'Vendor activation',
        value: totalVendors ? `${Math.round((activeVendors / totalVendors) * 100)}%` : '0%',
        helper: `${activeVendors}/${totalVendors} active vendors`
      },
      {
        label: 'User activation',
        value: totalUsers ? `${Math.round((activeUsers / totalUsers) * 100)}%` : '0%',
        helper: `${activeUsers}/${totalUsers} active users`
      },
      {
        label: 'Platform volume',
        value: currency(summary.totalRevenue || 0),
        helper: `${summary.totalPayments || 0} payments`
      },
      {
        label: 'Low stock alerts',
        value: summary.lowStockCount || 0,
        helper: 'Across all vendors'
      }
    ];
  }, [summary]);

  const saveSettings = async () => {
    if (!catalog) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await planService.updateCatalog({
        ...catalog,
        currency: form.currency,
        profitMargin: form.profitMargin,
        plans: catalog.plans || [],
        addons: catalog.addons || []
      });
      setCatalog(updated);
      setMessage('Platform settings saved successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save platform settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Panel title="Super Admin Settings" subtitle="Loading platform settings">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      ) : null}

      <Panel
        title="Super Admin Settings"
        subtitle="Configure platform-level defaults and monitor system readiness."
        right={
          <Button onClick={saveSettings} disabled={saving || !catalog}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {platformHealth.map((item) => (
            <div key={item.label} className="rounded-2xl border border-brand-100 bg-white/85 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-slate-900">{item.value}</p>
              <p className="mt-1 text-sm text-slate-500">{item.helper}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-12">
        <Panel title="Platform Defaults" subtitle="Used across plans, subscriptions, and platform-level reports" className="xl:col-span-7">
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Default Currency"
              value={form.currency}
              options={[
                { label: 'NPR - Nepalese Rupee', value: 'NPR' },
                { label: 'USD - US Dollar', value: 'USD' },
                { label: 'INR - Indian Rupee', value: 'INR' }
              ]}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
            />
            <Input
              label="Target Profit Margin"
              value={form.profitMargin}
              placeholder="41.6%"
              onChange={(e) => setForm((prev) => ({ ...prev, profitMargin: e.target.value }))}
              helperText="Displayed for internal platform pricing reference."
            />
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/80 p-4">
            <p className="font-semibold text-cyan-900">Current catalog status</p>
            <p className="mt-1 text-sm text-cyan-800">
              {catalog?.plans?.length || 0} plans · {catalog?.addons?.length || 0} addons · Currency {catalog?.currency || 'NPR'}
            </p>
          </div>
        </Panel>

        <Panel title="Platform Shortcuts" subtitle="Quick access to Super Admin controls" className="xl:col-span-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { to: '/super-admin/vendors', label: 'Vendors', hint: 'Manage vendor accounts' },
              { to: '/super-admin/subscriptions', label: 'Subscriptions', hint: 'Track vendor billing' },
              { to: '/super-admin/plans', label: 'Plans & Pricing', hint: 'Customize plans' },
              { to: '/super-admin/users', label: 'Users', hint: 'Platform access' }
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
      </div>

      <Panel title="Recent Platform Activity" subtitle="Latest vendor and payment records">
        <div className="grid gap-5 xl:grid-cols-2">
          <div>
            <h4 className="mb-3 font-display text-base font-bold text-slate-900">Recent Vendors</h4>
            <div className="space-y-3">
              {(overview?.recent?.vendors || []).slice(0, 4).map((vendor) => (
                <div key={vendor._id} className="rounded-2xl border border-slate-100 bg-white/85 p-3">
                  <p className="font-bold text-slate-900">{vendor.vendorName}</p>
                  <p className="text-sm text-slate-500">
                    {vendor.subscription?.planId || 'No plan'} · {formatDateTime(vendor.createdAt)}
                  </p>
                </div>
              ))}
              {!overview?.recent?.vendors?.length ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No recent vendor activity.
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <h4 className="mb-3 font-display text-base font-bold text-slate-900">Recent Payments</h4>
            <div className="space-y-3">
              {(overview?.recent?.payments || []).slice(0, 4).map((payment) => (
                <div key={payment._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/85 p-3">
                  <div>
                    <p className="font-bold text-slate-900">{payment.billNumber}</p>
                    <p className="text-sm text-slate-500">{formatDateTime(payment.createdAt)}</p>
                  </div>
                  <p className="font-display text-base font-extrabold text-slate-900">{currency(payment.amountPaid || 0)}</p>
                </div>
              ))}
              {!overview?.recent?.payments?.length ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No recent payment activity.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default SuperAdminSettingsPage;
