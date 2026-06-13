import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { categoryService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const categoryTabs = [
  { label: 'Food Categories', value: 'FOOD' },
  { label: 'Drink Categories', value: 'DRINK' },
  { label: 'Smoke Categories', value: 'SMOKE' }
];
const drinkPresetCategories = [
  { name: 'Hot Beverages', description: 'Tea, coffee, hot chocolate and warm drink items' },
  { name: 'Cold Beverages', description: 'Juices, soft drinks, mocktails and chilled drinks' },
  { name: 'Liquors', description: 'Whiskey, vodka, rum, beer and alcoholic drinks' }
];

const schema = z.object({
  name: z.string().min(2, 'Category name is required'),
  description: z.string().optional()
});

const defaults = { name: '', description: '' };

const MenuCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState('');
  const [activeMenuType, setActiveMenuType] = useState('FOOD');
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(schema), defaultValues: defaults });

  const load = async () => {
    const data = await categoryService.list({ menuType: activeMenuType });
    setCategories(data);
  };

  useEffect(() => {
    load();
  }, [activeMenuType]);

  const onSubmit = async (values) => {
    setError('');
    try {
      if (editingId) {
        await categoryService.update(editingId, { ...values, menuType: activeMenuType });
      } else {
        await categoryService.create({ ...values, menuType: activeMenuType });
      }
      setEditingId('');
      reset(defaults);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save category');
    }
  };

  const createDrinkPresets = async () => {
    setError('');
    try {
      await Promise.all(
        drinkPresetCategories.map((item) =>
          categoryService.create({ ...item, menuType: 'DRINK' }).catch((err) => {
            if (err.response?.data?.message?.toLowerCase().includes('duplicate')) return null;
            throw err;
          })
        )
      );
      setActiveMenuType('DRINK');
      setEditingId('');
      reset(defaults);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to create drink preset categories');
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Category Type" subtitle="Manage categories separately for food, drinks, and smoke items">
        <div className="flex flex-wrap gap-2">
          {categoryTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={activeMenuType === tab.value ? 'primary' : 'secondary'}
              onClick={() => {
                setActiveMenuType(tab.value);
                setEditingId('');
                reset(defaults);
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        {activeMenuType === 'DRINK' ? (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
            <p className="text-sm font-semibold text-sky-900">Recommended drink subcategories</p>
            <p className="mt-1 text-sm text-sky-800">Use professional drink grouping like Hot Beverages, Cold Beverages, and Liquors.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {drinkPresetCategories.map((item) => (
                <span key={item.name} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                  {item.name}
                </span>
              ))}
            </div>
            <div className="mt-4">
              <Button type="button" variant="success" onClick={createDrinkPresets}>
                Create Drink Presets
              </Button>
            </div>
          </div>
        ) : null}
      </Panel>

      <Panel title={editingId ? 'Edit Category' : 'Create Category'}>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Name" {...register('name')} error={errors.name?.message} />
          <Input label="Description" {...register('description')} error={errors.description?.message} />
          <div className="md:col-span-2 flex gap-2">
            <Button type="submit" disabled={isSubmitting}>{editingId ? 'Update Category' : 'Create Category'}</Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(''); reset(defaults); }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </Panel>

      <Panel title="Categories" subtitle={`Showing ${activeMenuType.toLowerCase()} categories`}>
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 py-2">{item.description || '-'}</td>
                  <td className="px-3 py-2">{item.menuType || 'FOOD'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(item._id);
                          reset({ name: item.name, description: item.description || '' });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={async () => {
                          if (!window.confirm('Delete this category?')) return;
                          await categoryService.remove(item._id);
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
      </Panel>
    </div>
  );
};

export default MenuCategoriesPage;
