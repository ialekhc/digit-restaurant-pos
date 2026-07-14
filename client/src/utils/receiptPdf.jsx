import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import { getReceiptSettings } from './receiptSettings';

const money = (value) => `NPR ${Number(value || 0).toFixed(2)}`;
const safe = (value, fallback = '-') => String((value ?? fallback) || '').trim() || fallback;

const styles = StyleSheet.create({
  page: {
    padding: 7,
    fontSize: 7.4,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff'
  },
  center: { textAlign: 'center' },
  title: { fontSize: 11.5, fontWeight: 'bold', marginBottom: 2, textAlign: 'center' },
  subtitle: { fontSize: 8.2, marginBottom: 2, textAlign: 'center', color: '#374151' },
  muted: { fontSize: 6.7, color: '#4b5563', textAlign: 'center', marginBottom: 1 },
  divider: { borderTopWidth: 0.8, borderTopColor: '#9ca3af', borderStyle: 'dashed', marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, marginBottom: 2.5 },
  rowLabel: { width: '38%' },
  rowValue: { width: '62%', textAlign: 'right' },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: '#d1d5db',
    paddingBottom: 3,
    marginBottom: 2
  },
  itemBlock: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 3
  },
  itemMainRow: { flexDirection: 'row', alignItems: 'flex-start' },
  itemMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 1.5, paddingLeft: 12 },
  colIndex: { width: 12, paddingRight: 2 },
  colItem: { flexGrow: 1, flexShrink: 1, paddingRight: 4 },
  colAmount: { width: 44, textAlign: 'right' },
  itemName: { fontSize: 7.6, lineHeight: 1.25 },
  itemMeta: { fontSize: 6.6, color: '#4b5563' },
  bold: { fontWeight: 'bold' },
  total: { fontSize: 8.4, fontWeight: 'bold' },
  footer: { textAlign: 'center', fontSize: 7.2, color: '#4b5563', marginTop: 5 }
});

const ReceiptPdfDocument = ({ payment, cashierName = '' }) => {
  const order = payment?.order || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const settings = getReceiptSettings();
  const subtotal = Number(
    order.subtotal ?? items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0)
  );
  const discount = Number(order.discount || 0);
  const total = Number(order.total ?? Math.max(0, subtotal - discount));
  const amountPaid = Number(payment?.amountPaid || 0);
  const changeAmount = Number(payment?.changeAmount || 0);
  const date = payment?.createdAt ? new Date(payment.createdAt).toLocaleString('en-NP') : '-';

  return (
    <Document title={`Receipt ${safe(payment?.billNumber, '')}`}>
      <Page size={[164.4, 420]} style={styles.page} wrap>
        <Text style={styles.title}>{safe(settings.businessName, 'Restaurant RMS')}</Text>
        <Text style={styles.subtitle}>Customer Bill</Text>
        {settings.address ? <Text style={styles.muted}>{settings.address}</Text> : null}
        {settings.phone ? <Text style={styles.muted}>Phone: {settings.phone}</Text> : null}
        {settings.email ? <Text style={styles.muted}>Email: {settings.email}</Text> : null}

        <View style={styles.divider} />

        <View style={styles.row}><Text style={styles.rowLabel}>Bill No</Text><Text style={[styles.rowValue, styles.bold]}>{safe(payment?.billNumber)}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Date</Text><Text style={styles.rowValue}>{date}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Order No</Text><Text style={styles.rowValue}>{safe(order.orderNumber)}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Table</Text><Text style={styles.rowValue}>{safe(order.table?.tableNumber)}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>Order Type</Text><Text style={styles.rowValue}>{safe(order.orderType)}</Text></View>

        <View style={styles.divider} />

        <View style={styles.tableHeader}>
          <Text style={[styles.colIndex, styles.bold]}>#</Text>
          <Text style={[styles.colItem, styles.bold]}>Item</Text>
          <Text style={[styles.colAmount, styles.bold]}>Amount</Text>
        </View>
        {items.length ? items.map((item, index) => {
          const qty = Number(item.quantity || 0);
          const price = Number(item.price || 0);
          const lineTotal = qty * price;
          return (
            <View key={`${item._id || item.name}-${index}`} style={styles.itemBlock} wrap={false}>
              <View style={styles.itemMainRow}>
                <Text style={styles.colIndex}>{index + 1}</Text>
                <Text style={[styles.colItem, styles.itemName]}>{safe(item.name)}</Text>
                <Text style={styles.colAmount}>{lineTotal.toFixed(2)}</Text>
              </View>
              <View style={styles.itemMetaRow}>
                <Text style={styles.itemMeta}>Qty {qty} x {money(price)}</Text>
                <Text style={styles.itemMeta}>Unit price</Text>
              </View>
            </View>
          );
        }) : (
          <Text style={styles.center}>No items</Text>
        )}

        <View style={styles.divider} />

        <View style={styles.row}><Text>Subtotal</Text><Text>{money(subtotal)}</Text></View>
        <View style={styles.row}><Text>Discount</Text><Text>{money(discount)}</Text></View>
        <View style={styles.row}><Text style={styles.total}>Grand Total</Text><Text style={styles.total}>{money(total)}</Text></View>
        <View style={styles.row}><Text>Amount Paid</Text><Text>{money(amountPaid)}</Text></View>
        <View style={styles.row}><Text>Change</Text><Text>{money(changeAmount)}</Text></View>
        <View style={styles.row}><Text>Payment Method</Text><Text>{safe(payment?.paymentMethod)}</Text></View>
        <View style={styles.row}><Text>Payment Status</Text><Text>{safe(payment?.paymentStatus)}</Text></View>
        <View style={styles.row}><Text>Cashier</Text><Text>{safe(payment?.paidBy?.name || cashierName || 'Cashier')}</Text></View>

        <View style={styles.divider} />
        <Text style={styles.footer}>{safe(settings.footerText, 'Thank you for dining with us.')}</Text>
      </Page>
    </Document>
  );
};

export const createReceiptPdfBlob = async (payment, cashierName = '') => {
  if (!payment) throw new Error('No receipt available to download');
  return pdf(<ReceiptPdfDocument payment={payment} cashierName={cashierName} />).toBlob();
};

export const openReceiptPdfTab = async (payment, cashierName = '') => {
  if (!payment) throw new Error('No receipt available to print');

  const tab = window.open('', '_blank');
  if (!tab) throw new Error('Please allow pop-ups to open receipt PDF');

  tab.document.write('<!doctype html><title>Preparing receipt...</title><p style="font-family:Arial;padding:16px;">Preparing receipt PDF...</p>');
  tab.document.close();

  try {
    const blob = await createReceiptPdfBlob(payment, cashierName);
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (error) {
    tab.close();
    throw error;
  }
};

export const downloadReceiptPdf = async (payment, cashierName = '') => {
  if (!payment) throw new Error('No receipt available to download');
  const blob = await createReceiptPdfBlob(payment, cashierName);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const bill = safe(payment.billNumber, 'receipt').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  anchor.href = url;
  anchor.download = `${bill}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export default ReceiptPdfDocument;
