import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api/axios';
import { orderService, tableService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { ROLES, TABLE_STATUSES } from '../utils/constants';

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
  CLEANING: 4
};

const statusRowClass = {
  AVAILABLE: 'border-emerald-200 bg-emerald-50/80',
  OCCUPIED: 'border-amber-200 bg-amber-50/80',
  RESERVED: 'border-sky-200 bg-sky-50/80',
  CLEANING: 'border-cyan-200 bg-cyan-50/80'
};

const statusFilterLabels = {
  ALL: 'All',
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  CLEANING: 'Cleaning'
};

const tableNumberValue = (tableNumber) => {
  const numeric = String(tableNumber || '').match(/\d+/);
  return numeric ? Number(numeric[0]) : Number.MAX_SAFE_INTEGER;
};

const TablesPage = () => {
  const { user } = useAuth();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [transferFromTableId, setTransferFromTableId] = useState('');
  const [transferToTableId, setTransferToTableId] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [qrTable, setQrTable] = useState(null);
  const [qrVersion, setQrVersion] = useState('0');
  const [qrLoading, setQrLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const canManageTables = [ROLES.ADMIN, ROLES.MANAGER].includes(user?.role);
  const canPlaceOrders = [ROLES.ADMIN, ROLES.MANAGER, ROLES.WAITER].includes(user?.role);
  const canTransferTables = canPlaceOrders;

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

  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => {
      const statusSort = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
      if (statusSort !== 0) return statusSort;
      return tableNumberValue(a.tableNumber) - tableNumberValue(b.tableNumber);
    });
  }, [tables]);

  const visibleTables = useMemo(() => {
    if (statusFilter === 'ALL') return sortedTables;
    return sortedTables.filter((table) => table.status === statusFilter);
  }, [sortedTables, statusFilter]);

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

  const transferTargets = useMemo(() => {
    return sortedTables.filter((table) => table._id !== transferFromTableId && table.status === 'AVAILABLE');
  }, [sortedTables, transferFromTableId]);

  const sourceTableForTransfer = useMemo(() => {
    return tables.find((table) => table._id === transferFromTableId);
  }, [tables, transferFromTableId]);

  const onTransferTable = async () => {
    setError('');
    setTransferMessage('');

    if (!transferFromTableId || !transferToTableId) {
      setError('Please select source and target table for transfer');
      return;
    }

    setTransferring(true);
    try {
      const result = await tableService.transfer(transferFromTableId, transferToTableId);
      setTransferMessage(result.message || 'Table transferred successfully');
      setTransferFromTableId('');
      setTransferToTableId('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to transfer table');
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

        {canTransferTables ? (
          <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <h4 className="text-sm font-semibold text-orange-900">Transfer Table</h4>
            <p className="mt-1 text-xs text-orange-800">
              Move all active dine-in orders from one table to another when customers shift seats.
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
                  setTransferFromTableId(e.target.value);
                  setTransferToTableId('');
                  setTransferMessage('');
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
                }}
                disabled={!transferFromTableId}
              />

              <div className="flex items-end gap-2">
                <Button
                  className="w-full"
                  onClick={onTransferTable}
                  disabled={transferring || !transferFromTableId || !transferToTableId}
                >
                  {transferring ? 'Transferring...' : 'Transfer Now'}
                </Button>
                {transferFromTableId ? (
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setTransferFromTableId('');
                      setTransferToTableId('');
                      setTransferMessage('');
                    }}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>

            {sourceTableForTransfer ? (
              <p className="mt-2 text-xs text-orange-900">
                Source table: <span className="font-semibold">{sourceTableForTransfer.tableNumber}</span> with{' '}
                <span className="font-semibold">{activeOrderCountByTable[sourceTableForTransfer._id] || 0}</span> active order(s).
              </p>
            ) : null}

            {transferMessage ? <p className="mt-2 text-sm font-semibold text-emerald-700">{transferMessage}</p> : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleTables.map((item) => (
            <article
              key={item._id}
              className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${statusRowClass[item.status] || 'border-slate-200 bg-white'}`}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Table</p>
                  <p className="text-2xl font-bold text-slate-900">{item.tableNumber}</p>
                </div>
                <StatusBadge value={item.status} />
              </div>

              <p className="mb-4 text-sm text-slate-700">
                Capacity: <span className="font-semibold">{item.seatingCapacity} guests</span>
              </p>
              <p className="mb-3 text-sm text-slate-700">
                Active orders: <span className="font-semibold">{activeOrderCountByTable[item._id] || 0}</span>
              </p>

              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Status</p>
                <div className="flex flex-wrap gap-2">
                  {TABLE_STATUSES.map((status) => (
                    <Button
                      key={status}
                      variant={status === item.status ? 'primary' : 'secondary'}
                      className="px-2 py-1 text-xs"
                      onClick={async () => {
                        try {
                          await tableService.updateStatus(item._id, status);
                          setError('');
                          load();
                        } catch (err) {
                          setError(err.response?.data?.message || 'Unable to update table status');
                        }
                      }}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>

              {canPlaceOrders ? (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <Link
                    to={`/orders?table=${item._id}&tableNumber=${encodeURIComponent(item.tableNumber)}`}
                    className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
                  >
                    View Orders
                  </Link>
                  <Link
                    to={`/orders/create?table=${item._id}&tableNumber=${encodeURIComponent(item.tableNumber)}`}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    New Order
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    className="sm:col-span-2"
                    onClick={() => openQrForTable(item)}
                    disabled={qrLoading}
                  >
                    {qrLoading && qrTable?._id === item._id ? 'Loading QR...' : 'Show QR'}
                  </Button>
                  {canTransferTables && (activeOrderCountByTable[item._id] || 0) > 0 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="sm:col-span-2"
                      onClick={() => {
                        setTransferFromTableId(item._id);
                        setTransferToTableId('');
                        setTransferMessage('');
                        setError('');
                      }}
                    >
                      Transfer From This Table
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {canManageTables ? (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="secondary"
                    onClick={() => {
                      setEditingId(item._id);
                      setForm({
                        tableNumber: item.tableNumber,
                        seatingCapacity: item.seatingCapacity,
                        status: item.status
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    className="flex-1"
                    variant="danger"
                    onClick={async () => {
                      if (!window.confirm('Delete this table?')) return;
                      try {
                        await tableService.remove(item._id);
                        setError('');
                        load();
                      } catch (err) {
                        setError(err.response?.data?.message || 'Unable to delete table');
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
        {!visibleTables.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm font-semibold text-slate-500">
            No {statusFilterLabels[statusFilter].toLowerCase()} tables found.
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
