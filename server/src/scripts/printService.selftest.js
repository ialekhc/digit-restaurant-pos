import assert from 'assert/strict';
import {
  buildCounterReceiptPayload,
  buildCounterOrderBillPayload,
  buildStationPayload,
  groupItemsByStation,
  kotNumberForKey,
  normalizeStation,
  printerPurposeForStation,
  stationFromMenu
} from '../services/printService.js';

const mixedItems = [
  { _id: '1', name: 'Momo', quantity: 2, price: 120, preparationStation: 'KITCHEN' },
  { _id: '2', name: 'Cold Coffee', quantity: 1, price: 90, preparationStation: 'BAR' },
  { _id: '3', name: 'Hookah', quantity: 1, price: 400, preparationStation: 'SMOKE' },
  { _id: '4', name: 'No prep', quantity: 1, price: 10, preparationStation: 'NONE' }
];

assert.equal(normalizeStation('FOOD'), 'KITCHEN');
assert.equal(stationFromMenu({ menuType: 'DRINK' }), 'BAR');
assert.equal(stationFromMenu({ menuType: 'SMOKE' }), 'SMOKE');
assert.equal(stationFromMenu({ menuType: 'DRINK', preparationStation: 'KITCHEN' }), 'BAR');
assert.equal(stationFromMenu({ menuType: 'SMOKE', preparationStation: 'KITCHEN' }), 'SMOKE');
assert.equal(printerPurposeForStation('KITCHEN'), 'KITCHEN');
assert.equal(printerPurposeForStation('BAR'), 'BAR');
assert.equal(printerPurposeForStation('SMOKE'), 'SMOKE');
assert.equal(printerPurposeForStation('COUNTER'), 'COUNTER');

const grouped = groupItemsByStation(mixedItems);
assert.equal(grouped.KITCHEN.length, 1, 'Kitchen group should contain only kitchen items');
assert.equal(grouped.BAR.length, 1, 'Bar group should contain only bar items');
assert.equal(grouped.SMOKE.length, 1, 'Smoke group should contain only smoke items');
assert.equal(grouped.NONE, undefined, 'NONE station must not create a printable group');

const stationPayload = buildStationPayload({
  order: { orderNumber: 'ORD-1', orderType: 'DINE_IN', table: { tableNumber: 'T-1' }, createdBy: { name: 'Waiter' } },
  station: 'BAR',
  items: [mixedItems[1]],
  restaurant: { restaurantName: 'Demo Cafe' },
  source: 'ADDED_ITEMS',
  kotNumber: kotNumberForKey('ADDED_ITEMS:order:BAR:item')
});
assert.equal(stationPayload.items.length, 1, 'Station ticket should include only its station items');
assert.equal(stationPayload.items[0].name, 'Cold Coffee');
assert.equal(stationPayload.ticketType, 'ADDITIONAL KOT');
assert.match(stationPayload.kotNumber, /^KOT-[A-F0-9]{10}$/);
assert.equal(stationPayload.subtotal, undefined, 'Station ticket must not include financial totals');
assert.equal(stationPayload.paymentMethod, undefined, 'Station ticket must not include payment information');

const counterOrderBillPayload = buildCounterOrderBillPayload({
  order: {
    orderNumber: 'ORD-1',
    orderType: 'DINE_IN',
    table: { tableNumber: 'T-1' },
    createdBy: { name: 'Waiter' },
    items: mixedItems,
    subtotal: 610,
    discount: 0,
    total: 610
  },
  restaurant: { restaurantName: 'Demo Cafe' }
});
assert.equal(counterOrderBillPayload.items.length, 4, 'Counter order bill should include every ordered item');
assert.equal(counterOrderBillPayload.grandTotal, 610);
assert.equal(counterOrderBillPayload.paymentMethod, undefined, 'Order-time counter bill must not claim a payment method');

const receiptPayload = buildCounterReceiptPayload({
  payment: { billNumber: 'BILL-1', amountPaid: 610, changeAmount: 0, paymentMethod: 'CASH', paidBy: { name: 'Cashier' } },
  payments: [{ billNumber: 'BILL-1', amountPaid: 610, changeAmount: 0, paymentMethod: 'CASH' }],
  order: { orderNumber: 'ORD-1', orderType: 'DINE_IN', table: { tableNumber: 'T-1' }, items: mixedItems, subtotal: 610, discount: 0, total: 610 },
  restaurant: { restaurantName: 'Demo Cafe', restaurantAddress: 'Kathmandu' }
});
assert.equal(receiptPayload.items.length, 4, 'Counter receipt should include every ordered item');
assert.equal(receiptPayload.grandTotal, 610);
assert.equal(receiptPayload.paymentMethod, 'CASH');

console.log('printService selftest passed');
