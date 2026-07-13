import { useEffect, useMemo, useState } from 'react';
import { orderService, paymentService, planService } from '../api/services';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { FEATURE_KEYS, PAYMENT_METHODS, PERMISSIONS } from '../utils/constants';
import { currency, formatDateTime } from '../utils/format';
import { getReceiptSettings } from '../utils/receiptSettings';
import { downloadReceiptPdf } from '../utils/receiptPdf';

const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const paymentOrderId = (payment) => String(payment?.order?._id || payment?.order || '');
const orderTableNumber = (order) => String(order?.table?.tableNumber || '').trim().toLowerCase();
const paymentTableNumber = (payment) => orderTableNumber(payment?.order);
const timestampMs = (value) => {
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
};

const combineReceiptPayments = (group = []) => {
  const payments = group.filter(Boolean);
  if (!payments.length) return null;

  const orders = payments.map((payment) => payment.order).filter(Boolean);
  const items = orders.flatMap((order) =>
    (order.items || []).map((item) => ({
      ...item,
      name: `${item.name || '-'} (${order.orderNumber || '-'})`
    }))
  );
  const subtotal = roundMoney(
    orders.reduce((sum, order) => {
      const itemSubtotal = (order.items || []).reduce(
        (itemSum, item) => itemSum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );
      return sum + Number(order.subtotal ?? itemSubtotal);
    }, 0)
  );
  const discount = roundMoney(orders.reduce((sum, order) => sum + Number(order.discount || 0), 0));
  const total = roundMoney(orders.reduce((sum, order) => sum + Number(order.total || 0), 0));
  const amountPaid = roundMoney(payments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0));
  const changeAmount = roundMoney(payments.reduce((sum, payment) => sum + Number(payment.changeAmount || 0), 0));
  const statuses = new Set(payments.map((payment) => payment.paymentStatus));
  const paymentStatus = statuses.size === 1 ? payments[0].paymentStatus : 'PARTIAL';

  return {
    ...payments[0],
    billNumber: payments.map((payment) => payment.billNumber).filter(Boolean).join(', '),
    paymentStatus,
    amountPaid,
    changeAmount,
    order: {
      orderNumber: orders.map((order) => order.orderNumber).filter(Boolean).join(', '),
      orderType: orders[0]?.orderType || 'DINE_IN',
      table: orders[0]?.table,
      items,
      subtotal,
      discount,
      total
    }
  };
};

const combineReceiptFromOrders = ({ basePayment, receiptOrders = [], receiptPayments = [] }) => {
  const orders = receiptOrders.filter(Boolean);
  if (!orders.length) return basePayment || null;

  const payments = receiptPayments.filter(Boolean);
  const items = orders.flatMap((order) =>
    (order.items || []).map((item) => ({
      ...item,
      name: orders.length > 1 ? `${item.name || '-'} (${order.orderNumber || '-'})` : item.name
    }))
  );
  const subtotal = roundMoney(
    orders.reduce((sum, order) => {
      const itemSubtotal = (order.items || []).reduce(
        (itemSum, item) => itemSum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );
      return sum + Number(order.subtotal ?? itemSubtotal);
    }, 0)
  );
  const discount = roundMoney(orders.reduce((sum, order) => sum + Number(order.discount || 0), 0));
  const total = roundMoney(orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0));
  const amountPaid = roundMoney(
    payments.length
      ? payments.reduce((sum, payment) => sum + Number(payment.amountPaid || 0), 0)
      : Number(basePayment?.amountPaid || total)
  );
  const changeAmount = roundMoney(
    payments.length
      ? payments.reduce((sum, payment) => sum + Number(payment.changeAmount || 0), 0)
      : Number(basePayment?.changeAmount || 0)
  );

  return {
    ...(basePayment || {}),
    billNumber: payments.length
      ? payments.map((payment) => payment.billNumber).filter(Boolean).join(', ')
      : basePayment?.billNumber,
    amountPaid,
    changeAmount,
    order: {
      orderNumber: orders.map((order) => order.orderNumber).filter(Boolean).join(', '),
      orderType: orders[0]?.orderType || basePayment?.order?.orderType || 'DINE_IN',
      table: orders[0]?.table || basePayment?.order?.table,
      items,
      subtotal,
      discount,
      total
    }
  };
};

const buildReceiptHtml = (payment, cashierName = '') => {
  const order = payment?.order || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const receiptSettings = getReceiptSettings();
  const contactLines = [
    receiptSettings.address,
    receiptSettings.phone ? `Phone: ${receiptSettings.phone}` : '',
    receiptSettings.email ? `Email: ${receiptSettings.email}` : ''
  ].filter(Boolean);
  const estimatedHeightMm = Math.max(58, Math.min(500, 70 + items.length * 7));
  const subtotal = Number(
    order.subtotal ?? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  );
  const discount = Number(order.discount || 0);
  const total = Number(order.total ?? Math.max(0, subtotal - discount));
  const amountPaid = Number(payment?.amountPaid || 0);
  const changeAmount = Number(payment?.changeAmount || 0);
  const paymentDate = payment?.createdAt ? new Date(payment.createdAt).toLocaleString('en-NP') : '-';
  const cashier = payment?.paidBy?.name || cashierName || 'Cashier';
  const money = (value) => Number(value || 0).toFixed(2);

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
          <td style="text-align:right;">${money(price)}</td>
          <td style="text-align:right;">${money(lineTotal)}</td>
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
    @page { size: 58mm ${estimatedHeightMm}mm; margin: 0; }
    * { box-sizing: border-box; font-family: "Courier New", monospace; color: #111827; }
    html, body { margin: 0; padding: 0; width: 58mm; height: auto; background: #ffffff; }
    .receipt { width: 58mm; height: auto; margin: 0; padding: 2mm 2mm 2.5mm; }
    .center { text-align: center; }
    h1 { margin: 0; font-size: 12px; line-height: 1.15; letter-spacing: 0.2px; }
    .muted { color: #4b5563; font-size: 8px; margin-top: 1px; line-height: 1.1; }
    .row { display: flex; justify-content: space-between; gap: 4px; font-size: 9px; line-height: 1.25; margin: 0.9mm 0; }
    .row > span:first-child { white-space: nowrap; }
    .row > span:last-child { text-align: right; }
    .divider { border-top: 1px dashed #9ca3af; margin: 1.2mm 0; }
    table { width: 100%; border-collapse: collapse; font-size: 8.3px; table-layout: fixed; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 0.65mm 0.4mm; vertical-align: top; word-wrap: break-word; }
    th { text-align: left; background: #f8fafc; font-size: 8.4px; }
    th:nth-child(1), td:nth-child(1) { width: 7%; }
    th:nth-child(2), td:nth-child(2) { width: 39%; }
    th:nth-child(3), td:nth-child(3) { width: 10%; }
    th:nth-child(4), td:nth-child(4) { width: 22%; }
    th:nth-child(5), td:nth-child(5) { width: 22%; }
    th:nth-child(1), td:nth-child(1),
    th:nth-child(3), td:nth-child(3),
    th:nth-child(4), td:nth-child(4),
    th:nth-child(5), td:nth-child(5) { white-space: nowrap; }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) { text-align: right; }
    td { overflow: hidden; }
    .totals .row { font-size: 9px; }
    .grand { font-weight: 700; font-size: 10px; }
    .footer { text-align: center; font-size: 8px; color: #4b5563; margin-top: 1.4mm; line-height: 1.2; }
    @media print {
      @page { size: 58mm ${estimatedHeightMm}mm; margin: 0; }
      html, body { width: 58mm; height: auto; }
      .receipt { width: 58mm; height: auto; }
    }
  </style>
</head>
<body>
  <section class="receipt">
    <div class="center">
      <h1>${escapeHtml(receiptSettings.businessName || 'Restaurant RMS')}</h1>
      <p class="muted">Customer Bill</p>
      ${contactLines.map((line) => `<p class="muted">${escapeHtml(line)}</p>`).join('')}
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
    <p class="footer">${escapeHtml(receiptSettings.footerText || 'Thank you for dining with us.')}</p>
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

  const [lookupTableNumber, setLookupTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PAID');
  const [discountPercent, setDiscountPercent] = useState('');

  const [historySearch, setHistorySearch] = useState('');
  const [historyMethod, setHistoryMethod] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');

  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const canCreateBills = Array.isArray(user?.permissions) && user.permissions.includes(PERMISSIONS.PAYMENT_COLLECT);

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

    const refresh = () => {
      load().catch(() => {
        // Keep the billing screen usable if a background refresh fails briefly.
      });
    };
    const timer = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const paidOrderIds = useMemo(() => new Set(payments.map((p) => paymentOrderId(p)).filter(Boolean)), [payments]);

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
    const tableSearch = lookupTableNumber.trim().toLowerCase();
    if (!tableSearch) return [];

    return payableOrders.filter((order) => {
      return String(order.table?.tableNumber || '').trim().toLowerCase() === tableSearch;
    });
  }, [payableOrders, lookupTableNumber]);

  const parsedDiscountPercent = Number(discountPercent || 0);
  const validDiscountPercent =
    Number.isFinite(parsedDiscountPercent) && parsedDiscountPercent >= 0
      ? Math.min(parsedDiscountPercent, 100)
      : 0;
  const tableItems = useMemo(() => {
    return filteredPayableOrders.flatMap((order) =>
      (order.items || []).map((item, orderItemIndex) => ({
        ...item,
        orderNumber: order.orderNumber,
        orderId: order._id,
        orderItemIndex
      }))
    );
  }, [filteredPayableOrders]);

  const getOrderSubtotal = (order) => {
    const itemSubtotal = (order.items || []).reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
    return roundMoney(Number(order.subtotal ?? itemSubtotal));
  };

  const getOrderPayableTotal = (order) => {
    const subtotal = getOrderSubtotal(order);
    if (discountPercent === '') return roundMoney(Number(order.total ?? subtotal));
    return roundMoney(Math.max(0, subtotal * (1 - validDiscountPercent / 100)));
  };

  const tableSubtotal = useMemo(
    () => roundMoney(filteredPayableOrders.reduce((sum, order) => sum + getOrderSubtotal(order), 0)),
    [filteredPayableOrders]
  );
  const tableTotal = useMemo(
    () => roundMoney(filteredPayableOrders.reduce((sum, order) => sum + getOrderPayableTotal(order), 0)),
    [filteredPayableOrders, discountPercent, validDiscountPercent]
  );
  const tableDiscountAmount = roundMoney(Math.max(0, tableSubtotal - tableTotal));

  useEffect(() => {
    if (!filteredPayableOrders.length) {
      setAmountPaid('');
      return;
    }
    if (paymentStatus === 'PAID') setAmountPaid(String(tableTotal));
    if (paymentStatus === 'UNPAID') setAmountPaid('0');
  }, [filteredPayableOrders.length, paymentStatus, tableTotal]);

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

  const getPrintablePayment = (payment) => {
    if (!payment) return null;

    if (payment.billGroupId) {
      const group = payments.filter((row) => row.billGroupId === payment.billGroupId);
      const groupedReceipt = combineReceiptPayments(group.length ? group : [payment]);
      if (groupedReceipt?.order?.items?.length) return groupedReceipt;
    }

    const tableNumber = paymentTableNumber(payment);
    const paidAt = timestampMs(payment.createdAt);
    const sameTablePayments = payments.filter((row) => {
      if (!tableNumber || paymentTableNumber(row) !== tableNumber) return false;
      if (!paidAt || !timestampMs(row.createdAt)) return paymentOrderId(row) === paymentOrderId(payment);
      return Math.abs(timestampMs(row.createdAt) - paidAt) <= 2 * 60 * 1000;
    });
    const orderIds = new Set(sameTablePayments.map((row) => paymentOrderId(row)).filter(Boolean));
    if (paymentOrderId(payment)) orderIds.add(paymentOrderId(payment));

    const receiptOrders = orders.filter((order) => orderIds.has(String(order._id)));
    if (receiptOrders.length) {
      return combineReceiptFromOrders({
        basePayment: payment,
        receiptOrders,
        receiptPayments: sameTablePayments.length ? sameTablePayments : [payment]
      });
    }

    if (Array.isArray(payment.order?.items) && payment.order.items.length) {
      return combineReceiptFromOrders({
        basePayment: payment,
        receiptOrders: [payment.order],
        receiptPayments: [payment]
      });
    }

    return payment;
  };

  const printPaymentReceipt = (payment) => {
    const printablePayment = getPrintablePayment(payment);
    setReceiptPayment(printablePayment);
    printReceipt(printablePayment);
  };

  const downloadPaymentReceiptPdf = async (payment) => {
    setError('');
    try {
      const printablePayment = getPrintablePayment(payment);
      setReceiptPayment(printablePayment);
      await downloadReceiptPdf(printablePayment, user?.name || 'Cashier');
    } catch (err) {
      setError(err.message || 'Unable to download receipt PDF');
    }
  };

  const editBillingOrderItem = async (item) => {
    setError('');
    const order = filteredPayableOrders.find((row) => row._id === item.orderId);
    if (!order) {
      setError('Order not found for selected item');
      return;
    }

    const nextQuantityValue = window.prompt(
      `Update quantity for ${item.name}. Enter 0 to remove this item from the bill.`,
      String(item.quantity || 1)
    );
    if (nextQuantityValue === null) return;

    const nextQuantity = Number(nextQuantityValue);
    if (!Number.isFinite(nextQuantity) || nextQuantity < 0) {
      setError('Quantity must be 0 or more');
      return;
    }

    const nextNotes = window.prompt('Update item note if needed', item.notes || '');
    if (nextNotes === null) return;

    const nextItems = (order.items || [])
      .map((orderItem, orderItemIndex) => {
        const isTarget = orderItemIndex === item.orderItemIndex;
        return {
          _id: orderItem._id,
          menuItem: orderItem.menuItem?._id || orderItem.menuItem,
          quantity: isTarget ? nextQuantity : Number(orderItem.quantity || 1),
          notes: isTarget ? nextNotes : orderItem.notes || ''
        };
      })
      .filter((orderItem) => Number(orderItem.quantity || 0) > 0);

    if (!nextItems.length) {
      setError('An order must keep at least one item');
      return;
    }

    try {
      await orderService.updateItems(order._id, { items: nextItems });
      setReceiptPayment(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to edit order item');
    }
  };

  const createPayment = async () => {
    setError('');
    if (!lookupTableNumber.trim()) {
      setError('Please enter a table number to find billable orders');
      return;
    }
    if (!filteredPayableOrders.length) {
      setError('No READY or SERVED unpaid orders found for this table');
      return;
    }

    const numericAmountPaid = Number(amountPaid);
    if (!Number.isFinite(numericAmountPaid) || numericAmountPaid < 0) {
      setError('Please enter a valid amount paid');
      return;
    }
    if (paymentStatus === 'PAID' && numericAmountPaid < tableTotal) {
      setError(`Paid amount must be at least ${currency(tableTotal)} for this table`);
      return;
    }
    if (paymentStatus === 'PARTIAL' && (numericAmountPaid <= 0 || numericAmountPaid >= tableTotal)) {
      setError('Partial payments must be more than zero and less than the table total');
      return;
    }
    if (paymentStatus === 'UNPAID' && numericAmountPaid !== 0) {
      setError('Unpaid records must use amount paid as 0');
      return;
    }

    try {
      let remainingPaid = roundMoney(numericAmountPaid);
      const createdPayments = [];
      const billGroupId =
        filteredPayableOrders.length > 1
          ? `TABLE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          : '';

      for (const [index, order] of filteredPayableOrders.entries()) {
        const orderTotal = getOrderPayableTotal(order);
        const isLastOrder = index === filteredPayableOrders.length - 1;
        let splitPaid = 0;
        let splitStatus = paymentStatus;

        if (paymentStatus === 'PAID') {
          splitPaid = orderTotal;
          if (isLastOrder && numericAmountPaid > tableTotal) {
            splitPaid = roundMoney(splitPaid + numericAmountPaid - tableTotal);
          }
          splitStatus = 'PAID';
        } else if (paymentStatus === 'PARTIAL') {
          splitPaid = roundMoney(Math.min(orderTotal, remainingPaid));
          remainingPaid = roundMoney(remainingPaid - splitPaid);
          splitStatus = splitPaid >= orderTotal ? 'PAID' : splitPaid > 0 ? 'PARTIAL' : 'UNPAID';
        }

        const payload = {
          order: order._id,
          tableNumber: lookupTableNumber.trim(),
          paymentMethod,
          amountPaid: splitPaid,
          paymentStatus: splitStatus,
          billGroupId,
          billGroupTableNumber: lookupTableNumber.trim(),
          billGroupOrderCount: filteredPayableOrders.length
        };
        if (discountPercent !== '') payload.discountPercent = validDiscountPercent;

        createdPayments.push(await paymentService.create(payload));
      }

      const combinedReceipt = {
        ...(createdPayments.at(-1) || {}),
        billNumber: createdPayments.map((payment) => payment.billNumber).filter(Boolean).join(', '),
        paymentMethod,
        paymentStatus,
        amountPaid: numericAmountPaid,
        changeAmount: roundMoney(Math.max(0, numericAmountPaid - tableTotal)),
        order: {
          orderNumber: filteredPayableOrders.map((order) => order.orderNumber).join(', '),
          orderType: 'DINE_IN',
          table: filteredPayableOrders[0]?.table,
          items: tableItems.map((item) => ({
            ...item,
            name: `${item.name || '-'} (${item.orderNumber || '-'})`
          })),
          subtotal: tableSubtotal,
          discount: tableDiscountAmount,
          total: tableTotal
        }
      };

      setReceiptPayment(combinedReceipt);
      setAmountPaid('');
      setPaymentMethod('CASH');
      setPaymentStatus('PAID');
      setDiscountPercent('');
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

      {canCreateBills ? (
        <Panel title="Billing & Payment Entry" subtitle="Create one combined table bill from every READY or SERVED unpaid order">
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="text-sm font-semibold text-slate-800">Table Lookup</h4>
              <Input
                label="Table Number"
                placeholder="T-1"
                value={lookupTableNumber}
                onChange={(e) => setLookupTableNumber(e.target.value)}
                helperText="Enter table number to show billable orders for that table"
              />

              {lookupTableNumber.trim() && !filteredPayableOrders.length ? (
                <p className="text-sm text-amber-700">
                  No billable order found for this table. Only READY or SERVED unpaid orders can be billed.
                </p>
              ) : null}

              {filteredPayableOrders.length ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-sky-100 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Orders</p>
                      <p className="text-xl font-bold text-slate-900">{filteredPayableOrders.length}</p>
                    </div>
                    <div className="rounded-xl border border-sky-100 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Items</p>
                      <p className="text-xl font-bold text-slate-900">{tableItems.length}</p>
                    </div>
                    <div className="rounded-xl border border-sky-100 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Table Total</p>
                      <p className="text-xl font-bold text-brand-700">{currency(tableTotal)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">Billable Orders On This Table</p>
                    {filteredPayableOrders.map((order) => (
                      <div key={order._id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{order.orderNumber}</p>
                            <p className="text-xs text-slate-500">
                              {order.items?.length || 0} items | {currency(getOrderPayableTotal(order))}
                            </p>
                          </div>
                          <StatusBadge value={order.status} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                    <div className="grid grid-cols-[1fr_54px_82px_64px] gap-2 border-b border-slate-100 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                      <span>Ordered Item</span>
                      <span className="text-right">Qty</span>
                      <span className="text-right">Total</span>
                      <span className="text-right">Edit</span>
                    </div>
                    {tableItems.map((item, index) => {
                      const qty = Number(item.quantity || 0);
                      const price = Number(item.price || 0);
                      return (
                        <div
                          key={`${item.orderId}-${item._id || index}`}
                          className="grid grid-cols-[1fr_54px_82px_64px] gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0"
                        >
                          <span>
                            <span className="font-medium text-slate-900">{item.name || '-'}</span>
                            <span className="block text-xs text-slate-500">{item.orderNumber}</span>
                            {item.notes ? <span className="block text-xs text-amber-700">Note: {item.notes}</span> : null}
                          </span>
                          <span className="text-right text-slate-700">{qty}</span>
                          <span className="text-right font-semibold text-slate-900">{currency(qty * price)}</span>
                          <span className="text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="px-2 py-1 text-xs"
                              onClick={() => editBillingOrderItem(item)}
                            >
                              Edit
                            </Button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
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
                label="Discount (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                helperText="Optional. Applied to each billable order before payment is recorded."
              />

              <Input
                label="Amount Paid"
                type="number"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />

              <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm">
                <p className="font-semibold text-slate-800">Table Bill Summary</p>
                <div className="mt-2 space-y-1 text-slate-700">
                  <p>Table: {lookupTableNumber.trim() || '-'}</p>
                  <p>Orders: {filteredPayableOrders.length}</p>
                  <p>Items: {tableItems.length}</p>
                  <p>Subtotal: {currency(tableSubtotal)}</p>
                  <p>Discount: {currency(tableDiscountAmount)} ({validDiscountPercent}%)</p>
                  <p className="text-base font-bold text-slate-900">Grand Total: {currency(tableTotal)}</p>
                </div>
              </div>
            </div>
          </div>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

          <div className="mt-4 grid gap-2 sm:flex">
            <Button className="px-6 py-3 text-base" onClick={createPayment}>Accept Payment</Button>
            <Button
              variant="secondary"
              className="px-6 py-3 text-base"
              onClick={() => {
                if (receiptPayment) printReceipt(receiptPayment);
                else printPaymentReceipt(filteredPayments[0]);
              }}
              disabled={!receiptPayment && !filteredPayments.length}
            >
              Print Latest Receipt
            </Button>
            <Button
              variant="secondary"
              className="px-6 py-3 text-base"
              onClick={() => downloadPaymentReceiptPdf(receiptPayment || filteredPayments[0])}
              disabled={!receiptPayment && !filteredPayments.length}
            >
              Download PDF
            </Button>
          </div>
        </Panel>
      ) : null}

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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => printPaymentReceipt(payment)}
                      >
                        Print
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => downloadPaymentReceiptPdf(payment)}
                      >
                        PDF
                      </Button>
                    </div>
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
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => printPaymentReceipt(payment)}
                  >
                    Print Receipt
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => downloadPaymentReceiptPdf(payment)}
                  >
                    Download PDF
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
