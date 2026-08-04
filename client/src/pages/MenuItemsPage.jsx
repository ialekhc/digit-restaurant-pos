import { useEffect, useMemo, useState } from 'react';
import { categoryService, menuService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import { API_BASE_URL } from '../api/axios';
import { currency } from '../utils/format';
import { usePermissions } from '../hooks/usePermissions';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { PERMISSIONS } from '../utils/constants';
import { downloadRowsAsXlsx, readRowsFromXlsx } from '../utils/excel';

const initial = {
  name: '',
  category: '',
  description: '',
  price: '',
  preparationTime: '10',
  preparationStation: 'KITCHEN',
  isAvailable: 'true',
  image: null
};

const defaultStationForMenuType = (menuType) => {
  if (menuType === 'DRINK') return 'BAR';
  if (menuType === 'SMOKE') return 'SMOKE';
  return 'KITCHEN';
};

const menuTypeConfig = {
  FOOD: {
    pageTitle: 'Menu Items',
    createTitle: 'Create Menu Item',
    editTitle: 'Edit Menu Item',
    listSubtitle: 'Manage food items',
    importTitle: 'Food Menu Import (Excel)',
    importSubtitle: 'Bulk upload food items using your sample format: Category, Item, Price (Rs.)',
    badgeText: 'Food Menu',
    itemLabel: 'Food'
  },
  DRINK: {
    pageTitle: 'Drink Items',
    createTitle: 'Create Drink Item',
    editTitle: 'Edit Drink Item',
    listSubtitle: 'Manage drink items',
    importTitle: 'Drink Menu Import (Excel)',
    importSubtitle: 'Bulk upload drink items using your sample format: Category, Item, Price (Rs.)',
    badgeText: 'Drink Menu',
    itemLabel: 'Drink'
  },
  SMOKE: {
    pageTitle: 'Smoke Items',
    createTitle: 'Create Smoke Item',
    editTitle: 'Edit Smoke Item',
    listSubtitle: 'Manage smoke items',
    importTitle: 'Smoke Menu Import (Excel)',
    importSubtitle: 'Bulk upload smoke items using your sample format: Category, Item, Price (Rs.)',
    badgeText: 'Smoke Menu',
    itemLabel: 'Smoke'
  },
  COMBO_PLATTER: {
    pageTitle: 'Combo Platter Items',
    createTitle: 'Create Combo Platter Item',
    editTitle: 'Edit Combo Platter Item',
    listSubtitle: 'Manage combo platter items',
    importTitle: 'Combo Platter Menu Import (Excel)',
    importSubtitle: 'Bulk upload combo platter items using your sample format: Category, Item, Price (Rs.)',
    badgeText: 'Combo Platter Menu',
    itemLabel: 'Combo Platter'
  }
};

const importSheetNames = {
  FOOD: ['food menu', 'food'],
  DRINK: ['drink menu', 'drinks menu', 'drink', 'drinks'],
  SMOKE: ['smoke menu', 'smoke'],
  COMBO_PLATTER: ['combo platter menu', 'combo platter', 'combo menu', 'combo', 'combos']
};

const menuSortOptions = [
  { label: 'Name: A to Z', value: 'name-asc' },
  { label: 'Name: Z to A', value: 'name-desc' },
  { label: 'Category: A to Z', value: 'category-asc' },
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Prep Time: Low to High', value: 'prep-asc' },
  { label: 'Availability', value: 'availability' }
];

const getItemStation = (item) => {
  if (item.preparationStation) return item.preparationStation;
  if (item.kitchenSection === 'BAR') return 'BAR';
  if (item.kitchenSection === 'SMOKE') return 'SMOKE';
  return 'KITCHEN';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');

  const canManageMenu = hasAnyPermission([PERMISSIONS.MENU_CREATE, PERMISSIONS.MENU_UPDATE]);
  const config = menuTypeConfig[menuType] || menuTypeConfig.FOOD;
  const emptyForm = useMemo(() => ({ ...initial, preparationStation: defaultStationForMenuType(menuType) }), [menuType]);
  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const filteredItems = query
      ? items.filter((item) => {
          const searchableValues = [
            item.name,
            item.category?.name,
            item.description,
            item.price,
            item.preparationTime,
            getItemStation(item),
            item.isAvailable ? 'available' : 'unavailable'
          ];

          return searchableValues.some((value) => String(value ?? '').toLocaleLowerCase().includes(query));
        })
      : [...items];

    const compareText = (left, right) => String(left || '').localeCompare(String(right || ''), undefined, {
      numeric: true,
      sensitivity: 'base'
    });

    return filteredItems.sort((left, right) => {
      switch (sortBy) {
        case 'name-desc':
          return compareText(right.name, left.name);
        case 'category-asc':
          return compareText(left.category?.name, right.category?.name) || compareText(left.name, right.name);
        case 'price-asc':
          return Number(left.price || 0) - Number(right.price || 0) || compareText(left.name, right.name);
        case 'price-desc':
          return Number(right.price || 0) - Number(left.price || 0) || compareText(left.name, right.name);
        case 'prep-asc':
          return Number(left.preparationTime || 0) - Number(right.preparationTime || 0) || compareText(left.name, right.name);
        case 'availability':
          return Number(right.isAvailable) - Number(left.isAvailable) || compareText(left.name, right.name);
        case 'name-asc':
        default:
          return compareText(left.name, right.name);
      }
    });
  }, [items, searchQuery, sortBy]);

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [menuData, categoryData] = await Promise.all([
        menuService.list({ menuType }),
        categoryService.list({ menuType })
      ]);
      setItems(menuData);
      setCategories(categoryData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setForm({ ...initial, preparationStation: defaultStationForMenuType(menuType) });
    setSearchQuery('');
    setSortBy('name-asc');
    load();
  }, [menuType]);

  useAutoRefresh(() => load(false));

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
    body.append('preparationStation', form.preparationStation || defaultStationForMenuType(menuType));
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
      setForm(emptyForm);
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
        preparationStation: String(getCellValue(row, ['Preparation Station', 'Printer Station', 'Station', 'preparationStation']) || '').trim(),
        menuType
      }))
      .filter((row) => row.category || row.item || String(row.price ?? '').trim() !== '');
  };

  const downloadTemplate = async () => {
    setImportError('');
    const templateRows = [
      { Category: 'MOMO', Item: 'Chicken Momo', 'Price (Rs.)': 200, 'Preparation Station': defaultStationForMenuType(menuType) },
      { Category: 'MOMO', Item: 'Buff Momo', 'Price (Rs.)': 200, 'Preparation Station': defaultStationForMenuType(menuType) },
      menuType === 'DRINK'
        ? { Category: 'MOCKTAILS', Item: 'Mint Lemonade', 'Price (Rs.)': 180, 'Preparation Station': 'BAR' }
        : menuType === 'SMOKE'
          ? { Category: 'CIGARETTES', Item: 'Classic Gold', 'Price (Rs.)': 40, 'Preparation Station': 'SMOKE' }
          : menuType === 'COMBO_PLATTER'
            ? { Category: 'SHARING PLATTERS', Item: 'Mixed Grill Platter', 'Price (Rs.)': 1200, 'Preparation Station': 'KITCHEN' }
            : { Category: 'CHOWMEIN', Item: 'Chicken Chowmein', 'Price (Rs.)': 220, 'Preparation Station': 'KITCHEN' }
    ];
    try {
      await downloadRowsAsXlsx({
        rows: templateRows,
        sheetName: config.badgeText,
        filename: 'vendor-menu-import-template.xlsx',
        widths: [20, 28, 14, 22]
      });
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
      const buffer = await importFile.arrayBuffer();
      const preferredSheetNames = importSheetNames[menuType];
      const { sheetName, rows: importedRows } = await readRowsFromXlsx(buffer, preferredSheetNames);

      if (!sheetName) {
        setImportError(
          `No ${config.badgeText} worksheet found. Expected a sheet named ${importSheetNames[menuType].join(' or ')}.`
        );
        return;
      }

      const rows = normalizeImportRows(importedRows);

      if (!rows.length) {
        setImportError('No valid rows found. Expected columns: Category, Item, Price (Rs.)');
        return;
      }

      if (!window.confirm(`Replace the existing ${config.itemLabel.toLowerCase()} menu with ${rows.length} imported rows?`)) {
        return;
      }

      const summary = await menuService.importExcel({ rows, upsert: true, replace: true, menuType });
      setImportSummary(summary);
      setImportFile(null);
      await load();
    } catch (err) {
      const responseData = err.response?.data?.data;
      if (responseData) setImportSummary(responseData);
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
            accept=".xlsx"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            helperText="Use an .xlsx file with columns: Category, Item, Price (Rs.). A successful import replaces the existing menu."
          />
          <div className="md:col-span-2 lg:col-span-2 flex items-end gap-2">
            <Button type="button" variant="secondary" onClick={downloadTemplate}>
              Download Template
            </Button>
            <Button type="submit" variant="success" disabled={importing}>
              {importing ? 'Replacing...' : `Replace ${config.itemLabel} Menu`}
            </Button>
          </div>
        </form>
        {importError ? <p className="mt-2 text-sm text-rose-600">{importError}</p> : null}
        {importSummary ? (
          <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
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
              <p className="text-sm text-slate-700">
                Removed Old Items: <span className="font-semibold text-rose-700">{importSummary.deleted || 0}</span>
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
        right={<span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">{config.badgeText}</span>}
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
            label="Preparation Station"
            options={menuType === 'COMBO_PLATTER'
              ? [{ label: 'Kitchen + Bar printers', value: 'KITCHEN' }]
              : [
                  { label: 'Kitchen printer', value: 'KITCHEN' },
                  { label: 'Bar printer', value: 'BAR' },
                  { label: 'Smoke printer', value: 'SMOKE' },
                  { label: 'No preparation print', value: 'NONE' }
                ]}
            value={form.preparationStation}
            onChange={(e) => setForm((p) => ({ ...p, preparationStation: e.target.value }))}
            disabled={menuType === 'COMBO_PLATTER'}
            helperText={menuType === 'COMBO_PLATTER' ? 'Combo platter KOTs always print on both stations.' : ''}
          />
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
              {editingId ? 'Update Item' : `Create ${config.itemLabel} Item`}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={() => { setEditingId(''); setForm(emptyForm); }}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      </Panel>

      <Panel title={config.pageTitle} subtitle={config.listSubtitle}>
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:items-end">
          <Input
            label={`Search ${config.pageTitle}`}
            type="search"
            placeholder="Search by name, category, price, station, or status"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Select
            label="Sort Items"
            options={menuSortOptions}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          />
        </div>
        <p className="mb-3 text-xs text-slate-500" aria-live="polite">
          Showing {visibleItems.length} of {items.length} items
        </p>
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Image</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Prep</th>
                <th className="px-3 py-2">Station</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
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
                  <td className="px-3 py-2">{getItemStation(item)}</td>
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
                              preparationStation: getItemStation(item),
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
              {!loading && visibleItems.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-3 py-8 text-center text-sm text-slate-500">
                    {searchQuery.trim()
                      ? `No ${config.pageTitle.toLowerCase()} match “${searchQuery.trim()}”.`
                      : `No ${config.pageTitle.toLowerCase()} found.`}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {loading ? <p className="p-4 text-sm text-slate-500">Loading...</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default MenuItemsPage;
