import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../api/axios';
import Panel from '../components/ui/Panel';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { currency } from '../utils/format';

const CustomerQrOrderPage = () => {
  const { tableId } = useParams();
  const [table, setTable] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setError('');
    const response = await fetch(`${API_BASE_URL}/public/qr-menu/${tableId}`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || 'Unable to load QR menu');
    }
    setTable(payload.data.table);
    setMenuItems(payload.data.menuItems);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message || 'Unable to load QR menu'));
  }, [tableId]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const groupedMenu = useMemo(() => {
    return menuItems.reduce((acc, item) => {
      const key = item.category?.name || 'General';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [menuItems]);

  const addToCart = (menuItem) => {
    setItems((prev) => {
      const found = prev.find((item) => item.menuItem === menuItem._id);
      if (found) {
        return prev.map((item) =>
          item.menuItem === menuItem._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          menuItem: menuItem._id,
          name: menuItem.name,
          price: menuItem.price,
          quantity: 1,
          notes: ''
        }
      ];
    });
  };

  const placeOrder = async () => {
    setError('');
    setSuccess('');
    if (!items.length) {
      setError('Please add at least one item');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/public/qr-menu/${tableId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to place order');
      }

      setSuccess(`Order ${payload.data.orderNumber} placed. Kitchen and waiter have received it.`);
      setItems([]);
    } catch (err) {
      setError(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Panel title="Digital Table Menu" subtitle={table ? `Table ${table.tableNumber}` : 'Loading table info'}>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {!error && !menuItems.length ? <p className="text-sm text-slate-600">No menu items available right now.</p> : null}
        </Panel>

        <Panel title="Menu by Type">
          <div className="space-y-5">
            {Object.keys(groupedMenu).map((groupName) => (
              <section key={groupName}>
                <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">{groupName}</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {groupedMenu[groupName].map((item) => (
                    <article key={item._id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.kitchenSection || 'FOOD'}</p>
                      <p className="mt-2 text-sm font-semibold text-brand-700">{currency(item.price)}</p>
                      <Button className="mt-3 w-full" onClick={() => addToCart(item)}>
                        Add
                      </Button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Panel>

        <Panel title="Your Order">
          {!items.length ? <p className="text-sm text-slate-600">No items added yet.</p> : null}
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.menuItem} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="grid gap-2 md:grid-cols-4 md:items-end">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{currency(item.price)} each</p>
                  </div>
                  <Input
                    label="Qty"
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => {
                      const qty = Math.max(1, Number(e.target.value || 1));
                      setItems((prev) =>
                        prev.map((x) => (x.menuItem === item.menuItem ? { ...x, quantity: qty } : x))
                      );
                    }}
                  />
                  <Input
                    label="Notes"
                    value={item.notes}
                    onChange={(e) => {
                      setItems((prev) =>
                        prev.map((x) => (x.menuItem === item.menuItem ? { ...x, notes: e.target.value } : x))
                      );
                    }}
                  />
                  <Button
                    variant="danger"
                    onClick={() => setItems((prev) => prev.filter((x) => x.menuItem !== item.menuItem))}
                  >
                    Remove
                  </Button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-base font-bold text-slate-900">Total: {currency(total)}</p>
            <Button onClick={placeOrder} disabled={loading}>
              {loading ? 'Placing Order...' : 'Place Order'}
            </Button>
          </div>

          {success ? <p className="mt-3 text-sm font-semibold text-emerald-700">{success}</p> : null}
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </Panel>
      </div>
    </div>
  );
};

export default CustomerQrOrderPage;
