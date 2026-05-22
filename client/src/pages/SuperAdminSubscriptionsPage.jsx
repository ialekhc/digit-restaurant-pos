import { useEffect, useMemo, useState } from 'react';
import { planService, vendorService } from '../api/services';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import {
  SuperAdminSection,
  SuperAdminStatCard
} from '../components/super-admin/SuperAdminUI';
import { currency, formatDate, formatDateTime } from '../utils/format';

const defaultPaymentForm = {
  amount: '',
  paymentMethod: 'ONLINE',
  paymentDate: '',
  reference: '',
  note: ''
};

const defaultSubscriptionForm = {
  planId: 'STARTER',
  billingCycle: 'monthly',
  amount: '',
  status: 'ACTIVE',
  startsOn: '',
  endsOn: '',
  nextBillingDate: '',
  addons: []
};

const SuperAdminSubscriptionsPage = () => {
  const [vendors, setVendors] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [subscriptionForm, setSubscriptionForm] = useState(defaultSubscriptionForm);
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm);
  const [editingPaymentId, setEditingPaymentId] = useState('');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [error, setError] = useState('');

  const load = async () => {
    const [vendorData, catalogData] = await Promise.all([vendorService.list(), planService.catalog()]);
    setVendors(vendorData);
    setCatalog(catalogData);
  };

  useEffect(() => {
    load();
  }, []);

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor._id === selectedVendorId) || null,
    [vendors, selectedVendorId]
  );

  const filteredVendors = useMemo(() => {
    if (vendorFilter === 'ALL') return vendors;
    return vendors.filter((vendor) => vendor._id === vendorFilter);
  }, [vendorFilter, vendors]);

  const stats = useMemo(() => {
    const statusCount = vendors.reduce(
      (acc, vendor) => {
        const key = vendor.subscription?.status || 'UNKNOWN';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {}
    );

    return {
      total: vendors.length,
      active: statusCount.ACTIVE || 0,
      trialing: statusCount.TRIALING || 0,
      pastDue: statusCount.PAST_DUE || 0,
      expired: statusCount.EXPIRED || 0
    };
  }, [vendors]);

  useEffect(() => {
    if (!selectedVendor) return;
    setSubscriptionForm({
      planId: selectedVendor.subscription?.planId || 'STARTER',
      billingCycle: selectedVendor.subscription?.billingCycle || 'monthly',
      amount: String(selectedVendor.subscription?.amount ?? ''),
      status: selectedVendor.subscription?.status || 'ACTIVE',
      startsOn: selectedVendor.subscription?.startsOn
        ? new Date(selectedVendor.subscription.startsOn).toISOString().slice(0, 10)
        : '',
      endsOn: selectedVendor.subscription?.endsOn
        ? new Date(selectedVendor.subscription.endsOn).toISOString().slice(0, 10)
        : '',
      nextBillingDate: selectedVendor.subscription?.nextBillingDate
        ? new Date(selectedVendor.subscription.nextBillingDate).toISOString().slice(0, 10)
        : '',
      addons: selectedVendor.subscription?.addons || []
    });
    setPaymentForm(defaultPaymentForm);
    setEditingPaymentId('');
  }, [selectedVendor]);

  const toggleAddon = (addonName) => {
    setSubscriptionForm((prev) => ({
      ...prev,
      addons: prev.addons.includes(addonName)
        ? prev.addons.filter((name) => name !== addonName)
        : [...prev.addons, addonName]
    }));
  };

  const saveSubscription = async () => {
    if (!selectedVendorId) return;
    setError('');

    try {
      await vendorService.updateSubscription(selectedVendorId, {
        ...subscriptionForm,
        amount: subscriptionForm.amount === '' ? undefined : Number(subscriptionForm.amount),
        startsOn: subscriptionForm.startsOn || undefined,
        endsOn: subscriptionForm.endsOn || undefined,
        nextBillingDate: subscriptionForm.nextBillingDate || undefined
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update subscription');
    }
  };

  const savePayment = async () => {
    if (!selectedVendorId) return;
    setError('');

    const payload = {
      amount: Number(paymentForm.amount),
      paymentMethod: paymentForm.paymentMethod,
      paymentDate: paymentForm.paymentDate || undefined,
      reference: paymentForm.reference,
      note: paymentForm.note
    };

    try {
      if (editingPaymentId) {
        await vendorService.updateSubscriptionPayment(selectedVendorId, editingPaymentId, payload);
      } else {
        await vendorService.addSubscriptionPayment(selectedVendorId, payload);
      }
      setPaymentForm(defaultPaymentForm);
      setEditingPaymentId('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save payment record');
    }
  };

  const onEditPayment = (payment) => {
    setEditingPaymentId(payment._id);
    setPaymentForm({
      amount: String(payment.amount || ''),
      paymentMethod: payment.paymentMethod || 'ONLINE',
      paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().slice(0, 10) : '',
      reference: payment.reference || '',
      note: payment.note || ''
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SuperAdminStatCard label="Total" value={stats.total} />
        <SuperAdminStatCard label="Active" value={stats.active} />
        <SuperAdminStatCard label="Trialing" value={stats.trialing} />
        <SuperAdminStatCard label="Past Due" value={stats.pastDue} />
        <SuperAdminStatCard label="Expired" value={stats.expired} />
      </div>

      <SuperAdminSection
        title="Assign Subscription"
        subtitle="Issue or change a vendor subscription with full billing controls"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Select
            label="Vendor"
            value={selectedVendorId}
            options={[{ label: 'Select vendor', value: '' }].concat(
              vendors.map((vendor) => ({
                label: `${vendor.vendorName} (${vendor.subscription?.planId || '-'})`,
                value: vendor._id
              }))
            )}
            onChange={(e) => setSelectedVendorId(e.target.value)}
          />
          <Select
            label="Plan"
            value={subscriptionForm.planId}
            options={(catalog?.plans || []).map((plan) => ({ label: `${plan.name} (${plan.id})`, value: plan.id }))}
            onChange={(e) => setSubscriptionForm((p) => ({ ...p, planId: e.target.value }))}
            disabled={!selectedVendor}
          />
          <Select
            label="Billing Cycle"
            value={subscriptionForm.billingCycle}
            options={[
              { label: 'Monthly', value: 'monthly' },
              { label: 'Semi-Annual', value: 'semiAnnual' },
              { label: 'Annual', value: 'annual' }
            ]}
            onChange={(e) => setSubscriptionForm((p) => ({ ...p, billingCycle: e.target.value }))}
            disabled={!selectedVendor}
          />
          <Input
            label="Amount (NPR)"
            type="number"
            step="0.01"
            value={subscriptionForm.amount}
            onChange={(e) => setSubscriptionForm((p) => ({ ...p, amount: e.target.value }))}
            disabled={!selectedVendor}
          />
          <Input
            label="Start Date"
            type="date"
            value={subscriptionForm.startsOn}
            onChange={(e) => setSubscriptionForm((p) => ({ ...p, startsOn: e.target.value }))}
            disabled={!selectedVendor}
          />
          <Input
            label="End Date"
            type="date"
            value={subscriptionForm.endsOn}
            onChange={(e) => setSubscriptionForm((p) => ({ ...p, endsOn: e.target.value }))}
            disabled={!selectedVendor}
          />
          <Input
            label="Next Billing"
            type="date"
            value={subscriptionForm.nextBillingDate}
            onChange={(e) => setSubscriptionForm((p) => ({ ...p, nextBillingDate: e.target.value }))}
            disabled={!selectedVendor}
          />
          <Select
            label="Status"
            value={subscriptionForm.status}
            options={[
              { label: 'ACTIVE', value: 'ACTIVE' },
              { label: 'PAUSED', value: 'PAUSED' },
              { label: 'EXPIRED', value: 'EXPIRED' },
              { label: 'CANCELLED', value: 'CANCELLED' }
            ]}
            onChange={(e) => setSubscriptionForm((p) => ({ ...p, status: e.target.value }))}
            disabled={!selectedVendor}
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={saveSubscription}
              disabled={!selectedVendor}
              className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Assign Subscription
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Addons</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(catalog?.addons || []).map((addon) => {
              const checked = subscriptionForm.addons.includes(addon.name);
              return (
                <button
                  key={addon.name}
                  type="button"
                  onClick={() => toggleAddon(addon.name)}
                  disabled={!selectedVendor}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    checked ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="font-semibold text-slate-800">{addon.name}</p>
                  <p className="text-xs text-slate-500">{currency(addon.monthlyPrice)}/mo</p>
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
      </SuperAdminSection>

      <SuperAdminSection
        title="Subscription Registry"
        subtitle="Platform-wide subscription lifecycle and visibility"
      >
        <div className="mb-4 max-w-sm">
          <Select
            label="Vendor Filter"
            value={vendorFilter}
            options={[
              { label: 'All vendors', value: 'ALL' },
              ...vendors.map((vendor) => ({ label: vendor.vendorName, value: vendor._id }))
            ]}
            onChange={(e) => setVendorFilter(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="superadmin-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Start</th>
                <th>End</th>
                <th>Next Billing</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((vendor) => (
                <tr key={vendor._id}>
                  <td className="font-semibold">{vendor.vendorName}</td>
                  <td>{vendor.subscription?.planId || '-'}</td>
                  <td><StatusBadge value={vendor.subscription?.status || '-'} /></td>
                  <td>{formatDate(vendor.subscription?.startsOn)}</td>
                  <td>{formatDate(vendor.subscription?.endsOn)}</td>
                  <td>{formatDate(vendor.subscription?.nextBillingDate)}</td>
                  <td>{currency(vendor.subscription?.amount || 0)}</td>
                  <td>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => setSelectedVendorId(vendor._id)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredVendors.length ? <p className="p-4 text-sm text-slate-500">No subscriptions found.</p> : null}
        </div>
      </SuperAdminSection>

      {selectedVendor ? (
        <SuperAdminSection
          title={`Subscription Payments: ${selectedVendor.vendorName}`}
          subtitle="Track credit collection and payment adjustments"
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))}
            />
            <Select
              label="Method"
              value={paymentForm.paymentMethod}
              options={[
                { label: 'ONLINE', value: 'ONLINE' },
                { label: 'BANK_TRANSFER', value: 'BANK_TRANSFER' },
                { label: 'CASH', value: 'CASH' },
                { label: 'CARD', value: 'CARD' },
                { label: 'QR', value: 'QR' }
              ]}
              onChange={(e) => setPaymentForm((p) => ({ ...p, paymentMethod: e.target.value }))}
            />
            <Input
              label="Payment Date"
              type="date"
              value={paymentForm.paymentDate}
              onChange={(e) => setPaymentForm((p) => ({ ...p, paymentDate: e.target.value }))}
            />
            <Input
              label="Reference"
              value={paymentForm.reference}
              onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
            />
            <Input
              label="Note"
              value={paymentForm.note}
              onChange={(e) => setPaymentForm((p) => ({ ...p, note: e.target.value }))}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={savePayment}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600"
            >
              {editingPaymentId ? 'Update Payment' : 'Add Payment'}
            </button>
            {editingPaymentId ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingPaymentId('');
                  setPaymentForm(defaultPaymentForm);
                }}
              >
                Cancel Edit
              </Button>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="superadmin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Note</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(selectedVendor.paymentHistory || []).map((payment) => (
                  <tr key={payment._id}>
                    <td>{formatDateTime(payment.paymentDate)}</td>
                    <td>{currency(payment.amount || 0)}</td>
                    <td>{payment.paymentMethod}</td>
                    <td>{payment.reference || '-'}</td>
                    <td>{payment.note || '-'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => onEditPayment(payment)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          onClick={async () => {
                            if (!window.confirm('Delete this payment record?')) return;
                            await vendorService.removeSubscriptionPayment(selectedVendorId, payment._id);
                            await load();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!selectedVendor.paymentHistory?.length ? (
              <p className="p-4 text-sm text-slate-500">No payment records yet.</p>
            ) : null}
          </div>
        </SuperAdminSection>
      ) : null}
    </div>
  );
};

export default SuperAdminSubscriptionsPage;
