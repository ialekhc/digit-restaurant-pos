import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { userService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import Loader from '../components/Loader';
import { formatDateTime } from '../utils/format';

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6).optional().or(z.literal('')),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'CUSTOMER']),
  isActive: z.enum(['true', 'false'])
});

const defaultValues = {
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'WAITER',
  isActive: 'true'
};

const roleOptions = ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'CUSTOMER'].map((x) => ({
  label: x,
  value: x
}));

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
      const data = await userService.list({ search });
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const onSubmit = async (values) => {
    setError('');
    try {
      const payload = {
        ...values,
        isActive: values.isActive === 'true'
      };

      if (!payload.password) delete payload.password;

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
    reset({
      name: item.name,
      email: item.email,
      password: '',
      phone: item.phone || '',
      role: item.role,
      isActive: String(item.isActive)
    });
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    await userService.remove(id);
    fetchUsers();
  };

  if (loading) return <Loader text="Loading users..." />;

  return (
    <div className="space-y-5">
      <Panel title={editing ? 'Edit User' : 'Create User'} subtitle="Manage staff accounts and roles">
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Name" {...register('name')} error={errors.name?.message} />
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <Input label={editing ? 'New Password (optional)' : 'Password'} type="password" {...register('password')} error={errors.password?.message} />
          <Input label="Phone" {...register('phone')} error={errors.phone?.message} />
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
        title="User List"
        right={
          <div className="flex gap-2">
            <Input placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="button" onClick={fetchUsers}>Search</Button>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 py-2">{item.email}</td>
                  <td className="px-3 py-2">{item.role}</td>
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
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

export default UsersPage;
