import { Vendor } from '../models/Vendor.js';
import { PLAN_CATALOG } from '../config/planCatalog.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

const BILLING_CYCLES = ['monthly', 'semiAnnual', 'annual'];
const SUBSCRIPTION_STATUSES = ['ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'];
const PAYMENT_METHODS = ['CASH', 'CARD', 'QR', 'ONLINE', 'BANK_TRANSFER'];

const parseDateValue = (value, fieldName) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `Invalid date for ${fieldName}`);
  }
  return parsed;
};

const getPlanById = (planId) => PLAN_CATALOG.plans.find((plan) => plan.id === planId);

const validateAddons = (addons = []) => {
  if (!Array.isArray(addons)) throw new ApiError(400, 'addons must be an array');
  const allowed = new Set(PLAN_CATALOG.addons.map((addon) => addon.name));
  const invalid = addons.filter((addon) => !allowed.has(addon));
  if (invalid.length) {
    throw new ApiError(400, `Invalid addons: ${invalid.join(', ')}`);
  }
  return addons;
};

const billingMultiplier = (cycle) => {
  if (cycle === 'semiAnnual') return 6;
  if (cycle === 'annual') return 12;
  return 1;
};

const resolveSubscriptionAmount = ({ planId, billingCycle, addons = [], amount }) => {
  const amountNum = Number(amount);
  if (!Number.isNaN(amountNum) && amountNum >= 0) return amountNum;

  const plan = getPlanById(planId);
  if (!plan) throw new ApiError(404, 'Plan not found');

  const planPrice = Number(plan.pricing?.[billingCycle] || 0);
  const addonMonthlyTotal = addons.reduce((sum, addonName) => {
    const addon = PLAN_CATALOG.addons.find((row) => row.name === addonName);
    return sum + Number(addon?.monthlyPrice || 0);
  }, 0);

  return planPrice + addonMonthlyTotal * billingMultiplier(billingCycle);
};

const recalculateVendorPayments = (vendor) => {
  const history = Array.isArray(vendor.paymentHistory) ? vendor.paymentHistory : [];
  vendor.totalPaid = history.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  if (!history.length) {
    vendor.lastPaymentDate = undefined;
    return;
  }

  const latest = history
    .map((payment) => new Date(payment.paymentDate || payment.createdAt || 0))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  vendor.lastPaymentDate = Number.isNaN(latest.getTime()) ? undefined : latest;
};

const buildSubscriptionPayload = (body, existing = {}) => {
  const planId = body.planId || existing.planId || 'STARTER';
  const billingCycle = body.billingCycle || existing.billingCycle || 'monthly';
  const status = body.status || existing.status || 'ACTIVE';
  const addons = validateAddons(body.addons || existing.addons || []);

  if (!getPlanById(planId)) {
    throw new ApiError(404, 'Plan not found');
  }
  if (!BILLING_CYCLES.includes(billingCycle)) {
    throw new ApiError(400, `billingCycle must be one of: ${BILLING_CYCLES.join(', ')}`);
  }
  if (!SUBSCRIPTION_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${SUBSCRIPTION_STATUSES.join(', ')}`);
  }

  const startsOn = parseDateValue(body.startsOn, 'startsOn') || existing.startsOn || new Date();
  const endsOn = parseDateValue(body.endsOn, 'endsOn') || existing.endsOn;
  const nextBillingDate =
    parseDateValue(body.nextBillingDate, 'nextBillingDate') || existing.nextBillingDate || undefined;

  const amount = resolveSubscriptionAmount({
    planId,
    billingCycle,
    addons,
    amount: body.amount ?? existing.amount
  });

  return {
    planId,
    billingCycle,
    amount,
    addons,
    status,
    startsOn,
    endsOn,
    nextBillingDate
  };
};

export const getVendors = asyncHandler(async (req, res) => {
  const { search = '', status = '', planId = '', isActive = '' } = req.query;

  const query = {};
  if (status) query['subscription.status'] = status;
  if (planId) query['subscription.planId'] = planId;
  if (isActive === 'true') query.isActive = true;
  if (isActive === 'false') query.isActive = false;

  if (search) {
    query.$or = [
      { vendorName: { $regex: search, $options: 'i' } },
      { contactPerson: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const data = await Vendor.find(query).populate('createdBy', 'name role').sort({ createdAt: -1 });
  res.json({ data });
});

export const getVendorById = asyncHandler(async (req, res) => {
  const data = await Vendor.findById(req.params.id).populate('createdBy', 'name role');
  if (!data) throw new ApiError(404, 'Vendor not found');
  res.json({ data });
});

export const createVendor = asyncHandler(async (req, res) => {
  const { vendorName, contactPerson, email, phone, address, isActive, notes = '', subscription = {} } = req.body;

  if (!vendorName) throw new ApiError(400, 'vendorName is required');

  const subscriptionPayload = buildSubscriptionPayload(subscription, {});

  const vendor = await Vendor.create({
    vendorName,
    contactPerson: contactPerson || '',
    email: email || '',
    phone: phone || '',
    address: address || '',
    isActive: typeof isActive === 'boolean' ? isActive : true,
    notes: notes || '',
    subscription: subscriptionPayload,
    createdBy: req.user?._id
  });

  const data = await Vendor.findById(vendor._id).populate('createdBy', 'name role');
  res.status(201).json({ data });
});

export const updateVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  const fields = ['vendorName', 'contactPerson', 'email', 'phone', 'address', 'notes'];
  fields.forEach((field) => {
    if (typeof req.body[field] !== 'undefined') vendor[field] = req.body[field];
  });

  if (typeof req.body.isActive !== 'undefined') {
    vendor.isActive = Boolean(req.body.isActive);
  }

  await vendor.save();
  const data = await Vendor.findById(vendor._id).populate('createdBy', 'name role');
  res.json({ data });
});

export const deleteVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  await vendor.deleteOne();
  res.json({ message: 'Vendor deleted' });
});

export const updateVendorSubscription = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  vendor.subscription = buildSubscriptionPayload(req.body, vendor.subscription || {});
  await vendor.save();

  const data = await Vendor.findById(vendor._id).populate('createdBy', 'name role');
  res.json({ data });
});

export const addVendorSubscriptionPayment = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  const amount = Number(req.body.amount);
  if (Number.isNaN(amount) || amount <= 0) {
    throw new ApiError(400, 'amount must be greater than 0');
  }

  const paymentMethod = req.body.paymentMethod || 'ONLINE';
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new ApiError(400, `paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`);
  }

  const paymentDate = parseDateValue(req.body.paymentDate, 'paymentDate') || new Date();

  vendor.paymentHistory.push({
    amount,
    paymentMethod,
    paymentDate,
    reference: req.body.reference || '',
    note: req.body.note || ''
  });

  recalculateVendorPayments(vendor);
  await vendor.save();

  const data = await Vendor.findById(vendor._id).populate('createdBy', 'name role');
  res.status(201).json({ data });
});

export const updateVendorSubscriptionPayment = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  const payment = vendor.paymentHistory.id(req.params.paymentId);
  if (!payment) throw new ApiError(404, 'Subscription payment record not found');

  if (typeof req.body.amount !== 'undefined') {
    const amount = Number(req.body.amount);
    if (Number.isNaN(amount) || amount <= 0) throw new ApiError(400, 'amount must be greater than 0');
    payment.amount = amount;
  }

  if (typeof req.body.paymentMethod !== 'undefined') {
    if (!PAYMENT_METHODS.includes(req.body.paymentMethod)) {
      throw new ApiError(400, `paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`);
    }
    payment.paymentMethod = req.body.paymentMethod;
  }

  if (typeof req.body.paymentDate !== 'undefined') {
    payment.paymentDate = parseDateValue(req.body.paymentDate, 'paymentDate');
  }

  if (typeof req.body.reference !== 'undefined') payment.reference = req.body.reference;
  if (typeof req.body.note !== 'undefined') payment.note = req.body.note;

  recalculateVendorPayments(vendor);
  await vendor.save();

  const data = await Vendor.findById(vendor._id).populate('createdBy', 'name role');
  res.json({ data });
});

export const deleteVendorSubscriptionPayment = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  const payment = vendor.paymentHistory.id(req.params.paymentId);
  if (!payment) throw new ApiError(404, 'Subscription payment record not found');

  payment.deleteOne();
  recalculateVendorPayments(vendor);
  await vendor.save();

  const data = await Vendor.findById(vendor._id).populate('createdBy', 'name role');
  res.json({ data });
});

export const vendorSubscriptionOverview = asyncHandler(async (_req, res) => {
  const vendors = await Vendor.find({}).sort({ createdAt: -1 });

  const summary = vendors.reduce(
    (acc, vendor) => {
      acc.totalVendors += 1;
      if (vendor.isActive) acc.activeVendors += 1;
      if (vendor.subscription?.status === 'ACTIVE') acc.activeSubscriptions += 1;

      const cycle = vendor.subscription?.billingCycle || 'monthly';
      const amount = Number(vendor.subscription?.amount || 0);
      if (vendor.subscription?.status === 'ACTIVE') {
        if (cycle === 'monthly') acc.monthlyRecurringRevenue += amount;
        if (cycle === 'semiAnnual') acc.monthlyRecurringRevenue += amount / 6;
        if (cycle === 'annual') acc.monthlyRecurringRevenue += amount / 12;
      }

      acc.totalSubscriptionIncome += Number(vendor.totalPaid || 0);
      return acc;
    },
    {
      totalVendors: 0,
      activeVendors: 0,
      activeSubscriptions: 0,
      monthlyRecurringRevenue: 0,
      totalSubscriptionIncome: 0
    }
  );

  const byPlan = vendors.reduce((acc, vendor) => {
    const key = vendor.subscription?.planId || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byStatus = vendors.reduce((acc, vendor) => {
    const key = vendor.subscription?.status || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  res.json({
    data: {
      summary,
      distributions: {
        byPlan: Object.entries(byPlan).map(([planId, count]) => ({ planId, count })),
        byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count }))
      }
    }
  });
});
