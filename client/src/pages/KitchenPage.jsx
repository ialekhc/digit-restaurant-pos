import { useEffect, useMemo, useState } from 'react';
import { orderService } from '../api/services';
import Button from '../components/ui/Button';
import Panel from '../components/ui/Panel';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
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
      <StatusBadge value={order.status} />
    </div>

    <ul className="space-y-2">
      {order.items.map((item) => (
        <li key={item.orderItemIndex} className="rounded-lg border border-slate-200 p-2">
          <p className="font-semibold text-slate-800">{item.quantity} x {item.name}</p>
          <p className="text-xs text-slate-500">
            Ready: {Number(item.readyQuantity || 0)}/{item.quantity} | Served: {Number(item.servedQuantity || 0)}/{item.quantity}
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
              +1 Served
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
        Mark dishes one by one using +1 Ready / +1 Served.
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
      Ready: {dish.readyQuantity}/{dish.quantity} | Served: {dish.servedQuantity}/{dish.quantity}
    </p>
    {allowServeActions ? (
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={updatingId === dish.orderId || dish.remainingToServe <= 0}
        onClick={() => onServeItem(dish.orderId, dish.itemIndex)}
      >
        Serve
      </Button>
    ) : null}
  </article>
);

const stationConfig = {
  FOOD: {
    title: 'Kitchen Display',
    emptyLabel: 'No kitchen orders available.'
  },
  BAR: {
    title: 'Bar Display',
    emptyLabel: 'No bar orders available.'
  },
  SMOKE: {
    title: 'Smoke Display',
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
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

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
      const allServed = order.items.every(isItemFullyServed);
      const allReady = order.items.every(isItemFullyReady);
      const anyReadyToServe = order.items.some(
        (item) => Number(item.readyQuantity || 0) > Number(item.servedQuantity || 0)
      );
      const anyUnready = order.items.some((item) => !isItemFullyReady(item));
      const isPending = !globallyClosed && order.status === 'PENDING' && !anyReadyToServe && anyUnready;
      const isPreparing = !globallyClosed && ACTIVE_ORDER_STATUSES.includes(order.status) && !allServed && !isPending && anyUnready;
      const isCompletedForStation = globallyClosed || allServed;
      const completedItems = order.items.filter((item) => Number(item.servedQuantity || 0) > 0);

      return {
        ...order,
        stationMeta: {
          allServed,
          allReady,
          anyReadyToServe,
          anyUnready,
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
    () => stationOrderMeta.filter((x) => !x.stationMeta.isCompletedForStation),
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
        <Panel title={`Ready Orders (${readyDishes.length})`} subtitle="Serve ready dishes first">
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

      <Panel title="Recently Completed Orders" subtitle="Most recent completed tickets">
        <div className="space-y-2">
          {completedOrders.map((order) => (
            <article key={order._id} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-emerald-900">{order.orderNumber}</p>
                  <p className="text-xs text-emerald-800">
                    {order.orderType} {order.table?.tableNumber ? `- ${order.table.tableNumber}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-emerald-900">
                    Items: {order.stationMeta.completedItems.length
                      ? order.stationMeta.completedItems.map((item) => `${item.servedQuantity}/${item.quantity} ${item.name}`).join(', ')
                      : order.items.map((item) => `${item.quantity} ${item.name}`).join(', ')}
                  </p>
                </div>
                <StatusBadge value="COMPLETED" />
              </div>
              <p className="mt-1 text-xs text-emerald-800">
                Completed: {formatDateTime(order.updatedAt || order.createdAt)} ({orderAgeLabel(order.updatedAt || order.createdAt)})
              </p>
            </article>
          ))}
          {!completedOrders.length ? (
            <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">No completed orders yet.</p>
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
