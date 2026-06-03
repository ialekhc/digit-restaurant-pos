import { useMemo, useState } from 'react';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

const rs = (value = 0) => {
  const amount = Number(value || 0);
  const sign = amount < 0 ? '-' : '';
  return `${sign}Rs ${Math.abs(amount).toLocaleString('en-NP', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const badgeClass = {
  'Safe Drop': 'bg-sky-100 text-sky-700',
  'Cash Sale': 'bg-emerald-100 text-emerald-700',
  'Cash Out': 'bg-rose-100 text-rose-700',
  'Cash In': 'bg-teal-100 text-teal-700',
  'Opening Float': 'bg-blue-100 text-blue-700'
};

const CashRegisterPage = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('0');
  const [reason, setReason] = useState('');
  const [transactions, setTransactions] = useState([]);
  const cashierName = user?.name || user?.email || 'Cashier';
  const openedAt = useMemo(() => {
    return new Date().toLocaleString('en-NP', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const totals = useMemo(() => {
    const opening = transactions
      .filter((item) => item.type === 'Opening Float')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const cashSales = transactions
      .filter((item) => item.type === 'Cash Sale')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const cashOut = transactions
      .filter((item) => item.type === 'Cash Out')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const safeDrop = transactions
      .filter((item) => item.type === 'Safe Drop')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      opening,
      cashSales,
      cashOut,
      safeDrop,
      expectedCash: opening + cashSales + cashOut + safeDrop
    };
  }, [transactions]);

  const addTransaction = (type) => {
    const numericAmount = Number(amount || 0);
    if (!numericAmount) return;

    const signedAmount = type === 'Cash Out' || type === 'Safe Drop' ? -Math.abs(numericAmount) : Math.abs(numericAmount);
    const now = new Date().toLocaleString('en-NP', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    setTransactions((prev) => [
      {
        time: now,
        type,
        amount: signedAmount,
        reason: reason || `${type} register entry`
      },
      ...prev
    ]);
    setAmount('0');
    setReason('');
  };

  return (
    <div className="space-y-5">
      <Panel title="Session Status">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-base font-bold text-emerald-800">Session Active</p>
                  <p className="text-sm text-emerald-700">Open - {openedAt}</p>
                </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-emerald-700">Expected Cash</p>
              <p className="text-xl font-bold text-emerald-900">{rs(totals.expectedCash)}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-500">Cashier</span> <span className="ml-2 font-bold">{cashierName}</span>
        </div>
      </Panel>

      <Panel title="Register Status">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-500">Opening Balance</p>
            <p className="mt-1 text-xl font-bold text-slate-950">{rs(totals.opening)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-500">Cash Sales</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{rs(totals.cashSales)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-500">Cash Out</p>
            <p className="mt-1 text-xl font-bold text-rose-600">{rs(totals.cashOut)}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-500">Safe Drop</p>
            <p className="mt-1 text-xl font-bold text-blue-600">{rs(totals.safeDrop)}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-slate-500">Expected Cash</p>
            <p className="mt-1 text-xl font-bold text-blue-600">{rs(totals.expectedCash)}</p>
          </div>
        </div>
      </Panel>

      <Panel title="Quick Actions">
        <div className="grid gap-3 xl:grid-cols-[1fr_2fr_repeat(3,0.9fr)]">
          <Input label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Reason" value={reason} placeholder="Enter reason for transaction" onChange={(e) => setReason(e.target.value)} />
          <div className="flex items-end">
            <Button className="w-full" onClick={() => addTransaction('Cash In')}>Cash In</Button>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => addTransaction('Cash Out')}>Cash Out</Button>
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={() => addTransaction('Safe Drop')}>Safe Drop</Button>
          </div>
        </div>
      </Panel>

      <Panel title="Transaction Logs">
        <div className="overflow-x-auto">
          <table className="table-ui">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item, index) => (
                <tr key={`${item.time}-${index}`}>
                  <td>{item.time}</td>
                  <td>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badgeClass[item.type] || 'bg-slate-100 text-slate-700'}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className={item.amount < 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-600'}>
                    {item.amount > 0 ? '+' : ''}
                    {rs(item.amount)}
                  </td>
                  <td>{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!transactions.length ? <p className="p-4 text-center text-sm text-slate-500">No register transactions yet</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default CashRegisterPage;
