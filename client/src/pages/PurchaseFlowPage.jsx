import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { inventoryService, purchaseService } from '../api/services';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { currency, formatDateTime } from '../utils/format';
import { useAutoRefresh } from '../hooks/useAutoRefresh';

const getTodayValue = () => new Date().toISOString().slice(0, 10);

const createDefaultForm = () => ({
  inventoryId: '',
  quantity: '',
  unitPrice: '',
  totalAmount: '',
  paymentMode: 'CASH',
  invoiceNumber: '',
  notes: '',
  transactionDate: getTodayValue()
});

const PurchaseFlowPage = () => {
  const { pathname } = useLocation();
  const isPurchaseIn = pathname === '/purchase-in';

  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(createDefaultForm);
  const [filters, setFilters] = useState({ search: '', from: '', to: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item._id === form.inventoryId),
    [items, form.inventoryId]
  );

  const summary = useMemo(() => {
    const totalAmount = transactions.reduce((acc, row) => acc + Number(row.totalAmount || 0), 0);
    const totalQuantity = transactions.reduce((acc, row) => acc + Number(row.quantity || 0), 0);
    return {
      entries: transactions.length,
      totalAmount,
      totalQuantity
    };
  }, [transactions]);

  const computedAmount = useMemo(() => {
    const qty = Number(form.quantity || 0);
    const rate = Number(form.unitPrice || selectedItem?.purchasePrice || 0);
    if (!Number.isFinite(qty) || !Number.isFinite(rate)) return 0;
    return Number((qty * rate).toFixed(2));
  }, [form.quantity, form.unitPrice, selectedItem?.purchasePrice]);

  const load = async (nextFilters = filters, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const query = {
        type: isPurchaseIn ? 'IN' : 'OUT',
        limit: 200
      };

      if (nextFilters.search) query.search = nextFilters.search;
      if (nextFilters.from) query.from = nextFilters.from;
      if (nextFilters.to) query.to = nextFilters.to;

      const [inventoryData, purchaseData] = await Promise.all([
        inventoryService.list(),
        purchaseService.list(query)
      ]);

      setItems(inventoryData);
      setTransactions(purchaseData);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load purchase data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ search: '', from: '', to: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useAutoRefresh(() => load(filters, false));

  useEffect(() => {
    if (!selectedItem) return;
    setForm((prev) => {
      if (prev.unitPrice !== '' && prev.unitPrice !== null && typeof prev.unitPrice !== 'undefined') return prev;
      return {
        ...prev,
        unitPrice: String(selectedItem.purchasePrice || '')
      };
    });
  }, [selectedItem]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const quantity = Number(form.quantity);
    const unitPrice = Number(form.unitPrice || 0);
    const totalAmount = form.totalAmount === '' ? Number((quantity * unitPrice).toFixed(2)) : Number(form.totalAmount);

    if (!form.inventoryId) {
      setError('Please select an inventory item');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Unit price must be zero or more');
      return;
    }
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      setError('Total amount must be zero or more');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        type: isPurchaseIn ? 'IN' : 'OUT',
        inventoryItem: form.inventoryId,
        quantity,
        unitPrice,
        totalAmount,
        paymentMode: form.paymentMode,
        invoiceNumber: form.invoiceNumber,
        notes: form.notes,
        transactionDate: form.transactionDate
      };

      const created = await purchaseService.create(payload);
      setSuccess(
        `${created.purchaseNumber} saved. ${created.itemName} stock moved from ${created.previousStock} to ${created.nextStock}.`
      );
      setForm(createDefaultForm());
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save purchase entry');
    } finally {
      setSubmitting(false);
    }
  };

  const applyFilters = async (e) => {
    e.preventDefault();
    setError('');
    await load(filters);
  };

  const title = isPurchaseIn ? 'Purchase In' : 'Purchase Out';
  const subtitle = isPurchaseIn
    ? 'Record daily stock-in purchases with quantity, rate, and payment details.'
    : 'Record daily stock-out movements for consumption, wastage, or returns.';

  return (
    <div className="space-y-5">
      <Panel title={title} subtitle={subtitle}>
        <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-4" onSubmit={onSubmit}>
          <Select
            label="Inventory Item"
            value={form.inventoryId}
            options={[{ label: 'Select item', value: '' }].concat(
              items.map((item) => ({
                label: `${item.name} (${item.quantity} ${item.unit})`,
                value: item._id
              }))
            )}
            onChange={(e) => setForm((prev) => ({ ...prev, inventoryId: e.target.value }))}
          />
          <Input
            label="Quantity"
            type="number"
            min="0"
            step="0.01"
            value={form.quantity}
            onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
          />
          <Input
            label="Rate (NPR)"
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => setForm((prev) => ({ ...prev, unitPrice: e.target.value }))}
          />
          <Input
            label="Amount (NPR)"
            type="number"
            min="0"
            step="0.01"
            value={form.totalAmount}
            helperText={`Auto: ${currency(computedAmount)}`}
            onChange={(e) => setForm((prev) => ({ ...prev, totalAmount: e.target.value }))}
          />
          <Select
            label="Payment Mode"
            value={form.paymentMode}
            options={[
              { label: 'Cash', value: 'CASH' },
              { label: 'Credit', value: 'CREDIT' },
              { label: 'Card', value: 'CARD' },
              { label: 'Online', value: 'ONLINE' },
              { label: 'Other', value: 'OTHER' }
            ]}
            onChange={(e) => setForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
          />
          <Input
            label="Invoice / Bill No."
            value={form.invoiceNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
          />
          <Input
            label="Transaction Date"
            type="date"
            value={form.transactionDate}
            onChange={(e) => setForm((prev) => ({ ...prev, transactionDate: e.target.value }))}
          />
          <div className="flex items-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Daily Entry'}
            </Button>
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <Input
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes (supplier info, reason, remarks)"
            />
          </div>
        </form>

        {selectedItem ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p>
              Current Stock: {selectedItem.quantity} {selectedItem.unit}
            </p>
            <p>
              Minimum Level: {selectedItem.minimumStockLevel} {selectedItem.unit}
            </p>
            <p>Default Purchase Price: {currency(selectedItem.purchasePrice || 0)}</p>
          </div>
        ) : null}

        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="mt-2 text-sm text-emerald-600">{success}</p> : null}
      </Panel>

      <Panel title="Daily Entry History" subtitle="Track every purchase transaction by date, invoice, and stock movement.">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={applyFilters}>
          <Input
            label="Search"
            value={filters.search}
            placeholder="Purchase no, item, invoice, note"
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <Input
            label="From Date"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
          />
          <Input
            label="To Date"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
          />
          <div className="flex items-end">
            <Button type="submit" variant="secondary" disabled={loading}>
              {loading ? 'Filtering...' : 'Apply Filters'}
            </Button>
          </div>
        </form>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Entries</p>
            <p className="text-lg font-semibold text-slate-800">{summary.entries}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Total Quantity</p>
            <p className="text-lg font-semibold text-slate-800">{summary.totalQuantity}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Total Amount</p>
            <p className="text-lg font-semibold text-slate-800">{currency(summary.totalAmount)}</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="table-ui">
            <thead className="bg-slate-100 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Purchase No</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Stock Move</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((entry) => (
                <tr key={entry._id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-xs text-slate-700">{formatDateTime(entry.transactionDate)}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-slate-800">{entry.purchaseNumber}</td>
                  <td className="px-3 py-2 text-sm text-slate-800">{entry.itemName}</td>
                  <td className="px-3 py-2 text-sm text-slate-700">
                    {entry.quantity} {entry.unit}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-700">{currency(entry.unitPrice)}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-slate-800">{currency(entry.totalAmount)}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">{entry.paymentMode}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {entry.previousStock} → {entry.nextStock}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">{entry.invoiceNumber || '-'}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">{entry.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!transactions.length && !loading ? (
            <p className="p-3 text-sm text-slate-500">No entries found for selected filters.</p>
          ) : null}
        </div>
      </Panel>
    </div>
  );
};

export default PurchaseFlowPage;
