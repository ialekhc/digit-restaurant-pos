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
import { currency, formatDate } from '../utils/format';

const defaultForm = {
  vendorName: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  isActive: 'true',
  planId: 'STARTER',
  billingCycle: 'monthly',
  amount: '',
  status: 'ACTIVE',
  startsOn: '',
  endsOn: '',
  nextBillingDate: '',
  loginName: '',
  loginEmail: '',
  loginPassword: '',
  loginActive: 'true'
};

const SuperAdminVendorsPage = () => {
  const [vendors, setVendors] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState('');
  const [editingVendorHasLogin, setEditingVendorHasLogin] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [error, setError] = useState('');

  const load = async () => {
    const [vendorData, catalogData] = await Promise.all([vendorService.list(), planService.catalog()]);
    setVendors(vendorData);
    setCatalog(catalogData);
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const totalVendors = vendors.length;
    const activeVendors = vendors.filter((vendor) => vendor.isActive).length;
    const inactiveVendors = Math.max(0, totalVendors - activeVendors);
    const activeSubscriptions = vendors.filter((vendor) => vendor.subscription?.status === 'ACTIVE').length;

    return {
      totalVendors,
      activeVendors,
      inactiveVendors,
      activeSubscriptions
    };
  }, [vendors]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return vendors.filter((vendor) => {
      if (statusFilter !== 'ALL' && vendor.subscription?.status !== statusFilter) return false;
      if (planFilter !== 'ALL' && vendor.subscription?.planId !== planFilter) return false;

      if (!query) return true;
      const text = [
        vendor.vendorName,
        vendor.contactPerson,
        vendor.email,
        vendor.phone,
        vendor.loginUser?.email,
        vendor.loginEmail,
        vendor.subscription?.planId,
        vendor.subscription?.status
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(query);
    });
  }, [vendors, search, statusFilter, planFilter]);

  const toggleAddon = (addonName) => {
    setForm((prev) => ({
      ...prev,
      addons: prev.addons.includes(addonName)
        ? prev.addons.filter((name) => name !== addonName)
        : [...prev.addons, addonName]
    }));
  };

  const resetEditor = () => {
    setEditingId('');
    setEditingVendorHasLogin(false);
    setForm(defaultForm);
    setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.vendorName.trim()) {
      setError('Vendor name is required');
      return;
    }

    const topPayload = {
      vendorName: form.vendorName,
      contactPerson: form.contactPerson,
      email: form.email,
      phone: form.phone,
      address: form.address,
      notes: form.notes,
      isActive: form.isActive === 'true'
    };

    const subscriptionPayload = {
      planId: form.planId,
      billingCycle: form.billingCycle,
      status: form.status,
      startsOn: form.startsOn || undefined,
      endsOn: form.endsOn || undefined,
      nextBillingDate: form.nextBillingDate || undefined,
      amount: form.amount === '' ? undefined : Number(form.amount)
    };

    const loginName = form.loginName.trim();
    const loginEmail = form.loginEmail.trim().toLowerCase();
    const loginPassword = form.loginPassword;
    const wantsToConfigureLogin = Boolean(loginName || loginEmail || loginPassword);

    if (!editingId && wantsToConfigureLogin && (!loginEmail || !loginPassword)) {
      setError('Vendor login email and password are required when creating vendor access');
      return;
    }

    if (editingId && !editingVendorHasLogin && (loginEmail || loginPassword) && (!loginEmail || !loginPassword)) {
      setError('Provide both vendor login email and password to create login access');
      return;
    }

    const shouldSendLoginAccess = editingVendorHasLogin || wantsToConfigureLogin;
    if (shouldSendLoginAccess) {
      topPayload.loginAccess = {
        ...(loginName ? { name: loginName } : {}),
        ...(loginEmail ? { email: loginEmail } : {}),
        ...(loginPassword ? { password: loginPassword } : {}),
        isActive: form.loginActive === 'true'
      };
    }

    try {
      if (editingId) {
        await vendorService.update(editingId, topPayload);
        await vendorService.updateSubscription(editingId, subscriptionPayload);
      } else {
        await vendorService.create({
          ...topPayload,
          subscription: subscriptionPayload
        });
      }

      resetEditor();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save vendor');
    }
  };

  const onEdit = (vendor) => {
    setEditingId(vendor._id);
    const vendorLoginEmail = vendor.loginUser?.email || vendor.loginEmail || '';

    setForm({
      vendorName: vendor.vendorName || '',
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      notes: vendor.notes || '',
      isActive: String(vendor.isActive),
      planId: vendor.subscription?.planId || 'STARTER',
      billingCycle: vendor.subscription?.billingCycle || 'monthly',
      amount: String(vendor.subscription?.amount ?? ''),
      status: vendor.subscription?.status || 'ACTIVE',
      startsOn: vendor.subscription?.startsOn ? new Date(vendor.subscription.startsOn).toISOString().slice(0, 10) : '',
      endsOn: vendor.subscription?.endsOn ? new Date(vendor.subscription.endsOn).toISOString().slice(0, 10) : '',
      nextBillingDate: vendor.subscription?.nextBillingDate
        ? new Date(vendor.subscription.nextBillingDate).toISOString().slice(0, 10)
        : '',
      loginName: vendor.loginUser?.name || '',
      loginEmail: vendorLoginEmail,
      loginPassword: '',
      loginActive: String(vendor.loginUser?.isActive ?? vendor.loginEnabled ?? true)
    });

    setEditingVendorHasLogin(Boolean(vendor.loginUser || vendor.loginEmail));
    setError('');
  };

  const removeVendor = async (vendor) => {
    if (!window.confirm(`Delete vendor ${vendor.vendorName}?`)) return;
    await vendorService.remove(vendor._id);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SuperAdminStatCard label="Total Vendors" value={summary.totalVendors} />
        <SuperAdminStatCard label="Active Vendors" value={summary.activeVendors} />
        <SuperAdminStatCard label="Inactive Vendors" value={summary.inactiveVendors} />
        <SuperAdminStatCard label="Active Subscriptions" value={summary.activeSubscriptions} />
      </div>

      <SuperAdminSection
        title="Vendor Provisioning"
        subtitle="Create or update vendor profile, subscription plan, and login credentials"
      >
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor Identity</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Input label="Vendor Name" value={form.vendorName} onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))} />
              <Input label="Contact Person" value={form.contactPerson} onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              <Input label="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              <Select
                label="Vendor Status"
                value={form.isActive}
                options={[
                  { label: 'Active', value: 'true' },
                  { label: 'Inactive', value: 'false' }
                ]}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Subscription Setup</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Select
                label="Plan"
                value={form.planId}
                options={(catalog?.plans || []).map((plan) => ({ label: `${plan.name} (${plan.id})`, value: plan.id }))}
                onChange={(e) => setForm((p) => ({ ...p, planId: e.target.value }))}
              />
              <Select
                label="Billing Cycle"
                value={form.billingCycle}
                options={[
                  { label: 'Monthly', value: 'monthly' },
                  { label: 'Semi-Annual', value: 'semiAnnual' },
                  { label: 'Annual', value: 'annual' }
                ]}
                onChange={(e) => setForm((p) => ({ ...p, billingCycle: e.target.value }))}
              />
              <Input
                label="Subscription Amount (NPR)"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
              <Select
                label="Subscription Status"
                value={form.status}
                options={[
                  { label: 'ACTIVE', value: 'ACTIVE' },
                  { label: 'PAUSED', value: 'PAUSED' },
                  { label: 'EXPIRED', value: 'EXPIRED' },
                  { label: 'CANCELLED', value: 'CANCELLED' }
                ]}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              />
              <Input label="Starts On" type="date" value={form.startsOn} onChange={(e) => setForm((p) => ({ ...p, startsOn: e.target.value }))} />
              <Input label="Ends On" type="date" value={form.endsOn} onChange={(e) => setForm((p) => ({ ...p, endsOn: e.target.value }))} />
              <Input
                label="Next Billing Date"
                type="date"
                value={form.nextBillingDate}
                onChange={(e) => setForm((p) => ({ ...p, nextBillingDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Vendor Login Access</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Input label="Login Name" value={form.loginName} onChange={(e) => setForm((p) => ({ ...p, loginName: e.target.value }))} />
              <Input
                label="Login Email"
                type="email"
                value={form.loginEmail}
                onChange={(e) => setForm((p) => ({ ...p, loginEmail: e.target.value }))}
              />
              <Input
                label={editingVendorHasLogin ? 'Reset Password (optional)' : 'Login Password'}
                type="password"
                value={form.loginPassword}
                onChange={(e) => setForm((p) => ({ ...p, loginPassword: e.target.value }))}
                placeholder={editingVendorHasLogin ? 'Leave blank to keep current password' : 'Create initial password'}
              />
              <Select
                label="Login Status"
                value={form.loginActive}
                options={[
                  { label: 'Active', value: 'true' },
                  { label: 'Inactive', value: 'false' }
                ]}
                onChange={(e) => setForm((p) => ({ ...p, loginActive: e.target.value }))}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Leave login fields empty if you want to create vendor profile without access credentials.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Addons</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(catalog?.addons || []).map((addon) => {
                const checked = form.addons.includes(addon.name);
                return (
                  <button
                    key={addon.name}
                    type="button"
                    onClick={() => toggleAddon(addon.name)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
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

          <Input label="Internal Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-w-[180px]">{editingId ? 'Update Vendor' : 'Create Vendor'}</Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetEditor}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
        </form>

        {error ? <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
      </SuperAdminSection>

      <SuperAdminSection title="Vendor Operations" subtitle="Monitor all vendor accounts, subscriptions, and access state">
        <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Search Vendor"
            placeholder="Name, email, plan, status"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Subscription Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { label: 'All', value: 'ALL' },
              { label: 'ACTIVE', value: 'ACTIVE' },
              { label: 'PAUSED', value: 'PAUSED' },
              { label: 'EXPIRED', value: 'EXPIRED' },
              { label: 'CANCELLED', value: 'CANCELLED' }
            ]}
          />
          <Select
            label="Plan"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            options={[
              { label: 'All Plans', value: 'ALL' },
              ...((catalog?.plans || []).map((plan) => ({ label: plan.name, value: plan.id })))
            ]}
          />
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Results</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{filtered.length} / {vendors.length} vendors</p>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="superadmin-table">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Contact</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Total Paid</th>
                <th>Next Billing</th>
                <th>Login Access</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vendor) => (
                <tr key={vendor._id}>
                  <td className="font-semibold">{vendor.vendorName}</td>
                  <td>{vendor.contactPerson || '-'}</td>
                  <td>
                    <p className="font-medium text-slate-700">{vendor.subscription?.planId || '-'}</p>
                    <p className="text-xs text-slate-500">{vendor.subscription?.billingCycle || '-'}</p>
                  </td>
                  <td>{currency(vendor.subscription?.amount || 0)}</td>
                  <td><StatusBadge value={vendor.subscription?.status || '-'} /></td>
                  <td>{currency(vendor.totalPaid || 0)}</td>
                  <td>{formatDate(vendor.subscription?.nextBillingDate)}</td>
                  <td>
                    {vendor.loginUser || vendor.loginEmail ? (
                      <div className="text-xs">
                        <p className="font-medium text-slate-700">{vendor.loginUser?.email || vendor.loginEmail}</p>
                        <p className={vendor.loginUser?.isActive || vendor.loginEnabled ? 'text-emerald-600' : 'text-rose-600'}>
                          {(vendor.loginUser?.isActive || vendor.loginEnabled) ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Not created</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => onEdit(vendor)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => removeVendor(vendor)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <p className="p-4 text-sm text-slate-500">No vendors found for current filters.</p> : null}
        </div>

        <div className="space-y-3 lg:hidden">
          {filtered.map((vendor) => (
            <article key={vendor._id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{vendor.vendorName}</p>
                  <p className="text-xs text-slate-500">{vendor.contactPerson || '-'} | {vendor.phone || '-'}</p>
                </div>
                <StatusBadge value={vendor.subscription?.status || '-'} />
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>Plan: {vendor.subscription?.planId || '-'} ({vendor.subscription?.billingCycle || '-'})</p>
                <p>Amount: {currency(vendor.subscription?.amount || 0)}</p>
                <p>Total Paid: {currency(vendor.totalPaid || 0)}</p>
                <p>Next Billing: {formatDate(vendor.subscription?.nextBillingDate)}</p>
                <p>
                  Login: {vendor.loginUser?.email || vendor.loginEmail || 'Not created'}
                  {vendor.loginUser || vendor.loginEmail ? (
                    <span className={(vendor.loginUser?.isActive || vendor.loginEnabled) ? 'text-emerald-600' : 'text-rose-600'}>
                      {' '}
                      ({(vendor.loginUser?.isActive || vendor.loginEnabled) ? 'Active' : 'Inactive'})
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => onEdit(vendor)}>Edit</Button>
                <Button variant="danger" size="sm" onClick={() => removeVendor(vendor)}>Delete</Button>
              </div>
            </article>
          ))}
          {!filtered.length ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No vendors found for current filters.</p> : null}
        </div>
      </SuperAdminSection>
    </div>
  );
};

export default SuperAdminVendorsPage;
