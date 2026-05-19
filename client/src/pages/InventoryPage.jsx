import { useEffect, useState } from 'react';
import { inventoryService, supplierService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { formatDate } from '../utils/format';

const defaultForm = {
  name: '',
  category: '',
  quantity: 0,
  unit: 'kg',
  minimumStockLevel: 10,
  supplier: '',
  purchasePrice: 0,
  expiryDate: ''
};

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [inventoryData, supplierData] = await Promise.all([
      inventoryService.list({ lowStock: showLowStock || undefined }),
      supplierService.list()
    ]);

    setItems(inventoryData);
    setSuppliers(supplierData);
  };

  useEffect(() => {
    load();
  }, [showLowStock]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.category || !form.unit) {
      setError('Name, category and unit are required');
      return;
    }

    const payload = {
      ...form,
      quantity: Number(form.quantity),
      minimumStockLevel: Number(form.minimumStockLevel),
      purchasePrice: Number(form.purchasePrice),
      supplier: form.supplier || undefined,
      expiryDate: form.expiryDate || undefined
    };

    try {
      if (editingId) {
        await inventoryService.update(editingId, payload);
      } else {
        await inventoryService.create(payload);
      }

      setEditingId('');
      setForm(defaultForm);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save inventory item');
    }
  };

  return (
    <div className="space-y-5">
      <Panel title={editingId ? 'Edit Inventory Item' : 'Add Inventory Item'}>
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-4" onSubmit={onSubmit}>
          <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Category" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
          <Input label="Quantity" type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
          <Input label="Unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
          <Input label="Minimum Stock Level" type="number" value={form.minimumStockLevel} onChange={(e) => setForm((p) => ({ ...p, minimumStockLevel: e.target.value }))} />
          <Select
            label="Supplier"
            value={form.supplier}
            options={[{ label: 'Select supplier', value: '' }].concat(
              suppliers.map((s) => ({ label: `${s.name} (${s.companyName || 'N/A'})`, value: s._id }))
            )}
            onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))}
          />
          <Input label="Purchase Price" type="number" step="0.01" value={form.purchasePrice} onChange={(e) => setForm((p) => ({ ...p, purchasePrice: e.target.value }))} />
          <Input label="Expiry Date" type="date" value={form.expiryDate} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} />

          <div className="lg:col-span-4 flex gap-2">
            <Button type="submit">{editingId ? 'Update Item' : 'Add Item'}</Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(''); setForm(defaultForm); }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </Panel>

      <Panel
        title="Inventory List"
        right={
          <Button
            variant={showLowStock ? 'primary' : 'secondary'}
            onClick={() => setShowLowStock((prev) => !prev)}
          >
            {showLowStock ? 'Showing Low Stock Only' : 'Show Low Stock Only'}
          </Button>
        }
      >
        <div className="hidden overflow-x-auto md:block">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Minimum</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2">{item.category}</td>
                  <td className="px-3 py-2">{item.quantity} {item.unit}</td>
                  <td className="px-3 py-2">{item.minimumStockLevel} {item.unit}</td>
                  <td className="px-3 py-2">{item.supplier?.name || '-'}</td>
                  <td className="px-3 py-2">{formatDate(item.expiryDate)}</td>
                  <td className="px-3 py-2"><StatusBadge value={item.quantity <= item.minimumStockLevel ? 'LOW' : 'OK'} /></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingId(item._id);
                          setForm({
                            name: item.name,
                            category: item.category,
                            quantity: item.quantity,
                            unit: item.unit,
                            minimumStockLevel: item.minimumStockLevel,
                            supplier: item.supplier?._id || '',
                            purchasePrice: item.purchasePrice || 0,
                            expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : ''
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          if (!window.confirm('Delete this inventory item?')) return;
                          await inventoryService.remove(item._id);
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
        </div>

        <div className="space-y-3 md:hidden">
          {items.map((item) => (
            <article key={item._id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.category}</p>
                </div>
                <StatusBadge value={item.quantity <= item.minimumStockLevel ? 'LOW' : 'OK'} />
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>Stock: {item.quantity} {item.unit}</p>
                <p>Minimum: {item.minimumStockLevel} {item.unit}</p>
                <p>Supplier: {item.supplier?.name || '-'}</p>
                <p>Expiry: {formatDate(item.expiryDate)}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEditingId(item._id);
                    setForm({
                      name: item.name,
                      category: item.category,
                      quantity: item.quantity,
                      unit: item.unit,
                      minimumStockLevel: item.minimumStockLevel,
                      supplier: item.supplier?._id || '',
                      purchasePrice: item.purchasePrice || 0,
                      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : ''
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    if (!window.confirm('Delete this inventory item?')) return;
                    await inventoryService.remove(item._id);
                    load();
                  }}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
        {!items.length ? <p className="p-4 text-center text-sm text-slate-500">No inventory items found</p> : null}
      </Panel>
    </div>
  );
};

export default InventoryPage;
