import { useEffect, useMemo, useState } from 'react';
import { orderService } from '../api/services';
import Button from '../components/ui/Button';
import Panel from '../components/ui/Panel';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { formatDateTime } from '../utils/format';

const orderAgeLabel = (value) => {
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '-';
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m ago`;
};

const byCreatedOldestFirst = (a, b) => new Date(a.createdAt) - new Date(b.createdAt);
const byCreatedNewestFirst = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
const byUpdatedNewestFirst = (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
const byOrderCreatedOldestFirst = (a, b) => new Date(a.orderCreatedAt) - new Date(b.orderCreatedAt);
const isItemFullyReady = (item) => Number(item.readyQuantity || 0) >= Number(item.quantity || 0);
const isItemFullyServed = (item) => Number(item.servedQuantity || 0) >= Number(item.quantity || 0);
const ACTIVE_ORDER_STATUSES = ['PENDING', 'PREPARING', 'READY', 'SERVED'];
const isTakeawayOrder = (order) => order?.orderType === 'TAKEAWAY';
const displayOrderStatus = (order) => (
  isTakeawayOrder(order) && order.status === 'SERVED' ? 'PACKED' : order.status
);

const KitchenOrderCard = ({ order, activeCountByTable, updatingId, onPreparing, onReadyItem, onServeItem, allowServeActions }) => (
  <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-slate-500">{order.orderNumber}</p>
        <h3 className="text-base font-bold text-slate-800 sm:text-lg">
          {order.orderType} {order.table?.tableNumber ? `- ${order.table.tableNumber}` : ''}
        </h3>
        {order.table?.tableNumber && activeCountByTable[order.table.tableNumber] > 1 ? (
          <p className="text-xs font-semibold text-amber-700">
            Same table queue: {activeCountByTable[order.table.tableNumber]} active
          </p>
        ) : null}
      </div>
      <StatusBadge value={displayOrderStatus(order)} />
    </div>

    <ul className="space-y-2">
      {order.items.map((item) => (
        <li key={item.orderItemIndex} className="rounded-lg border border-slate-200 p-2">
          <p className="font-semibold text-slate-800">{item.quantity} x {item.name}</p>
          <p className="text-xs text-slate-500">
            Ready: {Number(item.readyQuantity || 0)}/{item.quantity} | {isTakeawayOrder(order) ? 'Packed' : 'Served'}: {Number(item.servedQuantity || 0)}/{item.quantity}
          </p>
          {item.notes ? <p className="text-xs text-slate-500">Note: {item.notes}</p> : null}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Button
              variant="success"
              size="sm"
              disabled={(order.status !== 'PREPARING' && order.status !== 'READY') || Number(item.readyQuantity || 0) >= Number(item.quantity || 0) || updatingId === order._id}
              onClick={() => onReadyItem(order._id, item.orderItemIndex)}
            >
              +1 Ready
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!allowServeActions || (order.status !== 'READY' && order.status !== 'SERVED') || Number(item.servedQuantity || 0) >= Number(item.readyQuantity || 0) || updatingId === order._id}
              onClick={() => onServeItem(order._id, item.orderItemIndex)}
            >
              +1 {isTakeawayOrder(order) ? 'Packed' : 'Served'}
            </Button>
          </div>
        </li>
      ))}
    </ul>

    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
      <p>Placed: {formatDateTime(order.createdAt)}</p>
      <p className="text-right">Age: {orderAgeLabel(order.createdAt)}</p>
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      <Button
        variant="primary"
        className="py-2.5 text-sm"
        disabled={order.status !== 'PENDING' || updatingId === order._id}
        onClick={() => onPreparing(order._id)}
      >
        Mark Preparing
      </Button>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs text-slate-600">
        Mark dishes one by one using +1 Ready / +1 {isTakeawayOrder(order) ? 'Packed' : 'Served'}.
      </div>
    </div>
  </article>
);

const ReadyDishCard = ({ dish, updatingId, onServeItem, allowServeActions }) => (
  <article className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-xs font-semibold text-cyan-800">{dish.orderNumber}</p>
        <p className="text-sm font-bold text-slate-800">
          {dish.orderType} {dish.tableNumber ? `- ${dish.tableNumber}` : ''}
        </p>
      </div>
    </div>
    <p className="mt-2 text-sm font-semibold text-slate-800">{dish.remainingToServe} x {dish.itemName}</p>
    <p className="text-xs text-slate-600">
      Ready: {dish.readyQuantity}/{dish.quantity} | {dish.orderType === 'TAKEAWAY' ? 'Packed' : 'Served'}: {dish.servedQuantity}/{dish.quantity}
    </p>
    {allowServeActions ? (
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={updatingId === dish.orderId || dish.remainingToServe <= 0}
        onClick={() => onServeItem(dish.orderId, dish.itemIndex)}
      >
        {dish.orderType === 'TAKEAWAY' ? 'Pack' : 'Serve'}
      </Button>
    ) : null}
  </article>
);

const humanizeOrderType = (value) => String(value || '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const CompletedOrderCard = ({ order, stationLabel }) => {
  const completedAt = order.updatedAt || order.createdAt;
  const completedItems = order.stationMeta.completedItems.length
    ? order.stationMeta.completedItems
    : order.items;
  const totalQuantity = completedItems.reduce(
    (sum, item) => sum + Number(item.servedQuantity || item.quantity || 0),
    0
  );

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md">
      <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-300 to-secondary-900" />
      <div className="p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-slate-900">{order.orderNumber}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                {humanizeOrderType(order.orderType)}
              </span>
              {order.table?.tableNumber ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 ring-1 ring-inset ring-amber-200">
                  Table {order.table.tableNumber}
                </span>
              ) : null}
              <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700 ring-1 ring-inset ring-sky-200">
                {stationLabel}
              </span>
            </div>
          </div>
          <StatusBadge value="COMPLETED" />
        </header>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Completed items</p>
            <p className="text-xs font-semibold text-slate-500">
              {totalQuantity} item{totalQuantity === 1 ? '' : 's'}
            </p>
          </div>
          <ul className="divide-y divide-slate-100 bg-white">
            {completedItems.map((item) => {
              const completedQuantity = Number(item.servedQuantity || item.quantity || 0);
              return (
                <li key={item._id || item.orderItemIndex} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                    {item.notes ? <p className="mt-0.5 truncate text-xs text-slate-500">Note: {item.notes}</p> : null}
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {completedQuantity}/{Number(item.quantity || 0)} done
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-slate-100 pt-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Completed at</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-700">{formatDateTime(completedAt)}</p>
          </div>
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            {orderAgeLabel(completedAt)}
          </span>
        </footer>
      </div>
    </article>
  );
};

const stationConfig = {
  FOOD: {
    title: 'Kitchen Display',
    stationLabel: 'Kitchen',
    emptyLabel: 'No kitchen orders available.'
  },
  BAR: {
    title: 'Bar Display',
    stationLabel: 'Bar',
    emptyLabel: 'No bar orders available.'
  },
  SMOKE: {
    title: 'Smoke Display',
    stationLabel: 'Smoke',
    emptyLabel: 'No smoke orders available.'
  }
};

const KitchenPage = ({ station = 'FOOD' }) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [updatingId, setUpdatingId] = useState('');
  const config = stationConfig[station] || stationConfig.FOOD;
  const allowServeActions = !['KITCHEN', 'BARISTA'].includes(user?.role);

  const load = async () => {
    const data = await orderService.list();
    setOrders(data);
  };

  useEffect(() => {
    load();
  }, []);

  useAutoRefresh(load);

  const stationOrders = useMemo(() => {
    return orders
      .map((order) => ({
        ...order,
        items: (order.items || [])
          .map((item, itemIndex) => ({ ...item, orderItemIndex: itemIndex }))
          .filter((item) => item.kitchenSection === station)
      }))
      .filter((order) => order.items.length > 0);
  }, [orders, station]);

  const stationOrderMeta = useMemo(() => {
    return stationOrders.map((order) => {
      const globallyClosed = ['COMPLETED', 'CANCELLED'].includes(order.status);
      const globallyCompleted = order.status === 'COMPLETED';
      const isCancelled = order.status === 'CANCELLED';
      const allServed = order.items.every(isItemFullyServed);
      const allReady = order.items.every(isItemFullyReady);
      const anyReadyToServe = order.items.some(
        (item) => Number(item.readyQuantity || 0) > Number(item.servedQuantity || 0)
      );
      const anyUnready = order.items.some((item) => !isItemFullyReady(item));
      const isPending = !globallyClosed && order.status === 'PENDING' && !anyReadyToServe && anyUnready;
      const isPreparing = !globallyClosed && ACTIVE_ORDER_STATUSES.includes(order.status) && !allServed && !isPending && anyUnready;
      const isCompletedForStation = !isCancelled && (globallyCompleted || allServed);
      const completedItems = order.items.filter((item) => Number(item.servedQuantity || 0) > 0);

      return {
        ...order,
        stationMeta: {
          allServed,
          allReady,
          anyReadyToServe,
          anyUnready,
          globallyClosed,
          isCancelled,
          isPending,
          isPreparing,
          isCompletedForStation,
          completedItems
        }
      };
    });
  }, [stationOrders]);

  const pendingOrders = useMemo(
    () => stationOrderMeta.filter((x) => x.stationMeta.isPending).sort(byCreatedNewestFirst),
    [stationOrderMeta]
  );
  const preparingOrders = useMemo(
    () => stationOrderMeta.filter((x) => x.stationMeta.isPreparing).sort(byCreatedOldestFirst),
    [stationOrderMeta]
  );
  const readyDishes = useMemo(() => {
    const rows = [];
    stationOrderMeta.forEach((order) => {
      if (!order.stationMeta.anyReadyToServe) return;
      order.items.forEach((item) => {
        const readyQuantity = Number(item.readyQuantity || 0);
        const servedQuantity = Number(item.servedQuantity || 0);
        const remainingToServe = Math.max(0, readyQuantity - servedQuantity);
        if (remainingToServe <= 0) return;
        rows.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          tableNumber: order.table?.tableNumber || '',
          orderStatus: order.status,
          orderCreatedAt: order.createdAt,
          itemIndex: item.orderItemIndex,
          itemName: item.name,
          quantity: Number(item.quantity || 0),
          readyQuantity,
          servedQuantity,
          remainingToServe
        });
      });
    });
    return rows.sort(byOrderCreatedOldestFirst);
  }, [stationOrderMeta]);
  const completedOrders = useMemo(
    () =>
      stationOrderMeta
        .filter((x) => x.stationMeta.isCompletedForStation)
        .sort(byUpdatedNewestFirst)
        .slice(0, 12),
    [stationOrderMeta]
  );
  const activeOrders = useMemo(
    () => stationOrderMeta.filter((x) => !x.stationMeta.globallyClosed && !x.stationMeta.isCompletedForStation),
    [stationOrderMeta]
  );

  const activeCountByTable = useMemo(() => {
    return activeOrders.reduce((acc, order) => {
      const key = order.table?.tableNumber;
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [activeOrders]);

  const updateStatus = async (id, status, extra = {}) => {
    setUpdatingId(id);
    try {
      await orderService.updateStatus(id, status, extra);
      await load();
    } finally {
      setUpdatingId('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{config.title}</h2>
          <p className="text-xs text-slate-500">Auto-refresh every 15 seconds</p>
        </div>
        <Button onClick={load}>Refresh</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-amber-800">New / Recent</p>
          <p className="text-xl font-bold text-amber-900">{pendingOrders.length}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-indigo-800">Preparing</p>
          <p className="text-xl font-bold text-indigo-900">{preparingOrders.length}</p>
        </div>
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-cyan-800">Ready</p>
          <p className="text-xl font-bold text-cyan-900">{readyDishes.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-emerald-800">Recent Completed</p>
          <p className="text-xl font-bold text-emerald-900">{completedOrders.length}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={`Ready Orders (${readyDishes.length})`} subtitle="Complete ready dishes first">
          <div className="space-y-3">
            {readyDishes.map((dish) => (
              <ReadyDishCard
                key={`${dish.orderId}-${dish.itemIndex}`}
                dish={dish}
                updatingId={updatingId}
                allowServeActions={allowServeActions}
                onServeItem={(id, itemIndex) => updateStatus(id, 'SERVED', { itemIndex, quantity: 1 })}
              />
            ))}
            {!readyDishes.length ? <p className="rounded-xl bg-cyan-50 p-4 text-sm text-cyan-800">No ready dishes.</p> : null}
          </div>
        </Panel>

        <Panel title={`Preparing Orders (${preparingOrders.length})`} subtitle="Work in progress">
          <div className="space-y-3">
            {preparingOrders.map((order) => (
              <KitchenOrderCard
                key={order._id}
                order={order}
                activeCountByTable={activeCountByTable}
                updatingId={updatingId}
                allowServeActions={allowServeActions}
                onPreparing={(id) => updateStatus(id, 'PREPARING')}
                onReadyItem={(id, itemIndex) => updateStatus(id, 'READY', { itemIndex, quantity: 1 })}
                onServeItem={(id, itemIndex) => updateStatus(id, 'SERVED', { itemIndex, quantity: 1 })}
              />
            ))}
            {!preparingOrders.length ? <p className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-800">No preparing orders.</p> : null}
          </div>
        </Panel>

        <Panel title={`Recent New Orders (${pendingOrders.length})`} subtitle="Latest incoming orders">
          <div className="space-y-3">
            {pendingOrders.map((order) => (
              <KitchenOrderCard
                key={order._id}
                order={order}
                activeCountByTable={activeCountByTable}
                updatingId={updatingId}
                allowServeActions={allowServeActions}
                onPreparing={(id) => updateStatus(id, 'PREPARING')}
                onReadyItem={(id, itemIndex) => updateStatus(id, 'READY', { itemIndex, quantity: 1 })}
                onServeItem={(id, itemIndex) => updateStatus(id, 'SERVED', { itemIndex, quantity: 1 })}
              />
            ))}
            {!pendingOrders.length ? <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">No new orders.</p> : null}
          </div>
        </Panel>
      </div>

      <Panel
        title={`Recently Completed Orders (${completedOrders.length})`}
        subtitle={`Latest ${config.stationLabel.toLowerCase()} tickets, newest first`}
        right={completedOrders.length ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            Latest {completedOrders.length} ticket{completedOrders.length === 1 ? '' : 's'} · up to 12 shown
          </span>
        ) : null}
      >
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {completedOrders.map((order) => (
            <CompletedOrderCard key={order._id} order={order} stationLabel={config.stationLabel} />
          ))}
          {!completedOrders.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center lg:col-span-2 xl:col-span-3 2xl:col-span-5">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">✓</div>
              <p className="mt-3 text-sm font-bold text-slate-700">No completed {config.stationLabel.toLowerCase()} orders yet</p>
              <p className="mt-1 text-xs text-slate-500">Finished tickets will appear here automatically.</p>
            </div>
          ) : null}
        </div>
      </Panel>

      {!activeOrders.length && !completedOrders.length ? (
        <p className="rounded-xl bg-white p-6 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
          {config.emptyLabel}
        </p>
      ) : null}
    </div>
  );
};

export default KitchenPage;
