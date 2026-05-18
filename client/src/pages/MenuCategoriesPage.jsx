import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { categoryService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const schema = z.object({
  name: z.string().min(2, 'Category name is required'),
  description: z.string().optional()
});

const defaults = { name: '', description: '' };

const MenuCategoriesPage = () => {
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(schema), defaultValues: defaults });

  const load = async () => {
    const data = await categoryService.list();
    setCategories(data);
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (values) => {
    setError('');
    try {
      if (editingId) {
        await categoryService.update(editingId, values);
      } else {
        await categoryService.create(values);
      }
      setEditingId('');
      reset(defaults);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save category');
    }
  };

  return (
    <div className="space-y-5">
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

      <Panel title="Categories">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((item) => (
                <tr key={item._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 py-2">{item.description || '-'}</td>
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
