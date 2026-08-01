import assert from 'assert/strict';
import {
  buildCounterReceiptPayload,
  buildCounterOrderBillPayload,
  buildStationPayload,
  groupItemsByStation,
  normalizeStation,
  printerPurposeForStation,
  stationFromMenu
} from '../services/printService.js';

const mixedItems = [
  { _id: '1', name: 'Momo', quantity: 2, price: 120, preparationStation: 'KITCHEN' },
  { _id: '2', name: 'Cold Coffee', quantity: 1, price: 90, preparationStation: 'BAR' },
  { _id: '3', name: 'Hookah', quantity: 1, price: 400, preparationStation: 'SMOKE' },
  { _id: '4', name: 'No prep', quantity: 1, price: 10, preparationStation: 'NONE' },
  { _id: '5', name: 'Mixed Combo', quantity: 1, price: 500, menuType: 'COMBO_PLATTER', preparationStation: 'KITCHEN' }
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
assert.equal(grouped.KITCHEN.length, 2, 'Kitchen group should contain food and combo platter items');
assert.equal(grouped.BAR.length, 2, 'Bar group should contain drink and combo platter items');
assert.equal(grouped.SMOKE.length, 1, 'Smoke group should contain only smoke items');
assert.equal(grouped.NONE, undefined, 'NONE station must not create a printable group');
assert.equal(grouped.KITCHEN.filter((item) => item.menuType === 'COMBO_PLATTER').length, 1);
assert.equal(grouped.BAR.filter((item) => item.menuType === 'COMBO_PLATTER').length, 1);

const legacyGrouped = groupItemsByStation([
  { name: 'Legacy drink', menuType: 'DRINK', preparationStation: 'KITCHEN' },
  { name: 'Legacy smoke', menuType: 'SMOKE', preparationStation: 'KITCHEN' },
  { name: 'Hookah alias', preparationStation: 'HOOKAH' }
]);
assert.equal(legacyGrouped.KITCHEN, undefined, 'Legacy defaults must not send drinks or smoke to Kitchen');
assert.equal(legacyGrouped.BAR.length, 1, 'Drink menu type must print only at Bar');
assert.equal(legacyGrouped.SMOKE.length, 2, 'Smoke and Hookah designations must print only at Smoke');

const stationPayload = buildStationPayload({
  order: { orderNumber: 'ORD-1', orderType: 'DINE_IN', table: { tableNumber: 'T-1' }, createdBy: { name: 'Waiter' } },
  station: 'BAR',
  items: mixedItems,
  restaurant: { restaurantName: 'Demo Cafe' },
  source: 'ADDED_ITEMS'
});
assert.equal(stationPayload.items.length, 2, 'Bar ticket must contain drink and combo platter items');
assert.equal(stationPayload.items[0].name, 'Cold Coffee');
assert.equal(stationPayload.items[1].name, 'Mixed Combo');
assert.equal(stationPayload.ticketType, 'ADDITIONAL KOT');
assert.equal(stationPayload.kotNumber, undefined, 'Station tickets must not include a KOT number');
assert.equal(stationPayload.subtotal, undefined, 'Station ticket must not include financial totals');
assert.equal(stationPayload.paymentMethod, undefined, 'Station ticket must not include payment information');

const counterOrderBillPayload = buildCounterOrderBillPayload({
  order: {
    orderNumber: 'ORD-1',
    orderType: 'DINE_IN',
    table: { tableNumber: 'T-1' },
    createdBy: { name: 'Waiter' },
    items: mixedItems,
    subtotal: 1110,
    discount: 0,
    total: 1110
  },
  restaurant: { restaurantName: 'Demo Cafe' }
});
assert.equal(counterOrderBillPayload.items.length, 5, 'Counter order bill should include every ordered item once');
assert.equal(counterOrderBillPayload.grandTotal, 1110);
assert.equal(counterOrderBillPayload.paymentMethod, undefined, 'Order-time counter bill must not claim a payment method');

const receiptPayload = buildCounterReceiptPayload({
  payment: { billNumber: 'BILL-1', amountPaid: 1110, changeAmount: 0, paymentMethod: 'CASH', paidBy: { name: 'Cashier' } },
  payments: [{ billNumber: 'BILL-1', amountPaid: 1110, changeAmount: 0, paymentMethod: 'CASH' }],
  order: { orderNumber: 'ORD-1', orderType: 'DINE_IN', table: { tableNumber: 'T-1' }, items: mixedItems, subtotal: 1110, discount: 0, total: 1110 },
  restaurant: { restaurantName: 'Demo Cafe', restaurantAddress: 'Kathmandu' }
});
assert.equal(receiptPayload.items.length, 5, 'Counter receipt should include every ordered item once');
assert.equal(receiptPayload.grandTotal, 1110);
assert.equal(receiptPayload.paymentMethod, 'CASH');
assert.equal(receiptPayload.paymentStatus, 'PAID');
assert.equal(receiptPayload.restaurantName, 'Demo Cafe');
assert.equal(receiptPayload.cashier, 'Cashier');

console.log('printService selftest passed');
