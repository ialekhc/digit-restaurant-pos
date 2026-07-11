import { useEffect, useMemo, useState } from 'react';
import { categoryService, menuService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { API_BASE_URL } from '../api/axios';
import { currency } from '../utils/format';
import { usePermissions } from '../hooks/usePermissions';
import { PERMISSIONS } from '../utils/constants';

const initial = {
  name: '',
  category: '',
  description: '',
  price: '',
  preparationTime: '10',
  isAvailable: 'true',
  image: null
};

const menuTypeConfig = {
  FOOD: {
    pageTitle: 'Menu Items',
    createTitle: 'Create Menu Item',
    editTitle: 'Edit Menu Item',
    listSubtitle: 'Manage food items',
    importTitle: 'Food Menu Import (Excel)',
    importSubtitle: 'Bulk upload food items using your sample format: Category, Item, Price (Rs.)',
    badgeText: 'Food Menu'
  },
  DRINK: {
    pageTitle: 'Drink Items',
    createTitle: 'Create Drink Item',
    editTitle: 'Edit Drink Item',
    listSubtitle: 'Manage drink items',
    importTitle: 'Drink Menu Import (Excel)',
    importSubtitle: 'Bulk upload drink items using your sample format: Category, Item, Price (Rs.)',
    badgeText: 'Drink Menu'
  },
  SMOKE: {
    pageTitle: 'Smoke Items',
    createTitle: 'Create Smoke Item',
    editTitle: 'Edit Smoke Item',
    listSubtitle: 'Manage smoke items',
    importTitle: 'Smoke Menu Import (Excel)',
    importSubtitle: 'Bulk upload smoke items using your sample format: Category, Item, Price (Rs.)',
    badgeText: 'Smoke Menu'
  }
};

const MenuItemsPage = ({ menuType = 'FOOD' }) => {
  const { hasAnyPermission } = usePermissions();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initial);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSummary, setImportSummary] = useState(null);

  const canManageMenu = hasAnyPermission([PERMISSIONS.MENU_CREATE, PERMISSIONS.MENU_UPDATE]);
  const config = menuTypeConfig[menuType] || menuTypeConfig.FOOD;

  const load = async () => {
    setLoading(true);
    try {
      const [menuData, categoryData] = await Promise.all([menuService.list({ menuType }), categoryService.list()]);
      setItems(menuData);
      setCategories(categoryData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [menuType]);

  const categoryOptions = [{ label: 'Select Category', value: '' }].concat(
    categories.map((c) => ({ label: c.name, value: c._id }))
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!canManageMenu) {
      setError('You do not have permission to manage menu items');
      return;
    }

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
    body.append('menuType', menuType);
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

  const getCellValue = (row, keys) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && typeof row[key] !== 'undefined') {
        return row[key];
      }
    }
    return '';
  };

  const normalizeImportRows = (rows) => {
    return rows
      .map((row, index) => ({
        rowNumber: index + 2,
        category: String(getCellValue(row, ['Category', 'category', 'CATEGORY']) || '').trim(),
        item: String(getCellValue(row, ['Item', 'item', 'ITEM', 'Name', 'name']) || '').trim(),
        price: getCellValue(row, ['Price (Rs.)', 'Price (Rs)', 'Price', 'price', 'PRICE']),
        description: String(getCellValue(row, ['Description', 'description']) || '').trim(),
        preparationTime: getCellValue(row, ['Preparation Time', 'Prep Time', 'preparationTime']),
        isAvailable: getCellValue(row, ['Available', 'Is Available', 'isAvailable']),
        kitchenSection: String(getCellValue(row, ['Kitchen Section', 'Section', 'kitchenSection']) || '').trim(),
        menuType
      }))
      .filter((row) => row.category || row.item || String(row.price ?? '').trim() !== '');
  };

  const downloadTemplate = async () => {
    setImportError('');
    const templateRows = [
      { Category: 'MOMO', Item: 'Chicken Momo', 'Price (Rs.)': 200 },
      { Category: 'MOMO', Item: 'Buff Momo', 'Price (Rs.)': 200 },
      menuType === 'DRINK'
        ? { Category: 'MOCKTAILS', Item: 'Mint Lemonade', 'Price (Rs.)': 180 }
        : menuType === 'SMOKE'
          ? { Category: 'CIGARETTES', Item: 'Classic Gold', 'Price (Rs.)': 40 }
          : { Category: 'CHOWMEIN', Item: 'Chicken Chowmein', 'Price (Rs.)': 220 }
    ];
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(templateRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, config.badgeText);
      XLSX.writeFile(workbook, 'vendor-menu-import-template.xlsx');
    } catch (error) {
      setImportError('Unable to generate template file');
    }
  };

  const importMenuFromExcel = async (e) => {
    e.preventDefault();
    setImportError('');
    setImportSummary(null);

    if (!canManageMenu) {
      setImportError('You do not have permission to import menu items');
      return;
    }

    if (!importFile) {
      setImportError('Please choose an Excel file first');
      return;
    }

    try {
      setImporting(true);
      const XLSX = await import('xlsx');
      const buffer = await importFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        setImportError('No worksheet found in selected file');
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      const rows = normalizeImportRows(rawRows);

      if (!rows.length) {
        setImportError('No valid rows found. Expected columns: Category, Item, Price (Rs.)');
        return;
      }

      const summary = await menuService.importExcel({ rows, upsert: true });
      setImportSummary(summary);
      setImportFile(null);
      await load();
    } catch (err) {
      setImportError(err.response?.data?.message || 'Unable to import menu file');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel
        title={config.importTitle}
        subtitle={config.importSubtitle}
      >
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={importMenuFromExcel}>
          <Input
            label="Excel File"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            helperText="Use columns: Category, Item, Price (Rs.)"
          />
          <div className="md:col-span-2 lg:col-span-2 flex items-end gap-2">
            <Button type="button" variant="secondary" onClick={downloadTemplate}>
              Download Template
            </Button>
            <Button type="submit" variant="success" disabled={importing}>
              {importing ? 'Importing...' : `Import ${menuType === 'DRINK' ? 'Drink' : menuType === 'SMOKE' ? 'Smoke' : 'Food'} Menu`}
            </Button>
          </div>
        </form>
        {importError ? <p className="mt-2 text-sm text-rose-600">{importError}</p> : null}
        {importSummary ? (
          <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <p className="text-sm text-slate-700">
                Total Rows: <span className="font-semibold">{importSummary.totalRows}</span>
              </p>
              <p className="text-sm text-slate-700">
                Created: <span className="font-semibold text-emerald-700">{importSummary.created}</span>
              </p>
              <p className="text-sm text-slate-700">
                Updated: <span className="font-semibold text-blue-700">{importSummary.updated}</span>
              </p>
              <p className="text-sm text-slate-700">
                Skipped: <span className="font-semibold text-amber-700">{importSummary.skipped}</span>
              </p>
              <p className="text-sm text-slate-700">
                New Categories: <span className="font-semibold text-violet-700">{importSummary.categoriesCreated}</span>
              </p>
            </div>
            {Array.isArray(importSummary.errors) && importSummary.errors.length ? (
              <div className="rounded-lg border border-amber-200 bg-white p-3">
                <p className="text-sm font-semibold text-amber-800">Row Errors ({importSummary.errors.length})</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">
                  {importSummary.errors.slice(0, 10).map((err) => (
                    <li key={`${err.row}-${err.message}`}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel
        title={editingId ? config.editTitle : config.createTitle}
        right={<span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">{config.badgeText}</span>}
      >
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
            <Button type="submit" disabled={!canManageMenu}>
              {editingId ? 'Update Item' : `Create ${menuType === 'DRINK' ? 'Drink' : menuType === 'SMOKE' ? 'Smoke' : 'Food'} Item`}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(''); setForm(initial); }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </Panel>

      <Panel title={config.pageTitle} subtitle={config.listSubtitle}>
        <div className="overflow-x-auto">
          <table className="table-ui">
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
                    {canManageMenu ? (
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
                    ) : (
                      <span className="text-xs text-slate-400">View only</span>
                    )}
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
