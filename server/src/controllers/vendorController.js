import { Vendor } from '../models/Vendor.js';
import { User } from '../models/User.js';
import { PLAN_CATALOG } from '../config/planCatalog.js';
import { ROLES } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ensureVendorUserLimitAvailable } from '../services/vendorUserLimitService.js';

const BILLING_CYCLES = ['monthly', 'semiAnnual', 'annual'];
const SUBSCRIPTION_STATUSES = ['ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED'];
const PAYMENT_METHODS = ['CASH', 'CARD', 'QR', 'ONLINE', 'BANK_TRANSFER'];

const VENDOR_LOGIN_ROLE = ROLES.RESTAURANT_OWNER;
const VENDOR_LOGIN_MIN_PASSWORD = 6;
const vendorUserProjection = '-password -additionalPermissions -deniedPermissions -permissions -branchIds';

const toPlain = (doc) => (doc?.toJSON ? doc.toJSON() : doc);

const getVendorLoginUserId = (vendor) => {
  const plain = toPlain(vendor);
  return plain?.loginUser?._id || plain?.loginUser || null;
};

const findUsersForVendor = async (vendor) => {
  const plain = toPlain(vendor);
  const branches = [{ restaurantId: plain._id }];
  const loginUserId = getVendorLoginUserId(vendor);
  if (loginUserId) {
    branches.push({ ownerUser: loginUserId }, { _id: loginUserId });
  }

  return User.find({ $or: branches }).select(vendorUserProjection).sort({ createdAt: -1 });
};

const attachUsersToVendors = async (vendors = []) => {
  return Promise.all(
    vendors.map(async (vendor) => {
      const users = await findUsersForVendor(vendor);
      return {
        ...toPlain(vendor),
        users: users.map(toPlain),
        userCount: users.length
      };
    })
  );
};

const parseLoginPayload = (loginAccess) => {
  if (typeof loginAccess === 'undefined') return null;

  if (!loginAccess || typeof loginAccess !== 'object' || Array.isArray(loginAccess)) {
    throw new ApiError(400, 'loginAccess must be an object');
  }

  const name = typeof loginAccess.name === 'string' ? loginAccess.name.trim() : '';
  const email = typeof loginAccess.email === 'string' ? loginAccess.email.trim().toLowerCase() : '';
  const password = typeof loginAccess.password === 'string' ? loginAccess.password : '';
  const isActive = typeof loginAccess.isActive === 'boolean' ? loginAccess.isActive : undefined;

  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(400, 'Invalid vendor login email');
  }

  if (password && password.length < VENDOR_LOGIN_MIN_PASSWORD) {
    throw new ApiError(400, `Vendor login password must be at least ${VENDOR_LOGIN_MIN_PASSWORD} characters`);
  }

  if (!name && !email && !password && typeof isActive === 'undefined') {
    return null;
  }

  return { name, email, password, isActive };
};

const findVendorByIdWithPopulate = (id) =>
  Vendor.findById(id).populate('createdBy', 'name role').populate('loginUser', 'name email role isActive');

const buildVendorLoginName = ({ vendorName, loginName }) => {
  if (loginName) return loginName;
  return `${vendorName} Owner`;
};

const createVendorLoginAccount = async ({ vendorName, loginAccess }) => {
  if (!loginAccess) return null;
  if (!loginAccess.email || !loginAccess.password) {
    throw new ApiError(400, 'Vendor login email and password are required');
  }

  const existing = await User.findOne({ email: loginAccess.email });
  if (existing) {
    throw new ApiError(409, 'Vendor login email already exists');
  }

  return User.create({
    name: buildVendorLoginName({ vendorName, loginName: loginAccess.name }),
    email: loginAccess.email,
    password: loginAccess.password,
    phone: '',
    role: VENDOR_LOGIN_ROLE,
    isActive: typeof loginAccess.isActive === 'boolean' ? loginAccess.isActive : true
  });
};

const attachVendorScopeToLoginUser = async ({ vendor, user }) => {
  if (!vendor?._id || !user?._id) return user;
  await ensureVendorUserLimitAvailable({
    restaurantId: vendor._id,
    ownerUserId: user._id,
    ignoreUserId: String(user._id)
  });
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
      throw new ApiError(400, 'Provide both vendor login email and password to create vendor access');
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
    if (existing) throw new ApiError(409, 'Vendor login email already exists');
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

  const vendors = await Vendor.find(query)
    .populate('createdBy', 'name role')
    .populate('loginUser', 'name email role isActive')
    .sort({ createdAt: -1 });
  const data = await attachUsersToVendors(vendors);
  res.json({ data });
});

export const getVendorById = asyncHandler(async (req, res) => {
  const vendor = await findVendorByIdWithPopulate(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  const [data] = await attachUsersToVendors([vendor]);
  res.json({ data });
});

export const createVendor = asyncHandler(async (req, res) => {
  const { vendorName, contactPerson, email, phone, address, isActive, notes = '', subscription = {}, loginAccess } = req.body;

  if (!vendorName) throw new ApiError(400, 'vendorName is required');
  const parsedLoginAccess = parseLoginPayload(loginAccess);

  const subscriptionPayload = buildSubscriptionPayload(subscription, {});

  let vendor;
  let createdLoginUser = null;
  try {
    vendor = await Vendor.create({
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

    if (parsedLoginAccess) {
      createdLoginUser = await createVendorLoginAccount({ vendorName, loginAccess: parsedLoginAccess });
      await attachVendorScopeToLoginUser({ vendor, user: createdLoginUser });
      vendor.loginUser = createdLoginUser._id;
      vendor.loginEmail = createdLoginUser.email;
      vendor.loginEnabled = createdLoginUser.isActive;
      await vendor.save();
    }
  } catch (error) {
    if (vendor?._id) {
      await Vendor.findByIdAndDelete(vendor._id);
    }
    if (createdLoginUser?._id) {
      await User.findByIdAndDelete(createdLoginUser._id);
    }
    throw error;
  }

  const [data] = await attachUsersToVendors([await findVendorByIdWithPopulate(vendor._id)]);
  res.status(201).json({ data });
});

export const updateVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  const parsedLoginAccess = parseLoginPayload(req.body.loginAccess);

  const fields = ['vendorName', 'contactPerson', 'email', 'phone', 'address', 'notes'];
  fields.forEach((field) => {
    if (typeof req.body[field] !== 'undefined') vendor[field] = req.body[field];
  });

  if (typeof req.body.isActive !== 'undefined') {
    vendor.isActive = Boolean(req.body.isActive);
  }

  await syncVendorLoginAccount({
    vendor,
    loginAccess: parsedLoginAccess,
    vendorName: vendor.vendorName
  });

  await vendor.save();
  const [data] = await attachUsersToVendors([await findVendorByIdWithPopulate(vendor._id)]);
  res.json({ data });
});

export const deleteVendor = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');
  if (vendor.loginUser) {
    await User.findByIdAndDelete(vendor.loginUser);
  }
  await vendor.deleteOne();
  res.json({ message: 'Vendor deleted' });
});

export const updateVendorSubscription = asyncHandler(async (req, res) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new ApiError(404, 'Vendor not found');

  vendor.subscription = buildSubscriptionPayload(req.body, vendor.subscription || {});
  await vendor.save();

  const [data] = await attachUsersToVendors([await findVendorByIdWithPopulate(vendor._id)]);
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

  const [data] = await attachUsersToVendors([await findVendorByIdWithPopulate(vendor._id)]);
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

  const [data] = await attachUsersToVendors([await findVendorByIdWithPopulate(vendor._id)]);
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

  const [data] = await attachUsersToVendors([await findVendorByIdWithPopulate(vendor._id)]);
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
