import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { userService, vendorService } from '../api/services';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Loader from '../components/Loader';
import { SuperAdminSection, SuperAdminStatCard } from '../components/super-admin/SuperAdminUI';
import { formatDateTime } from '../utils/format';

const roleOptions = [
  'SUPER_ADMIN',
  'RESTAURANT_OWNER',
  'MANAGER',
  'CASHIER',
  'WAITER',
  'CHEF',
  'INVENTORY_MANAGER',
  'ACCOUNTANT',
  'DELIVERY_PARTNER',
  'CUSTOMER_SUPPORT',
  'ADMIN',
  'KITCHEN',
  'CUSTOMER'
].map((role) => ({ label: role, value: role }));

const schema = z.object({
  firstName: z.string().min(2, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  role: z.string().min(1, 'Role is required'),
  isActive: z.enum(['true', 'false']),
  vendorScope: z.string().optional()
});

const defaultValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'RESTAURANT_OWNER',
  isActive: 'true',
  vendorScope: 'ALL'
};

const SuperAdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(schema), defaultValues });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (roleFilter !== 'ALL') params.role = roleFilter;
      const [usersData, vendorData] = await Promise.all([userService.list(params), vendorService.list()]);
      setUsers(usersData);
      setVendors(vendorData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((user) => user.isActive).length;
    const inactiveUsers = totalUsers - activeUsers;
    const superAdmins = users.filter((user) => user.role === 'SUPER_ADMIN').length;

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      superAdmins
    };
  }, [users]);

  const onSubmit = async (values) => {
    setError('');
    try {
      const fullName = `${values.firstName} ${values.lastName || ''}`.trim();
      const payload = {
        name: fullName,
        email: values.email,
        role: values.role,
        isActive: values.isActive === 'true'
      };

      if (values.password) payload.password = values.password;

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
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save user');
    }
  };

  const startEdit = (item) => {
    setEditing(item);
    const names = String(item.name || '').split(' ');
    const firstName = names.shift() || '';
    const lastName = names.join(' ');

    reset({
      firstName,
      lastName,
      email: item.email,
      password: '',
      role: item.role,
      isActive: String(item.isActive),
      vendorScope: 'ALL'
    });
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await userService.remove(id);
    await fetchUsers();
  };

  if (loading) return <Loader text="Loading users..." />;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SuperAdminStatCard label="Total Users" value={stats.totalUsers} />
        <SuperAdminStatCard label="Active Users" value={stats.activeUsers} />
        <SuperAdminStatCard label="Inactive Users" value={stats.inactiveUsers} />
        <SuperAdminStatCard label="Super Admins" value={stats.superAdmins} />
      </div>

      <SuperAdminSection
        title="User Provisioning"
        subtitle="Create platform users or vendor staff with role-based access"
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="max-w-lg">
            <Select
              label="Vendor Scope"
              options={[
                { label: 'All vendors (global view)', value: 'ALL' },
                ...vendors.map((vendor) => ({ label: vendor.vendorName, value: vendor._id }))
              ]}
              {...register('vendorScope')}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input label="First Name" {...register('firstName')} error={errors.firstName?.message} />
            <Input label="Last Name" {...register('lastName')} error={errors.lastName?.message} />
            <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
            <Input
              label={editing ? 'Reset Password (optional)' : 'Password'}
              type="password"
              {...register('password')}
              error={errors.password?.message}
            />
            <Select label="Role" options={roleOptions} {...register('role')} error={errors.role?.message} />
            <Select
              label="Status"
              options={[
                { label: 'Active', value: 'true' },
                { label: 'Inactive', value: 'false' }
              ]}
              {...register('isActive')}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[220px] rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editing ? 'Update User' : 'Create User'}
            </button>
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

        {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p> : null}
      </SuperAdminSection>

      <SuperAdminSection
        title="Users"
        subtitle="Activate/deactivate accounts and run operational resets quickly"
      >
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Search Users"
            placeholder="Name, email, role"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Role Filter"
            value={roleFilter}
            options={[{ label: 'All roles', value: 'ALL' }, ...roleOptions]}
            onChange={(e) => setRoleFilter(e.target.value)}
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={fetchUsers}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Search
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="superadmin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item._id}>
                  <td className="font-semibold">{item.name}</td>
                  <td>{item.email}</td>
                  <td>{item.role}</td>
                  <td>{item.isActive ? 'Active' : 'Inactive'}</td>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        onClick={() => onDelete(item._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length ? <p className="p-4 text-sm text-slate-500">No users found for the current filters.</p> : null}
        </div>
      </SuperAdminSection>
    </div>
  );
};

export default SuperAdminUsersPage;
