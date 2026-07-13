import { getReceiptSettings } from './receiptSettings';

export const KITCHEN_AUTO_PRINT_KEY = 'rms_kitchen_auto_print';

const kitchenSectionLabels = {
  FOOD: 'Kitchen',
  BAR: 'Bar',
  SMOKE: 'Smoke'
};
const kitchenSectionOrder = ['FOOD', 'BAR', 'SMOKE'];

const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const shouldAutoPrintKitchenTicket = () => {
  return localStorage.getItem(KITCHEN_AUTO_PRINT_KEY) !== 'false';
};

export const setAutoPrintKitchenTicket = (enabled) => {
  localStorage.setItem(KITCHEN_AUTO_PRINT_KEY, enabled ? 'true' : 'false');
};

export const openKitchenPrintWindow = () => {
  const popup = window.open('', '_blank', 'width=420,height=760');
  if (!popup) return null;
  popup.document.open();
  popup.document.write('<p style="font-family: sans-serif; padding: 16px;">Preparing kitchen ticket...</p>');
  popup.document.close();
  return popup;
};

export const buildKitchenTicketHtml = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const receiptSettings = getReceiptSettings();
  const contactLines = [
    receiptSettings.address,
    receiptSettings.phone ? `Phone: ${receiptSettings.phone}` : ''
  ].filter(Boolean);
  const groupedItems = items.reduce((acc, item) => {
    const section = item.kitchenSection || 'FOOD';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  const placedAt = order?.createdAt ? new Date(order.createdAt).toLocaleString('en-NP') : new Date().toLocaleString('en-NP');
  const sections = kitchenSectionOrder
    .filter((section) => groupedItems[section]?.length)
    .concat(Object.keys(groupedItems).filter((section) => !kitchenSectionOrder.includes(section)));
  const estimatedHeightMm = Math.max(
    56,
    Math.min(500, 54 + Math.max(1, ...sections.map((section) => groupedItems[section]?.length || 0)) * 10)
  );
  const tickets = sections
    .map((section) => {
      const rows = groupedItems[section] || [];
      const itemRows = rows
        .map((item, index) => {
          const notes = item.notes ? `<div class="note">Note: ${escapeHtml(item.notes)}</div>` : '';
          return `<tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.name || '-')} ${notes}</td>
            <td class="qty">${Number(item.quantity || 0)}</td>
          </tr>`;
        })
        .join('');

      const label = kitchenSectionLabels[section] || section;

      return `<section class="ticket">
    <h1>${escapeHtml(label).toUpperCase()} ORDER</h1>
    <p class="sub">Separate production ticket</p>
    <p class="sub">${escapeHtml(receiptSettings.businessName || 'Restaurant RMS')}</p>
    ${contactLines.map((line) => `<p class="sub">${escapeHtml(line)}</p>`).join('')}
    <div class="divider"></div>
    <div class="row"><span>Order</span><strong>${escapeHtml(order?.orderNumber || '-')}</strong></div>
    <div class="row"><span>Table</span><strong>${escapeHtml(order?.table?.tableNumber || '-')}</strong></div>
    <div class="row"><span>Type</span><strong>${escapeHtml(order?.orderType || '-')}</strong></div>
    <div class="row"><span>Time</span><span>${escapeHtml(placedAt)}</span></div>
    <div class="divider"></div>
    <div class="section-title">${escapeHtml(label)}</div>
      <table>
        <thead>
          <tr><th>#</th><th>Item</th><th class="qty">Qty</th></tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
    <div class="divider"></div>
    <p class="footer">${escapeHtml(receiptSettings.footerText || 'Prepare and update display status.')}</p>
  </section>`;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kitchen Ticket ${escapeHtml(order?.orderNumber || '')}</title>
  <style>
    @page { size: 58mm ${estimatedHeightMm}mm; margin: 0; }
    * { box-sizing: border-box; font-family: "Courier New", monospace; color: #111827; }
    html, body { margin: 0; padding: 0; width: 58mm; height: auto; background: #ffffff; }
    .ticket { width: 58mm; height: auto; padding: 2mm; break-after: page; page-break-after: always; }
    .ticket:last-child { break-after: auto; page-break-after: auto; }
    h1 { margin: 0; text-align: center; font-size: 13px; letter-spacing: 0.3px; }
    .sub { margin: 1mm 0 0; text-align: center; font-size: 9px; color: #4b5563; }
    .divider { border-top: 1px dashed #9ca3af; margin: 1.5mm 0; }
    .row { display: flex; justify-content: space-between; gap: 4px; font-size: 9px; line-height: 1.25; margin: 1mm 0; }
    .row strong, .row span:last-child { text-align: right; }
    .section-title { margin-top: 1.7mm; border: 1px solid #111827; padding: 0.8mm; text-align: center; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; }
    th, td { border-bottom: 1px solid #e5e7eb; padding: 1mm 0.5mm; vertical-align: top; word-break: break-word; }
    th { text-align: left; font-size: 8px; text-transform: uppercase; }
    th:first-child, td:first-child { width: 8%; }
    th:nth-child(2), td:nth-child(2) { width: 72%; }
    .qty { width: 20%; text-align: right; font-weight: 700; }
    .note { margin-top: 0.5mm; font-size: 8px; color: #4b5563; }
    .footer { margin-top: 2mm; text-align: center; font-size: 8px; color: #4b5563; }
    @media print {
      @page { size: 58mm ${estimatedHeightMm}mm; margin: 0; }
      html, body { width: 58mm; height: auto; }
      .ticket { width: 58mm; height: auto; }
    }
  </style>
</head>
<body>
  ${tickets || '<section class="ticket"><h1>KITCHEN ORDER</h1><p class="sub">No items</p></section>'}
</body>
</html>`;
};

export const printKitchenTicket = (order, popup = null) => {
  const printPopup = popup || openKitchenPrintWindow();
  if (!printPopup) return false;

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    printPopup.focus();
    printPopup.print();
    printPopup.close();
  };

  printPopup.document.open();
  printPopup.document.write(buildKitchenTicketHtml(order));
  printPopup.document.close();
  printPopup.onload = doPrint;
  setTimeout(doPrint, 500);
  return true;
};
