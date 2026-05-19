import { BILLING_CYCLES, PAYMENT_METHODS, SUBSCRIPTION_STATUSES } from '../constants/vendorConstants.js';
import { badRequest } from '../utils/HttpError.js';

const parseString = (value, fieldName, { required = false } = {}) => {
  if (typeof value === 'undefined' || value === null) {
    if (required) throw badRequest(`${fieldName} is required`);
    return undefined;
  }

  if (typeof value !== 'string') {
    throw badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (required && !trimmed) throw badRequest(`${fieldName} is required`);
  return trimmed;
};

const parseBoolean = (value, fieldName) => {
  if (typeof value === 'undefined') return undefined;
  if (typeof value === 'boolean') return value;
  throw badRequest(`${fieldName} must be a boolean`);
};

const parseNumber = (value, fieldName, { required = false, min = null } = {}) => {
  if (typeof value === 'undefined' || value === null || value === '') {
    if (required) throw badRequest(`${fieldName} is required`);
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw badRequest(`${fieldName} must be a number`);
  if (min !== null && parsed < min) throw badRequest(`${fieldName} must be greater than or equal to ${min}`);
  return parsed;
};

const parseDateString = (value, fieldName) => {
  if (typeof value === 'undefined' || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw badRequest(`${fieldName} must be a date string`);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`Invalid date for ${fieldName}`);
  return value;
};

const parseStringArray = (value, fieldName) => {
  if (typeof value === 'undefined') return undefined;
  if (!Array.isArray(value)) throw badRequest(`${fieldName} must be an array`);

  return value.map((row, index) => {
    if (typeof row !== 'string') throw badRequest(`${fieldName}[${index}] must be a string`);
    return row.trim();
  });
};

const parseLoginAccess = (value) => {
  if (typeof value === 'undefined') return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest('loginAccess must be an object');
  }

  const name = parseString(value.name, 'loginAccess.name');
  const email = parseString(value.email, 'loginAccess.email');
  const password = parseString(value.password, 'loginAccess.password');
  const isActive = parseBoolean(value.isActive, 'loginAccess.isActive');

  const normalizedEmail = email ? email.toLowerCase() : '';
  if (normalizedEmail && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw badRequest('Invalid vendor login email');
  }
  if (password && password.length < 6) {
    throw badRequest('Vendor login password must be at least 6 characters');
  }

  const normalized = {
    ...(name ? { name } : {}),
    ...(normalizedEmail ? { email: normalizedEmail } : {}),
    ...(password ? { password } : {}),
    ...(typeof isActive === 'boolean' ? { isActive } : {})
  };

  return Object.keys(normalized).length ? normalized : undefined;
};

export const parseListVendorsQuery = (req) => {
  const search = parseString(req.query.search, 'search') || '';
  const status = parseString(req.query.status, 'status') || '';
  const planId = parseString(req.query.planId, 'planId') || '';
  const isActiveRaw = req.query.isActive;

  let isActive = '';
  if (typeof isActiveRaw !== 'undefined') {
    if (isActiveRaw !== 'true' && isActiveRaw !== 'false') {
      throw badRequest('isActive must be "true" or "false"');
    }
    isActive = isActiveRaw;
  }

  return { search, status, planId, isActive };
};

export const parseCreateVendorBody = (req) => {
  const subscription =
    req.body.subscription &&
    typeof req.body.subscription === 'object' &&
    !Array.isArray(req.body.subscription)
      ? req.body.subscription
      : {};

  return {
    vendorName: parseString(req.body.vendorName, 'vendorName', { required: true }),
    contactPerson: parseString(req.body.contactPerson, 'contactPerson') || '',
    email: parseString(req.body.email, 'email') || '',
    phone: parseString(req.body.phone, 'phone') || '',
    address: parseString(req.body.address, 'address') || '',
    notes: parseString(req.body.notes, 'notes') || '',
    isActive: parseBoolean(req.body.isActive, 'isActive'),
    subscription,
    loginAccess: parseLoginAccess(req.body.loginAccess)
  };
};

export const parseUpdateVendorBody = (req) => {
  return {
    vendorName: parseString(req.body.vendorName, 'vendorName'),
    contactPerson: parseString(req.body.contactPerson, 'contactPerson'),
    email: parseString(req.body.email, 'email'),
    phone: parseString(req.body.phone, 'phone'),
    address: parseString(req.body.address, 'address'),
    notes: parseString(req.body.notes, 'notes'),
    isActive: parseBoolean(req.body.isActive, 'isActive'),
    loginAccess: parseLoginAccess(req.body.loginAccess)
  };
};

export const parseUpdateSubscriptionBody = (req) => {
  const planId = parseString(req.body.planId, 'planId');
  const billingCycle = parseString(req.body.billingCycle, 'billingCycle');
  const status = parseString(req.body.status, 'status');
  const amount = parseNumber(req.body.amount, 'amount', { min: 0 });
  const addons = parseStringArray(req.body.addons, 'addons');
  const startsOn = parseDateString(req.body.startsOn, 'startsOn');
  const endsOn = parseDateString(req.body.endsOn, 'endsOn');
  const nextBillingDate = parseDateString(req.body.nextBillingDate, 'nextBillingDate');

  if (billingCycle && !BILLING_CYCLES.includes(billingCycle)) {
    throw badRequest(`billingCycle must be one of ${BILLING_CYCLES.join(', ')}`);
  }

  if (status && !SUBSCRIPTION_STATUSES.includes(status)) {
    throw badRequest(`status must be one of ${SUBSCRIPTION_STATUSES.join(', ')}`);
  }

  return {
    planId,
    billingCycle,
    status,
    amount,
    addons,
    startsOn,
    endsOn,
    nextBillingDate
  };
};

export const parseAddPaymentBody = (req) => {
  const amount = parseNumber(req.body.amount, 'amount', { required: true, min: 0.01 });
  const paymentMethod = parseString(req.body.paymentMethod, 'paymentMethod') || 'ONLINE';
  const paymentDate = parseDateString(req.body.paymentDate, 'paymentDate');
  const reference = parseString(req.body.reference, 'reference') || '';
  const note = parseString(req.body.note, 'note') || '';

  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw badRequest(`paymentMethod must be one of ${PAYMENT_METHODS.join(', ')}`);
  }

  return { amount, paymentMethod, paymentDate, reference, note };
};

export const parseUpdatePaymentBody = (req) => {
  const amount = parseNumber(req.body.amount, 'amount', { min: 0.01 });
  const paymentMethod = parseString(req.body.paymentMethod, 'paymentMethod');
  const paymentDate = parseDateString(req.body.paymentDate, 'paymentDate');
  const reference = parseString(req.body.reference, 'reference');
  const note = parseString(req.body.note, 'note');

  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    throw badRequest(`paymentMethod must be one of ${PAYMENT_METHODS.join(', ')}`);
  }

  return { amount, paymentMethod, paymentDate, reference, note };
};
