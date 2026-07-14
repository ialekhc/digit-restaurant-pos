import { useEffect, useState } from 'react';
import { supplierService } from '../api/services';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  companyName: ''
};

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const data = await supplierService.list();
    setSuppliers(data);
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
      if (editingId) {
        await supplierService.update(editingId, form);
      } else {
        await supplierService.create(form);
      }

      setEditingId('');
      setForm(defaultForm);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save supplier');
    }
  };

  return (
    <div className="space-y-5">
      <Panel title={editingId ? 'Edit Supplier' : 'Add Supplier'}>
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={submit}>
          <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <Input label="Company Name" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />
          <Input label="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />

          <div className="lg:col-span-3 flex gap-2">
            <Button type="submit">{editingId ? 'Update Supplier' : 'Add Supplier'}</Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(''); setForm(defaultForm); }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>

        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </Panel>

      <Panel title="Suppliers">
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2">{item.companyName || '-'}</td>
                  <td className="px-3 py-2">{item.phone}</td>
                  <td className="px-3 py-2">{item.email || '-'}</td>
                  <td className="px-3 py-2">{item.address || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingId(item._id);
                          setForm({
                            name: item.name,
                            phone: item.phone,
                            email: item.email || '',
                            address: item.address || '',
                            companyName: item.companyName || ''
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          if (!window.confirm('Delete this supplier?')) return;
                          await supplierService.remove(item._id);
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
          {!suppliers.length ? <p className="p-4 text-sm text-slate-500">No suppliers found</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default SuppliersPage;
