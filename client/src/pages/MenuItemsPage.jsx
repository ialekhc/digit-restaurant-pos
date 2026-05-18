import { useEffect, useState } from 'react';
import { categoryService, menuService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { API_BASE_URL } from '../api/axios';
import { currency } from '../utils/format';

const initial = {
  name: '',
  category: '',
  description: '',
  price: '',
  preparationTime: '10',
  isAvailable: 'true',
  image: null
};

const MenuItemsPage = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initial);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [menuData, categoryData] = await Promise.all([menuService.list(), categoryService.list()]);
      setItems(menuData);
      setCategories(categoryData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categoryOptions = [{ label: 'Select Category', value: '' }].concat(
    categories.map((c) => ({ label: c.name, value: c._id }))
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name || !form.category || !form.price) {
      setError('Name, category, and price are required');
      return;
    }

    const body = new FormData();
    body.append('name', form.name);
    body.append('category', form.category);
    body.append('description', form.description);
    body.append('price', Number(form.price));
    body.append('preparationTime', Number(form.preparationTime || 0));
    body.append('isAvailable', form.isAvailable === 'true');
    if (form.image) body.append('image', form.image);

    try {
      if (editingId) {
        await menuService.update(editingId, body);
      } else {
        await menuService.create(body);
      }

      setEditingId('');
      setForm(initial);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save menu item');
    }
  };

  return (
    <div className="space-y-5">
      <Panel title={editingId ? 'Edit Menu Item' : 'Create Menu Item'}>
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={submit}>
          <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Select
            label="Category"
            options={categoryOptions}
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
          />
          <Input label="Price" type="number" step="0.01" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
          <Input label="Preparation Time (mins)" type="number" value={form.preparationTime} onChange={(e) => setForm((p) => ({ ...p, preparationTime: e.target.value }))} />
          <Select
            label="Availability"
            options={[
              { label: 'Available', value: 'true' },
              { label: 'Unavailable', value: 'false' }
            ]}
            value={form.isAvailable}
            onChange={(e) => setForm((p) => ({ ...p, isAvailable: e.target.value }))}
          />
          <Input
            label="Image"
            type="file"
            accept="image/*"
            onChange={(e) => setForm((p) => ({ ...p, image: e.target.files?.[0] || null }))}
          />
          <div className="md:col-span-2 lg:col-span-3">
            <Input label="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="md:col-span-2 lg:col-span-3 flex gap-2">
            <Button type="submit">{editingId ? 'Update Item' : 'Create Item'}</Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(''); setForm(initial); }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </Panel>

      <Panel title="Menu Items" subtitle="Manage food and drink items">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Image</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Prep</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    {item.image ? (
                      <img
                        src={`${API_BASE_URL.replace('/api', '')}${item.image}`}
                        alt={item.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <span className="text-xs text-slate-500">No image</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 py-2">{item.category?.name}</td>
                  <td className="px-3 py-2">{currency(item.price)}</td>
                  <td className="px-3 py-2">{item.preparationTime} min</td>
                  <td className="px-3 py-2">{item.isAvailable ? 'Available' : 'Unavailable'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditingId(item._id);
                          setForm({
                            name: item.name,
                            category: item.category?._id || '',
                            description: item.description || '',
                            price: String(item.price),
                            preparationTime: String(item.preparationTime || 0),
                            isAvailable: String(item.isAvailable),
                            image: null
                          });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          if (!window.confirm('Delete this menu item?')) return;
                          await menuService.remove(item._id);
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
          {loading ? <p className="p-4 text-sm text-slate-500">Loading...</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default MenuItemsPage;
