import assert from 'node:assert/strict';
import { buildStationTicketHtml, buildStationTicketText } from '../client/src/utils/printingService.js';

const job = {
  station: 'KITCHEN',
  documentType: 'KITCHEN_PREPARATION_TICKET',
  printer: { paperWidthMm: 58 },
  order: { table: { tableNumber: 'A-1' } },
  payload: {
    restaurantName: 'Restaurant RMS',
    station: 'KITCHEN',
    orderNumber: 'ORD-1081',
    orderType: 'DINE_IN',
    waiter: 'Samir Rasaili',
    time: '2026-07-20T14:20:14.000Z',
    items: [{ name: 'Buff Sukuti Fry (Nepali Style)', quantity: 1, notes: 'NO ONION' }]
  }
};

const html = buildStationTicketHtml(job);
const text = buildStationTicketText(job);

for (const output of [html, text]) {
  assert.match(output, /FOOD \/ KITCHEN TICKET/);
  assert.match(output, /ORD-1081/);
  assert.match(output, /A-1/);
  assert.match(output, /DINE_IN/);
  assert.match(output, /Samir Rasaili/);
  assert.match(output, /TABLE NO\.:/);
  assert.match(output, /NOTE:.*NO ONION/s);
  assert.doesNotMatch(output, /KOT No/i);
  assert.doesNotMatch(output, /NPR|Subtotal|Grand Total|Payment Method|Paid:/i);
}

assert.match(html, /<th>#<\/th><th>Item<\/th><th>Qty<\/th>/);
assert.match(html, /station-title[^>]*>FOOD \/ KITCHEN TICKET<\/div>\s*<div class="table-banner">TABLE NO\.: A-1<\/div>/);
assert.match(html, /class="item-note"/);
assert.match(html, /Buff Sukuti Fry \(Nepali Style\)/);
assert.match(html, /Preparation ticket only\. No price or payment details\./);
assert.match(text, /#\s+Item\s+/);
assert.match(text, /Buff Sukuti Fry \(Nepali/);
assert.match(text, /Style\)/);
assert.match(text, /Preparation ticket only\. No/);
assert.match(text, /price or payment details\./);
assert.ok(text.indexOf('FOOD / KITCHEN TICKET') < text.indexOf('TABLE NO.: A-1'));

console.log('KOT ticket format smoke test passed');
