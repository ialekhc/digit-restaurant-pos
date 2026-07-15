import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { userService, vendorService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Loader from '../components/Loader';
import { formatDateTime } from '../utils/format';
import { useAuth } from '../hooks/useAuth';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal('')),
  phone: z.string().optional(),
  restaurantId: z.string().optional(),
  role: z.enum([
    'RESTAURANT_OWNER',
    'MANAGER',
    'CASHIER',
    'WAITER',
    'ADMIN',
    'KITCHEN',
    'BARISTA',
    'CUSTOMER'
  ]),
  isActive: z.enum(['true', 'false'])
});

const defaultValues = {
  name: '',
  email: '',
  password: '',
  phone: '',
  restaurantId: '',
  role: 'WAITER',
  isActive: 'true'
};

const allRoleOptions = [
  'RESTAURANT_OWNER',
  'MANAGER',
  'CASHIER',
  'WAITER',
  'ADMIN',
  'KITCHEN',
  'BARISTA',
  'CUSTOMER'
].map((x) => ({
  label: x,
  value: x
}));

const vendorAdminRoleOptions = [
  'ADMIN',
  'MANAGER',
  'CASHIER',
  'WAITER',
  'KITCHEN',
  'BARISTA',
  'CUSTOMER'
].map((x) => ({
  label: x,
  value: x
}));

const sortOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Email', value: 'email' },
  { label: 'Role', value: 'role' },
  { label: 'Vendor', value: 'vendor' },
  { label: 'Status', value: 'status' },
  { label: 'Created Date', value: 'createdAt' }
];

const getVendorLabel = (item) =>
  item.vendor?.vendorName || (item.restaurantId ? `Vendor ${String(item.restaurantId).slice(0, 6)}` : '-');

const normalizeSortValue = (item, key) => {
  if (key === 'vendor') return getVendorLabel(item).toLowerCase();
  if (key === 'status') return item.isActive ? 'active' : 'inactive';
  if (key === 'createdAt') return new Date(item.createdAt || 0).getTime();
  return String(item[key] || '').toLowerCase();
};

const UsersPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const isVendorOwner = user?.role === 'RESTAURANT_OWNER';
  const canChooseVendor = user?.role === 'SUPER_ADMIN';
  const roleOptions = isVendorOwner ? vendorAdminRoleOptions : allRoleOptions;
  const vendorName = users.find((item) => item.vendor?.vendorName)?.vendor?.vendorName || 'Your vendor';
  const activeUserCount = users.filter((item) => item.isActive).length;
  const vendorOptions = [
    { label: 'Select vendor', value: '' },
    ...vendors.map((vendor) => ({ label: vendor.vendorName, value: vendor._id }))
  ];
  const sortedUsers = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    return [...users].sort((a, b) => {
      const aValue = normalizeSortValue(a, sortBy);
      const bValue = normalizeSortValue(b, sortBy);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }

      return String(aValue).localeCompare(String(bValue), undefined, {
        numeric: true,
        sensitivity: 'base'
      }) * direction;
    });
  }, [users, sortBy, sortDirection]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  const fetchUsers = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [userData, vendorData] = await Promise.all([
        userService.list({ search }),
        canChooseVendor ? vendorService.list() : Promise.resolve([])
      ]);
      setUsers(userData);
      setVendors(vendorData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useAutoRefresh(() => fetchUsers(false));

  const onSubmit = async (values) => {
    setError('');
    try {
      const payload = {
        ...values,
        isActive: values.isActive === 'true'
      };

      if (!payload.password) delete payload.password;
      if (!canChooseVendor) delete payload.restaurantId;
      if (canChooseVendor && !payload.restaurantId) {
        setError('Please select which vendor this user belongs to');
        return;
      }

      if (editing) {
        await userService.update(editing._id, payload);
      } else {
        if (!payload.password) {
          setError('Password is required for new user');
          return;
        }
        await userService.create(payload);
      }

      reset(defaultValues);
      setEditing(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save user');
    }
  };

  const startEdit = (item) => {
    setEditing(item);
    const fallbackRole = roleOptions[0]?.value || 'WAITER';
    reset({
      name: item.name,
      email: item.email,
      password: '',
      phone: item.phone || '',
      restaurantId: item.restaurantId || item.vendor?._id || '',
      role: roleOptions.some((opt) => opt.value === item.role) ? item.role : fallbackRole,
      isActive: String(item.isActive)
    });
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await userService.remove(id);
    fetchUsers();
  };

  const toggleSort = (key) => {
    setSortBy((current) => {
      if (current === key) {
        setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
        return current;
      }

      setSortDirection(key === 'createdAt' ? 'desc' : 'asc');
      return key;
    });
  };

  const sortIndicator = (key) => {
    if (sortBy !== key) return 'Sort';
    return sortDirection === 'asc' ? 'Asc' : 'Desc';
  };

  const SortHeader = ({ label, sortKey }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-lg px-1 py-0.5 font-semibold text-slate-700 transition hover:bg-brand-50 hover:text-brand-700"
      onClick={() => toggleSort(sortKey)}
    >
      <span>{label}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-400">{sortIndicator(sortKey)}</span>
    </button>
  );

  if (loading) return <Loader text="Loading users..." />;

  return (
    <div className="space-y-5">
      {isVendorOwner ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Vendor</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{vendorName}</p>
            <p className="text-xs text-slate-500">Only users from this vendor are shown here.</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Total Users</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{users.length} / 20</p>
            <p className="text-xs text-slate-500">Vendor account limit includes owner and staff.</p>
          </div>
          <div className="app-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Active Users</p>
            <p className="mt-1 text-xl font-bold text-slate-800">{activeUserCount}</p>
            <p className="text-xs text-slate-500">Users currently enabled for login.</p>
          </div>
        </div>
      ) : null}

      <Panel
        title={editing ? 'Edit User' : isVendorOwner ? 'Create Vendor User' : 'Create User'}
        subtitle={isVendorOwner ? 'Create and manage staff accounts for your vendor only' : 'Manage staff accounts and roles'}
      >
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Name" {...register('name')} error={errors.name?.message} />
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <Input label={editing ? 'New Password (optional)' : 'Password'} type="password" {...register('password')} error={errors.password?.message} />
          <Input label="Phone" {...register('phone')} error={errors.phone?.message} />
          {canChooseVendor ? (
            <Select label="Vendor" options={vendorOptions} {...register('restaurantId')} error={errors.restaurantId?.message} />
          ) : null}
          <Select label="Role" options={roleOptions} {...register('role')} error={errors.role?.message} />
          <Select
            label="Status"
            options={[
              { label: 'Active', value: 'true' },
              { label: 'Inactive', value: 'false' }
            ]}
            {...register('isActive')}
          />

          <div className="md:col-span-2 lg:col-span-3 flex gap-2">
            <Button type="submit" disabled={isSubmitting}>{editing ? 'Update User' : 'Create User'}</Button>
            {editing ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  reset(defaultValues);
                }}
              >
                Cancel Edit
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </Panel>

      <Panel
        title={isVendorOwner ? 'My Vendor Users' : 'User List'}
        subtitle={isVendorOwner ? 'This list is scoped to your vendor account only' : 'View users and their vendor ownership'}
        right={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Input placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select
              label="Sort By"
              value={sortBy}
              options={sortOptions}
              onChange={(e) => setSortBy(e.target.value)}
              className="min-w-36"
            />
            <Select
              label="Order"
              value={sortDirection}
              options={[
                { label: 'Ascending', value: 'asc' },
                { label: 'Descending', value: 'desc' }
              ]}
              onChange={(e) => setSortDirection(e.target.value)}
              className="min-w-36"
            />
            <Button type="button" onClick={fetchUsers}>Search</Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2"><SortHeader label="Name" sortKey="name" /></th>
                <th className="px-3 py-2"><SortHeader label="Email" sortKey="email" /></th>
                <th className="px-3 py-2"><SortHeader label="Role" sortKey="role" /></th>
                <th className="px-3 py-2"><SortHeader label="Vendor" sortKey="vendor" /></th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2"><SortHeader label="Status" sortKey="status" /></th>
                <th className="px-3 py-2"><SortHeader label="Created" sortKey="createdAt" /></th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 py-2">{item.email}</td>
                  <td className="px-3 py-2">{item.role}</td>
                  <td className="px-3 py-2">{getVendorLabel(item)}</td>
                  <td className="px-3 py-2">{item.phone || '-'}</td>
                  <td className="px-3 py-2">{item.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2">{formatDateTime(item.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" onClick={() => startEdit(item)}>Edit</Button>
                      <Button type="button" variant="danger" onClick={() => onDelete(item._id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!sortedUsers.length ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-slate-500" colSpan={8}>
                    No users found for the current search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

export default UsersPage;
