import { useEffect, useMemo, useState } from 'react';
import { orderService, paymentService, planService } from '../api/services';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { FEATURE_KEYS, PAYMENT_METHODS } from '../utils/constants';
import { currency, formatDateTime } from '../utils/format';

const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const buildReceiptHtml = (payment, cashierName = '') => {
  const order = payment?.order || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = Number(
    order.subtotal ?? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  );
  const discount = Number(order.discount || 0);
  const total = Number(order.total ?? Math.max(0, subtotal - discount));
  const amountPaid = Number(payment?.amountPaid || 0);
  const changeAmount = Number(payment?.changeAmount || 0);
  const paymentDate = payment?.createdAt ? new Date(payment.createdAt).toLocaleString('en-NP') : '-';
  const cashier = payment?.paidBy?.name || cashierName || 'Cashier';

  const itemRows = items.length
    ? items
      .map((item, index) => {
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const lineTotal = qty * price;
        return `<tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.name || '-')}</td>
          <td style="text-align:right;">${qty}</td>
          <td style="text-align:right;">${currency(price)}</td>
          <td style="text-align:right;">${currency(lineTotal)}</td>
        </tr>`;
      })
      .join('')
    : '<tr><td colspan="5" style="text-align:center;">No items</td></tr>';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(payment?.billNumber || '')}</title>
  <style>
    @page { size: 57mm 40mm; margin: 0; }
    * { box-sizing: border-box; font-family: "Courier New", monospace; color: #111827; }
    body { margin: 0; padding: 0; width: 57mm; height: 40mm; background: #ffffff; }
    .receipt { width: 57mm; min-height: 40mm; max-height: 40mm; margin: 0; padding: 1.5mm; overflow: hidden; }
    .center { text-align: center; }
    h1 { margin: 0; font-size: 9px; line-height: 1.1; }
    .muted { color: #4b5563; font-size: 6px; margin-top: 1px; line-height: 1.1; }
    .row { display: flex; justify-content: space-between; gap: 2px; font-size: 6px; line-height: 1.2; margin: 0.6mm 0; }
    .divider { border-top: 1px dashed #9ca3af; margin: 1mm 0; }
    table { width: 100%; border-collapse: collapse; font-size: 6px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 0.4mm; vertical-align: top; }
    th { text-align: left; background: #f8fafc; font-size: 6px; }
    .totals .row { font-size: 6px; }
    .grand { font-weight: 700; font-size: 7px; }
    .footer { text-align: center; font-size: 6px; color: #4b5563; margin-top: 1mm; line-height: 1.1; }
    @media print {
      @page { size: 57mm 40mm; margin: 0; }
      html, body { width: 57mm; height: 40mm; }
      .receipt { width: 57mm; min-height: 40mm; max-height: 40mm; }
    }
  </style>
</head>
<body>
  <section class="receipt">
    <div class="center">
      <h1>Restaurant RMS</h1>
      <p class="muted">Customer Bill</p>
    </div>

    <div class="divider"></div>

    <div class="row"><span>Bill No</span><strong>${escapeHtml(payment?.billNumber || '-')}</strong></div>
    <div class="row"><span>Date</span><span>${escapeHtml(paymentDate)}</span></div>
    <div class="row"><span>Order No</span><span>${escapeHtml(order?.orderNumber || '-')}</span></div>
    <div class="row"><span>Table</span><span>${escapeHtml(order?.table?.tableNumber || '-')}</span></div>
    <div class="row"><span>Order Type</span><span>${escapeHtml(order?.orderType || '-')}</span></div>

    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th style="text-align:right;">Qty</th>
          <th style="text-align:right;">Price</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="divider"></div>

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${currency(subtotal)}</span></div>
      <div class="row"><span>Discount</span><span>${currency(discount)}</span></div>
      <div class="row grand"><span>Grand Total</span><span>${currency(total)}</span></div>
      <div class="row"><span>Amount Paid</span><span>${currency(amountPaid)}</span></div>
      <div class="row"><span>Change</span><span>${currency(changeAmount)}</span></div>
      <div class="row"><span>Payment Method</span><span>${escapeHtml(payment?.paymentMethod || '-')}</span></div>
      <div class="row"><span>Payment Status</span><span>${escapeHtml(payment?.paymentStatus || '-')}</span></div>
      <div class="row"><span>Cashier</span><span>${escapeHtml(cashier)}</span></div>
    </div>

    <div class="divider"></div>
    <p class="footer">Thank you for dining with us.</p>
  </section>
</body>
</html>`;
};

const BillingPage = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [enabledFeatures, setEnabledFeatures] = useState(new Set());
  const [receiptPayment, setReceiptPayment] = useState(null);

  const [lookupOrderNumber, setLookupOrderNumber] = useState('');
  const [lookupTableNumber, setLookupTableNumber] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PAID');

  const [historySearch, setHistorySearch] = useState('');
  const [historyMethod, setHistoryMethod] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');

  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    const [orderData, paymentData, activePlan] = await Promise.all([
      orderService.list(),
      paymentService.list(),
      planService.active()
    ]);
    setOrders(orderData);
    setPayments(paymentData);
    setEnabledFeatures(new Set(activePlan?.enabledFeatureKeys || []));
  };

  useEffect(() => {
    load();
  }, []);

  const paidOrderIds = useMemo(() => new Set(payments.map((p) => p.order?._id)), [payments]);

  const payableOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        !paidOrderIds.has(o._id) &&
        o.status !== 'CANCELLED' &&
        o.status !== 'COMPLETED' &&
        ['READY', 'SERVED'].includes(o.status)
    );
  }, [orders, paidOrderIds]);

  const filteredPayableOrders = useMemo(() => {
    const orderSearch = lookupOrderNumber.trim().toLowerCase();
    const tableSearch = lookupTableNumber.trim().toLowerCase();

    return payableOrders.filter((order) => {
      const orderMatch = !orderSearch || String(order.orderNumber || '').toLowerCase().includes(orderSearch);
      const tableMatch = !tableSearch || String(order.table?.tableNumber || '').toLowerCase().includes(tableSearch);
      return orderMatch && tableMatch;
    });
  }, [payableOrders, lookupOrderNumber, lookupTableNumber]);

  useEffect(() => {
    if (selectedOrderId && !filteredPayableOrders.some((order) => order._id === selectedOrderId)) {
      setSelectedOrderId('');
      setAmountPaid('');
    }
  }, [filteredPayableOrders, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId && filteredPayableOrders.length === 1) {
      const onlyOrder = filteredPayableOrders[0];
      setSelectedOrderId(onlyOrder._id);
      if (!amountPaid) setAmountPaid(String(onlyOrder.total));
    }
  }, [filteredPayableOrders, selectedOrderId, amountPaid]);

  const selectedOrder = payableOrders.find((x) => x._id === selectedOrderId);

  const totalPaidToday = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();

    return payments.reduce((sum, payment) => {
      const dt = payment?.createdAt ? new Date(payment.createdAt) : null;
      if (!dt) return sum;
      if (dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d) {
        return sum + Number(payment.amountPaid || 0);
      }
      return sum;
    }, 0);
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const q = historySearch.trim().toLowerCase();

    return payments.filter((payment) => {
      const searchable = [
        payment.billNumber,
        payment.order?.orderNumber,
        payment.order?.table?.tableNumber,
        payment.paymentMethod,
        payment.paymentStatus,
        payment.paidBy?.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchSearch = !q || searchable.includes(q);
      const matchMethod = !historyMethod || payment.paymentMethod === historyMethod;
      const matchStatus = !historyStatus || payment.paymentStatus === historyStatus;

      return matchSearch && matchMethod && matchStatus;
    });
  }, [payments, historySearch, historyMethod, historyStatus]);

  const paymentMethodOptions = useMemo(() => {
    if (!enabledFeatures.size) return PAYMENT_METHODS;
    return PAYMENT_METHODS.filter((method) => {
      if (method === 'CASH') return enabledFeatures.has(FEATURE_KEYS.CASH_PAYMENT);
      if (method === 'CARD') return enabledFeatures.has(FEATURE_KEYS.CARD_PAYMENT);
      if (method === 'QR') return enabledFeatures.has(FEATURE_KEYS.QR_PAYMENT);
      if (method === 'ONLINE') return enabledFeatures.has(FEATURE_KEYS.ONLINE_ORDERING_SYSTEM);
      if (method === 'SPLIT') return enabledFeatures.has(FEATURE_KEYS.SPLIT_BILLING);
      return false;
    });
  }, [enabledFeatures]);

  useEffect(() => {
    if (!paymentMethodOptions.length) return;
    if (!paymentMethodOptions.includes(paymentMethod)) {
      setPaymentMethod(paymentMethodOptions[0]);
    }
  }, [paymentMethodOptions, paymentMethod]);

  const printReceipt = (payment) => {
    setError('');
    if (!payment) {
      setError('No receipt available to print');
      return;
    }

    const popup = window.open('', '_blank', 'width=420,height=760');
    if (!popup) {
      setError('Please allow pop-ups to print receipt');
      return;
    }

    let printed = false;
    const doPrint = () => {
      if (printed) return;
      printed = true;
      popup.focus();
      popup.print();
      popup.close();
    };

    popup.document.open();
    popup.document.write(buildReceiptHtml(payment, user?.name || 'Cashier'));
    popup.document.close();
    popup.onload = doPrint;
    setTimeout(doPrint, 500);
  };

  const createPayment = async () => {
    setError('');
    if ((!selectedOrderId && !lookupOrderNumber.trim()) || !amountPaid) {
      setError('Please provide order number (or select order) and enter amount paid');
      return;
    }

    try {
      const payload = {
        paymentMethod,
        amountPaid: Number(amountPaid),
        paymentStatus
      };

      if (selectedOrderId) payload.order = selectedOrderId;
      if (lookupOrderNumber.trim()) payload.orderNumber = lookupOrderNumber.trim();
      if (lookupTableNumber.trim()) payload.tableNumber = lookupTableNumber.trim();

      const createdPayment = await paymentService.create(payload);
      setReceiptPayment(createdPayment);

      setSelectedOrderId('');
      setAmountPaid('');
      setPaymentMethod('CASH');
      setPaymentStatus('PAID');
      setLookupOrderNumber('');
      setLookupTableNumber('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Payment failed');
    }
  };

  const exportBillsToExcel = async () => {
    setError('');
    if (!filteredPayments.length) {
      setError('No bill history available to export');
      return;
    }

    setExporting(true);
    try {
      const XLSX = await import('xlsx');

      const rows = filteredPayments.map((payment, index) => {
        const order = payment.order || {};
        const items = Array.isArray(order.items) ? order.items : [];

        return {
          'S.N.': index + 1,
          'Bill Number': payment.billNumber || '',
          'Bill Date': payment.createdAt ? new Date(payment.createdAt).toLocaleString('en-NP') : '',
          'Order Number': order.orderNumber || '',
          'Table Number': order.table?.tableNumber || '',
          'Order Type': order.orderType || '',
          'Order Status': order.status || '',
          'Items Count': items.length,
          'Items Summary': items.map((item) => `${item.quantity}x ${item.name}`).join(', '),
          'Subtotal (NPR)': Number(order.subtotal || 0),
          'Discount (NPR)': Number(order.discount || 0),
          'Grand Total (NPR)': Number(order.total || 0),
          'Payment Method': payment.paymentMethod || '',
          'Payment Status': payment.paymentStatus || '',
          'Amount Paid (NPR)': Number(payment.amountPaid || 0),
          'Change (NPR)': Number(payment.changeAmount || 0),
          'Customer Name': order.customer?.name || '',
          'Cashier': payment.paidBy?.name || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 22 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 40 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
        { wch: 20 },
        { wch: 16 }
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Bills');

      const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      XLSX.writeFile(workbook, `bills-history-${stamp}.xlsx`);
    } catch (err) {
      setError('Unable to export Excel right now. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-sky-700">Billable Orders</p>
          <p className="text-2xl font-bold text-sky-900">{payableOrders.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-emerald-700">Total Bills</p>
          <p className="text-2xl font-bold text-emerald-900">{payments.length}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-indigo-700">Paid Today</p>
          <p className="text-2xl font-bold text-indigo-900">{currency(totalPaidToday)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-amber-700">Filtered History</p>
          <p className="text-2xl font-bold text-amber-900">{filteredPayments.length}</p>
        </div>
      </div>

      <Panel title="Billing & Payment Entry" subtitle="Create clean bills quickly using order number or table number">
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h4 className="text-sm font-semibold text-slate-800">Order Lookup</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Order Number"
                placeholder="ORD-1001"
                value={lookupOrderNumber}
                onChange={(e) => setLookupOrderNumber(e.target.value)}
                helperText="Find bill by order number"
              />

              <Input
                label="Table Number"
                placeholder="T-1"
                value={lookupTableNumber}
                onChange={(e) => setLookupTableNumber(e.target.value)}
                helperText="Optional for dine-in"
              />
            </div>

            <Select
              label="Select Matching Order"
              value={selectedOrderId}
              options={[{ label: 'Select order', value: '' }].concat(
                filteredPayableOrders.map((o) => ({
                  label: `${o.orderNumber} | ${o.table?.tableNumber || 'No Table'} | ${currency(o.total)} | ${o.status}`,
                  value: o._id
                }))
              )}
              onChange={(e) => {
                setSelectedOrderId(e.target.value);
                const order = filteredPayableOrders.find((x) => x._id === e.target.value);
                if (order) {
                  setAmountPaid(String(order.total));
                  setLookupOrderNumber(order.orderNumber || '');
                  setLookupTableNumber(order.table?.tableNumber || '');
                }
              }}
            />

            {(lookupOrderNumber.trim() || lookupTableNumber.trim()) && !filteredPayableOrders.length ? (
              <p className="text-sm text-amber-700">
                No billable order found for this filter. Try changing order number or table number.
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <h4 className="text-sm font-semibold text-slate-800">Payment Details</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Payment Method"
                value={paymentMethod}
                options={paymentMethodOptions.map((x) => ({ label: x, value: x }))}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />

              <Select
                label="Payment Status"
                value={paymentStatus}
                options={[
                  { label: 'PAID', value: 'PAID' },
                  { label: 'PARTIAL', value: 'PARTIAL' },
                  { label: 'UNPAID', value: 'UNPAID' }
                ]}
                onChange={(e) => setPaymentStatus(e.target.value)}
              />
            </div>

            <Input
              label="Amount Paid"
              type="number"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
            />

            {selectedOrder ? (
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">
                <p className="font-semibold text-slate-800">Selected Order: {selectedOrder.orderNumber}</p>
                <p>Table: {selectedOrder.table?.tableNumber || '-'}</p>
                <p>Total: {currency(selectedOrder.total)}</p>
                <p>Items: {selectedOrder.items.length}</p>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-4 grid gap-2 sm:flex">
          <Button className="px-6 py-3 text-base" onClick={createPayment}>Accept Payment</Button>
          <Button
            variant="secondary"
            className="px-6 py-3 text-base"
            onClick={() => printReceipt(receiptPayment || filteredPayments[0])}
            disabled={!receiptPayment && !filteredPayments.length}
          >
            Print Latest Receipt
          </Button>
        </div>
      </Panel>

      <Panel
        title="Bills & Payment History"
        subtitle="Search, review, print, and export your bill records"
        right={(
          <Button variant="secondary" onClick={exportBillsToExcel} disabled={exporting || !filteredPayments.length}>
            {exporting ? 'Exporting...' : 'Export Excel (.xlsx)'}
          </Button>
        )}
      >
        <div className="mb-3 grid gap-3 md:grid-cols-3">
          <Input
            label="Search"
            placeholder="Bill, order, table, cashier"
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
          />

          <Select
            label="Method"
            value={historyMethod}
            options={[
              { label: 'All Methods', value: '' },
              ...paymentMethodOptions.map((method) => ({ label: method, value: method }))
            ]}
            onChange={(e) => setHistoryMethod(e.target.value)}
          />

          <Select
            label="Status"
            value={historyStatus}
            options={[
              { label: 'All Statuses', value: '' },
              { label: 'PAID', value: 'PAID' },
              { label: 'PARTIAL', value: 'PARTIAL' },
              { label: 'UNPAID', value: 'UNPAID' }
            ]}
            onChange={(e) => setHistoryStatus(e.target.value)}
          />
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="table-ui">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Order #</th>
                <th>Table</th>
                <th>Method</th>
                <th>Amount Paid</th>
                <th>Change</th>
                <th>Status</th>
                <th>Paid At</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment._id}>
                  <td className="font-semibold">{payment.billNumber}</td>
                  <td>{payment.order?.orderNumber || '-'}</td>
                  <td>{payment.order?.table?.tableNumber || '-'}</td>
                  <td>{payment.paymentMethod}</td>
                  <td>{currency(payment.amountPaid)}</td>
                  <td>{currency(payment.changeAmount)}</td>
                  <td><StatusBadge value={payment.paymentStatus} /></td>
                  <td>{formatDateTime(payment.createdAt)}</td>
                  <td>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setReceiptPayment(payment);
                        printReceipt(payment);
                      }}
                    >
                      Print
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredPayments.length ? <p className="p-4 text-sm text-slate-500">No bill records found</p> : null}
        </div>

        <div className="space-y-3 md:hidden">
          {filteredPayments.map((payment) => (
            <article key={payment._id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-slate-500">{payment.billNumber}</p>
                  <p className="text-sm font-semibold text-slate-800">{payment.order?.orderNumber || '-'}</p>
                </div>
                <StatusBadge value={payment.paymentStatus} />
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-700">
                <p>Table: {payment.order?.table?.tableNumber || '-'}</p>
                <p>Method: {payment.paymentMethod}</p>
                <p>Paid: {currency(payment.amountPaid)}</p>
                <p>Change: {currency(payment.changeAmount)}</p>
                <p>Time: {formatDateTime(payment.createdAt)}</p>
                <div className="pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setReceiptPayment(payment);
                      printReceipt(payment);
                    }}
                  >
                    Print Receipt
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {!filteredPayments.length ? <p className="rounded-xl bg-white p-4 text-sm text-slate-500">No bill records found</p> : null}
        </div>
      </Panel>
    </div>
  );
};

export default BillingPage;
