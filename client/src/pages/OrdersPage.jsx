import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderService, tableService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import OrderCancellationDialog from '../components/OrderCancellationDialog';
import { useAuth } from '../hooks/useAuth';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { ORDER_STATUSES, ORDER_TYPES, PERMISSIONS } from '../utils/constants';
import { currency, formatDateTime } from '../utils/format';
import { openStationTicketsPdfTab } from '../utils/stationTicketPdf';

const OrdersPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTableFilter = searchParams.get('table') || '';
  const initialTableLabel = searchParams.get('tableNumber') || '';

  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [expandedItemsByOrder, setExpandedItemsByOrder] = useState({});
  const [actionError, setActionError] = useState('');
  const [cancellationOrder, setCancellationOrder] = useState(null);
  const [cancellationBusy, setCancellationBusy] = useState(false);
  const [cancellationError, setCancellationError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    orderType: '',
    search: '',
    table: initialTableFilter
  });
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const load = async (nextFilters = filters) => {
    const data = await orderService.list(nextFilters);
    setOrders(data);
  };

  useEffect(() => {
    const boot = async () => {
      const [orderData, tableData] = await Promise.all([
        orderService.list(filters),
        tableService.list()
      ]);
      setOrders(orderData);
      setTables(tableData);
    };

    boot();
  }, []);

  useAutoRefresh(async () => {
    const [orderData, tableData] = await Promise.all([
      orderService.list(filtersRef.current),
      tableService.list()
    ]);
    setOrders(orderData);
    setTables(tableData);
  });

  const selectedTable = useMemo(() => {
    return tables.find((table) => table._id === filters.table);
  }, [tables, filters.table]);

  const hasPermission = (permission) => Array.isArray(user?.permissions) && user.permissions.includes(permission);
  const isOwnerDeleteRole = ['SUPER_ADMIN', 'RESTAURANT_OWNER'].includes(user?.role);

  const attendedByLabel = (order) => {
    const attendedBy = order?.createdBy;
    if (!attendedBy) return 'Unknown staff';
    const name = attendedBy.name || attendedBy.email || 'Unknown staff';
    const role = attendedBy.role ? ` (${String(attendedBy.role).replaceAll('_', ' ')})` : '';
    return `${name}${role}`;
  };

  const getAllowedActions = (order) => {
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return { canServe: false, canCancel: false };
    }

    const canServe =
      hasPermission(PERMISSIONS.ORDER_UPDATE) &&
      order.items.some((item) => Number(item.servedQuantity || 0) < Number(item.readyQuantity || 0));
    const canCancel = hasPermission(PERMISSIONS.ORDER_CANCEL);

    return { canServe, canCancel, canDelete: isOwnerDeleteRole };
  };

  const runOrderAction = async (action) => {
    setActionError('');
    try {
      await action();
      await load();
    } catch (error) {
      setActionError(error?.response?.data?.message || 'Action failed. Please check your permission and try again.');
    }
  };

  const printStationTickets = async (order) => {
    setActionError('');
    try {
      await openStationTicketsPdfTab(order);
    } catch (error) {
      setActionError(error?.message || 'Unable to open station tickets');
    }
  };

  const openCancellation = (order) => {
    setActionError('');
    setCancellationError('');
    setCancellationOrder(order);
  };

  const confirmCancellation = async ({ mode, reason, items }) => {
    if (!cancellationOrder) return;
    setCancellationBusy(true);
    setCancellationError('');
    try {
      if (mode === 'ORDER') {
        await orderService.cancel(cancellationOrder._id, reason);
      } else {
        await orderService.cancelItems(cancellationOrder._id, items, reason);
      }
      await load(filtersRef.current);
      setCancellationOrder(null);
    } catch (error) {
      setCancellationError(error?.response?.data?.message || 'Cancellation failed. Please try again.');
    } finally {
      setCancellationBusy(false);
    }
  };

  const renderItemProgress = (order, compact = false) => {
    const isExpanded = Boolean(expandedItemsByOrder[order._id]);
    const visibleItems = isExpanded ? order.items : order.items.slice(0, 3);
    const hiddenCount = Math.max(0, order.items.length - 3);

    return (
      <ul className={compact ? 'mt-3 space-y-2 text-sm' : 'min-w-[320px] space-y-2'}>
        {visibleItems.map((item, i) => {
          const ready = Number(item.readyQuantity || 0);
          const served = Number(item.servedQuantity || 0);
          return (
            <li
              key={`${item.name}-${i}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
            >
              <span className="min-w-0 text-slate-800">
                <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-slate-700 shadow-sm">
                  {item.quantity}x
                </span>
                <span className="font-semibold">{item.name}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-slate-500">
                R {ready}/{item.quantity} · {order.orderType === 'TAKEAWAY' ? 'P' : 'S'} {served}/{item.quantity}
              </span>
            </li>
          );
        })}
        {!isExpanded && hiddenCount > 0 ? (
          <li>
            <button
              type="button"
              className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 hover:text-sky-900"
              onClick={() => setExpandedItemsByOrder((prev) => ({ ...prev, [order._id]: true }))}
            >
              +{hiddenCount} more
            </button>
          </li>
        ) : null}
        {isExpanded && order.items.length > 3 ? (
          <li>
            <button
              type="button"
              className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-800"
              onClick={() => setExpandedItemsByOrder((prev) => ({ ...prev, [order._id]: false }))}
            >
              Show less
            </button>
          </li>
        ) : null}
      </ul>
    );
  };

  const orderStats = useMemo(() => {
    const activeStatuses = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED']);
    return {
      total: orders.length,
      active: orders.filter((order) => activeStatuses.has(order.status)).length,
      completed: orders.filter((order) => order.status === 'COMPLETED').length,
      cancelled: orders.filter((order) => order.status === 'CANCELLED').length,
      revenue: orders
        .filter((order) => order.status !== 'CANCELLED')
        .reduce((sum, order) => sum + Number(order.total || 0), 0)
    };
  }, [orders]);

  const renderOrderActions = (order, compact = false) => (
    <div className={compact ? 'mt-4 grid grid-cols-2 gap-2' : 'flex flex-col gap-2 xl:flex-row xl:flex-wrap'}>
      <Button
        variant="secondary"
        size="sm"
        className={compact ? 'min-h-11' : 'whitespace-nowrap'}
        onClick={() => printStationTickets(order)}
      >
        Print Tickets
      </Button>
      {getAllowedActions(order).canServe ? (
        <Button
          variant="success"
          size="sm"
          className={compact ? 'min-h-11' : 'whitespace-nowrap'}
          onClick={() => runOrderAction(async () => {
            const itemIndex = order.items.findIndex(
              (item) => Number(item.servedQuantity || 0) < Number(item.readyQuantity || 0)
            );
            if (itemIndex < 0) return;
            await orderService.updateStatus(order._id, 'SERVED', { itemIndex, quantity: 1 });
          })}
        >
          {order.orderType === 'TAKEAWAY' ? 'Pack' : 'Serve'}
        </Button>
      ) : null}
      {getAllowedActions(order).canCancel ? (
        <Button
          variant="danger"
          size="sm"
          className={compact ? 'col-span-2 min-h-11' : 'whitespace-nowrap'}
          onClick={() => openCancellation(order)}
        >
          Cancel
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      <Panel
        title="Find Orders"
        subtitle="Search by order, table, status, or service type."
        right={
          <Link
            to="/orders/create"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-200/70 transition hover:from-brand-600 hover:to-brand-700"
          >
            New Order
          </Link>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <Input
            label="Search"
            placeholder="Order number or item"
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          />
          <Select
            label="Status"
            value={filters.status}
            options={[{ label: 'All Statuses', value: '' }, ...ORDER_STATUSES.map((x) => ({ label: x, value: x }))]}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          />
          <Select
            label="Type"
            value={filters.orderType}
            options={[{ label: 'All Types', value: '' }, ...ORDER_TYPES.map((x) => ({ label: x, value: x }))]}
            onChange={(e) => setFilters((p) => ({ ...p, orderType: e.target.value }))}
          />
          <Select
            label="Table"
            value={filters.table}
            options={[
              { label: 'All Tables', value: '' },
              ...tables.map((table) => ({ label: table.tableNumber, value: table._id }))
            ]}
            onChange={(e) => setFilters((p) => ({ ...p, table: e.target.value }))}
          />
          <div className="flex items-end">
            <Button
              className="min-h-11 w-full"
              onClick={async () => {
                const params = new URLSearchParams();
                if (filters.table) {
                  params.set('table', filters.table);
                  if (selectedTable?.tableNumber) params.set('tableNumber', selectedTable.tableNumber);
                }
                setSearchParams(params, { replace: true });
                await load(filters);
              }}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Orders"
        subtitle="Live order history with station ticket reprint and service actions."
        right={
          <div className="grid grid-cols-2 gap-2 text-right sm:flex sm:flex-wrap sm:justify-end">
            {[
              ['Total', orderStats.total, 'bg-slate-50 text-slate-800'],
              ['Active', orderStats.active, 'bg-amber-50 text-amber-800'],
              ['Completed', orderStats.completed, 'bg-emerald-50 text-emerald-800'],
              ['Sales', currency(orderStats.revenue), 'bg-cyan-50 text-cyan-800']
            ].map(([label, value, tone]) => (
              <div key={label} className={`rounded-2xl border border-white px-4 py-2 shadow-sm ${tone}`}>
                <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</p>
                <p className="text-base font-extrabold">{value}</p>
              </div>
            ))}
          </div>
        }
      >
        {actionError ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {actionError}
          </div>
        ) : null}
        {filters.table ? (
          <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
            <p className="text-sm font-semibold text-sky-900">
              Viewing orders for table {selectedTable?.tableNumber || initialTableLabel || 'selected table'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link
                to={`/orders/create?table=${filters.table}&tableNumber=${encodeURIComponent(selectedTable?.tableNumber || initialTableLabel || '')}`}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                New Order For This Table
              </Link>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  setFilters((prev) => ({ ...prev, table: '' }));
                  setSearchParams({}, { replace: true });
                  await load({ ...filters, table: '' });
                }}
              >
                Clear Table Filter
              </Button>
            </div>
          </div>
        ) : null}

        <div className="hidden overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm md:block">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px] text-sm">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[8%]" />
              <col className="w-[13%]" />
              <col className="w-[30%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead className="bg-gradient-to-r from-brand-50 via-white to-secondary-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-4">Order</th>
                <th className="px-4 py-4">Service</th>
                <th className="px-4 py-4">Attended By</th>
                <th className="px-4 py-4">Ordered Items</th>
                <th className="px-4 py-4 text-right">Total</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Created</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100/70">
              {orders.map((order) => (
                <tr key={order._id} className="align-top transition hover:bg-brand-50/35">
                  <td className="px-4 py-4">
                    <p className="font-display text-base font-bold text-slate-900">{order.orderNumber}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {order.items.length} item{order.items.length === 1 ? '' : 's'}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-2">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {order.orderType.replaceAll('_', ' ')}
                      </span>
                      <p className="text-sm font-bold text-slate-900">{order.table?.tableNumber || 'No table'}</p>
                    </div>
                  </td>
                  <td className="max-w-[220px] px-4 py-4">
                    <p className="font-semibold text-slate-800">{attendedByLabel(order).replace(/\s\([^)]+\)$/, '')}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {order.createdBy?.role ? String(order.createdBy.role).replaceAll('_', ' ') : 'Staff'}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    {renderItemProgress(order)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="font-display text-base font-extrabold text-slate-900">{currency(order.total)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge value={order.orderType === 'TAKEAWAY' && order.status === 'SERVED' ? 'PACKED' : order.status} />
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-700">{formatDateTime(order.createdAt)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end">{renderOrderActions(order)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {!orders.length ? <p className="p-5 text-center text-sm text-slate-500">No orders found</p> : null}
        </div>

        <div className="space-y-3 md:hidden">
          {orders.map((order) => (
            <article key={order._id} className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-base font-bold text-slate-900">{order.orderNumber}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {order.orderType.replaceAll('_', ' ')} {order.table?.tableNumber ? `· ${order.table.tableNumber}` : ''}
                  </p>
                </div>
                <StatusBadge value={order.orderType === 'TAKEAWAY' && order.status === 'SERVED' ? 'PACKED' : order.status} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-400">Attended</p>
                  <p className="mt-1 font-semibold text-slate-800">{attendedByLabel(order)}</p>
                </div>
                <div className="rounded-xl bg-brand-50 p-3 text-right">
                  <p className="text-xs font-bold uppercase text-brand-500">Total</p>
                  <p className="mt-1 font-display text-lg font-extrabold text-brand-800">{currency(order.total)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">{formatDateTime(order.createdAt)}</p>

              {renderItemProgress(order, true)}

              {renderOrderActions(order, true)}
            </article>
          ))}
          {!orders.length ? <p className="rounded-xl bg-white p-5 text-center text-sm text-slate-500">No orders found</p> : null}
        </div>
      </Panel>
      {cancellationOrder ? (
        <OrderCancellationDialog
          order={cancellationOrder}
          busy={cancellationBusy}
          error={cancellationError}
          onClose={() => {
            if (cancellationBusy) return;
            setCancellationOrder(null);
            setCancellationError('');
          }}
          onConfirm={confirmCancellation}
        />
      ) : null}
    </div>
  );
};

export default OrdersPage;
