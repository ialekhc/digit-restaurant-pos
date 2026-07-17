import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import { getReceiptSettings } from './receiptSettings';

const stationLabels = {
  KITCHEN: 'Food / Kitchen',
  BAR: 'Bar',
  SMOKE: 'Smoke'
};

const stationOrder = ['KITCHEN', 'BAR', 'SMOKE'];
const safe = (value, fallback = '-') => String((value ?? fallback) || '').trim() || fallback;

const normalizeStation = (item = {}) => {
  const raw = String(item.preparationStation || item.station || item.kitchenSection || '').trim().toUpperCase();
  if (raw === 'FOOD' || raw === 'KITCHEN') return 'KITCHEN';
  if (raw === 'BAR') return 'BAR';
  if (raw === 'SMOKE') return 'SMOKE';
  return 'KITCHEN';
};

export const groupOrderItemsByStation = (items = []) => {
  const grouped = items.reduce((acc, item) => {
    const station = normalizeStation(item);
    if (!acc[station]) acc[station] = [];
    acc[station].push(item);
    return acc;
  }, {});

  return stationOrder
    .filter((station) => grouped[station]?.length)
    .map((station) => ({ station, items: grouped[station] }));
};

const styles = StyleSheet.create({
  page: {
    padding: 8,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#ffffff'
  },
  title: { fontSize: 10.2, fontWeight: 'bold', textAlign: 'center', marginBottom: 1.5 },
  subtitle: { fontSize: 6.8, textAlign: 'center', color: '#000000', marginBottom: 0.8 },
  stationPill: {
    marginTop: 5,
    marginBottom: 5,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#111827',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  divider: { borderTopWidth: 0.8, borderTopColor: '#9ca3af', borderStyle: 'dashed', marginVertical: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 4, marginBottom: 3 , color: '#000000' },
  rowLabel: { width: '36%', color: '#000000' },
  rowValue: { width: '64%', textAlign: 'right', fontWeight: 'bold' },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: '#d1d5db',
    paddingBottom: 3,
    marginBottom: 2
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 4
  },
  colIndex: { width: 12, paddingRight: 2, color: '#000000' },
  colItem: { flexGrow: 1, flexShrink: 1, paddingRight: 5 },
  colQty: { width: 28, textAlign: 'right', fontWeight: 'bold', color: '#000000' },
  itemName: { fontSize: 8.2, lineHeight: 1.25, color: '#000000', fontWeight: 'bold' },
  note: { marginTop: 1.5, fontSize: 6.8, color: '#000000', lineHeight: 1.2 },
  footer: { marginTop: 6, textAlign: 'center', fontSize: 7, color: '#000000' }
});

const ticketPageSize = (items = []) => {
  const itemCount = Math.max(1, items.length);
  const noteCount = items.filter((item) => item.notes).length;
  const height = Math.max(285, Math.min(560, 252 + itemCount * 24 + noteCount * 10));
  return [164.4, height];
};

const StationTicketPage = ({ order, station, items, settings }) => {
  const placedAt = order?.createdAt ? new Date(order.createdAt).toLocaleString('en-NP') : new Date().toLocaleString('en-NP');
  const attendedBy = order?.createdBy?.name || order?.createdBy?.email || 'Staff';

  return (
    <Page size={ticketPageSize(items)} style={styles.page} wrap={false}>
      <Text style={styles.title}>{safe(settings.businessName, 'Restaurant RMS')}</Text>
      {settings.address ? <Text style={styles.subtitle}>{settings.address}</Text> : null}
      {settings.phone ? <Text style={styles.subtitle}>Phone: {settings.phone}</Text> : null}
      <Text style={styles.stationPill}>{stationLabels[station] || station} Ticket</Text>

      <View style={styles.row}><Text style={styles.rowLabel}>Order</Text><Text style={styles.rowValue}>{safe(order?.orderNumber)}</Text></View>
      <View style={styles.row}><Text style={styles.rowLabel}>Table</Text><Text style={styles.rowValue}>{safe(order?.table?.tableNumber)}</Text></View>
      <View style={styles.row}><Text style={styles.rowLabel}>Type</Text><Text style={styles.rowValue}>{safe(order?.orderType)}</Text></View>
      <View style={styles.row}><Text style={styles.rowLabel}>Time</Text><Text style={styles.rowValue}>{placedAt}</Text></View>
      <View style={styles.row}><Text style={styles.rowLabel}>Attended By</Text><Text style={styles.rowValue}>{attendedBy}</Text></View>

      <View style={styles.divider} />

      <View style={styles.tableHeader}>
        <Text style={[styles.colIndex, { fontWeight: 'bold' }]}>#</Text>
        <Text style={[styles.colItem, { fontWeight: 'bold' }]}>Item</Text>
        <Text style={styles.colQty}>Qty</Text>
      </View>

      {items.map((item, index) => (
        <View key={`${item._id || item.name}-${index}`} style={styles.itemRow} wrap={false}>
          <Text style={styles.colIndex}>{index + 1}</Text>
          <View style={styles.colItem}>
            <Text style={styles.itemName}>{safe(item.name)}</Text>
            {item.notes ? <Text style={styles.note}>Note: {item.notes}</Text> : null}
          </View>
          <Text style={styles.colQty}>{Number(item.quantity || 0)}</Text>
        </View>
      ))}

      <View style={styles.divider} />
      <Text style={styles.footer}>Preparation ticket only. No price or payment details.</Text>
    </Page>
  );
};

const StationTicketsPdfDocument = ({ order }) => {
  const settings = getReceiptSettings();
  const stationGroups = groupOrderItemsByStation(order?.items || []);

  return (
    <Document title={`Station Tickets ${safe(order?.orderNumber, '')}`}>
      {stationGroups.length ? stationGroups.map(({ station, items }) => (
        <StationTicketPage key={station} order={order} station={station} items={items} settings={settings} />
      )) : (
        <Page size={[164.4, 120]} style={styles.page}>
          <Text style={styles.title}>{safe(settings.businessName, 'Restaurant RMS')}</Text>
          <Text style={styles.subtitle}>No printable station items found.</Text>
        </Page>
      )}
    </Document>
  );
};

export const createStationTicketsPdfBlob = async (order) => {
  if (!order) throw new Error('No order available to print');
  return pdf(<StationTicketsPdfDocument order={order} />).toBlob();
};

export const openStationTicketsPdfTab = async (order) => {
  if (!order) throw new Error('No order available to print');

  const tab = window.open('', '_blank');
  if (!tab) throw new Error('Please allow pop-ups to open station tickets');

  tab.document.write('<!doctype html><title>Preparing station tickets...</title><p style="font-family:Arial;padding:16px;">Preparing station tickets...</p>');
  tab.document.close();

  try {
    const blob = await createStationTicketsPdfBlob(order);
    const url = URL.createObjectURL(blob);
    tab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  } catch (error) {
    tab.close();
    throw error;
  }
};

export default StationTicketsPdfDocument;
