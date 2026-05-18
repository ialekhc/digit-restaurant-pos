import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

      <Panel title="Table List">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TABLE_STATUSES.map((status) => (
            <div key={status} className={`rounded-xl border px-3 py-2 ${statusRowClass[status] || 'border-slate-200 bg-white'}`}>
              <p className="text-xs font-semibold uppercase text-slate-600">{status}</p>
              <p className="text-lg font-bold text-slate-800">{statusCounts[status] || 0}</p>
            </div>
          ))}
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
          {sortedTables.map((item) => (
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
      </Panel>
    </div>
  );
};

export default TablesPage;
