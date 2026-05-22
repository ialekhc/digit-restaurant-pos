import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { inventoryService } from '../api/services';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { formatDate } from '../utils/format';

const defaultForm = {
  inventoryId: '',
  quantity: 0
};

const PurchaseFlowPage = () => {
  const { pathname } = useLocation();
  const isPurchaseIn = pathname === '/purchase-in';

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item._id === form.inventoryId),
    [items, form.inventoryId]
  );

  const load = async () => {
    const data = await inventoryService.list();
    setItems(data);
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const movementQty = Number(form.quantity);
    if (!form.inventoryId) {
      setError('Please select an inventory item');
      return;
    }
    if (!Number.isFinite(movementQty) || movementQty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (!selectedItem) {
      setError('Selected item not found');
      return;
    }

    const nextQty = isPurchaseIn ? selectedItem.quantity + movementQty : selectedItem.quantity - movementQty;
    if (nextQty < 0) {
      setError('Purchase Out cannot reduce stock below 0');
      return;
    }

    try {
      setLoading(true);
      await inventoryService.updateStock(form.inventoryId, nextQty);
      setSuccess(`${selectedItem.name} stock updated: ${selectedItem.quantity} -> ${nextQty}`);
      setForm(defaultForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Panel
        title={isPurchaseIn ? 'Purchase In' : 'Purchase Out'}
        subtitle={isPurchaseIn ? 'Increase raw material stock after purchase entry' : 'Reduce stock for returns, wastage, or adjustments'}
      >
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
            label={isPurchaseIn ? 'Purchase In Quantity' : 'Purchase Out Quantity'}
            type="number"
            min="0"
            value={form.quantity}
            onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
          />
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>{loading ? 'Updating...' : 'Save Transaction'}</Button>
          </div>
        </form>

        {selectedItem ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p>Current Stock: {selectedItem.quantity} {selectedItem.unit}</p>
            <p>Minimum Level: {selectedItem.minimumStockLevel} {selectedItem.unit}</p>
            <p>Last Updated: {formatDate(selectedItem.updatedAt)}</p>
          </div>
        ) : null}

        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="mt-2 text-sm text-emerald-600">{success}</p> : null}
      </Panel>
    </div>
  );
};

export default PurchaseFlowPage;
