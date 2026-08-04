import assert from 'node:assert/strict';
import { buildReceiptHtml, buildReceiptText } from '../client/src/utils/printingService.js';

const receiptJob = (paperWidthMm) => ({
  documentType: 'COUNTER_RECEIPT',
  station: 'COUNTER',
  printer: { paperWidthMm },
  payload: {
    restaurantName: 'Jiggs Cafe and Family Restaurant',
    restaurantAddress: 'Mid-Baneshwor, Kathmandu',
    restaurantPhone: '01-5555555',
    invoiceNumber: 'BILL-1017',
    orderNumber: 'ORD-1055',
    tableNumber: 'A-1',
    orderType: 'DINE_IN',
    cashier: 'Jiggs Cafe Owner',
    items: [
      { name: 'Shikhar Ice', quantity: 1, unitPrice: 25, lineTotal: 25 },
      { name: 'Surya Lite Arctic Fusion', quantity: 1, unitPrice: 30, lineTotal: 30 }
    ],
    subtotal: 55,
    discount: 0,
    grandTotal: 55,
    paidAmount: 55,
    change: 0,
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    paidAt: '2026-07-20T14:47:05.000Z'
  }
});

const stripEscPos = (value) => value
  .replace(/\x1b[aE][\x00-\x01]/g, '')
  .replace(/\x1d[!B][\x00\x01\x11]/g, '');

for (const width of [58, 80]) {
  const job = receiptJob(width);
  const html = buildReceiptHtml(job);
  const text = buildReceiptText(job);
  const columnWidth = width >= 76 ? 48 : 32;

  for (const output of [html, text]) {
    assert.match(output, /Jiggs Cafe/);
    assert.match(output, /Family Restaurant/);
    assert.match(output, /CUSTOMER BILL|Customer Bill/);
    assert.match(output, /BILL-1017/);
    assert.match(output, /Jiggs Cafe Owner/);
    assert.match(output, /Payment Method/);
    assert.match(output, /Grand Total/);
  }

  const visibleLines = stripEscPos(text).split('\n');
  assert.ok(visibleLines.every((line) => line.length <= columnWidth), `${width}mm receipt contains an overflowing line`);
  assert.match(html, /<th>#<\/th><th>Item<\/th><th>Amount<\/th>/);
}

console.log('Billing receipt format smoke test passed');
