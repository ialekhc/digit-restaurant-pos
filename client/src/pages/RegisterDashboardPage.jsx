import { useEffect, useMemo, useState } from 'react';
import { paymentService } from '../api/services';
import Panel from '../components/ui/Panel';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime } from '../utils/format';

const todayInputValue = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const local = new Date(today.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
};

const rs = (value = 0) => {
  return `Rs ${Number(value || 0).toLocaleString('en-NP', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const RegisterDashboardPage = () => {
  const [selectedDate, setSelectedDate] = useState(todayInputValue());
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await paymentService.list({ date: selectedDate });
      setPayments(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load register report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedDate]);

  const stats = useMemo(() => {
    const totalPayments = payments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0);
    const cashSales = payments
      .filter((payment) => payment.paymentMethod === 'CASH')
      .reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0);
    const changeGiven = payments.reduce((sum, payment) => sum + Number(payment.changeAmount || 0), 0);

    return {
      cashSales,
      totalPayments,
      safeDrops: 0,
      transactionCount: payments.length,
      changeGiven,
      averageSale: payments.length ? totalPayments / payments.length : 0
    };
  }, [payments]);

  const statCards = [
    { label: 'Cash Sales', value: rs(stats.cashSales), note: 'Cash method payments', badge: 'Cash' },
    { label: 'Total Payments', value: rs(stats.totalPayments), note: `${stats.transactionCount} transactions`, badge: 'Pay' },
    { label: 'Safe Drops', value: rs(stats.safeDrops), note: 'No safe drops recorded', badge: 'Safe' },
    { label: 'Change Given', value: rs(stats.changeGiven), note: 'Total returned to customers', badge: 'Change' },
    { label: 'Average Sale', value: rs(stats.averageSale), note: 'Per transaction average', badge: 'Avg' },
    { label: 'Discrepancy', value: rs(0), note: 'No discrepancy recorded', badge: 'OK' }
  ];

  const exportExcel = async () => {
    setError('');
    if (!payments.length) {
      setError('No sales report available for selected date');
      return;
    }

    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const rows = payments.map((payment, index) => {
        const order = payment.order || {};
        const items = Array.isArray(order.items) ? order.items : [];

        return {
          'S.N.': index + 1,
          Date: payment.createdAt ? new Date(payment.createdAt).toLocaleString('en-NP') : '',
          'Bill Number': payment.billNumber || '',
          'Order Number': order.orderNumber || '',
          Table: order.table?.tableNumber || '',
          'Payment Method': payment.paymentMethod || '',
          'Payment Status': payment.paymentStatus || '',
          'Amount Paid (Rs)': Number(payment.amountPaid || 0),
          'Change (Rs)': Number(payment.changeAmount || 0),
          'Order Total (Rs)': Number(order.total || 0),
          Items: items.map((item) => `${item.quantity}x ${item.name}`).join(', '),
          Cashier: payment.paidBy?.name || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 18 },
        { wch: 18 },
        { wch: 10 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 14 },
        { wch: 16 },
        { wch: 42 },
        { wch: 18 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');
      XLSX.writeFile(workbook, `register-sales-report-${selectedDate}.xlsx`);
    } catch (_err) {
      setError('Unable to export Excel right now. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Register Dashboard</h2>
          <p className="text-sm text-slate-500">Sales report by selected date</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[220px_auto]">
          <Input
            label="Select Date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <div className="flex items-end">
            <Button type="button" variant="secondary" onClick={exportExcel} disabled={exporting || !payments.length}>
              {exporting ? 'Exporting...' : 'Download Excel'}
            </Button>
          </div>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-base font-bold text-slate-900">Statistics</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {statCards.map((card) => (
            <Panel key={card.label} className="min-h-32">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{card.value}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{card.note}</p>
                </div>
                <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{card.badge}</span>
              </div>
            </Panel>
          ))}
        </div>
      </section>

      <Panel
        title="Sales Report"
        subtitle={loading ? 'Loading selected date...' : `${payments.length} payment${payments.length === 1 ? '' : 's'} found`}
      >
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}

        <div className="hidden overflow-x-auto md:block">
          <table className="table-ui">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Order #</th>
                <th>Table</th>
                <th>Method</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Change</th>
                <th>Cashier</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment._id}>
                  <td className="font-semibold">{payment.billNumber || '-'}</td>
                  <td>{payment.order?.orderNumber || '-'}</td>
                  <td>{payment.order?.table?.tableNumber || '-'}</td>
                  <td>{payment.paymentMethod || '-'}</td>
                  <td><StatusBadge value={payment.paymentStatus || '-'} /></td>
                  <td>{rs(payment.amountPaid)}</td>
                  <td>{rs(payment.changeAmount)}</td>
                  <td>{payment.paidBy?.name || '-'}</td>
                  <td>{formatDateTime(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payments.length ? <p className="p-4 text-center text-sm text-slate-500">No sales report found for this date</p> : null}
        </div>

        <div className="space-y-3 md:hidden">
          {payments.map((payment) => (
            <article key={payment._id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">{payment.billNumber || '-'}</p>
                  <p className="text-sm font-semibold text-slate-800">{payment.order?.orderNumber || '-'}</p>
                </div>
                <StatusBadge value={payment.paymentStatus || '-'} />
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>Table: {payment.order?.table?.tableNumber || '-'}</p>
                <p>Method: {payment.paymentMethod || '-'}</p>
                <p>Amount: {rs(payment.amountPaid)}</p>
                <p>Cashier: {payment.paidBy?.name || '-'}</p>
                <p>Time: {formatDateTime(payment.createdAt)}</p>
              </div>
            </article>
          ))}
          {!payments.length ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No sales report found for this date</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default RegisterDashboardPage;
