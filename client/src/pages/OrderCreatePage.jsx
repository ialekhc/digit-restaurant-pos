import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { customerService, menuService, orderService, planService, tableService } from '../api/services';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { FEATURE_KEYS, ORDER_TYPES } from '../utils/constants';
import { currency } from '../utils/format';

const initialState = {
  orderType: 'DINE_IN',
  table: '',
  customer: '',
  discount: 0
};

const activeFlowStatuses = ['PENDING', 'PREPARING', 'READY', 'SERVED'];

const OrderCreatePage = () => {
  const [searchParams] = useSearchParams();
  const tableFromUrl = searchParams.get('table') || '';
  const tableNumberFromUrl = searchParams.get('tableNumber') || '';
  const didApplyTableContext = useRef(false);

  const [tables, setTables] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [enabledFeatures, setEnabledFeatures] = useState(new Set());
  const [orderState, setOrderState] = useState(initialState);
  const [selectedMenu, setSelectedMenu] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [tableData, customerData, menuData, orderData, activePlan] = await Promise.all([
      tableService.list(),
      customerService.list(),
      menuService.list({ available: true }),
      orderService.list({ orderType: 'DINE_IN' }),
      planService.active()
    ]);
    setTables(tableData);
    setCustomers(customerData);
    setMenuItems(menuData);
    setOrders(orderData);
    setEnabledFeatures(new Set(activePlan?.enabledFeatureKeys || []));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!tableFromUrl || !tables.length || didApplyTableContext.current) return;
    const hasTable = tables.some((table) => table._id === tableFromUrl);
    if (hasTable) {
      setOrderState((prev) => ({
        ...prev,
        orderType: 'DINE_IN',
        table: tableFromUrl
      }));
    }
    didApplyTableContext.current = true;
  }, [tables, tableFromUrl]);

  useEffect(() => {
    if (orderState.orderType !== 'DINE_IN' && orderState.table) {
      setOrderState((prev) => ({ ...prev, table: '' }));
    }
  }, [orderState.orderType, orderState.table]);

  const selectableTables = useMemo(() => {
    return tables.filter((table) => !['RESERVED', 'CLEANING'].includes(table.status));
  }, [tables]);

  const selectedTableActiveOrders = useMemo(() => {
    if (!orderState.table) return [];
    return orders.filter(
      (order) => order.table?._id === orderState.table && activeFlowStatuses.includes(order.status)
    );
  }, [orders, orderState.table]);

  const orderTypeOptions = useMemo(() => {
    if (!enabledFeatures.size) return ORDER_TYPES;
    return ORDER_TYPES.filter((type) => {
      if (type === 'DINE_IN') return enabledFeatures.has(FEATURE_KEYS.DINE_IN_ORDERS);
      if (type === 'TAKEAWAY') return enabledFeatures.has(FEATURE_KEYS.TAKEAWAY_ORDERS);
      if (type === 'DELIVERY') return enabledFeatures.has(FEATURE_KEYS.DELIVERY_ORDER_MANAGEMENT);
      return false;
    });
  }, [enabledFeatures]);

  useEffect(() => {
    if (!orderTypeOptions.length) return;
    if (!orderTypeOptions.includes(orderState.orderType)) {
      setOrderState((prev) => ({ ...prev, orderType: orderTypeOptions[0] }));
    }
  }, [orderTypeOptions, orderState.orderType]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - Number(orderState.discount || 0));
  }, [subtotal, orderState.discount]);

  const addItem = () => {
    setError('');
    setSuccess('');
    if (!selectedMenu) return;
    const menuItem = menuItems.find((x) => x._id === selectedMenu);
    if (!menuItem) return;

    setItems((prev) => {
      const index = prev.findIndex((x) => x.menuItem === menuItem._id && x.notes === notes);
      if (index >= 0) {
        const clone = [...prev];
        clone[index] = { ...clone[index], quantity: clone[index].quantity + Number(quantity) };
        return clone;
      }
      return [
        ...prev,
        {
          menuItem: menuItem._id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: Number(quantity),
          notes
        }
      ];
    });

    setSelectedMenu('');
    setQuantity(1);
    setNotes('');
  };

  const submitOrder = async () => {
    setError('');
    setSuccess('');
    if (!items.length) {
      setError('Please add at least one item');
      return;
    }

    if (orderState.orderType === 'DINE_IN' && !orderState.table) {
      setError('Table is required for dine-in order');
      return;
    }

    setSaving(true);
    try {
      const created = await orderService.create({
        ...orderState,
        table: orderState.table || undefined,
        customer: orderState.customer || undefined,
        items,
        discount: Number(orderState.discount || 0)
      });
      setItems([]);
      setSelectedMenu('');
      setQuantity(1);
      setNotes('');
      setOrderState((prev) => ({
        ...prev,
        discount: 0
      }));
      setSuccess(
        `Order ${created.orderNumber} has been placed and sent to kitchen. You can add another new order for the same table.`
      );
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Create New Order" subtitle="Waiter can create dine-in, takeaway, and delivery orders">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Order Type"
            value={orderState.orderType}
            options={orderTypeOptions.map((x) => ({ label: x, value: x }))}
            onChange={(e) => setOrderState((p) => ({ ...p, orderType: e.target.value }))}
          />

          <Select
            label="Table"
            value={orderState.table}
            options={[{ label: 'No table', value: '' }].concat(
              selectableTables.map((t) => {
                const activeOrders = orders.filter(
                  (order) => order.table?._id === t._id && activeFlowStatuses.includes(order.status)
                ).length;
                return {
                  label: `${t.tableNumber} (${t.status}${activeOrders ? `, ${activeOrders} active` : ''})`,
                  value: t._id
                };
              })
            )}
            onChange={(e) => setOrderState((p) => ({ ...p, table: e.target.value }))}
            disabled={orderState.orderType !== 'DINE_IN'}
          />

          <Select
            label="Customer"
            value={orderState.customer}
            options={[{ label: 'Walk-in / no customer', value: '' }].concat(
              customers.map((c) => ({ label: `${c.name} (${c.phone})`, value: c._id }))
            )}
            onChange={(e) => setOrderState((p) => ({ ...p, customer: e.target.value }))}
          />

          <Input
            label="Discount"
            type="number"
            step="0.01"
            value={orderState.discount}
            onChange={(e) => setOrderState((p) => ({ ...p, discount: e.target.value }))}
          />
        </div>

        {orderState.table ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Same table repeat-order flow enabled</p>
            <p>
              Working table:{' '}
              <span className="font-bold">
                {tables.find((table) => table._id === orderState.table)?.tableNumber || tableNumberFromUrl || 'Selected'}
              </span>
            </p>
            <p>
              Active orders on this table: <span className="font-bold">{selectedTableActiveOrders.length}</span>
            </p>
            {selectedTableActiveOrders.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTableActiveOrders.map((order) => (
                  <span key={order._id} className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-amber-200">
                    {order.orderNumber} - {order.status}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel title="Add Items">
        <div className="grid gap-3 md:grid-cols-4">
          <Select
            label="Menu Item"
            value={selectedMenu}
            options={[{ label: 'Select menu item', value: '' }].concat(
              menuItems.map((m) => ({ label: `${m.name} - ${currency(m.price)}`, value: m._id }))
            )}
            onChange={(e) => setSelectedMenu(e.target.value)}
          />
          <Input label="Quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex items-end">
            <Button className="w-full py-3 text-base" onClick={addItem}>Add Item</Button>
          </div>
        </div>

        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Price</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2">{item.quantity}</td>
                  <td className="px-3 py-2">{currency(item.price)}</td>
                  <td className="px-3 py-2">{currency(item.price * item.quantity)}</td>
                  <td className="px-3 py-2">{item.notes || '-'}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="danger"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2 md:hidden">
          {items.map((item, idx) => (
            <article key={`${item.menuItem}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-800">{item.name}</p>
                <Button variant="danger" size="sm" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>
                  Remove
                </Button>
              </div>
              <p className="mt-2 text-sm text-slate-600">Qty: {item.quantity}</p>
              <p className="text-sm text-slate-600">Price: {currency(item.price)}</p>
              <p className="text-sm font-semibold text-slate-800">Total: {currency(item.price * item.quantity)}</p>
              {item.notes ? <p className="text-xs text-slate-500">Note: {item.notes}</p> : null}
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Order Summary">
        <div className="space-y-2 text-sm">
          <p>Subtotal: <span className="font-semibold">{currency(subtotal)}</span></p>
          <p>Discount: <span className="font-semibold">{currency(orderState.discount || 0)}</span></p>
          <p className="text-lg font-bold text-brand-700">Grand Total: {currency(total)}</p>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="mt-3 text-sm font-semibold text-emerald-700">{success}</p> : null}

        <div className="mt-4 grid gap-2 sm:flex">
          <Button className="px-6 py-3 text-base" onClick={submitOrder} disabled={saving}>
            {saving ? 'Creating Order...' : 'Create Order & Send to Kitchen'}
          </Button>
          {orderState.table ? (
            <Link
              to={`/orders?table=${orderState.table}&tableNumber=${encodeURIComponent(tables.find((table) => table._id === orderState.table)?.tableNumber || tableNumberFromUrl || '')}`}
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-700"
            >
              View This Table Orders
            </Link>
          ) : null}
          <Link to="/kitchen" className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-sky-700">
            View Kitchen Queue
          </Link>
        </div>
      </Panel>
    </div>
  );
};

export default OrderCreatePage;
