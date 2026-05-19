import { useEffect, useMemo, useState } from 'react';
import { planService, vendorService } from '../api/services';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { currency, formatDate, formatDateTime } from '../utils/format';

const defaultPaymentForm = {
  amount: '',
  paymentMethod: 'ONLINE',
  paymentDate: '',
  reference: '',
  note: ''
};

const SuperAdminSubscriptionsPage = () => {
  const [vendors, setVendors] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [subscriptionForm, setSubscriptionForm] = useState({
    planId: 'STARTER',
    billingCycle: 'monthly',
    amount: '',
    status: 'ACTIVE',
    startsOn: '',
    endsOn: '',
    nextBillingDate: '',
    addons: []
  });
  const [paymentForm, setPaymentForm] = useState(defaultPaymentForm);
  const [editingPaymentId, setEditingPaymentId] = useState('');
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
      <Panel title="Vendor Subscriptions" subtitle="Manage plan lifecycle and track subscription payment collection">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Select Vendor"
            value={selectedVendorId}
            options={[{ label: 'Select vendor', value: '' }].concat(
              vendors.map((vendor) => ({
                label: `${vendor.vendorName} | ${vendor.subscription?.planId || '-'} | ${vendor.subscription?.status || '-'}`,
                value: vendor._id
              }))
            )}
            onChange={(e) => setSelectedVendorId(e.target.value)}
          />
          <Input label="Current Plan" value={selectedVendor?.subscription?.planId || '-'} disabled />
          <Input label="Subscription Amount" value={currency(selectedVendor?.subscription?.amount || 0)} disabled />
          <Input label="Total Paid" value={currency(selectedVendor?.totalPaid || 0)} disabled />
        </div>
      </Panel>

      {selectedVendor ? (
        <>
          <Panel title={`Edit Subscription: ${selectedVendor.vendorName}`}>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Select
                label="Plan"
                value={subscriptionForm.planId}
                options={(catalog?.plans || []).map((plan) => ({ label: `${plan.name} (${plan.id})`, value: plan.id }))}
                onChange={(e) => setSubscriptionForm((p) => ({ ...p, planId: e.target.value }))}
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
              />
              <Input
                label="Amount (NPR)"
                type="number"
                step="0.01"
                value={subscriptionForm.amount}
                onChange={(e) => setSubscriptionForm((p) => ({ ...p, amount: e.target.value }))}
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
              />
              <Input
                label="Starts On"
                type="date"
                value={subscriptionForm.startsOn}
                onChange={(e) => setSubscriptionForm((p) => ({ ...p, startsOn: e.target.value }))}
              />
              <Input
                label="Ends On"
                type="date"
                value={subscriptionForm.endsOn}
                onChange={(e) => setSubscriptionForm((p) => ({ ...p, endsOn: e.target.value }))}
              />
              <Input
                label="Next Billing Date"
                type="date"
                value={subscriptionForm.nextBillingDate}
                onChange={(e) => setSubscriptionForm((p) => ({ ...p, nextBillingDate: e.target.value }))}
              />
            </div>

            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Addons</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(catalog?.addons || []).map((addon) => {
                  const checked = subscriptionForm.addons.includes(addon.name);
                  return (
                    <button
                      key={addon.name}
                      type="button"
                      onClick={() => toggleAddon(addon.name)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        checked ? 'border-brand-400 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <p className="font-semibold text-slate-800">{addon.name}</p>
                      <p className="text-xs text-slate-500">{currency(addon.monthlyPrice)}/mo</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={saveSubscription}>Update Subscription</Button>
            </div>
          </Panel>

          <Panel title="Subscription Payment Records" subtitle="Create, update, and delete vendor subscription collections">
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
              <Button onClick={savePayment}>{editingPaymentId ? 'Update Payment' : 'Add Payment'}</Button>
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

            {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="table-ui">
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
                          <Button variant="secondary" size="sm" onClick={() => onEditPayment(payment)}>Edit</Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={async () => {
                              if (!window.confirm('Delete this payment record?')) return;
                              await vendorService.removeSubscriptionPayment(selectedVendorId, payment._id);
                              await load();
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!selectedVendor.paymentHistory?.length ? (
                <p className="p-4 text-sm text-slate-500">No payment records yet</p>
              ) : null}
            </div>

            <div className="space-y-3 md:hidden">
              {(selectedVendor.paymentHistory || []).map((payment) => (
                <article key={payment._id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{currency(payment.amount || 0)}</p>
                    <StatusBadge value={payment.paymentMethod} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(payment.paymentDate)}</p>
                  <p className="text-sm text-slate-700">Ref: {payment.reference || '-'}</p>
                  <p className="text-sm text-slate-700">Note: {payment.note || '-'}</p>
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => onEditPayment(payment)}>Edit</Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        if (!window.confirm('Delete this payment record?')) return;
                        await vendorService.removeSubscriptionPayment(selectedVendorId, payment._id);
                        await load();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
              {!selectedVendor.paymentHistory?.length ? (
                <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No payment records yet</p>
              ) : null}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
};

export default SuperAdminSubscriptionsPage;
