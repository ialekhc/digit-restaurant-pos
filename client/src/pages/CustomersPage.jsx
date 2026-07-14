import { useEffect, useState } from 'react';
import { customerService } from '../api/services';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { currency, formatDateTime } from '../utils/format';

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  loyaltyPoints: 0
};

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState('');
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await customerService.list();
    setCustomers(data);
  };

  useEffect(() => {
    load();
  }, []);

  useAutoRefresh(load);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.phone) {
      setError('Name and phone are required');
      return;
    }

    try {
      const payload = {
        ...form,
        loyaltyPoints: Number(form.loyaltyPoints || 0)
      };

      if (editingId) {
        await customerService.update(editingId, payload);
      } else {
        await customerService.create(payload);
      }

      setEditingId('');
      setForm(defaultForm);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save customer');
    }
  };

  return (
    <div className="space-y-5">
      <Panel title={editingId ? 'Edit Customer' : 'Add Customer'}>
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={submit}>
          <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <Input label="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          <Input label="Loyalty Points" type="number" value={form.loyaltyPoints} onChange={(e) => setForm((p) => ({ ...p, loyaltyPoints: e.target.value }))} />

          <div className="lg:col-span-3 flex gap-2">
            <Button type="submit">{editingId ? 'Update Customer' : 'Add Customer'}</Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(''); setForm(defaultForm); }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </Panel>

      <Panel title="Customer List">
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2">Loyalty</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2">{item.phone}</td>
                  <td className="px-3 py-2">{item.email || '-'}</td>
                  <td className="px-3 py-2">{item.address || '-'}</td>
                  <td className="px-3 py-2">{item.loyaltyPoints}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingId(item._id);
                          setForm({
                            name: item.name,
                            phone: item.phone,
                            email: item.email || '',
                            address: item.address || '',
                            loyaltyPoints: item.loyaltyPoints || 0
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          const res = await customerService.orderHistory(item._id);
                          setHistory(res);
                        }}
                      >
                        Order History
                      </Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          if (!window.confirm('Delete this customer?')) return;
                          await customerService.remove(item._id);
                          load();
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
          {!customers.length ? <p className="p-4 text-center text-sm text-slate-500">No customers found</p> : null}
        </div>
      </Panel>

      {history ? (
        <Panel
          title={`Order History - ${history.customer?.name}`}
          right={<Button variant="secondary" onClick={() => setHistory(null)}>Close</Button>}
        >
          <div className="overflow-x-auto">
            <table className="table-ui">
              <thead className="bg-slate-100 text-left text-slate-600">
                <tr>
                  <th className="px-3 py-2">Order #</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Items</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.orders?.map((o) => (
                  <tr key={o._id} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium">{o.orderNumber}</td>
                    <td className="px-3 py-2">{o.orderType}</td>
                    <td className="px-3 py-2">{o.items.length}</td>
                    <td className="px-3 py-2">{currency(o.total)}</td>
                    <td className="px-3 py-2">{o.status}</td>
                    <td className="px-3 py-2">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!history.orders?.length ? <p className="p-4 text-sm text-slate-500">No orders for this customer</p> : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
};

export default CustomersPage;
