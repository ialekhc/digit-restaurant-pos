import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { orderService, tableService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { ORDER_STATUSES, ORDER_TYPES } from '../utils/constants';
import { currency, formatDateTime } from '../utils/format';

const OrdersPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTableFilter = searchParams.get('table') || '';
  const initialTableLabel = searchParams.get('tableNumber') || '';

  const [orders, setOrders] = useState([]);
  const [tables, setTables] = useState([]);
  const [expandedItemsByOrder, setExpandedItemsByOrder] = useState({});
  const [filters, setFilters] = useState({
    status: '',
    orderType: '',
    search: '',
    table: initialTableFilter
  });

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

  const selectedTable = useMemo(() => {
    return tables.find((table) => table._id === filters.table);
  }, [tables, filters.table]);

  const getAllowedActions = (order) => {
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return { canServe: false, canCancel: false };
    }

    const canServe =
      user?.role !== 'KITCHEN' &&
      order.items.some((item) => Number(item.servedQuantity || 0) < Number(item.readyQuantity || 0));
    const canCancel = user?.role !== 'KITCHEN';

    return { canServe, canCancel };
  };

  const renderItemProgress = (order, compact = false) => {
    const isExpanded = Boolean(expandedItemsByOrder[order._id]);
    const visibleItems = isExpanded ? order.items : order.items.slice(0, 3);
    const hiddenCount = Math.max(0, order.items.length - 3);

    return (
      <ul className={compact ? 'mt-2 space-y-1 text-sm' : 'space-y-1'}>
        {visibleItems.map((item, i) => {
          const ready = Number(item.readyQuantity || 0);
          const served = Number(item.servedQuantity || 0);
          return (
            <li key={`${item.name}-${i}`}>
              {item.quantity} x {item.name}
              <span className="ml-1 text-xs text-slate-500">(R {ready}/{item.quantity}, S {served}/{item.quantity})</span>
            </li>
          );
        })}
        {!isExpanded && hiddenCount > 0 ? (
          <li>
            <button
              type="button"
              className="text-xs font-semibold text-sky-700 hover:text-sky-900"
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
              className="text-xs font-semibold text-slate-600 hover:text-slate-800"
              onClick={() => setExpandedItemsByOrder((prev) => ({ ...prev, [order._id]: false }))}
            >
              Show less
            </button>
          </li>
        ) : null}
      </ul>
    );
  };

  return (
    <div className="space-y-5">
      <Panel title="Order Filters">
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
              className="w-full"
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

      <Panel title="Orders">
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

        <div className="hidden overflow-x-auto md:block">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Order #</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Table</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2 font-semibold">{order.orderNumber}</td>
                  <td className="px-3 py-2">{order.orderType}</td>
                  <td className="px-3 py-2">{order.table?.tableNumber || '-'}</td>
                  <td className="px-3 py-2">{order.customer?.name || '-'}</td>
                  <td className="px-3 py-2">
                    {renderItemProgress(order)}
                  </td>
                  <td className="px-3 py-2">{currency(order.total)}</td>
                  <td className="px-3 py-2"><StatusBadge value={order.status} /></td>
                  <td className="px-3 py-2">{formatDateTime(order.createdAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {getAllowedActions(order).canServe ? (
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          onClick={async () => {
                            const itemIndex = order.items.findIndex(
                              (item) => Number(item.servedQuantity || 0) < Number(item.readyQuantity || 0)
                            );
                            if (itemIndex < 0) return;
                            await orderService.updateStatus(order._id, 'SERVED', { itemIndex, quantity: 1 });
                            load();
                          }}
                        >
                          Serve
                        </Button>
                      ) : null}
                      {getAllowedActions(order).canCancel ? (
                        <Button
                          variant="danger"
                          className="px-2 py-1 text-xs"
                          onClick={async () => {
                            const reason = window.prompt('Cancel reason (optional):') || '';
                            await orderService.cancel(order._id, reason);
                            load();
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!orders.length ? <p className="p-5 text-center text-sm text-slate-500">No orders found</p> : null}
        </div>

        <div className="space-y-3 md:hidden">
          {orders.map((order) => (
            <article key={order._id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">{order.orderNumber}</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {order.orderType} {order.table?.tableNumber ? `- ${order.table.tableNumber}` : ''}
                  </p>
                </div>
                <StatusBadge value={order.status} />
              </div>

              <div className="mt-2 text-sm text-slate-700">
                <p>Customer: {order.customer?.name || '-'}</p>
                <p>Total: {currency(order.total)}</p>
                <p>Created: {formatDateTime(order.createdAt)}</p>
              </div>

              {renderItemProgress(order, true)}

              <div className="mt-3 flex flex-wrap gap-2">
                {getAllowedActions(order).canServe ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const itemIndex = order.items.findIndex(
                        (item) => Number(item.servedQuantity || 0) < Number(item.readyQuantity || 0)
                      );
                      if (itemIndex < 0) return;
                      await orderService.updateStatus(order._id, 'SERVED', { itemIndex, quantity: 1 });
                      load();
                    }}
                  >
                    Serve
                  </Button>
                ) : null}
                {getAllowedActions(order).canCancel ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      const reason = window.prompt('Cancel reason (optional):') || '';
                      await orderService.cancel(order._id, reason);
                      load();
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
          {!orders.length ? <p className="rounded-xl bg-white p-5 text-center text-sm text-slate-500">No orders found</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default OrdersPage;
