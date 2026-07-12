import { PLAN_CATALOG } from '../config/planCatalog.js';
import { BILLING_CYCLES, SUBSCRIPTION_STATUSES } from '../constants/vendorConstants.js';
import { User } from '../models/User.js';
import { vendorRepository } from '../repositories/vendorRepository.js';
import { badRequest, notFound } from '../utils/HttpError.js';

const VENDOR_LOGIN_ROLE = 'RESTAURANT_OWNER';

const getPlanById = (planId) => PLAN_CATALOG.plans.find((plan) => plan.id === planId);

const billingMultiplier = (cycle) => {
  if (cycle === 'semiAnnual') return 6;
  if (cycle === 'annual') return 12;
  return 1;
};

const parseDateValue = (value, fieldName) => {
  if (typeof value === 'undefined') return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw badRequest(`Invalid date for ${fieldName}`);
  }

  return parsed;
};

const validateAddons = (addons = []) => {
  const allowed = new Set(PLAN_CATALOG.addons.map((addon) => addon.name));
  const invalid = addons.filter((addon) => !allowed.has(addon));
  if (invalid.length) {
    throw badRequest(`Invalid addons: ${invalid.join(', ')}`);
  }
  return addons;
};

const resolveSubscriptionAmount = ({ planId, billingCycle, addons = [], amount }) => {
  if (typeof amount === 'number' && !Number.isNaN(amount) && amount >= 0) {
    return amount;
  }

  const plan = getPlanById(planId);
  if (!plan) throw badRequest('Plan not found');

  const planPrice = Number(plan?.pricing?.[billingCycle] || 0);
  const addonMonthlyTotal = addons.reduce((sum, addonName) => {
    const addon = PLAN_CATALOG.addons.find((row) => row.name === addonName);
    return sum + Number(addon?.monthlyPrice || 0);
  }, 0);

  return planPrice + addonMonthlyTotal * billingMultiplier(billingCycle);
};

const buildSubscriptionPayload = (payload, existing = {}) => {
  const planId = payload.planId ?? existing.planId ?? 'STARTER';
  const billingCycle = payload.billingCycle ?? existing.billingCycle ?? 'monthly';
  const status = payload.status ?? existing.status ?? 'ACTIVE';

  if (!getPlanById(planId)) {
    throw badRequest('Plan not found');
  }
  if (!BILLING_CYCLES.includes(billingCycle)) {
    throw badRequest(`billingCycle must be one of: ${BILLING_CYCLES.join(', ')}`);
  }
  if (!SUBSCRIPTION_STATUSES.includes(status)) {
    throw badRequest(`status must be one of: ${SUBSCRIPTION_STATUSES.join(', ')}`);
  }

  const addons =
    typeof payload.addons !== 'undefined'
      ? validateAddons(payload.addons)
      : Array.isArray(existing.addons)
        ? existing.addons
        : [];

  const amount = resolveSubscriptionAmount({
    planId,
    billingCycle,
    addons,
    amount: payload.amount ?? existing.amount
  });

  return {
    planId,
    billingCycle,
    amount,
    addons,
    status,
    startsOn: parseDateValue(payload.startsOn, 'startsOn') || existing.startsOn || new Date(),
    endsOn: parseDateValue(payload.endsOn, 'endsOn') || existing.endsOn,
    nextBillingDate: parseDateValue(payload.nextBillingDate, 'nextBillingDate') || existing.nextBillingDate
  };
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

const findVendorOrThrow = async (id) => {
  const vendor = await vendorRepository.findById(id);
  if (!vendor) throw notFound('Vendor not found');
  return vendor;
};

const toVendorQuery = ({ search = '', status = '', planId = '', isActive = '' }) => {
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

  return query;
};

const createVendorLoginAccount = async ({ vendorName, loginAccess }) => {
  if (!loginAccess) return null;
  if (!loginAccess.email || !loginAccess.password) {
    throw badRequest('Vendor login email and password are required');
  }

  const existing = await User.findOne({ email: loginAccess.email });
  if (existing) throw badRequest('Vendor login email already exists');

  return User.create({
    name: loginAccess.name || `${vendorName} Owner`,
    email: loginAccess.email,
    password: loginAccess.password,
    role: VENDOR_LOGIN_ROLE,
    isActive: typeof loginAccess.isActive === 'boolean' ? loginAccess.isActive : true
  });
};

const attachVendorScopeToLoginUser = async ({ vendor, user }) => {
  if (!vendor?._id || !user?._id) return user;
  user.restaurantId = vendor._id;
  user.ownerUser = user._id;
  if (user.role !== VENDOR_LOGIN_ROLE) user.role = VENDOR_LOGIN_ROLE;
  await user.save();
  return user;
};

const syncVendorLoginAccount = async ({ vendor, loginAccess, vendorName }) => {
  if (!loginAccess) return;

  const hasExistingLogin = Boolean(vendor.loginUser);
  const shouldCreateNew = !hasExistingLogin && loginAccess.email && loginAccess.password;
  if (shouldCreateNew) {
    const user = await createVendorLoginAccount({ vendorName, loginAccess });
    await attachVendorScopeToLoginUser({ vendor, user });
    vendor.loginUser = user._id;
    vendor.loginEmail = user.email;
    vendor.loginEnabled = user.isActive;
    return;
  }

  if (!hasExistingLogin) {
    if (loginAccess.email || loginAccess.password || loginAccess.name || typeof loginAccess.isActive === 'boolean') {
      throw badRequest('Provide both vendor login email and password to create vendor access');
    }
    return;
  }

  const user = await User.findById(vendor.loginUser);
  if (!user) {
    vendor.loginUser = null;
    vendor.loginEmail = '';
    vendor.loginEnabled = false;
    if (loginAccess.email && loginAccess.password) {
      const newUser = await createVendorLoginAccount({ vendorName, loginAccess });
      await attachVendorScopeToLoginUser({ vendor, user: newUser });
      vendor.loginUser = newUser._id;
      vendor.loginEmail = newUser.email;
      vendor.loginEnabled = newUser.isActive;
    }
    return;
  }

  if (loginAccess.email && loginAccess.email !== user.email) {
    const existing = await User.findOne({ email: loginAccess.email, _id: { $ne: user._id } });
    if (existing) throw badRequest('Vendor login email already exists');
    user.email = loginAccess.email;
  }
  if (loginAccess.password) user.password = loginAccess.password;
  if (loginAccess.name) user.name = loginAccess.name;
  if (typeof loginAccess.isActive === 'boolean') user.isActive = loginAccess.isActive;
  if (user.role !== VENDOR_LOGIN_ROLE) user.role = VENDOR_LOGIN_ROLE;

  await attachVendorScopeToLoginUser({ vendor, user });
  vendor.loginUser = user._id;
  vendor.loginEmail = user.email;
  vendor.loginEnabled = user.isActive;
};

export const vendorService = {
  async list(filters) {
    const query = toVendorQuery(filters);
    return vendorRepository.findMany(query);
  },

  async getById(id) {
    return findVendorOrThrow(id);
  },

  async create(payload, actorId) {
    const subscription = buildSubscriptionPayload(payload.subscription || {}, {});
    let vendor;
    let createdLoginUser = null;
    try {
      vendor = await vendorRepository.create({
        vendorName: payload.vendorName,
        contactPerson: payload.contactPerson || '',
        email: payload.email || '',
        phone: payload.phone || '',
        address: payload.address || '',
        notes: payload.notes || '',
        isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
        subscription,
        createdBy: actorId
      });

      if (payload.loginAccess) {
        createdLoginUser = await createVendorLoginAccount({
          vendorName: payload.vendorName,
          loginAccess: payload.loginAccess
        });
        await attachVendorScopeToLoginUser({ vendor, user: createdLoginUser });
        vendor.loginUser = createdLoginUser._id;
        vendor.loginEmail = createdLoginUser.email;
        vendor.loginEnabled = createdLoginUser.isActive;
        await vendor.save();
      }
    } catch (error) {
      if (vendor?._id) {
        await vendor.deleteOne();
      }
      if (createdLoginUser?._id) {
        await User.findByIdAndDelete(createdLoginUser._id);
      }
      throw error;
    }

    return vendorRepository.findById(vendor._id);
  },

  async update(id, payload) {
    const vendor = await findVendorOrThrow(id);

    ['vendorName', 'contactPerson', 'email', 'phone', 'address', 'notes'].forEach((field) => {
      if (typeof payload[field] !== 'undefined') vendor[field] = payload[field];
    });

    if (typeof payload.isActive !== 'undefined') {
      vendor.isActive = Boolean(payload.isActive);
    }

    await syncVendorLoginAccount({
      vendor,
      loginAccess: payload.loginAccess,
      vendorName: vendor.vendorName
    });

    await vendor.save();
    return vendorRepository.findById(vendor._id);
  },

  async remove(id) {
    const vendor = await findVendorOrThrow(id);
    if (vendor.loginUser) {
      await User.findByIdAndDelete(vendor.loginUser);
    }
    await vendor.deleteOne();
  },

  async updateSubscription(id, payload) {
    const vendor = await findVendorOrThrow(id);
    vendor.subscription = buildSubscriptionPayload(payload, vendor.subscription || {});
    await vendor.save();
    return vendor;
  },

  async addSubscriptionPayment(id, payload) {
    const vendor = await findVendorOrThrow(id);

    vendor.paymentHistory.push({
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      paymentDate: parseDateValue(payload.paymentDate, 'paymentDate') || new Date(),
      reference: payload.reference || '',
      note: payload.note || ''
    });

    recalculateVendorPayments(vendor);
    await vendor.save();
    return vendor;
  },

  async updateSubscriptionPayment(id, paymentId, payload) {
    const vendor = await findVendorOrThrow(id);
    const payment = vendor.paymentHistory.id(paymentId);
    if (!payment) throw notFound('Subscription payment record not found');

    if (typeof payload.amount === 'number') payment.amount = payload.amount;
    if (typeof payload.paymentMethod === 'string') payment.paymentMethod = payload.paymentMethod;
    if (typeof payload.paymentDate === 'string') {
      payment.paymentDate = parseDateValue(payload.paymentDate, 'paymentDate');
    }
    if (typeof payload.reference !== 'undefined') payment.reference = payload.reference;
    if (typeof payload.note !== 'undefined') payment.note = payload.note;

    recalculateVendorPayments(vendor);
    await vendor.save();
    return vendor;
  },

  async deleteSubscriptionPayment(id, paymentId) {
    const vendor = await findVendorOrThrow(id);
    const payment = vendor.paymentHistory.id(paymentId);
    if (!payment) throw notFound('Subscription payment record not found');

    payment.deleteOne();
    recalculateVendorPayments(vendor);
    await vendor.save();
    return vendor;
  },

  async getSubscriptionOverview() {
    const vendors = await vendorRepository.findMany({});

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

    return {
      summary,
      distributions: {
        byPlan: Object.entries(byPlan).map(([planId, count]) => ({ planId, count })),
        byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count }))
      }
    };
  }
};
