import { Fragment, useEffect, useMemo, useState } from 'react';
import { planService, vendorService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { currency, formatDate } from '../utils/format';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const defaultForm = {
  vendorName: '',
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
  const [error, setError] = useState('');
  const [expandedVendorId, setExpandedVendorId] = useState('');

  const load = async () => {
    const [vendorData, catalogData] = await Promise.all([vendorService.list(), planService.catalog()]);
    setVendors(vendorData);
    setCatalog(catalogData);
  };

  useEffect(() => {
    load();
  }, []);

  useAutoRefresh(load, { enabled: !editingId });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((vendor) => {
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
      return text.includes(q);
    });
  }, [vendors, search]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.vendorName.trim()) {
      setError('Vendor name is required');
      return;
    }

    const topPayload = {
      vendorName: form.vendorName,
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

    const loginEmail = form.loginEmail.trim().toLowerCase();
    const loginPassword = form.loginPassword;
    const wantsToConfigureLogin = Boolean(loginEmail || loginPassword);

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

      setEditingId('');
      setEditingVendorHasLogin(false);
      setForm(defaultForm);
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
      loginEmail: vendorLoginEmail,
      loginPassword: '',
      loginActive: String(vendor.loginUser?.isActive ?? vendor.loginEnabled ?? true)
    });
    setEditingVendorHasLogin(Boolean(vendor.loginUser || vendor.loginEmail));
    setError('');
  };

  const onDeleteVendor = async (vendor) => {
    if (!window.confirm(`Delete vendor ${vendor.vendorName}?`)) return;
    setError('');
    try {
      await vendorService.remove(vendor._id);
      await load();
      if (editingId === vendor._id) {
        setEditingId('');
        setEditingVendorHasLogin(false);
        setForm(defaultForm);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete vendor');
    }
  };

  return (
    <div className="space-y-5">
      <Panel title={editingId ? 'Edit Vendor' : 'Create Vendor'} subtitle="Manage vendor profile and subscription setup">
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={onSubmit}>
          <Input label="Vendor Name" value={form.vendorName} onChange={(e) => setForm((p) => ({ ...p, vendorName: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <Input label="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          <Select
            label="Active"
            value={form.isActive}
            options={[
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' }
            ]}
            onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value }))}
          />

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

          <Input
            label="Vendor Login Email"
            type="email"
            value={form.loginEmail}
            onChange={(e) => setForm((p) => ({ ...p, loginEmail: e.target.value }))}
          />
          <Input
            label={editingVendorHasLogin ? 'Reset Vendor Password (optional)' : 'Vendor Login Password'}
            type="password"
            value={form.loginPassword}
            onChange={(e) => setForm((p) => ({ ...p, loginPassword: e.target.value }))}
            placeholder={editingVendorHasLogin ? 'Leave blank to keep existing password' : 'Create initial password'}
          />
          <Select
            label="Vendor Login Status"
            value={form.loginActive}
            options={[
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' }
            ]}
            onChange={(e) => setForm((p) => ({ ...p, loginActive: e.target.value }))}
          />
          <p className="md:col-span-2 lg:col-span-3 text-xs text-slate-500">
            Leave vendor login fields empty if you do not want to create login access now.
          </p>

          <div className="lg:col-span-3">
            <Input label="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          </div>

          <div className="lg:col-span-3 flex flex-wrap gap-2">
            <Button type="submit">{editingId ? 'Update Vendor' : 'Create Vendor'}</Button>
            {editingId ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditingId('');
                  setEditingVendorHasLogin(false);
                  setForm(defaultForm);
                  setError('');
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </Panel>

      <Panel title="Vendors" subtitle="Track all vendors and their active subscription details">
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <Input label="Search Vendor" placeholder="Name, email, plan, status" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="table-ui">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Contact</th>
                <th>Plan</th>
                <th>Cycle</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Total Paid</th>
                <th>Next Billing</th>
                <th>Login Access</th>
                <th>Users</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vendor) => (
                <Fragment key={vendor._id}>
                  <tr>
                    <td className="font-semibold">{vendor.vendorName}</td>
                    <td>{vendor.contactPerson || '-'}</td>
                    <td>{vendor.subscription?.planId || '-'}</td>
                    <td>{vendor.subscription?.billingCycle || '-'}</td>
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setExpandedVendorId((current) => (current === vendor._id ? '' : vendor._id))}
                      >
                        {vendor.userCount || vendor.users?.length || 0} Users
                      </Button>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => onEdit(vendor)}>Edit</Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => onDeleteVendor(vendor)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expandedVendorId === vendor._id ? (
                    <tr>
                      <td colSpan={11} className="bg-orange-50/60">
                        <div className="rounded-xl border border-orange-100 bg-white p-3">
                          <p className="mb-2 text-sm font-semibold text-slate-800">Users in {vendor.vendorName}</p>
                          {vendor.users?.length ? (
                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                              {vendor.users.map((item) => (
                                <div key={item._id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                                  <p className="font-semibold text-slate-800">{item.name}</p>
                                  <p className="text-slate-500">{item.email}</p>
                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <span className="font-medium text-slate-700">{item.role}</span>
                                    <StatusBadge value={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500">No users created for this vendor yet.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {!filtered.length ? <p className="p-4 text-sm text-slate-500">No vendors found</p> : null}
        </div>

        <div className="space-y-3 md:hidden">
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
                <p>Plan: {vendor.subscription?.planId || '-'}</p>
                <p>Cycle: {vendor.subscription?.billingCycle || '-'}</p>
                <p>Amount: {currency(vendor.subscription?.amount || 0)}</p>
                <p>Total Paid: {currency(vendor.totalPaid || 0)}</p>
                <p>Next Billing: {formatDate(vendor.subscription?.nextBillingDate)}</p>
                <p>Users: {vendor.userCount || vendor.users?.length || 0}</p>
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setExpandedVendorId((current) => (current === vendor._id ? '' : vendor._id))}
                >
                  {expandedVendorId === vendor._id ? 'Hide Users' : 'View Users'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onEdit(vendor)}>Edit</Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => onDeleteVendor(vendor)}
                >
                  Delete
                </Button>
              </div>
              {expandedVendorId === vendor._id ? (
                <div className="mt-3 space-y-2 rounded-xl border border-orange-100 bg-orange-50/70 p-3">
                  {vendor.users?.length ? (
                    vendor.users.map((item) => (
                      <div key={item._id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-slate-500">{item.email}</p>
                        <p className="mt-1 text-slate-700">{item.role} | {item.isActive ? 'Active' : 'Inactive'}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No users created for this vendor yet.</p>
                  )}
                </div>
              ) : null}
            </article>
          ))}
          {!filtered.length ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No vendors found</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default SuperAdminVendorsPage;
