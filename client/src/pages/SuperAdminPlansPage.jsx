import { useEffect, useMemo, useState } from 'react';
import { planService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { currency } from '../utils/format';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const SuperAdminPlansPage = () => {
  const [catalog, setCatalog] = useState(null);
  const [activePlanData, setActivePlanData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [catalogSaving, setCatalogSaving] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [editablePlans, setEditablePlans] = useState([]);
  const [selectedCatalogPlanId, setSelectedCatalogPlanId] = useState('');

  const load = async (syncForm = true) => {
    setError('');
    try {
      const [catalogData, activeData] = await Promise.all([planService.catalog(), planService.active()]);
      setCatalog(catalogData);
      setActivePlanData(activeData);
      if (syncForm) {
        setSelectedPlanId(activeData?.config?.activePlanId || '');
        setBillingCycle(activeData?.config?.billingCycle || 'monthly');
        setEditablePlans(catalogData?.plans || []);
        setSelectedCatalogPlanId(catalogData?.plans?.[0]?.id || '');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plan catalog');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useAutoRefresh(() => load(false));

  const activePlan = useMemo(
    () => (catalog?.plans || []).find((plan) => plan.id === selectedPlanId),
    [catalog, selectedPlanId]
  );

  const selectedCatalogPlan = useMemo(
    () => editablePlans.find((plan) => plan.id === selectedCatalogPlanId),
    [editablePlans, selectedCatalogPlanId]
  );

  const savePlanConfig = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await planService.updateActive({
        activePlanId: selectedPlanId,
        billingCycle
      });
      setActivePlanData(updated);
      await load();
      setMessage('Active plan configuration saved.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save plan configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateEditablePlan = (planId, updater) => {
    setEditablePlans((prev) =>
      prev.map((plan) => (plan.id === planId ? updater({ ...plan, pricing: { ...plan.pricing }, limits: { ...plan.limits } }) : plan))
    );
  };

  const saveCatalog = async () => {
    setCatalogSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await planService.updateCatalog({
        currency: catalog?.currency || 'NPR',
        profitMargin: catalog?.profitMargin || '',
        plans: editablePlans
      });
      setCatalog(updated);
      setEditablePlans(updated?.plans || []);
      setMessage('Plan prices and features updated successfully.');
      await load(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save plan catalog');
    } finally {
      setCatalogSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Plans & Features" subtitle="Manage active subscription plan distribution and package features">
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{message}</p> : null}

        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="Active Plan"
            value={selectedPlanId}
            options={(catalog?.plans || []).map((plan) => ({ label: `${plan.name} (${plan.id})`, value: plan.id }))}
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
              {saving ? 'Saving...' : 'Save Plan'}
            </Button>
          </div>
        </div>

        {activePlan ? (
          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Current Selection: {activePlan.name}</p>
            <p>Cycle Price: {currency(activePlan.pricing?.[billingCycle] || 0)}</p>
          </div>
        ) : null}
      </Panel>

      <Panel
        title="Customize Plans & Prices"
        subtitle="Edit plan pricing, staff/branch limits, and feature labels. These values are used when assigning vendor subscriptions."
        right={
          <Button onClick={saveCatalog} disabled={catalogSaving || !editablePlans.length}>
            {catalogSaving ? 'Saving...' : 'Save Catalog'}
          </Button>
        }
      >
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-3">
            <Select
              label="Plan To Edit"
              value={selectedCatalogPlanId}
              options={editablePlans.map((plan) => ({ label: `${plan.name} (${plan.id})`, value: plan.id }))}
              onChange={(e) => setSelectedCatalogPlanId(e.target.value)}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              {editablePlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedCatalogPlanId(plan.id)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selectedCatalogPlanId === plan.id
                      ? 'border-brand-300 bg-brand-50 shadow-sm'
                      : 'border-brand-100 bg-white hover:border-brand-200'
                  }`}
                >
                  <p className="font-display text-base font-bold text-slate-900">{plan.name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{plan.id}</p>
                  <p className="mt-2 text-sm font-bold text-brand-700">{currency(plan.pricing?.monthly || 0)}/mo</p>
                </button>
              ))}
            </div>
          </div>

          {selectedCatalogPlan ? (
            <div className="rounded-2xl border border-brand-100 bg-white/80 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Plan Name"
                  value={selectedCatalogPlan.name || ''}
                  onChange={(e) =>
                    updateEditablePlan(selectedCatalogPlan.id, (plan) => ({ ...plan, name: e.target.value }))
                  }
                />
                <Select
                  label="Recommended"
                  value={selectedCatalogPlan.recommended ? 'yes' : 'no'}
                  options={[
                    { label: 'No', value: 'no' },
                    { label: 'Yes', value: 'yes' }
                  ]}
                  onChange={(e) =>
                    updateEditablePlan(selectedCatalogPlan.id, (plan) => ({
                      ...plan,
                      recommended: e.target.value === 'yes'
                    }))
                  }
                />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  ['monthly', 'Monthly Price'],
                  ['semiAnnual', 'Semi-Annual Price'],
                  ['annual', 'Annual Price']
                ].map(([key, label]) => (
                  <Input
                    key={key}
                    type="number"
                    min="0"
                    label={label}
                    value={selectedCatalogPlan.pricing?.[key] ?? 0}
                    onChange={(e) =>
                      updateEditablePlan(selectedCatalogPlan.id, (plan) => ({
                        ...plan,
                        pricing: { ...plan.pricing, [key]: Number(e.target.value) }
                      }))
                    }
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input
                  label="Staff Account Limit"
                  value={selectedCatalogPlan.limits?.staffAccounts ?? ''}
                  onChange={(e) =>
                    updateEditablePlan(selectedCatalogPlan.id, (plan) => ({
                      ...plan,
                      limits: { ...plan.limits, staffAccounts: e.target.value === 'Unlimited' ? 'Unlimited' : Number(e.target.value) }
                    }))
                  }
                  helperText='Use a number or "Unlimited".'
                />
                <Input
                  label="Branch Limit"
                  value={selectedCatalogPlan.limits?.branches ?? ''}
                  onChange={(e) =>
                    updateEditablePlan(selectedCatalogPlan.id, (plan) => ({
                      ...plan,
                      limits: { ...plan.limits, branches: e.target.value === 'Unlimited' ? 'Unlimited' : Number(e.target.value) }
                    }))
                  }
                  helperText='Use a number or "Unlimited".'
                />
              </div>

              <div className="mt-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Feature List</span>
                  <textarea
                    rows={7}
                    value={(selectedCatalogPlan.features || []).join('\n')}
                    onChange={(e) =>
                      updateEditablePlan(selectedCatalogPlan.id, (plan) => ({
                        ...plan,
                        features: e.target.value.split('\n').map((row) => row.trim()).filter(Boolean)
                      }))
                    }
                    className="w-full rounded-xl border border-brand-200/80 bg-gradient-to-b from-white to-brand-50/35 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              Select a plan to edit.
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Plan Catalog">
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

              <div className="mt-3 flex flex-wrap gap-2">
                {(plan.features || []).slice(0, 7).map((feature) => (
                  <span key={feature} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                    {feature}
                  </span>
                ))}
                {(plan.features || []).length > 7 ? (
                  <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    +{plan.features.length - 7} more
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
};

export default SuperAdminPlansPage;
