import { useEffect, useMemo, useState } from 'react';
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

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const EXPIRING_SOON_DAYS = 7;

const getExpiryInfo = (value) => {
  if (!value) return null;
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const days = Math.ceil((expiry.getTime() - today.getTime()) / MS_PER_DAY);
  if (days > EXPIRING_SOON_DAYS) return null;

  if (days < 0) {
    const overdue = Math.abs(days);
    return {
      days,
      label: overdue === 1 ? 'Expired 1 day ago' : `Expired ${overdue} days ago`
    };
  }

  if (days === 0) return { days, label: 'Expires today' };
  return { days, label: days === 1 ? 'Expires in 1 day' : `Expires in ${days} days` };
};

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [timePeriod, setTimePeriod] = useState('today');
  const [error, setError] = useState('');

  const load = async () => {
    const [inventoryData, supplierData] = await Promise.all([
      inventoryService.list(),
      supplierService.list()
    ]);

    setItems(inventoryData);
    setSuppliers(supplierData);
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredByPeriod = useMemo(() => {
    if (timePeriod === 'all') return items;

    const now = new Date();
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);

    if (timePeriod === 'week') {
      from.setDate(from.getDate() - 6);
    }

    if (timePeriod === 'month') {
      from.setDate(1);
    }

    return items.filter((item) => {
      const timestamp = new Date(item.createdAt || item.updatedAt || 0).getTime();
      return Number.isFinite(timestamp) && timestamp >= from.getTime();
    });
  }, [items, timePeriod]);

  const categoryCards = useMemo(() => {
    const source = categoryFilter
      ? filteredByPeriod.filter((item) => item.category === categoryFilter)
      : filteredByPeriod;
    const map = new Map();

    source.forEach((item) => {
      const category = item.category || 'Uncategorized';
      const current = map.get(category) || { category, total: 0, outOfStock: 0 };
      const quantity = Number(item.quantity || 0);
      current.total += 1;
      if (quantity <= 0) current.outOfStock += 1;
      map.set(category, current);
    });

    return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category));
  }, [categoryFilter, filteredByPeriod]);

  const visibleItems = useMemo(() => {
    const categoryItems = categoryFilter ? items.filter((item) => item.category === categoryFilter) : items;
    if (!showLowStock) return categoryItems;
    return categoryItems.filter((item) => Number(item.quantity || 0) <= Number(item.minimumStockLevel || 0));
  }, [categoryFilter, items, showLowStock]);

  const expiringItems = useMemo(() => {
    return items
      .map((item) => ({ ...item, expiryInfo: getExpiryInfo(item.expiryDate) }))
      .filter((item) => item.expiryInfo)
      .sort((a, b) => a.expiryInfo.days - b.expiryInfo.days);
  }, [items]);

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
      <section className="rounded-lg bg-slate-50 p-4 sm:p-5">
        <h2 className="text-2xl font-bold text-slate-900">Inventory Dashboard</h2>

        <div className="mt-5 rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Category Filter"
              value={categoryFilter}
              options={[{ label: 'All Categories', value: '' }, ...categories.map((category) => ({ label: category, value: category }))]}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <Select
              label="Time Period"
              value={timePeriod}
              options={[
                { label: 'Today', value: 'today' },
                { label: 'This Week', value: 'week' },
                { label: 'This Month', value: 'month' },
                { label: 'All Time', value: 'all' }
              ]}
              onChange={(e) => setTimePeriod(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {categoryCards.map((card) => {
            const inStock = card.outOfStock === 0;
            return (
              <article
                key={card.category}
                className={`min-h-44 rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-100 ${
                  inStock ? 'border-b-4 border-b-emerald-500' : 'border-b-4 border-b-rose-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-700">{card.category}</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${
                      inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {inStock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
                <p className="mt-5 text-4xl font-bold leading-none text-slate-950">
                  {card.total} <span className="align-baseline text-base font-normal text-slate-500">items</span>
                </p>
                {!inStock ? (
                  <p className="mt-5 text-base font-medium text-rose-600">
                    {card.outOfStock} {card.outOfStock === 1 ? 'item' : 'items'} out of stock
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        {!categoryCards.length ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No inventory categories found.</p> : null}
      </section>

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
              suppliers.map((s) => ({ label: `${s.name}${s.companyName ? ` (${s.companyName})` : ''}`, value: s._id }))
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
        title="Expiring Stock"
        right={
          <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
            {expiringItems.length} {expiringItems.length === 1 ? 'item' : 'items'}
          </span>
        }
      >
        {expiringItems.length ? (
          <div className="space-y-3">
            {expiringItems.map((item) => (
              <article
                key={item._id}
                className="rounded-lg border-l-4 border-orange-500 bg-orange-50/70 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-900">{item.name}</p>
                    <p className="mt-1 text-sm font-semibold text-orange-700">{item.expiryInfo.label}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm text-slate-500">{item.category}</p>
                    <p className="mt-1 text-sm font-bold text-orange-700">
                      Stock: {Number(item.quantity || 0).toFixed(2)} {item.unit}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No stock expiring soon.</p>
        )}
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
              {visibleItems.map((item) => (
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
          {visibleItems.map((item) => (
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
        {!visibleItems.length ? <p className="p-4 text-center text-sm text-slate-500">No inventory items found</p> : null}
      </Panel>
    </div>
  );
};

export default InventoryPage;
