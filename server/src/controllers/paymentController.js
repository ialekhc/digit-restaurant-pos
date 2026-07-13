import { Payment } from '../models/Payment.js';
import { Order } from '../models/Order.js';
import { Customer } from '../models/Customer.js';
import { Table } from '../models/Table.js';
import { BILLABLE_ORDER_STATUSES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { generateBillNumber } from '../utils/serialGenerators.js';
import { syncTableStatusFromOrders } from '../services/tableWorkflowService.js';
import { ensureFeatureEnabled } from '../services/planService.js';
import { buildTenantScopedQuery, resolveTenantScope, withTenantFields } from '../services/tenantScopeService.js';
import { createCounterReceiptJob } from '../services/printService.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ensurePaymentMethodFeature = async (paymentMethod) => {
  if (paymentMethod === 'CASH') {
    await ensureFeatureEnabled(FEATURE_KEYS.CASH_PAYMENT, 'Cash payment is not available in the active plan');
  }
  if (paymentMethod === 'CARD') {
    await ensureFeatureEnabled(FEATURE_KEYS.CARD_PAYMENT, 'Card payment is not available in the active plan');
  }
  if (paymentMethod === 'QR') {
    await ensureFeatureEnabled(FEATURE_KEYS.QR_PAYMENT, 'QR payment is not available in the active plan');
  }
  if (paymentMethod === 'ONLINE') {
    await ensureFeatureEnabled(
      FEATURE_KEYS.ONLINE_ORDERING_SYSTEM,
      'Online payments are not available without the Online Ordering addon'
    );
  }
  if (paymentMethod === 'SPLIT') {
    await ensureFeatureEnabled(FEATURE_KEYS.SPLIT_BILLING, 'Split billing is not available in the active plan');
  }
};

const applyDiscountPercentToOrder = async (order, discountPercent) => {
  if (typeof discountPercent === 'undefined' || discountPercent === null || discountPercent === '') return;

  const percent = Number(discountPercent);
  if (Number.isNaN(percent) || percent < 0 || percent > 100) {
    throw new ApiError(400, 'Discount percent must be between 0 and 100');
  }

  await ensureFeatureEnabled(
    FEATURE_KEYS.DISCOUNT_MANAGEMENT,
    'Discount management is not available in the active plan'
  );

  const subtotal = Number(order.subtotal || 0);
  const discountAmount = Number(((subtotal * percent) / 100).toFixed(2));
  const total = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));

  order.discount = discountAmount;
  order.total = total;
  await order.save();
};

const completeOrderAfterPayment = async (order) => {
  if (!order) return;
  if (order.status !== 'COMPLETED') {
    order.status = 'COMPLETED';
    await order.save();
  }

  await syncTableStatusFromOrders(order.table);

  if (order.customer) {
    try {
      await ensureFeatureEnabled(FEATURE_KEYS.LOYALTY_POINTS_SYSTEM);
      await Customer.findByIdAndUpdate(order.customer, {
        $inc: { loyaltyPoints: Math.floor(order.total / 10) }
      });
    } catch (_error) {
      // Loyalty feature is optional by plan; skip points update if unavailable.
    }
  }
};

const buildPaymentScopedQuery = async (req, baseQuery = {}) => {
  const scope = await resolveTenantScope(req.user);
  if (scope.platform) return baseQuery;

  const branches = [];
  if (scope.restaurantId && !scope.customerOnly) branches.push({ restaurantId: scope.restaurantId });
  if (scope.userIds.length) {
    branches.push(
      { paidBy: { $in: scope.userIds } },
      { receivedBy: { $in: scope.userIds } },
      { 'creditHistory.receivedBy': { $in: scope.userIds } }
    );
  }

  const scopedOrderQuery = await buildTenantScopedQuery(req.user, {}, { userFields: ['createdBy'] });
  const scopedOrders = await Order.find(scopedOrderQuery).select('_id');
  const orderIds = scopedOrders.map((order) => order._id);
  if (orderIds.length) branches.push({ order: { $in: orderIds } });

  const scopeQuery = branches.length ? { $or: branches } : { _id: '__NO_PAYMENT_SCOPE_MATCH__' };
  return Object.keys(baseQuery).length ? { $and: [baseQuery, scopeQuery] } : scopeQuery;
};

export const createPayment = asyncHandler(async (req, res) => {
  const {
    order: orderId,
    orderNumber = '',
    tableNumber = '',
    paymentMethod,
    amountPaid,
    discountPercent,
    paymentStatus = 'PAID',
    dueDate,
    creditNote = '',
    billGroupId = '',
    billGroupTableNumber = '',
    billGroupOrderCount
  } = req.body;
  const normalizedTableNumber = String(tableNumber).trim();

  if ((!orderId && !orderNumber) || !paymentMethod || typeof amountPaid === 'undefined') {
    throw new ApiError(400, 'Order ID or order number, payment method and amount paid are required');
  }

  await ensurePaymentMethodFeature(paymentMethod);

  let order = null;

  if (orderId) {
    order = await Order.findOne(await buildTenantScopedQuery(req.user, { _id: orderId }, { userFields: ['createdBy'] }));
  } else {
    const query = { orderNumber: String(orderNumber).trim() };

    if (normalizedTableNumber) {
      const table = await Table.findOne(
        await buildTenantScopedQuery(req.user, {
          tableNumber: { $regex: new RegExp(`^${escapeRegex(normalizedTableNumber)}$`, 'i') }
        }, {
          userFields: ['createdBy'],
          includeCustomerTenant: true
        })
      );
      if (!table) {
        throw new ApiError(404, 'Table not found for provided table number');
      }
      query.table = table._id;
    }

    order = await Order.findOne(await buildTenantScopedQuery(req.user, query, { userFields: ['createdBy'] }));
  }

  if (!order) throw new ApiError(404, 'Order not found');

  if (normalizedTableNumber) {
    if (!order.table) {
      throw new ApiError(400, 'This order is not linked to any table');
    }

    const linkedTable = await Table.findById(order.table).select('tableNumber');
    const matches = linkedTable?.tableNumber?.toLowerCase() === normalizedTableNumber.toLowerCase();
    if (!matches) {
      throw new ApiError(400, 'Provided table number does not match the selected order');
    }
  }

  const existing = await Payment.findOne({ order: order._id });
  if (existing) throw new ApiError(409, 'Payment already exists for this order');

  const paid = Number(amountPaid);
  if (Number.isNaN(paid) || paid < 0) {
    throw new ApiError(400, 'Amount paid must be a non-negative number');
  }

  if (!BILLABLE_ORDER_STATUSES.includes(order.status)) {
    throw new ApiError(400, `Order must be ${BILLABLE_ORDER_STATUSES.join(' or ')} before billing`);
  }

  await applyDiscountPercentToOrder(order, discountPercent);

  if (paymentStatus === 'UNPAID' && paid !== 0) {
    throw new ApiError(400, 'UNPAID credit record must have amount paid as 0');
  }
  if (paymentStatus === 'PARTIAL' && (paid <= 0 || paid >= order.total)) {
    throw new ApiError(400, 'PARTIAL payment must be greater than 0 and less than order total');
  }
  if (paymentStatus === 'PAID' && paid < order.total) {
    throw new ApiError(400, 'Amount paid is less than total. Use PARTIAL or UNPAID status for credit sales');
  }

  let parsedDueDate;
  if (dueDate) {
    parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      throw new ApiError(400, 'Invalid due date');
    }
  }

  const changeAmount = paid > order.total ? paid - order.total : 0;

  const data = await Payment.create(await withTenantFields(req.user, {
    order: order._id,
    billNumber: generateBillNumber(),
    paymentMethod,
    amountPaid: paid,
    changeAmount,
    paymentStatus,
    paidBy: req.user._id,
    dueDate: paymentStatus === 'PAID' ? undefined : parsedDueDate,
    creditNote: paymentStatus === 'PAID' ? '' : String(creditNote || ''),
    billGroupId: billGroupId ? String(billGroupId).trim() : undefined,
    billGroupTableNumber: billGroupTableNumber ? String(billGroupTableNumber).trim() : undefined,
    billGroupOrderCount: typeof billGroupOrderCount === 'undefined' ? undefined : Number(billGroupOrderCount),
    creditHistory:
      paid > 0 && paymentStatus !== 'PAID'
        ? [
          {
            amount: paid,
            paymentMethod,
            note: String(creditNote || 'Initial credit entry'),
            receivedBy: req.user._id
          }
        ]
        : []
  }));

  if (paymentStatus === 'PAID') {
    await completeOrderAfterPayment(order);
    try {
      await createCounterReceiptJob({ user: req.user, payment: data });
    } catch (error) {
      console.warn('[printing] counter receipt job was not created', error?.message || error);
    }
  }

  const populated = await Payment.findById(data._id)
    .populate({ path: 'order', populate: [{ path: 'table' }, { path: 'customer' }] })
    .populate('paidBy', 'name role')
    .populate('creditHistory.receivedBy', 'name role');

  res.status(201).json({ data: populated });
});

export const getPayments = asyncHandler(async (req, res) => {
  const { method = '', status = '', date = '', creditOnly = '' } = req.query;

  const query = {};
  if (method) query.paymentMethod = method;
  if (status) query.paymentStatus = status;
  if (creditOnly === 'true') query.paymentStatus = { $in: ['UNPAID', 'PARTIAL'] };
  if (date) {
    const from = new Date(date);
    const to = new Date(date);
    to.setDate(to.getDate() + 1);
    query.createdAt = { $gte: from, $lt: to };
  }

  const scopedQuery = await buildPaymentScopedQuery(req, query);
  const data = await Payment.find(scopedQuery)
    .populate({ path: 'order', populate: [{ path: 'table' }, { path: 'customer' }] })
    .populate('paidBy', 'name role')
    .populate('creditHistory.receivedBy', 'name role')
    .sort({ createdAt: -1 });

  res.json({ data });
});

export const getPaymentById = asyncHandler(async (req, res) => {
  const data = await Payment.findOne(await buildPaymentScopedQuery(req, { _id: req.params.id }))
    .populate({ path: 'order', populate: [{ path: 'table' }, { path: 'customer' }] })
    .populate('paidBy', 'name role')
    .populate('creditHistory.receivedBy', 'name role');

  if (!data) throw new ApiError(404, 'Payment not found');
  res.json({ data });
});

export const settleCreditPayment = asyncHandler(async (req, res) => {
  const { amountReceived, paymentMethod = '', note = '' } = req.body;
  const received = Number(amountReceived);

  if (Number.isNaN(received) || received <= 0) {
    throw new ApiError(400, 'Amount received must be greater than 0');
  }

  const payment = await Payment.findOne(await buildPaymentScopedQuery(req, { _id: req.params.id })).populate('order');
  if (!payment) throw new ApiError(404, 'Payment not found');

  if (payment.paymentStatus === 'PAID') {
    throw new ApiError(400, 'This payment is already settled');
  }

  const nextMethod = paymentMethod || payment.paymentMethod;
  await ensurePaymentMethodFeature(nextMethod);

  const orderTotal = Number(payment.order?.total || 0);
  const nextPaid = Number(payment.amountPaid || 0) + received;
  const nextStatus = nextPaid >= orderTotal ? 'PAID' : 'PARTIAL';
  const nextChange = nextPaid > orderTotal ? nextPaid - orderTotal : 0;

  payment.amountPaid = nextPaid;
  payment.changeAmount = nextChange;
  payment.paymentMethod = nextMethod;
  payment.paymentStatus = nextStatus;
  payment.creditHistory.push({
    amount: received,
    paymentMethod: nextMethod,
    note: String(note || 'Credit settlement'),
    receivedBy: req.user._id
  });

  if (nextStatus === 'PAID') {
    payment.settledAt = new Date();
    payment.dueDate = undefined;
  }

  await payment.save();

  if (nextStatus === 'PAID') {
    await completeOrderAfterPayment(payment.order);
    try {
      await createCounterReceiptJob({ user: req.user, payment });
    } catch (error) {
      console.warn('[printing] counter receipt job was not created', error?.message || error);
    }
  }

  const data = await Payment.findById(payment._id)
    .populate({ path: 'order', populate: [{ path: 'table' }, { path: 'customer' }] })
    .populate('paidBy', 'name role')
    .populate('creditHistory.receivedBy', 'name role');

  res.json({ data });
});
