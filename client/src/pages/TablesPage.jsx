import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api/axios';
import { orderService, tableService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { usePermissions } from '../hooks/usePermissions';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { PERMISSIONS, TABLE_STATUSES } from '../utils/constants';

const defaultForm = {
  tableNumber: '',
  seatingCapacity: 2,
  status: 'AVAILABLE'
};

const activeOrderStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED'];

const statusPriority = {
  AVAILABLE: 1,
  OCCUPIED: 2,
  RESERVED: 3,
  Unavailable: 4
};

const statusRowClass = {
  AVAILABLE: 'border-emerald-200 bg-emerald-50/80',
  OCCUPIED: 'border-amber-200 bg-amber-50/80',
  RESERVED: 'border-sky-200 bg-sky-50/80',
  Unavailable: 'border-cyan-200 bg-cyan-50/80'
};

const statusAccentClass = {
  AVAILABLE: 'from-emerald-500 to-teal-400',
  OCCUPIED: 'from-amber-500 to-yellow-400',
  RESERVED: 'from-sky-500 to-blue-400',
  Unavailable: 'from-cyan-500 to-teal-300'
};

const statusFilterLabels = {
  ALL: 'All',
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  Unavailable: 'Unavailable'
};

const tableSortOptions = [
  { label: 'Status, then Table Number', value: 'status-asc' },
  { label: 'Table Number: Low to High', value: 'number-asc' },
  { label: 'Table Number: High to Low', value: 'number-desc' },
  { label: 'Capacity: Low to High', value: 'capacity-asc' },
  { label: 'Capacity: High to Low', value: 'capacity-desc' },
  { label: 'Active Orders: High to Low', value: 'orders-desc' }
];

const tableNumberValue = (tableNumber) => {
  const numeric = String(tableNumber || '').match(/\d+/);
  return numeric ? Number(numeric[0]) : Number.MAX_SAFE_INTEGER;
};

const compareTableNumbers = (left, right) => {
  const numericDifference = tableNumberValue(left) - tableNumberValue(right);
  if (numericDifference !== 0) return numericDifference;
  return String(left || '').localeCompare(String(right || ''), undefined, { numeric: true, sensitivity: 'base' });
};

const getTableAlphabet = (tableNumber) => {
  const match = String(tableNumber || '').trim().match(/^[a-z]/i);
  return match ? match[0].toUpperCase() : '';
};

const transferItemKey = (orderId, itemId) => `${orderId}:${itemId}`;

const transferItemType = (item) => {
  if (item.kitchenSection === 'BAR' || item.preparationStation === 'BAR') return 'DRINK';
  if (item.kitchenSection === 'SMOKE' || item.preparationStation === 'SMOKE') return 'SMOKE';
  return 'FOOD';
};

const SvgIcon = ({ children, className = 'h-4 w-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const EditIcon = () => (
  <SvgIcon>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </SvgIcon>
);

const DeleteIcon = () => (
  <SvgIcon>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v5" />
    <path d="M14 11v5" />
  </SvgIcon>
);

const ScanIcon = () => (
  <SvgIcon>
    <path d="M4 7V5a1 1 0 0 1 1-1h2" />
    <path d="M17 4h2a1 1 0 0 1 1 1v2" />
    <path d="M20 17v2a1 1 0 0 1-1 1h-2" />
    <path d="M7 20H5a1 1 0 0 1-1-1v-2" />
    <path d="M7 8h3v3H7z" />
    <path d="M14 8h3v3h-3z" />
    <path d="M7 14h3v3H7z" />
    <path d="M14 14h1.5" />
    <path d="M17 14v3h-3" />
  </SvgIcon>
);

const TablesPage = () => {
  const { hasAnyPermission } = usePermissions();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [transferFromTableId, setTransferFromTableId] = useState('');
  const [transferToTableId, setTransferToTableId] = useState('');
  const [transferItemQuantities, setTransferItemQuantities] = useState({});
  const [transferMessage, setTransferMessage] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [qrTable, setQrTable] = useState(null);
  const [qrVersion, setQrVersion] = useState('0');
  const [qrLoading, setQrLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableSortBy, setTableSortBy] = useState('status-asc');
  const canManageTables = hasAnyPermission([PERMISSIONS.TABLE_MANAGE]);
  const canPlaceOrders = hasAnyPermission([PERMISSIONS.ORDER_CREATE]);
  const canTransferTables = hasAnyPermission([PERMISSIONS.ORDER_TRANSFER]);

  const load = async () => {
    const [tableData, orderData] = await Promise.all([
      tableService.list(),
      orderService.list({ orderType: 'DINE_IN' })
    ]);
    setTables(tableData);
    setOrders(orderData);
  };

  useEffect(() => {
    load();
  }, []);

  useAutoRefresh(load);

  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => {
      const statusSort = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
      if (statusSort !== 0) return statusSort;
      return compareTableNumbers(a.tableNumber, b.tableNumber);
    });
  }, [tables]);

  const statusCounts = useMemo(() => {
    return TABLE_STATUSES.reduce((acc, status) => {
      acc[status] = tables.filter((table) => table.status === status).length;
      return acc;
    }, {});
  }, [tables]);

  const activeOrders = useMemo(() => {
    return orders.filter((order) => activeOrderStatuses.includes(order.status));
  }, [orders]);

  const activeOrderCountByTable = useMemo(() => {
    return activeOrders.reduce((acc, order) => {
      const tableId = order.table?._id;
      if (!tableId) return acc;
      acc[tableId] = (acc[tableId] || 0) + 1;
      return acc;
    }, {});
  }, [activeOrders]);

  const tableAlphabetOptions = useMemo(() => {
    const alphabets = [...new Set(tables.map((table) => getTableAlphabet(table.tableNumber)).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));

    return [
      { label: 'Show All Table Alphabets', value: 'prefix:ALL' },
      ...alphabets.map((alphabet) => ({
        label: `Show ${alphabet} Tables`,
        value: `prefix:${alphabet}`
      }))
    ];
  }, [tables]);

  useEffect(() => {
    if (!tableSortBy.startsWith('prefix:')) return;
    if (!tableAlphabetOptions.some((option) => option.value === tableSortBy)) {
      setTableSortBy('prefix:ALL');
    }
  }, [tableAlphabetOptions, tableSortBy]);

  const visibleTables = useMemo(() => {
    const query = tableSearchQuery.trim().toLocaleLowerCase();
    const selectedAlphabet = tableSortBy.startsWith('prefix:') ? tableSortBy.slice('prefix:'.length) : 'ALL';
    const filteredTables = tables.filter((table) => {
      if (statusFilter !== 'ALL' && table.status !== statusFilter) return false;
      if (selectedAlphabet !== 'ALL' && getTableAlphabet(table.tableNumber) !== selectedAlphabet) return false;
      if (!query) return true;

      const activeOrderCount = activeOrderCountByTable[table._id] || 0;
      return [
        table.tableNumber,
        table.status,
        statusFilterLabels[table.status],
        table.seatingCapacity,
        activeOrderCount,
        `${table.seatingCapacity} guests`,
        `${activeOrderCount} active orders`
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(query));
    });

    return filteredTables.sort((left, right) => {
      switch (tableSortBy) {
        case 'number-asc':
          return compareTableNumbers(left.tableNumber, right.tableNumber);
        case 'number-desc':
          return compareTableNumbers(right.tableNumber, left.tableNumber);
        case 'capacity-asc':
          return Number(left.seatingCapacity || 0) - Number(right.seatingCapacity || 0)
            || compareTableNumbers(left.tableNumber, right.tableNumber);
        case 'capacity-desc':
          return Number(right.seatingCapacity || 0) - Number(left.seatingCapacity || 0)
            || compareTableNumbers(left.tableNumber, right.tableNumber);
        case 'orders-desc':
          return (activeOrderCountByTable[right._id] || 0) - (activeOrderCountByTable[left._id] || 0)
            || compareTableNumbers(left.tableNumber, right.tableNumber);
        case 'status-asc':
        default:
          return (statusPriority[left.status] || 99) - (statusPriority[right.status] || 99)
            || compareTableNumbers(left.tableNumber, right.tableNumber);
      }
    });
  }, [activeOrderCountByTable, statusFilter, tableSearchQuery, tableSortBy, tables]);

  const transferTargets = useMemo(() => {
    return sortedTables.filter((table) => table._id !== transferFromTableId && table.status === 'AVAILABLE');
  }, [sortedTables, transferFromTableId]);

  const sourceTableForTransfer = useMemo(() => {
    return tables.find((table) => table._id === transferFromTableId);
  }, [tables, transferFromTableId]);

  const sourceOrdersForTransfer = useMemo(() => {
    return activeOrders.filter((order) => order.table?._id === transferFromTableId);
  }, [activeOrders, transferFromTableId]);

  const sourceItemsForTransfer = useMemo(() => {
    return sourceOrdersForTransfer.flatMap((order) => (
      (order.items || []).map((item) => ({ order, item }))
    ));
  }, [sourceOrdersForTransfer]);

  const selectedTransferQuantity = Object.values(transferItemQuantities).reduce(
    (sum, quantity) => sum + Number(quantity || 0),
    0
  );
  const sourceTotalQuantity = sourceItemsForTransfer.reduce(
    (sum, { item }) => sum + Number(item.quantity || 0),
    0
  );

  const allSourceItemsSelected = sourceItemsForTransfer.length > 0
    && sourceItemsForTransfer.every(({ order, item }) => (
      Number(transferItemQuantities[transferItemKey(order._id, item._id)] || 0) === Number(item.quantity || 0)
    ));

  const selectTransferSource = (tableId) => {
    setTransferFromTableId(tableId);
    setTransferToTableId('');
    setTransferItemQuantities({});
    setTransferMessage('');
    setTransferError('');
  };

  const onTransferTable = async () => {
    setError('');
    setTransferMessage('');
    setTransferError('');

    if (!transferFromTableId || !transferToTableId) {
      setTransferError('Please select source and target table for transfer');
      return;
    }

    if (selectedTransferQuantity <= 0) {
      setTransferError('Please select at least one item to transfer');
      return;
    }

    setTransferring(true);
    try {
      const itemSelections = sourceOrdersForTransfer
        .map((order) => ({
          orderId: order._id,
          items: (order.items || [])
            .map((item) => ({
              itemId: item._id,
              quantity: Number(transferItemQuantities[transferItemKey(order._id, item._id)] || 0)
            }))
            .filter((item) => item.quantity > 0)
        }))
        .filter((selection) => selection.items.length > 0);
      const result = await tableService.transfer(transferFromTableId, transferToTableId, itemSelections);
      setTransferMessage(result.message || 'Table transferred successfully');
      setTransferFromTableId('');
      setTransferToTableId('');
      setTransferItemQuantities({});
      await load();
    } catch (err) {
      setTransferError(err.response?.data?.message || 'Unable to transfer selected items');
    } finally {
      setTransferring(false);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.tableNumber || !form.seatingCapacity) {
      setError('Table number and seating capacity are required');
      return;
    }

    try {
      setTransferMessage('');
      if (editingId) {
        await tableService.update(editingId, {
          ...form,
          seatingCapacity: Number(form.seatingCapacity)
        });
      } else {
        await tableService.create({
          ...form,
          seatingCapacity: Number(form.seatingCapacity)
        });
      }
      setEditingId('');
      setForm(defaultForm);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save table');
    }
  };

  const onAdd10Tables = async () => {
    setError('');
    setTransferMessage('');
    setBulkAdding(true);
    try {
      const usedNumbers = new Set(
        tables
          .map((table) => {
            const match = String(table.tableNumber || '').match(/\d+/);
            return match ? Number(match[0]) : null;
          })
          .filter((value) => Number.isFinite(value))
      );
      const currentMax = usedNumbers.size ? Math.max(...usedNumbers) : 0;
      const payloads = [];
      for (let index = 1; index <= 10; index += 1) {
        let next = currentMax + index;
        while (usedNumbers.has(next)) {
          next += 1;
        }
        usedNumbers.add(next);
        payloads.push({
          tableNumber: `T-${next}`,
          seatingCapacity: 4,
          status: 'AVAILABLE'
        });
      }

      await Promise.all(payloads.map((payload) => tableService.create(payload)));
      await load();
      setTransferMessage('10 new tables have been added successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to add 10 tables');
    } finally {
      setBulkAdding(false);
    }
  };

  const qrUrlForTable = (tableId, menuVersion) =>
    `${window.location.origin}/scan/${tableId}${menuVersion ? `?mv=${encodeURIComponent(menuVersion)}` : ''}`;
  const qrImageUrlForTable = (tableId) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrUrlForTable(tableId, qrVersion))}`;

  const openQrForTable = async (table) => {
    setError('');
    setQrLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/public/qr-meta/${table._id}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to prepare QR');
      }
      setQrVersion(payload?.data?.menuVersion || '0');
      setQrTable(table);
    } catch (err) {
      setError(err.message || 'Unable to prepare QR');
    } finally {
      setQrLoading(false);
    }
  };

  const editTable = (table) => {
    setEditingId(table._id);
    setForm({
      tableNumber: table.tableNumber,
      seatingCapacity: table.seatingCapacity,
      status: table.status
    });
  };

  const deleteTable = async (table) => {
    if (!window.confirm('Delete this table?')) return;
    try {
      await tableService.remove(table._id);
      setError('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete table');
    }
  };

  return (
    <div className="space-y-5">
      {canManageTables ? (
        <Panel title={editingId ? 'Edit Table' : 'Add Table'}>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmit}>
            <Input label="Table Number" value={form.tableNumber} onChange={(e) => setForm((p) => ({ ...p, tableNumber: e.target.value }))} />
            <Input label="Seating Capacity" type="number" min={1} value={form.seatingCapacity} onChange={(e) => setForm((p) => ({ ...p, seatingCapacity: e.target.value }))} />
            <Select
              label="Status"
              options={TABLE_STATUSES.map((x) => ({ label: x, value: x }))}
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
            />
            <div className="md:col-span-3 flex gap-2">
              <Button type="submit">{editingId ? 'Update Table' : 'Add Table'}</Button>
              {editingId ? (
                <Button type="button" variant="secondary" onClick={() => { setEditingId(''); setForm(defaultForm); }}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
          {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        </Panel>
      ) : (
        <Panel title="Table Service">
          <p className="text-sm text-slate-600">
            Select a table below to view its orders or create a new order.
          </p>
          {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        </Panel>
      )}

      <Panel
        title="Table List"
        right={
          canManageTables ? (
            <Button onClick={onAdd10Tables} disabled={bulkAdding}>
              {bulkAdding ? 'Adding...' : 'Add 10 Tables'}
            </Button>
          ) : null
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TABLE_STATUSES.map((status) => (
            <div key={status} className={`rounded-xl border px-3 py-2 ${statusRowClass[status] || 'border-slate-200 bg-white'}`}>
              <p className="text-xs font-semibold uppercase text-slate-600">{status}</p>
              <p className="text-lg font-bold text-slate-800">{statusCounts[status] || 0}</p>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {['ALL', ...TABLE_STATUSES].map((status) => {
            const isActive = statusFilter === status;
            const count = status === 'ALL' ? tables.length : statusCounts[status] || 0;
            return (
              <Button
                key={status}
                type="button"
                variant={isActive ? 'primary' : 'secondary'}
                className="min-w-[110px] justify-center"
                onClick={() => setStatusFilter(status)}
              >
                {statusFilterLabels[status]} ({count})
              </Button>
            );
          })}
        </div>

        <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,340px)]">
          <Input
            label="Search Tables"
            type="search"
            placeholder="Search by table number, status, capacity, or active orders"
            value={tableSearchQuery}
            onChange={(e) => setTableSearchQuery(e.target.value)}
          />
          <Select
            label="Sort / Filter Tables"
            options={tableAlphabetOptions.concat(tableSortOptions)}
            value={tableSortBy}
            onChange={(e) => setTableSortBy(e.target.value)}
          />
        </div>
        <p className="mb-4 text-xs text-slate-500" aria-live="polite">
          Showing {visibleTables.length} of {tables.length} tables
        </p>

        {canTransferTables ? (
          <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4">
            <h4 className="text-sm font-semibold text-brand-900">Transfer Table</h4>
            <p className="mt-1 text-xs text-brand-800">
              Choose particular food, drink, or smoke items—or select all items—to move between tables.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Select
                label="From Table"
                value={transferFromTableId}
                options={[
                  { label: 'Select source table', value: '' },
                  ...sortedTables
                    .filter((table) => (activeOrderCountByTable[table._id] || 0) > 0)
                    .map((table) => ({
                      label: `${table.tableNumber} (${activeOrderCountByTable[table._id]} active order(s))`,
                      value: table._id
                    }))
                ]}
                onChange={(e) => {
                  selectTransferSource(e.target.value);
                }}
              />

              <Select
                label="To Table"
                value={transferToTableId}
                options={[
                  { label: 'Select target table', value: '' },
                  ...transferTargets.map((table) => ({
                    label: `${table.tableNumber} (${table.status})`,
                    value: table._id
                  }))
                ]}
                onChange={(e) => {
                  setTransferToTableId(e.target.value);
                  setTransferMessage('');
                  setTransferError('');
                }}
                disabled={!transferFromTableId}
              />

              <div className="flex items-end gap-2">
                <Button
                  className="w-full"
                  onClick={onTransferTable}
                  disabled={transferring || !transferFromTableId || !transferToTableId || selectedTransferQuantity <= 0}
                >
                  {transferring ? 'Transferring...' : 'Transfer Now'}
                </Button>
                {transferFromTableId ? (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      selectTransferSource('');
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>

            {sourceTableForTransfer ? (
              <div className="mt-3 rounded-xl border border-brand-200 bg-white/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-brand-900">
                    Source table: <span className="font-semibold">{sourceTableForTransfer.tableNumber}</span>.{' '}
                    <span className="font-semibold">{selectedTransferQuantity}</span> of{' '}
                    <span className="font-semibold">{sourceTotalQuantity}</span> unit(s) selected.
                  </p>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-brand-900">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-300"
                      checked={allSourceItemsSelected}
                      onChange={(e) => {
                        setTransferItemQuantities(
                          e.target.checked
                            ? Object.fromEntries(sourceItemsForTransfer.map(({ order, item }) => (
                              [transferItemKey(order._id, item._id), Number(item.quantity || 0)]
                            )))
                            : {}
                        );
                        setTransferMessage('');
                        setTransferError('');
                      }}
                    />
                    Select all items
                  </label>
                </div>

                <div className="mt-3 space-y-3">
                  {sourceOrdersForTransfer.map((order) => (
                    <div key={order._id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-900">{order.orderNumber}</span>
                        <span className="text-slate-500">
                          {order.customer?.name || 'No customer'} · {order.status}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {(order.items || []).map((item) => {
                          const key = transferItemKey(order._id, item._id);
                          const selectedQuantity = Number(transferItemQuantities[key] || 0);
                          const selected = selectedQuantity > 0;
                          const type = transferItemType(item);
                          return (
                            <div
                              key={item._id}
                              className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                                selected
                                  ? 'border-brand-400 bg-brand-50'
                                  : 'border-slate-200 bg-white hover:border-brand-200'
                              }`}
                            >
                              <label className="flex min-w-0 flex-1 cursor-pointer gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 rounded border-brand-300 text-brand-600 focus:ring-brand-300"
                                  checked={selected}
                                  onChange={(e) => {
                                    setTransferItemQuantities((current) => ({
                                      ...current,
                                      [key]: e.target.checked ? 1 : 0
                                    }));
                                    setTransferMessage('');
                                    setTransferError('');
                                  }}
                                />
                                <span className="min-w-0 text-xs text-slate-700">
                                  <span className="block truncate font-bold text-slate-900">{item.name}</span>
                                  <span className="block">Ordered: {item.quantity} · {type}</span>
                                  <span className="block text-slate-500">
                                    Ready {Number(item.readyQuantity || 0)}/{item.quantity}
                                  </span>
                                </span>
                              </label>
                              {selected ? (
                                <label className="w-20 text-[11px] font-semibold text-brand-900">
                                  Move qty
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.quantity}
                                    step="1"
                                    value={selectedQuantity}
                                    onChange={(e) => {
                                      const requested = Math.floor(Number(e.target.value) || 1);
                                      const quantity = Math.max(1, Math.min(Number(item.quantity), requested));
                                      setTransferItemQuantities((current) => ({ ...current, [key]: quantity }));
                                      setTransferMessage('');
                                      setTransferError('');
                                    }}
                                    className="mt-1 w-full rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                                    aria-label={`Transfer quantity for ${item.name}`}
                                  />
                                </label>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {transferMessage ? <p className="mt-2 text-sm font-semibold text-emerald-700">{transferMessage}</p> : null}
            {transferError ? <p className="mt-2 text-sm font-semibold text-rose-700">{transferError}</p> : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleTables.map((item) => (
            <article
              key={item._id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className={`h-1.5 bg-gradient-to-r ${statusAccentClass[item.status] || 'from-slate-400 to-slate-300'}`} />
              <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black leading-none text-slate-950">{item.tableNumber}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {item.seatingCapacity} guests · {activeOrderCountByTable[item._id] || 0} active order{(activeOrderCountByTable[item._id] || 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusBadge value={item.status} />
                    {canManageTables ? (
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-700 transition hover:bg-brand-100"
                          title={`Edit ${item.tableNumber}`}
                          aria-label={`Edit ${item.tableNumber}`}
                          onClick={() => editTable(item)}
                        >
                          <EditIcon />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                          title={`Delete ${item.tableNumber}`}
                          aria-label={`Delete ${item.tableNumber}`}
                          onClick={() => deleteTable(item)}
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {canPlaceOrders ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to={`/orders?table=${item._id}&tableNumber=${encodeURIComponent(item.tableNumber)}`}
                      className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700"
                    >
                      View Orders
                    </Link>
                    <Link
                      to={`/orders/create?table=${item._id}&tableNumber=${encodeURIComponent(item.tableNumber)}`}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                    >
                      New Order
                    </Link>
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  {canManageTables ? (
                    <Select
                      label="Status"
                      value={item.status}
                      options={TABLE_STATUSES.map((status) => ({
                        label: statusFilterLabels[status] || status,
                        value: status
                      }))}
                      onChange={async (e) => {
                        try {
                          await tableService.updateStatus(item._id, e.target.value);
                          setError('');
                          load();
                        } catch (err) {
                          setError(err.response?.data?.message || 'Unable to update table status');
                        }
                      }}
                    />
                  ) : null}

                  {canPlaceOrders ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className={`${canManageTables ? 'mt-auto w-full self-end' : 'w-full'} inline-flex items-center justify-center gap-2`}
                      onClick={() => openQrForTable(item)}
                      disabled={qrLoading}
                    >
                      <ScanIcon />
                      <span>{qrLoading && qrTable?._id === item._id ? 'Loading QR...' : 'Show QR'}</span>
                    </Button>
                  ) : null}
                </div>

                {canTransferTables && (activeOrderCountByTable[item._id] || 0) > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => {
                      selectTransferSource(item._id);
                      setError('');
                    }}
                  >
                    Transfer From This Table
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {!visibleTables.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm font-semibold text-slate-500">
            {tableSearchQuery.trim()
              ? `No ${statusFilterLabels[statusFilter].toLowerCase()} tables match “${tableSearchQuery.trim()}”.`
              : `No ${statusFilterLabels[statusFilter].toLowerCase()} tables found.`}
          </div>
        ) : null}

      </Panel>

      {qrTable ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-lg font-bold text-slate-900">Permanent QR - Table {qrTable.tableNumber}</h4>
                <p className="text-sm text-slate-600">
                  QR changes only when menu items are updated. Otherwise this QR remains unchanged for this table.
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setQrTable(null)}>
                Close
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[260px,1fr]">
              <img
                src={qrImageUrlForTable(qrTable._id)}
                alt={`QR for ${qrTable.tableNumber}`}
                className="h-[260px] w-[260px] rounded-xl border border-slate-200 bg-white p-2"
              />
              <div className="space-y-3">
                <p className="text-sm text-slate-700 break-all">
                  Menu URL: <span className="font-semibold">{qrUrlForTable(qrTable._id, qrVersion)}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={qrImageUrlForTable(qrTable._id)}
                    download={`table-${String(qrTable.tableNumber || '').replace(/\s+/g, '-').toLowerCase()}-qr.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                  >
                    Download QR
                  </a>
                  <Button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(qrUrlForTable(qrTable._id, qrVersion));
                        setTransferMessage(`QR link copied for ${qrTable.tableNumber}`);
                      } catch (_err) {
                        setError('Unable to copy QR link');
                      }
                    }}
                  >
                    Copy Menu Link
                  </Button>
                  <a
                    href={qrUrlForTable(qrTable._id, qrVersion)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Open Menu
                  </a>
                </div>
                <p className="text-xs text-slate-500">
                  Customer orders from this QR go to the same dine-in order pipeline, so waiter and kitchen receive them.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TablesPage;
