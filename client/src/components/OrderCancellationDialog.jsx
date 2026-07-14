import { useEffect, useMemo, useState } from 'react';
import Button from './ui/Button';
import { currency } from '../utils/format';

const OrderCancellationDialog = ({ order, busy = false, error = '', onClose, onConfirm }) => {
  const [mode, setMode] = useState('ITEMS');
  const [selected, setSelected] = useState({});
  const [reason, setReason] = useState('');

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [busy, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const selectedItems = useMemo(() => (
    (order.items || []).flatMap((item) => {
      const quantity = Number(selected[item._id] || 0);
      return quantity > 0 ? [{ itemId: item._id, quantity }] : [];
    })
  ), [order.items, selected]);

  const selectedTotal = useMemo(() => selectedItems.reduce((sum, selection) => {
    const item = order.items.find((row) => row._id === selection.itemId);
    return sum + Number(item?.price || 0) * selection.quantity;
  }, 0), [order.items, selectedItems]);

  const allItemsSelected = selectedItems.length === order.items.length && selectedItems.every((selection) => {
    const item = order.items.find((row) => row._id === selection.itemId);
    return selection.quantity === Number(item?.quantity || 0);
  });
  const canSubmit = reason.trim() && (mode === 'ORDER' || (selectedItems.length > 0 && !allItemsSelected));

  const toggleItem = (item) => {
    setSelected((previous) => {
      const next = { ...previous };
      if (next[item._id]) delete next[item._id];
      else next[item._id] = Number(item.quantity || 1);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Cancellation</p>
            <h2 id="cancel-order-title" className="mt-1 text-xl font-bold text-slate-900">{order.orderNumber}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {order.table?.tableNumber ? `Table ${order.table.tableNumber} · ` : ''}{order.items.length} item{order.items.length === 1 ? '' : 's'} · {currency(order.total)}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close cancellation dialog" className="rounded-lg p-2 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">×</button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2" aria-label="Cancellation type">
            <button
              type="button"
              onClick={() => setMode('ITEMS')}
              className={`rounded-xl border p-4 text-left transition ${mode === 'ITEMS' ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className="block text-sm font-bold text-slate-900">Cancel selected items</span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">Keep the order active and remove only selected quantities.</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('ORDER')}
              className={`rounded-xl border p-4 text-left transition ${mode === 'ORDER' ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-100' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <span className="block text-sm font-bold text-slate-900">Cancel entire order</span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">Cancel every item and close this order completely.</span>
            </button>
          </div>

          {mode === 'ITEMS' ? (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800">Choose items and quantities</label>
                <span className="text-xs font-semibold text-slate-500">Selected subtotal: {currency(selectedTotal)}</span>
              </div>
              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                {order.items.map((item) => {
                  const checked = Boolean(selected[item._id]);
                  const max = Number(item.quantity || 1);
                  return (
                    <div key={item._id} className={`flex items-center gap-3 p-3 ${checked ? 'bg-sky-50/70' : 'bg-white'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleItem(item)} className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500" />
                      <button type="button" onClick={() => toggleItem(item)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-semibold text-slate-800">{item.name}</span>
                        <span className="block text-xs text-slate-500">{currency(item.price)} each · {max} ordered</span>
                      </button>
                      {checked ? (
                        <div className="flex items-center gap-2">
                          <label htmlFor={`cancel-quantity-${item._id}`} className="text-xs font-semibold text-slate-600">Qty</label>
                          <input
                            id={`cancel-quantity-${item._id}`}
                            type="number"
                            min="1"
                            max={max}
                            step="1"
                            value={selected[item._id]}
                            onChange={(event) => {
                              const value = Math.max(1, Math.min(max, Number(event.target.value) || 1));
                              setSelected((previous) => ({ ...previous, [item._id]: value }));
                            }}
                            className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-center text-sm font-semibold outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              {allItemsSelected ? <p className="mt-2 text-xs font-semibold text-rose-600">To remove every item, choose “Cancel entire order” above.</p> : null}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <p className="font-bold">This action cancels the complete order.</p>
              <p className="mt-1 leading-5">All {order.items.length} items will be cancelled. Other orders on {order.table?.tableNumber ? `table ${order.table.tableNumber}` : 'the table'} will not be affected.</p>
            </div>
          )}

          <div className="mt-5">
            <label htmlFor="cancellation-reason" className="text-sm font-bold text-slate-800">Reason <span className="text-rose-600">*</span></label>
            <textarea
              id="cancellation-reason"
              rows="3"
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Example: Guest changed their order"
              className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />
          </div>
          {error ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</div> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Keep Order</Button>
          <Button
            type="button"
            variant="danger"
            disabled={busy || !canSubmit}
            onClick={() => onConfirm({ mode, reason: reason.trim(), items: selectedItems })}
          >
            {busy ? 'Cancelling…' : mode === 'ORDER' ? 'Cancel Entire Order' : `Cancel Selected${selectedItems.length ? ` (${selectedItems.length})` : ''}`}
          </Button>
        </footer>
      </section>
    </div>
  );
};

export default OrderCancellationDialog;
