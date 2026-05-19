import { useEffect, useMemo, useState } from 'react';
import { planService } from '../api/services';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { currency } from '../utils/format';

const SuperAdminPlansPage = () => {
  const [catalog, setCatalog] = useState(null);
  const [activePlanData, setActivePlanData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedAddons, setSelectedAddons] = useState([]);

  const load = async () => {
    setError('');
    try {
      const [catalogData, activeData] = await Promise.all([planService.catalog(), planService.active()]);
      setCatalog(catalogData);
      setActivePlanData(activeData);
      setSelectedPlanId(activeData?.config?.activePlanId || '');
      setBillingCycle(activeData?.config?.billingCycle || 'monthly');
      setSelectedAddons(activeData?.config?.addons || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load plan catalog');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activePlan = useMemo(
    () => (catalog?.plans || []).find((plan) => plan.id === selectedPlanId),
    [catalog, selectedPlanId]
  );

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

  const toggleAddon = (addonName) => {
    setSelectedAddons((prev) =>
      prev.includes(addonName) ? prev.filter((name) => name !== addonName) : [...prev, addonName]
    );
  };

  return (
    <div className="space-y-5">
      <Panel title="Plans & Features" subtitle="Manage active subscription plan distribution and feature addons">
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

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
            <p>Addons Selected: {selectedAddons.length}</p>
          </div>
        ) : null}
      </Panel>

      <Panel title="Addon Features">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(catalog?.addons || []).map((addon) => {
            const selected = selectedAddons.includes(addon.name);
            return (
              <button
                key={addon.name}
                type="button"
                onClick={() => toggleAddon(addon.name)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  selected ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">{addon.name}</p>
                <p className="text-xs text-slate-500">{currency(addon.monthlyPrice)}/month</p>
              </button>
            );
          })}
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
