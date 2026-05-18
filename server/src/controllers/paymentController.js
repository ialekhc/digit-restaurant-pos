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

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createPayment = asyncHandler(async (req, res) => {
  const { order: orderId, orderNumber = '', tableNumber = '', paymentMethod, amountPaid, paymentStatus = 'PAID' } = req.body;
  const normalizedTableNumber = String(tableNumber).trim();

  if ((!orderId && !orderNumber) || !paymentMethod || typeof amountPaid === 'undefined') {
    throw new ApiError(400, 'Order ID or order number, payment method and amount paid are required');
  }

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

  let order = null;

  if (orderId) {
    order = await Order.findById(orderId);
  } else {
    const query = { orderNumber: String(orderNumber).trim() };

    if (normalizedTableNumber) {
      const table = await Table.findOne({
        tableNumber: { $regex: new RegExp(`^${escapeRegex(normalizedTableNumber)}$`, 'i') }
      });
      if (!table) {
        throw new ApiError(404, 'Table not found for provided table number');
      }
      query.table = table._id;
    }

    order = await Order.findOne(query);
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
  const changeAmount = paid > order.total ? paid - order.total : 0;

  if (paid < order.total && paymentStatus === 'PAID') {
    throw new ApiError(400, 'Amount paid is less than total. Use PARTIAL status or pay full amount');
  }

  if (paymentStatus === 'PAID' && !BILLABLE_ORDER_STATUSES.includes(order.status)) {
    throw new ApiError(400, `Order must be ${BILLABLE_ORDER_STATUSES.join(' or ')} before final payment`);
  }

  const data = await Payment.create({
    order: order._id,
    billNumber: generateBillNumber(),
    paymentMethod,
    amountPaid: paid,
    changeAmount,
    paymentStatus,
    paidBy: req.user._id
  });

  if (paymentStatus === 'PAID') {
    order.status = 'COMPLETED';
    await order.save();

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
  }

  const populated = await Payment.findById(data._id)
    .populate({ path: 'order', populate: [{ path: 'table' }, { path: 'customer' }] })
    .populate('paidBy', 'name role');

  res.status(201).json({ data: populated });
});

export const getPayments = asyncHandler(async (req, res) => {
  const { method = '', status = '', date = '' } = req.query;

  const query = {};
  if (method) query.paymentMethod = method;
  if (status) query.paymentStatus = status;
  if (date) {
    const from = new Date(date);
    const to = new Date(date);
    to.setDate(to.getDate() + 1);
    query.createdAt = { $gte: from, $lt: to };
  }

  const data = await Payment.find(query)
    .populate({ path: 'order', populate: [{ path: 'table' }, { path: 'customer' }] })
    .populate('paidBy', 'name role')
    .sort({ createdAt: -1 });

  res.json({ data });
});

export const getPaymentById = asyncHandler(async (req, res) => {
  const data = await Payment.findById(req.params.id)
    .populate({ path: 'order', populate: [{ path: 'table' }, { path: 'customer' }] })
    .populate('paidBy', 'name role');

  if (!data) throw new ApiError(404, 'Payment not found');
  res.json({ data });
});
