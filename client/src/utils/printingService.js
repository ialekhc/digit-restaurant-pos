import qz from 'qz-tray';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[char]));

const money = (value) => `NPR ${Number(value || 0).toFixed(2)}`;

class BrowserPrintAdapter {
  constructor() {
    this.connected = true;
  }

  async connect() {
    this.connected = true;
    return true;
  }

  async disconnect() {
    this.connected = false;
  }

  async getPrinters() {
    return [];
  }

  isConnected() {
    return this.connected;
  }

  async printHtml({ html }) {
    const popup = window.open('', '_blank', 'width=460,height=700');
    if (!popup) throw new Error('Popup blocked. Allow pop-ups for print station fallback printing.');
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    await new Promise((resolve) => setTimeout(resolve, 250));
    popup.print();
    popup.close();
    return true;
  }

  async printRaw({ raw }) {
    return this.printHtml({ html: `<pre>${escapeHtml(raw)}</pre>` });
  }

  async testPrint({ printer }) {
    return this.printHtml({ html: buildTestPrintHtml(printer) });
  }
}

class QzTrayAdapter {
  constructor() {
    this.qz = qz;
  }

  async connect() {
    if (!this.qz) throw new Error('QZ Tray is not loaded on this page');
    if (!this.qz.websocket.isActive()) await this.qz.websocket.connect({ retries: 3, delay: 1 });
    return true;
  }

  configureSecurity({ getCertificate, sign }) {
    this.qz.security.setCertificatePromise(async () => getCertificate());
    this.qz.security.setSignatureAlgorithm('SHA512');
    this.qz.security.setSignaturePromise(async (request) => sign(request));
  }

  async disconnect() {
    if (this.qz?.websocket?.isActive()) await this.qz.websocket.disconnect();
  }

  async getPrinters() {
    await this.connect();
    return this.qz.printers.find();
  }

  isConnected() {
    return Boolean(this.qz?.websocket?.isActive());
  }

  async resolvePrinterName(printer = {}) {
    const requestedName = String(printer.name || printer.printerSystemName || '').trim();
    if (!requestedName) throw new Error('Printer name is required');

    const discovered = await this.qz.printers.find();
    const printerNames = (Array.isArray(discovered) ? discovered : [discovered])
      .map((name) => String(name || '').trim())
      .filter(Boolean);
    const exactName = printerNames.find((name) => name.toLowerCase() === requestedName.toLowerCase());
    if (!exactName) {
      throw new Error(`Printer named "${requestedName}" is not connected or is not installed on this system`);
    }
    return exactName;
  }

  async printHtml({ html, printer }) {
    await this.connect();
    const printerName = await this.resolvePrinterName(printer);
    const config = this.qz.configs.create(printerName, {
      copies: Number(printer?.copies || 1),
      size: { width: Number(printer?.paperWidthMm || 58), units: 'mm' }
    });
    return this.qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
  }

  async printRaw({ raw, printer }) {
    await this.connect();
    const printerName = await this.resolvePrinterName(printer);
    const config = this.qz.configs.create(printerName, { copies: Number(printer?.copies || 1) });
    return this.qz.print(config, [{ type: 'raw', format: 'plain', data: raw }]);
  }

  async testPrint({ printer }) {
    return this.printHtml({ printer, html: buildTestPrintHtml(printer) });
  }
}

class DesktopPrintAdapter {
  isAvailable() {
    return Boolean(
      window.digitDesktop?.isDesktop &&
      typeof window.digitDesktop.getPrinters === 'function' &&
      typeof window.digitDesktop.printHtml === 'function'
    );
  }

  async connect() {
    if (!this.isAvailable()) throw new Error('Desktop printer bridge is not available');
    return true;
  }

  async disconnect() {}

  isConnected() {
    return this.isAvailable();
  }

  async getPrinters() {
    await this.connect();
    return window.digitDesktop.getPrinters();
  }

  async resolvePrinterName(printer = {}) {
    const requestedName = String(printer.name || printer.printerSystemName || '').trim();
    if (!requestedName) throw new Error('Printer name is required');

    const discovered = await this.getPrinters();
    const exactName = (Array.isArray(discovered) ? discovered : [discovered])
      .map((name) => String(name || '').trim())
      .find((name) => name.toLowerCase() === requestedName.toLowerCase());
    if (!exactName) {
      throw new Error(`Printer named "${requestedName}" is not connected or is not installed on this system`);
    }
    return exactName;
  }

  async printHtml({ html, printer, job, rawText = '' }) {
    const printerName = await this.resolvePrinterName(printer);
    try {
      return await window.digitDesktop.printHtml({
        html,
        text: rawText || buildPrintTextForJob(job),
        printerName,
        copies: Number(printer?.copies || 1),
        paperWidthMm: Number(printer?.paperWidthMm || 58)
      });
    } catch (error) {
      const message = String(error?.message || error || 'Desktop print failed')
        .replace(/^Error invoking remote method 'desktop:print-html':\s*(?:Error:\s*)?/, '');
      throw new Error(message);
    }
  }

  async printRaw({ raw, printer }) {
    return this.printHtml({ html: `<pre>${escapeHtml(raw)}</pre>`, printer });
  }

  async testPrint({ printer }) {
    return this.printHtml({
      printer,
      html: buildTestPrintHtml(printer),
      rawText: buildTestPrintText(printer)
    });
  }
}

class RoutedPrinterAdapter {
  constructor() {
    this.browser = new BrowserPrintAdapter();
    this.desktop = new DesktopPrintAdapter();
    this.qz = new QzTrayAdapter();
    this.qzError = '';
  }

  async connect() {
    await this.browser.connect();
    if (this.desktop.isAvailable()) {
      await this.desktop.connect();
      this.qzError = '';
      return true;
    }
    try {
      await this.qz.connect();
      this.qzError = '';
    } catch (error) {
      this.qzError = error.message || 'QZ Tray is unavailable';
    }
    return true;
  }

  configureSecurity(providers) {
    this.qz.configureSecurity(providers);
  }

  async disconnect() {
    await Promise.allSettled([this.browser.disconnect(), this.desktop.disconnect(), this.qz.disconnect()]);
  }

  isConnected() {
    return this.desktop.isAvailable() || this.qz.isConnected();
  }

  statusMessage() {
    if (this.desktop.isAvailable()) return 'Desktop printer bridge connected';
    return this.qz.isConnected() ? 'QZ Tray connected' : `Browser fallback only${this.qzError ? `: ${this.qzError}` : ''}`;
  }

  usesNativePrinting() {
    return this.desktop.isAvailable();
  }

  adapterFor(printer = {}) {
    if (String(printer.connectionType || '').toUpperCase() === 'BROWSER') return this.browser;
    return this.desktop.isAvailable() ? this.desktop : this.qz;
  }

  async getPrinters() {
    return this.desktop.isAvailable() ? this.desktop.getPrinters() : this.qz.getPrinters();
  }

  async printHtml(options) {
    return this.adapterFor(options.printer).printHtml(options);
  }

  async printRaw(options) {
    return this.adapterFor(options.printer).printRaw(options);
  }

  async testPrint(options) {
    return this.adapterFor(options.printer).testPrint(options);
  }
}

let sharedPrinterAdapter;

export const createPrinterAdapter = () => {
  if (!sharedPrinterAdapter) sharedPrinterAdapter = new RoutedPrinterAdapter();
  return sharedPrinterAdapter;
};

const baseStyles = (width = 58) => `
  <style>
    @page { size: ${Number(width || 58)}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .ticket { width: ${Number(width || 58)}mm; padding: 3mm; font-size: 12px; line-height: 1.35; }
    h1, h2, p { margin: 0; }
    h1 { text-align: center; font-size: 16px; }
    h2 { text-align: center; font-size: 13px; margin-top: 2px; }
    .line { border-top: 1px dashed #6b7280; margin: 6px 0; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th, td { padding: 2px 0; text-align: left; vertical-align: top; }
    th:nth-child(2), td:nth-child(2), th:nth-child(3), td:nth-child(3) { text-align: right; }
    .center { text-align: center; }
    .muted { color: #4b5563; font-size: 10px; }
    .total { font-weight: 800; font-size: 13px; }
    .station-title { border: 2px solid #111827; margin: 7px 0 8px; padding: 5px 2px; font-size: 15px; font-weight: 900; text-align: center; }
    .station-meta .row { align-items: baseline; font-size: 12px; margin: 2px 0; }
    .station-meta .row strong { text-align: right; font-size: 13px; }
    .kot-items { margin-top: 0; }
    .kot-items th { border-bottom: 1px solid #cbd5e1; font-size: 12px; font-weight: 900; }
    .kot-items td { border-bottom: 1px solid #e2e8f0; padding: 5px 0; font-size: 12px; }
    .kot-items th:first-child, .kot-items td:first-child { width: 18px; text-align: left; }
    .kot-items th:nth-child(2), .kot-items td:nth-child(2) { text-align: left; }
    .kot-items th:last-child, .kot-items td:last-child { width: 28px; text-align: right; }
    .preparation-note { margin-top: 9px; text-align: center; font-size: 11px; font-weight: 700; }
    @media print { html, body { width: ${Number(width || 58)}mm; height: auto; } }
  </style>
`;

const stationDisplayTitle = (station) => {
  const normalized = String(station || '').trim().toUpperCase();
  if (normalized === 'KITCHEN' || normalized === 'FOOD') return 'FOOD / KITCHEN TICKET';
  if (normalized === 'SMOKE' || normalized === 'HOOKAH') return 'SMOKE / HOOKAH TICKET';
  if (normalized === 'BAR') return 'BAR TICKET';
  return `${normalized || 'PREPARATION'} TICKET`;
};

const stationTicketTitle = (job, payload, station) => {
  const baseTitle = stationDisplayTitle(station);
  const ticketType = String(payload.ticketType || '').toUpperCase();
  if (job.documentType === 'CANCELLED_ITEMS' || ticketType.includes('CANCELLATION')) return `CANCELLATION ${baseTitle}`;
  if (ticketType.includes('ADDITIONAL')) return `ADDITIONAL ${baseTitle}`;
  if (ticketType.includes('REPRINT')) return `REPRINT ${baseTitle}`;
  return baseTitle;
};

const stationTableNumber = (job, payload) => (
  payload.tableNumber || job.order?.table?.tableNumber || job.order?.tableNumber || '-'
);

export const buildStationTicketHtml = (job) => {
  const printer = job.printer || {};
  const payload = job.payload || {};
  const department = payload.department || payload.station || job.station || '';
  const title = stationTicketTitle(job, payload, department);
  const tableNumber = stationTableNumber(job, payload);
  const printedAt = new Date(payload.time || Date.now());
  const optionLabel = (option) => {
    if (typeof option === 'string') return option;
    const name = option?.name || option?.label || option?.value || '';
    const quantity = Number(option?.quantity || option?.qty || 0);
    return `${quantity > 1 ? `${quantity}x ` : ''}${name}`.trim();
  };
  const optionLine = (label, options) => {
    const values = (Array.isArray(options) ? options : []).map(optionLabel).filter(Boolean);
    return values.length ? `<div class="muted"><strong>${label}:</strong> ${escapeHtml(values.join(', '))}</div>` : '';
  };
  return `<!doctype html><html><head><title>${escapeHtml(title)}</title>${baseStyles(printer.paperWidthMm)}</head><body>
    <section class="ticket">
      <h1>${escapeHtml(payload.restaurantName || 'Restaurant RMS')}</h1>
      <div class="station-title">${escapeHtml(title)}</div>
      <div class="station-meta">
        <div class="row"><span>Order</span><strong>${escapeHtml(payload.orderNumber || '-')}</strong></div>
        <div class="row"><span>Table</span><strong>${escapeHtml(tableNumber)}</strong></div>
        <div class="row"><span>Type</span><strong>${escapeHtml(payload.orderType || '-')}</strong></div>
        <div class="row"><span>Time</span><strong>${escapeHtml(printedAt.toLocaleString())}</strong></div>
        <div class="row"><span>Attended By</span><strong>${escapeHtml(payload.waiter || '-')}</strong></div>
      </div>
      ${payload.cancellationReason ? `<div class="row"><span>Reason</span><span>${escapeHtml(payload.cancellationReason)}</span></div>` : ''}
      ${payload.cancelledBy ? `<div class="row"><span>Cancelled By</span><span>${escapeHtml(payload.cancelledBy)}</span></div>` : ''}
      <div class="line"></div>
      <table class="kot-items">
        <thead><tr><th>#</th><th>Item</th><th>Qty</th></tr></thead>
        <tbody>
          ${(payload.items || []).map((item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>
                <strong>${escapeHtml(item.name)}</strong>
                ${optionLine('Variant', item.variants)}
                ${optionLine('Add-ons', item.addons)}
                ${item.specialInstructions ? `<div class="muted"><strong>Instructions:</strong> ${escapeHtml(item.specialInstructions)}</div>` : ''}
                ${item.notes && item.notes !== item.specialInstructions ? `<div class="muted"><strong>Notes:</strong> ${escapeHtml(item.notes)}</div>` : ''}
              </td>
              <td>${Number(item.quantity || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="line"></div>
      <p class="preparation-note">Preparation ticket only. No price or payment details.</p>
    </section>
  </body></html>`;
};

export const buildReceiptHtml = (job) => {
  const printer = job.printer || {};
  const payload = job.payload || {};
  const isOrderBill = job.documentType === 'COUNTER_ORDER_BILL';
  const title = isOrderBill ? 'Full Order Bill' : 'Customer Receipt';
  return `<!doctype html><html><head><title>${title}</title>${baseStyles(printer.paperWidthMm)}</head><body>
    <section class="ticket">
      <h1>${escapeHtml(payload.restaurantName || 'Restaurant RMS')}</h1>
      ${payload.restaurantAddress ? `<p class="center muted">${escapeHtml(payload.restaurantAddress)}</p>` : ''}
      ${payload.panVatNumber ? `<p class="center muted">PAN/VAT: ${escapeHtml(payload.panVatNumber)}</p>` : ''}
      <h2>${title}</h2>
      <div class="line"></div>
      ${isOrderBill ? '' : `<div class="row"><span>Invoice</span><strong>${escapeHtml(payload.invoiceNumber || '-')}</strong></div>`}
      <div class="row"><span>Order</span><span>${escapeHtml(payload.orderNumber || '-')}</span></div>
      <div class="row"><span>Table/Type</span><span>${escapeHtml(payload.tableNumber || payload.orderType || '-')}</span></div>
      <div class="row"><span>Date</span><span>${escapeHtml(new Date(payload.paidAt || payload.createdAt || Date.now()).toLocaleString())}</span></div>
      <div class="row"><span>${isOrderBill ? 'Staff' : 'Cashier'}</span><span>${escapeHtml(payload.staff || payload.cashier || '-')}</span></div>
      <div class="line"></div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
        <tbody>
          ${(payload.items || []).map((item) => `
            <tr><td>${escapeHtml(item.name)}<div class="muted">${money(item.unitPrice)}</div></td><td>${Number(item.quantity || 0)}</td><td>${money(item.lineTotal)}</td></tr>
          `).join('')}
        </tbody>
      </table>
      <div class="line"></div>
      <div class="row"><span>Subtotal</span><span>${money(payload.subtotal)}</span></div>
      <div class="row"><span>Discount</span><span>${money(payload.discount)}</span></div>
      <div class="row"><span>Service</span><span>${money(payload.serviceCharge)}</span></div>
      <div class="row"><span>Tax</span><span>${money(payload.tax)}</span></div>
      <div class="row total"><span>Grand Total</span><span>${money(payload.grandTotal)}</span></div>
      ${isOrderBill ? '' : `
        <div class="row"><span>Paid</span><span>${money(payload.paidAmount)}</span></div>
        <div class="row"><span>Method</span><span>${escapeHtml(payload.paymentMethod || '-')}</span></div>
        <div class="row"><span>Change/Due</span><span>${money(Number(payload.change || 0) || Number(payload.remainingBalance || 0))}</span></div>
      `}
      <div class="line"></div>
      <p class="center">${isOrderBill ? 'Complete order copy' : 'Thank you for dining with us.'}</p>
    </section>
  </body></html>`;
};

export const buildTestPrintHtml = (printer = {}) => `<!doctype html><html><head><title>Test Print</title>${baseStyles(printer.paperWidthMm)}</head><body>
  <section class="ticket">
    <h1>Restaurant RMS</h1>
    <h2>Test Print</h2>
    <div class="line"></div>
    <div class="row"><span>Printer</span><strong>${escapeHtml(printer.name || '-')}</strong></div>
    <div class="row"><span>Purpose</span><span>${escapeHtml(printer.purpose || '-')}</span></div>
    <div class="row"><span>Time</span><span>${escapeHtml(new Date().toLocaleString())}</span></div>
    <div class="line"></div>
    <p class="center">Printer route is configured.</p>
  </section>
</body></html>`;

const textOptionLabel = (option) => {
  if (typeof option === 'string') return option;
  const name = option?.name || option?.label || option?.value || '';
  const quantity = Number(option?.quantity || option?.qty || 0);
  return `${quantity > 1 ? `${quantity}x ` : ''}${name}`.trim();
};

const textOptionLine = (label, options) => {
  const values = (Array.isArray(options) ? options : []).map(textOptionLabel).filter(Boolean);
  return values.length ? `  ${label}: ${values.join(', ')}` : '';
};

const ESC = '\x1b';
const GS = '\x1d';
const rawAlignCenter = `${ESC}a\x01`;
const rawAlignLeft = `${ESC}a\x00`;
const rawBoldOn = `${ESC}E\x01`;
const rawBoldOff = `${ESC}E\x00`;
const rawDoubleSize = `${GS}!\x11`;
const rawNormalSize = `${GS}!\x00`;

const centeredText = (value, width) => {
  const text = String(value || '');
  const remaining = Math.max(0, width - text.length);
  return `${' '.repeat(Math.floor(remaining / 2))}${text}`;
};

const metadataText = (label, value, width) => {
  const left = String(label || '');
  const right = String(value || '-');
  const spacing = Math.max(1, width - left.length - right.length);
  return `${left}${' '.repeat(spacing)}${rawBoldOn}${right}${rawBoldOff}`;
};

const wrapTicketText = (value, width) => {
  const words = String(value || '-').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) {
      line = word.slice(0, width);
    } else if (`${line} ${word}`.length <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word.slice(0, width);
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
};

export const buildStationTicketText = (job = {}) => {
  const payload = job.payload || {};
  const department = payload.department || payload.station || job.station || '';
  const title = stationTicketTitle(job, payload, department);
  const tableNumber = stationTableNumber(job, payload);
  const printedAt = new Date(payload.time || Date.now());
  const paperWidthMm = Number(job.printer?.paperWidthMm || 58);
  const width = paperWidthMm >= 76 ? 48 : 32;
  const separator = '-'.repeat(width);
  const itemWidth = width - 7;
  const lines = [
    `${rawAlignCenter}${rawBoldOn}${rawDoubleSize}${payload.restaurantName || 'Restaurant RMS'}${rawNormalSize}${rawBoldOff}`,
    '',
    `+${'-'.repeat(width - 2)}+`,
    `${rawBoldOn}|${centeredText(title, width - 2).padEnd(width - 2)}|${rawBoldOff}`,
    `+${'-'.repeat(width - 2)}+`,
    `${rawAlignLeft}${metadataText('Order', payload.orderNumber || '-', width)}`,
    metadataText('Table', tableNumber, width),
    metadataText('Type', payload.orderType || '-', width),
    metadataText('Time', printedAt.toLocaleString(), width),
    metadataText('Attended By', payload.waiter || '-', width)
  ];
  if (payload.cancellationReason) lines.push(`Reason: ${payload.cancellationReason}`);
  if (payload.cancelledBy) lines.push(`Cancelled By: ${payload.cancelledBy}`);
  lines.push(separator, `${rawBoldOn}${'#'.padEnd(3)}${'Item'.padEnd(itemWidth)}${'Qty'.padStart(4)}${rawBoldOff}`, separator);
  (payload.items || []).forEach((item, index) => {
    const itemLines = wrapTicketText(item.name, itemWidth);
    itemLines.forEach((itemLine, lineIndex) => {
      const number = lineIndex === 0 ? String(index + 1) : '';
      const quantity = lineIndex === 0 ? String(Number(item.quantity || 0)) : '';
      lines.push(`${number.padEnd(3)}${rawBoldOn}${itemLine.padEnd(itemWidth)}${rawBoldOff}${quantity.padStart(4)}`);
    });
    const variant = textOptionLine('Variant', item.variants);
    const addons = textOptionLine('Add-ons', item.addons);
    if (variant) lines.push(variant);
    if (addons) lines.push(addons);
    if (item.specialInstructions) lines.push(`  Instructions: ${item.specialInstructions}`);
    if (item.notes && item.notes !== item.specialInstructions) lines.push(`  Notes: ${item.notes}`);
  });
  lines.push(separator, '');
  const footerLines = wrapTicketText('Preparation ticket only. No price or payment details.', width);
  footerLines.forEach((line, index) => {
    const prefix = index === 0 ? `${rawAlignCenter}${rawBoldOn}` : '';
    const suffix = index === footerLines.length - 1 ? `${rawBoldOff}${rawAlignLeft}${rawNormalSize}` : '';
    lines.push(`${prefix}${line}${suffix}`);
  });
  return lines.join('\n');
};

export const buildReceiptText = (job = {}) => {
  const payload = job.payload || {};
  const isOrderBill = job.documentType === 'COUNTER_ORDER_BILL';
  const lines = [
    payload.restaurantName || 'Restaurant RMS',
    payload.restaurantAddress || '',
    payload.panVatNumber ? `PAN/VAT: ${payload.panVatNumber}` : '',
    isOrderBill ? 'FULL ORDER BILL' : 'CUSTOMER RECEIPT',
    '--------------------------------',
    isOrderBill ? '' : `Invoice: ${payload.invoiceNumber || '-'}`,
    `Order: ${payload.orderNumber || '-'}`,
    `Table/Type: ${payload.tableNumber || payload.orderType || '-'}`,
    `Staff: ${payload.staff || payload.cashier || '-'}`,
    '--------------------------------'
  ].filter(Boolean);
  for (const item of payload.items || []) {
    lines.push(`${Number(item.quantity || 0)} x ${item.name || '-'}  ${money(item.lineTotal)}`);
  }
  lines.push(
    '--------------------------------',
    `Subtotal: ${money(payload.subtotal)}`,
    `Discount: ${money(payload.discount)}`,
    `Service: ${money(payload.serviceCharge)}`,
    `Tax: ${money(payload.tax)}`,
    `GRAND TOTAL: ${money(payload.grandTotal)}`
  );
  if (!isOrderBill) {
    lines.push(
      `Paid: ${money(payload.paidAmount)}`,
      `Method: ${payload.paymentMethod || '-'}`,
      `Change/Due: ${money(Number(payload.change || 0) || Number(payload.remainingBalance || 0))}`
    );
  }
  lines.push('--------------------------------', isOrderBill ? 'Complete order copy' : 'Thank you for dining with us.');
  return lines.join('\n');
};

export const buildTestPrintText = (printer = {}) => [
  'Restaurant RMS',
  'TEST PRINT',
  '--------------------------------',
  `Printer: ${printer.name || '-'}`,
  `Purpose: ${printer.purpose || '-'}`,
  `Time: ${new Date().toLocaleString()}`,
  '--------------------------------',
  'Printer route is configured.'
].join('\n');

export const buildPrintTextForJob = (job = {}) => {
  if (!job || !Object.keys(job).length) return '';
  if (['COUNTER_ORDER_BILL', 'COUNTER_RECEIPT', 'CUSTOMER_RECEIPT', 'RECEIPT_REPRINT'].includes(job.documentType)) {
    return buildReceiptText(job);
  }
  if (job.documentType === 'TEST_PRINT') return buildTestPrintText(job.printer || job.payload || {});
  return buildStationTicketText(job);
};

export const buildPrintHtmlForJob = (job) => {
  if (['COUNTER_ORDER_BILL', 'COUNTER_RECEIPT', 'CUSTOMER_RECEIPT', 'RECEIPT_REPRINT'].includes(job.documentType)) return buildReceiptHtml(job);
  if (job.documentType === 'TEST_PRINT') return buildTestPrintHtml(job.printer || job.payload || {});
  return buildStationTicketHtml(job);
};
