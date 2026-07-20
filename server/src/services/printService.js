import { Printer } from '../models/Printer.js';
import { PrintJob } from '../models/PrintJob.js';
import { Payment } from '../models/Payment.js';
import { Order } from '../models/Order.js';
import { Vendor } from '../models/Vendor.js';
import { ApiError } from '../utils/ApiError.js';
import { resolveTenantScope, withTenantFields } from './tenantScopeService.js';

export const STATIONS = {
  KITCHEN: 'KITCHEN',
  BAR: 'BAR',
  SMOKE: 'SMOKE',
  NONE: 'NONE'
};

const stationDocumentTypes = {
  KITCHEN: 'KITCHEN_PREPARATION_TICKET',
  BAR: 'BAR_PREPARATION_TICKET',
  SMOKE: 'SMOKE_PREPARATION_TICKET'
};

export const normalizeStation = (value, fallback = STATIONS.KITCHEN) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'FOOD') return STATIONS.KITCHEN;
  if (['DRINK', 'DRINKS', 'BEVERAGE', 'BEVERAGES'].includes(normalized)) return STATIONS.BAR;
  if (['HOOKAH', 'SHISHA'].includes(normalized)) return STATIONS.SMOKE;
  if (['NO_PRINT', 'NO PRINT'].includes(normalized)) return STATIONS.NONE;
  if (['KITCHEN', 'BAR', 'SMOKE', 'NONE'].includes(normalized)) return normalized;
  return fallback;
};

export const stationToKitchenSection = (station) => {
  if (station === STATIONS.KITCHEN) return 'FOOD';
  return station;
};

export const stationFromMenu = (menu = {}) => {
  const menuType = String(menu.menuType || '').trim().toUpperCase();
  // Legacy migrations defaulted preparationStation to KITCHEN for every menu
  // item. Menu type must win for drinks and smoke or they print in Kitchen.
  if (menuType === 'DRINK') return STATIONS.BAR;
  if (menuType === 'SMOKE') return STATIONS.SMOKE;
  if (menu.preparationStation) return normalizeStation(menu.preparationStation);
  return normalizeStation(menu.kitchenSection, STATIONS.KITCHEN);
};

export const printerPurposeForStation = (station) => {
  if (String(station || '').trim().toUpperCase() === 'COUNTER') return 'COUNTER';
  return normalizeStation(station);
};

export const groupItemsByStation = (items = []) => {
  return items.reduce((acc, item) => {
    const menuType = String(item.menuType || item.menuItem?.menuType || '').trim().toUpperCase();
    const station = menuType === 'DRINK'
      ? STATIONS.BAR
      : menuType === 'SMOKE'
        ? STATIONS.SMOKE
        : normalizeStation(item.preparationStation || item.station || item.kitchenSection);
    if (station === STATIONS.NONE) return acc;
    if (!acc[station]) acc[station] = [];
    acc[station].push({
      ...item,
      preparationStation: station
    });
    return acc;
  }, {});
};

const toPlain = (doc) => (doc?.toJSON ? doc.toJSON() : doc);

const getRestaurantDetails = async (restaurantId) => {
  if (!restaurantId) return {};
  const vendor = await Vendor.findById(restaurantId);
  if (!vendor) return {};
  return {
    restaurantName: vendor.vendorName || 'Restaurant RMS',
    restaurantAddress: vendor.address || '',
    restaurantPhone: vendor.phone || '',
    panVatNumber: vendor.panVatNumber || vendor.vatNumber || ''
  };
};

const resolveRestaurantId = async (user, fallbackRestaurantId = '') => {
  if (fallbackRestaurantId) return String(fallbackRestaurantId);
  const scope = await resolveTenantScope(user);
  if (!scope.restaurantId) throw new ApiError(403, 'Restaurant scope is required for printing');
  return String(scope.restaurantId);
};

export const getPrinterForPurpose = async ({ user, restaurantId, purpose }) => {
  const scopedRestaurantId = await resolveRestaurantId(user, restaurantId);
  return Printer.findOne({
    restaurantId: scopedRestaurantId,
    purpose: printerPurposeForStation(purpose),
    isActive: true
  });
};

const createPrintJobIfMissing = async ({ user, restaurantId, printer, order, payment, documentType, station, payload, idempotencyKey }) => {
  const scopedRestaurantId = await resolveRestaurantId(user, restaurantId || printer?.restaurantId || order?.restaurantId);
  if (printer && String(printer.restaurantId) !== scopedRestaurantId) {
    throw new ApiError(403, 'Printer does not belong to this restaurant');
  }

  const existing = await PrintJob.findOne({ idempotencyKey });
  if (existing) return existing;

  return PrintJob.create(await withTenantFields(user, {
    restaurantId: scopedRestaurantId,
    printer: printer?._id || null,
    order: order?._id,
    payment: payment?._id,
    documentType,
    station,
    payload,
    status: 'PENDING',
    attempts: 0,
    idempotencyKey
  }));
};

const ticketTypeForSource = (source = '') => {
  if (source === 'ADDED_ITEMS') return 'ADDITIONAL KOT';
  if (String(source).startsWith('CANCELLED_ITEMS')) return 'CANCELLATION KOT';
  if (String(source).startsWith('MANUAL_REPRINT')) return 'REPRINT KOT';
  return 'KOT';
};

export const buildStationPayload = ({
  order,
  station,
  items,
  reason = '',
  cancelledBy = '',
  restaurant = {},
  source = 'INITIAL_ORDER'
}) => {
  const plainOrder = toPlain(order);
  const designatedItems = groupItemsByStation(items)[station] || [];
  return {
    station,
    department: station === STATIONS.SMOKE ? 'HOOKAH' : station,
    ticketType: ticketTypeForSource(source),
    restaurantName: restaurant.restaurantName || plainOrder.restaurantName || '',
    orderNumber: plainOrder.orderNumber,
    orderType: plainOrder.orderType,
    tableNumber: plainOrder.table?.tableNumber || plainOrder.tableNumber || '',
    time: new Date().toISOString(),
    createdAt: plainOrder.createdAt,
    waiter: plainOrder.createdBy?.name || '',
    cancelledBy,
    cancellationReason: reason,
    // KOTs are preparation tickets, never full-order bills. Keep this filter
    // here as a final boundary even when a caller accidentally passes all
    // order items instead of the already grouped station items.
    items: designatedItems.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 0),
      notes: item.notes || '',
      variants: item.variants || [],
      addons: item.addons || [],
      specialInstructions: item.specialInstructions || item.notes || ''
    }))
  };
};

export const createStationPrintJobs = async ({ user, order, items = null, reason = '', cancelledBy = '', source = 'INITIAL_ORDER' }) => {
  const printableItems = items || order.items || [];
  const grouped = groupItemsByStation(printableItems);
  const jobs = [];
  const restaurant = await getRestaurantDetails(order.restaurantId);

  // A mixed order must always produce independent jobs. Fixed station order
  // makes the split deterministic while each payload contains only its own
  // designated items.
  for (const station of [STATIONS.KITCHEN, STATIONS.BAR, STATIONS.SMOKE]) {
    const stationItems = grouped[station] || [];
    if (!stationItems.length) continue;
    const printer = await getPrinterForPurpose({ user, restaurantId: order.restaurantId, purpose: station });

    const documentType = String(source).startsWith('CANCELLED_ITEMS') ? 'CANCELLED_ITEMS' : stationDocumentTypes[station];
    const itemKey = stationItems
      .map((item) => `${item._id || item.menuItem || item.name}:${item.quantity}:${item.notes || ''}`)
      .join('|');
    const idempotencyKey = `${source}:${order._id}:${station}:${itemKey}`;

    const job = await createPrintJobIfMissing({
      user,
      restaurantId: order.restaurantId,
      printer,
      order,
      documentType,
      station,
      payload: buildStationPayload({
        order,
        station,
        items: stationItems,
        reason,
        cancelledBy,
        restaurant,
        source
      }),
      idempotencyKey
    });
    if (job) jobs.push(job);
  }

  return Promise.all(
    jobs.map((job) => PrintJob.findById(job._id).populate('printer').populate('order').populate('payment'))
  );
};

export const createAddedItemPrintJobs = ({ user, order, items }) =>
  createStationPrintJobs({ user, order, items, source: 'ADDED_ITEMS' });

export const createCancellationPrintJob = ({ user, order, items, reason = '', cancelledBy = '', eventId = Date.now() }) =>
  createStationPrintJobs({ user, order, items, reason, cancelledBy, source: `CANCELLED_ITEMS:${eventId}` });

export const buildCounterReceiptPayload = ({ payment, order, payments = [], orders = [], restaurant = {} }) => {
  const plainOrder = toPlain(order);
  const paymentRows = payments.length ? payments.map(toPlain) : [toPlain(payment)];
  const receiptOrders = orders.length ? orders.map(toPlain) : [plainOrder];
  const orderItems = receiptOrders.flatMap((row) => row.items || []);
  const subtotal = receiptOrders.reduce((sum, row) => sum + Number(row.subtotal || 0), 0);
  const discount = receiptOrders.reduce((sum, row) => sum + Number(row.discount || 0), 0);
  const serviceCharge = receiptOrders.reduce((sum, row) => sum + Number(row.serviceCharge || 0), 0);
  const tax = receiptOrders.reduce((sum, row) => sum + Number(row.tax || 0), 0);
  const grandTotal = receiptOrders.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const paidAmount = paymentRows.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0);
  return {
    invoiceNumber: paymentRows.map((row) => row.billNumber).filter(Boolean).join(', ') || payment?.billNumber || '',
    restaurantName: restaurant.restaurantName || 'Restaurant RMS',
    restaurantAddress: restaurant.restaurantAddress || '',
    restaurantPhone: restaurant.restaurantPhone || '',
    panVatNumber: restaurant.panVatNumber || '',
    orderNumber: receiptOrders.map((row) => row.orderNumber).filter(Boolean).join(', ') || plainOrder.orderNumber,
    orderType: plainOrder.orderType,
    tableNumber: plainOrder.table?.tableNumber || '',
    cashier: payment?.paidBy?.name || '',
    customer: plainOrder.customer || null,
    items: orderItems.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.price || 0),
      lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
      station: normalizeStation(item.preparationStation || item.kitchenSection),
      notes: item.notes || ''
    })),
    subtotal,
    discount,
    serviceCharge,
    tax,
    grandTotal,
    paidAmount,
    paymentMethod: paymentRows.map((row) => row.paymentMethod).filter(Boolean).join(', '),
    change: paymentRows.reduce((sum, row) => sum + Number(row.changeAmount || 0), 0),
    remainingBalance: Math.max(0, grandTotal - paidAmount),
    paidAt: payment?.createdAt || new Date().toISOString()
  };
};

export const buildCounterOrderBillPayload = ({ order, restaurant = {} }) => {
  const plainOrder = toPlain(order);
  const items = plainOrder.items || [];
  return {
    restaurantName: restaurant.restaurantName || 'Restaurant RMS',
    restaurantAddress: restaurant.restaurantAddress || '',
    restaurantPhone: restaurant.restaurantPhone || '',
    panVatNumber: restaurant.panVatNumber || '',
    orderNumber: plainOrder.orderNumber,
    orderType: plainOrder.orderType,
    tableNumber: plainOrder.table?.tableNumber || '',
    staff: plainOrder.createdBy?.name || '',
    customer: plainOrder.customer || null,
    items: items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.price || 0),
      lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
      station: normalizeStation(item.preparationStation || item.kitchenSection),
      notes: item.notes || ''
    })),
    subtotal: Number(plainOrder.subtotal || 0),
    discount: Number(plainOrder.discount || 0),
    serviceCharge: Number(plainOrder.serviceCharge || 0),
    tax: Number(plainOrder.tax || 0),
    grandTotal: Number(plainOrder.total || 0),
    createdAt: plainOrder.createdAt || new Date().toISOString()
  };
};

const createCounterOrderBillJob = async ({ user, order, restaurant, source }) => {
  const printer = await getPrinterForPurpose({
    user,
    restaurantId: order.restaurantId,
    purpose: 'COUNTER'
  });

  return createPrintJobIfMissing({
    user,
    restaurantId: order.restaurantId,
    printer,
    order,
    documentType: 'COUNTER_ORDER_BILL',
    station: 'COUNTER',
    payload: buildCounterOrderBillPayload({ order, restaurant }),
    idempotencyKey: `${source}:COUNTER_ORDER_BILL:${order._id}`
  });
};

export const createCounterReceiptJob = async ({ user, payment, force = false }) => {
  const order = await Order.findById(payment.order).populate('table').populate('customer').populate('createdBy', 'name role');
  if (!order) throw new ApiError(404, 'Order not found for receipt');

  if (!force && payment.paymentStatus !== 'PAID') return null;

  let payments = [payment];
  let receiptOrders = [order];
  if (payment.billGroupId) {
    payments = await Payment.find({ billGroupId: payment.billGroupId }).populate('paidBy', 'name role');
    const expectedCount = Number(payment.billGroupOrderCount || 0);
    if (!force && expectedCount > 0 && payments.length < expectedCount) return null;
    const orderIds = payments.map((row) => row.order).filter(Boolean);
    if (orderIds.length) {
      receiptOrders = await Order.find({ _id: { $in: orderIds } })
        .populate('table')
        .populate('customer')
        .populate('createdBy', 'name role');
    }
  }

  const printer = await getPrinterForPurpose({ user, restaurantId: payment.restaurantId || order.restaurantId, purpose: 'COUNTER' });
  const restaurant = await getRestaurantDetails(payment.restaurantId || order.restaurantId);

  const groupKey = payment.billGroupId || payment._id;
  return createPrintJobIfMissing({
    user,
    restaurantId: payment.restaurantId || order.restaurantId,
    printer,
    order,
    payment,
    documentType: force ? 'RECEIPT_REPRINT' : 'COUNTER_RECEIPT',
    station: 'COUNTER',
    payload: buildCounterReceiptPayload({ payment, order, payments, orders: receiptOrders, restaurant }),
    idempotencyKey: `${force ? 'RECEIPT_REPRINT' : 'COUNTER_RECEIPT'}:${groupKey}`
  });
};

export const createTestPrintJob = async ({ user, printer }) => {
  if (!printer) throw new ApiError(404, 'Printer not found');
  const idempotencyKey = `TEST_PRINT:${printer._id}:${Date.now()}`;
  return createPrintJobIfMissing({
    user,
    restaurantId: printer.restaurantId,
    printer,
    documentType: 'TEST_PRINT',
    station: printer.purpose,
    payload: {
      station: printer.purpose,
      printerName: printer.name,
      printerSystemName: printer.printerSystemName,
      time: new Date().toISOString(),
      message: 'Test print from Restaurant RMS'
    },
    idempotencyKey
  });
};

export const retryPrintJob = async (job) => {
  if (job.status === 'PRINTED') throw new ApiError(409, 'Printed jobs cannot be retried');
  job.status = 'PENDING';
  job.errorMessage = '';
  job.claimedAt = null;
  job.claimedBy = '';
  await job.save();
  return job;
};

export const markPrintJobPrinted = async (job) => {
  if (job.status === 'PRINTED') return job;
  job.status = 'PRINTED';
  job.printedAt = new Date().toISOString();
  job.errorMessage = '';
  await job.save();
  return job;
};

export const markPrintJobFailed = async (job, errorMessage = '') => {
  if (job.status === 'PRINTED') throw new ApiError(409, 'Printed jobs cannot be failed');
  job.status = 'FAILED';
  job.errorMessage = String(errorMessage || 'Print failed');
  await job.save();
  return job;
};
