import { useEffect, useMemo, useState } from 'react';
import { planService, reportService } from '../api/services';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { currency, formatDateTime } from '../utils/format';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const SuperAdminPage = () => {
  const [catalog, setCatalog] = useState(null);
  const [activePlanData, setActivePlanData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedAddons, setSelectedAddons] = useState([]);

  const load = async (syncForm = true) => {
    setError('');
    try {
      const [catalogData, activeData, overviewData] = await Promise.all([
        planService.catalog(),
        planService.active(),
        reportService.superAdmin()
      ]);
      setCatalog(catalogData);
      setActivePlanData(activeData);
      setOverview(overviewData);

      if (syncForm) {
        setSelectedPlanId(activeData?.config?.activePlanId || '');
        setBillingCycle(activeData?.config?.billingCycle || 'monthly');
        setSelectedAddons(activeData?.config?.addons || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load super admin portal');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useAutoRefresh(() => load(false));

  const planOptions = useMemo(
    () => (catalog?.plans || []).map((plan) => ({ label: plan.name, value: plan.id })),
    [catalog]
  );

  const activePlan = useMemo(
    () => (catalog?.plans || []).find((plan) => plan.id === selectedPlanId),
    [catalog, selectedPlanId]
  );

  const onToggleAddon = (addonName) => {
    setSelectedAddons((prev) =>
      prev.includes(addonName) ? prev.filter((name) => name !== addonName) : [...prev, addonName]
    );
  };

  const savePlanConfig = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    setError('');
    try {
      const updated = await planService.updateActive({
        activePlanId: selectedPlanId,
        billingCycle,
        addons: selectedAddons
      });
      setActivePlanData(updated);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save plan configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Super Admin Portal" subtitle="Platform-level controls, plan distribution, and system analytics">
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <p className="mb-3 text-sm text-slate-600">
          Catalog Currency: <span className="font-semibold">{catalog?.currency || 'NPR'}</span> | Profit Margin Target:{' '}
          <span className="font-semibold">{catalog?.profitMargin || '-'}</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-emerald-700">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-900">{currency(overview?.summary?.totalRevenue || 0)}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-sky-700">Total Users</p>
            <p className="text-2xl font-bold text-sky-900">{overview?.summary?.totalUsers || 0}</p>
          </div>
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-violet-700">Total Orders</p>
            <p className="text-2xl font-bold text-violet-900">{overview?.summary?.totalOrders || 0}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase text-amber-700">Low Stock Items</p>
            <p className="text-2xl font-bold text-amber-900">{overview?.summary?.lowStockCount || 0}</p>
          </div>
        </div>
      </Panel>

      <Panel title="Plan Distribution" subtitle="Set active plan, billing cycle, and addon features">
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="Active Plan"
            value={selectedPlanId}
            options={[{ label: 'Select plan', value: '' }, ...planOptions]}
            onChange={(e) => setSelectedPlanId(e.target.value)}
          />

          <Select
            label="Billing Cycle"
            value={billingCycle}
            options={[
              { label: 'Monthly', value: 'monthly' },
              { label: 'Semi-Annual', value: 'semiAnnual' },
              { label: 'Annual', value: 'annual' }
            ]}
            onChange={(e) => setBillingCycle(e.target.value)}
          />

          <div className="flex items-end">
            <Button className="w-full" onClick={savePlanConfig} disabled={saving || !selectedPlanId}>
              {saving ? 'Saving...' : 'Save Plan Config'}
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(catalog?.addons || []).map((addon) => {
            const selected = selectedAddons.includes(addon.name);
            return (
              <button
                key={addon.name}
                type="button"
                onClick={() => onToggleAddon(addon.name)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  selected
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">{addon.name}</p>
                <p className="text-xs text-slate-500">{currency(addon.monthlyPrice)}/month</p>
              </button>
            );
          })}
        </div>

        {activePlan ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">Selected Plan: {activePlan.name}</p>
            <p className="text-xs text-slate-600">
              Pricing ({billingCycle}): {currency(activePlan.pricing?.[billingCycle] || 0)}
            </p>
            <p className="text-xs text-slate-600">
              Staff limit: {String(activePlan.limits?.staffAccounts || '-')} | Branch limit:{' '}
              {String(activePlan.limits?.branches || '-')}
            </p>
          </div>
        ) : null}
      </Panel>

      <Panel title="Plan Catalog" subtitle="Feature distribution and limits per subscription plan">
        <div className="grid gap-4 lg:grid-cols-2">
          {(catalog?.plans || []).map((plan) => (
            <article
              key={plan.id}
              className={`rounded-2xl border p-4 ${
                activePlanData?.config?.activePlanId === plan.id
                  ? 'border-brand-300 bg-brand-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{plan.name}</h4>
                  <p className="text-xs text-slate-600">{plan.id}</p>
                </div>
                {plan.recommended ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                    Recommended
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-white px-2 py-2 ring-1 ring-slate-200">
                  <p className="text-slate-500">Monthly</p>
                  <p className="font-semibold text-slate-900">{currency(plan.pricing?.monthly || 0)}</p>
                </div>
                <div className="rounded-lg bg-white px-2 py-2 ring-1 ring-slate-200">
                  <p className="text-slate-500">Semi-Annual</p>
                  <p className="font-semibold text-slate-900">{currency(plan.pricing?.semiAnnual || 0)}</p>
                </div>
                <div className="rounded-lg bg-white px-2 py-2 ring-1 ring-slate-200">
                  <p className="text-slate-500">Annual</p>
                  <p className="font-semibold text-slate-900">{currency(plan.pricing?.annual || 0)}</p>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-600">
                Staff: <span className="font-semibold">{String(plan.limits?.staffAccounts || '-')}</span> | Branches:{' '}
                <span className="font-semibold">{String(plan.limits?.branches || '-')}</span>
              </p>

              <p className="mt-2 text-xs text-slate-600">
                Suitable for: {(plan.suitableFor || []).join(', ')}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {(plan.features || []).slice(0, 8).map((feature) => (
                  <span key={feature} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                    {feature}
                  </span>
                ))}
                {(plan.features || []).length > 8 ? (
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    +{plan.features.length - 8} more
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Users By Role">
          <div className="space-y-2">
            {(overview?.distributions?.usersByRole || []).map((row) => (
              <div key={row.role} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm font-medium text-slate-700">{row.role}</span>
                <span className="text-sm font-bold text-slate-900">{row.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Payment Methods">
          <div className="space-y-2">
            {(overview?.distributions?.paymentsByMethod || []).map((row) => (
              <div key={row.method} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{row.method}</span>
                  <span className="text-sm font-bold text-slate-900">{row.count}</span>
                </div>
                <p className="text-xs text-slate-500">{currency(row.totalAmount || 0)}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Recent Payments">
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Order #</th>
                <th>Table</th>
                <th>Method</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.recent?.payments || []).map((payment) => (
                <tr key={payment._id}>
                  <td className="font-semibold">{payment.billNumber}</td>
                  <td>{payment.order?.orderNumber || '-'}</td>
                  <td>{payment.order?.table?.tableNumber || '-'}</td>
                  <td>{payment.paymentMethod}</td>
                  <td>{payment.paymentStatus}</td>
                  <td>{currency(payment.amountPaid)}</td>
                  <td>{formatDateTime(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

export default SuperAdminPage;
