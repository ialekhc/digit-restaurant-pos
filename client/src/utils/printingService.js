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

  async printHtml({ html, printer }) {
    await this.connect();
    const printerName = printer?.printerSystemName || printer?.name;
    if (!printerName) throw new Error('Printer system name is required');
    const config = this.qz.configs.create(printerName, {
      copies: Number(printer?.copies || 1),
      size: { width: Number(printer?.paperWidthMm || 58), units: 'mm' }
    });
    return this.qz.print(config, [{ type: 'pixel', format: 'html', flavor: 'plain', data: html }]);
  }

  async printRaw({ raw, printer }) {
    await this.connect();
    const printerName = printer?.printerSystemName || printer?.name;
    if (!printerName) throw new Error('Printer system name is required');
    const config = this.qz.configs.create(printerName, { copies: Number(printer?.copies || 1) });
    return this.qz.print(config, [{ type: 'raw', format: 'plain', data: raw }]);
  }

  async testPrint({ printer }) {
    return this.printHtml({ printer, html: buildTestPrintHtml(printer) });
  }
}

class RoutedPrinterAdapter {
  constructor() {
    this.browser = new BrowserPrintAdapter();
    this.qz = new QzTrayAdapter();
    this.qzError = '';
  }

  async connect() {
    await this.browser.connect();
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
    await Promise.allSettled([this.browser.disconnect(), this.qz.disconnect()]);
  }

  isConnected() {
    return this.qz.isConnected();
  }

  statusMessage() {
    return this.isConnected() ? 'QZ Tray connected' : `Browser fallback only${this.qzError ? `: ${this.qzError}` : ''}`;
  }

  adapterFor(printer = {}) {
    return String(printer.connectionType || '').toUpperCase() === 'BROWSER' ? this.browser : this.qz;
  }

  async getPrinters() {
    return this.qz.getPrinters();
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

export const createPrinterAdapter = () => {
  return new RoutedPrinterAdapter();
};

const baseStyles = (width = 58) => `
  <style>
    @page { size: ${Number(width || 58)}mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #111827; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .ticket { width: ${Number(width || 58)}mm; padding: 2.5mm; font-size: 11px; line-height: 1.35; }
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
    @media print { html, body { width: ${Number(width || 58)}mm; height: auto; } }
  </style>
`;

export const buildStationTicketHtml = (job) => {
  const printer = job.printer || {};
  const payload = job.payload || {};
  const title = job.documentType === 'CANCELLED_ITEMS' ? 'CANCELLATION TICKET' : `${payload.station || job.station} TICKET`;
  return `<!doctype html><html><head><title>${escapeHtml(title)}</title>${baseStyles(printer.paperWidthMm)}</head><body>
    <section class="ticket">
      <h1>${escapeHtml(payload.restaurantName || 'Restaurant RMS')}</h1>
      <h2>${escapeHtml(title)}</h2>
      <div class="line"></div>
      <div class="row"><span>Order</span><strong>${escapeHtml(payload.orderNumber || '-')}</strong></div>
      <div class="row"><span>Table/Type</span><strong>${escapeHtml(payload.tableNumber || payload.orderType || '-')}</strong></div>
      <div class="row"><span>Time</span><span>${escapeHtml(new Date(payload.time || Date.now()).toLocaleString())}</span></div>
      ${payload.waiter ? `<div class="row"><span>Staff</span><span>${escapeHtml(payload.waiter)}</span></div>` : ''}
      ${payload.cancellationReason ? `<div class="row"><span>Reason</span><span>${escapeHtml(payload.cancellationReason)}</span></div>` : ''}
      ${payload.cancelledBy ? `<div class="row"><span>Cancelled By</span><span>${escapeHtml(payload.cancelledBy)}</span></div>` : ''}
      <div class="line"></div>
      <table>
        <thead><tr><th>Item</th><th>Qty</th></tr></thead>
        <tbody>
          ${(payload.items || []).map((item) => `
            <tr>
              <td>${escapeHtml(item.name)}${item.notes ? `<div class="muted">${escapeHtml(item.notes)}</div>` : ''}</td>
              <td>${Number(item.quantity || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="line"></div>
      <p class="center muted">No prices on station tickets</p>
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

export const buildPrintHtmlForJob = (job) => {
  if (['COUNTER_ORDER_BILL', 'COUNTER_RECEIPT', 'CUSTOMER_RECEIPT', 'RECEIPT_REPRINT'].includes(job.documentType)) return buildReceiptHtml(job);
  if (job.documentType === 'TEST_PRINT') return buildTestPrintHtml(job.printer || job.payload || {});
  return buildStationTicketHtml(job);
};
