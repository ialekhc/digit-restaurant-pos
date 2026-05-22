import { useEffect, useMemo, useState } from 'react';
import { planService } from '../api/services';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import {
  SuperAdminSection,
  SuperAdminStatCard
} from '../components/super-admin/SuperAdminUI';
import { currency } from '../utils/format';

const SuperAdminPlansPage = () => {
  const [catalog, setCatalog] = useState(null);
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

  const stats = useMemo(() => {
    const plans = catalog?.plans || [];
    const avgMonthly = plans.length
      ? plans.reduce((sum, plan) => sum + Number(plan.pricing?.monthly || 0), 0) / plans.length
      : 0;

    return {
      totalPlans: plans.length,
      avgMonthly,
      enabledFeaturesSelected: selectedAddons.length,
      totalFeaturesSelected: activePlan?.featureKeys?.length || activePlan?.features?.length || 0
    };
  }, [catalog, selectedAddons, activePlan]);

  const savePlanConfig = async () => {
    if (!selectedPlanId) return;
    setSaving(true);
    setError('');
    try {
      await planService.updateActive({
        activePlanId: selectedPlanId,
        billingCycle,
        addons: selectedAddons
      });
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SuperAdminStatCard label="Total Plans" value={stats.totalPlans} />
        <SuperAdminStatCard label="Avg Monthly Price" value={currency(stats.avgMonthly)} />
        <SuperAdminStatCard label="Enabled Features (Selected)" value={stats.enabledFeaturesSelected} />
        <SuperAdminStatCard label="Total Features (Selected)" value={stats.totalFeaturesSelected} />
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
      ) : null}

      <SuperAdminSection
        title="Plan Catalog"
        subtitle="Select a plan to edit pricing, limits, and package attributes"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(catalog?.plans || []).map((plan) => {
            const selected = plan.id === selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                className={`rounded-2xl border p-3 text-left transition ${
                  selected ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <p className="font-display text-lg font-semibold text-slate-800">{plan.name} ({plan.id})</p>
                <p className="text-sm text-slate-500">{currency(plan.pricing?.monthly || 0)} / month</p>
              </button>
            );
          })}
        </div>
      </SuperAdminSection>

      <SuperAdminSection
        title="Edit Plan"
        subtitle="Change commercial terms and package metadata for the selected plan"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input label="Plan Code" value={activePlan?.id || ''} readOnly />
          <Input label="Plan Name" value={activePlan?.name || ''} readOnly />
          <Input label="Hosting Package" value={activePlan?.support?.prioritySupport ? 'Priority Cloud' : 'Basic Shared Cloud'} readOnly />

          <Input label="Description" value={(activePlan?.suitableFor || []).join(', ')} readOnly />
          <Input label="Monthly Price" value={String(activePlan?.pricing?.monthly || '')} readOnly />
          <Input label="Yearly Price" value={String(activePlan?.pricing?.annual || '')} readOnly />

          <Input label="Max Products" value={String(activePlan?.limits?.products || 250)} readOnly />
          <Input label="Max Orders / Year" value={String(activePlan?.limits?.maxOrdersPerYear || 10000)} readOnly />
          <Input label="Max Staff Accounts" value={String(activePlan?.limits?.staffAccounts || '-')} readOnly />

          <Select
            label="Domain Included"
            value={(activePlan?.features || []).includes('Custom Branding') || (activePlan?.features || []).includes('Custom Domain') ? 'Yes' : 'No'}
            options={[
              { label: 'Yes', value: 'Yes' },
              { label: 'No', value: 'No' }
            ]}
            disabled
          />
          <Select
            label="Maintenance Included"
            value={activePlan?.support?.trainingIncluded ? 'Yes' : 'No'}
            options={[
              { label: 'Yes', value: 'Yes' },
              { label: 'No', value: 'No' }
            ]}
            disabled
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
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={savePlanConfig}
            disabled={saving || !selectedPlanId}
            className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60 md:w-[260px]"
          >
            {saving ? 'Saving...' : 'Save Plan Changes'}
          </button>
        </div>
      </SuperAdminSection>

      <SuperAdminSection
        title="Feature Entitlements"
        subtitle="Enable addon capabilities and review selected plan features"
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Addons</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(catalog?.addons || []).map((addon) => {
                const selected = selectedAddons.includes(addon.name);
                return (
                  <button
                    key={addon.name}
                    type="button"
                    onClick={() => toggleAddon(addon.name)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      selected ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="font-semibold text-slate-800">{addon.name}</p>
                    <p className="text-xs text-slate-500">{currency(addon.monthlyPrice)}/month</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Plan Features</p>
            <div className="max-h-[280px] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
              {(activePlan?.features || []).map((feature) => (
                <div key={feature} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  {feature}
                </div>
              ))}
              {!activePlan?.features?.length ? <p className="text-sm text-slate-500">No features available.</p> : null}
            </div>
          </div>
        </div>
      </SuperAdminSection>
    </div>
  );
};

export default SuperAdminPlansPage;
