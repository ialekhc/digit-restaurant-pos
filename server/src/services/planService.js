import { ADDON_FEATURES, PLAN_CATALOG } from '../config/planCatalog.js';
import { ROLES } from '../config/constants.js';
import { PlanConfig } from '../models/PlanConfig.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const DEFAULT_PLAN_ID = 'STANDARD';

const unique = (values) => Array.from(new Set(values));

export const getPlanById = (planId) => {
  return PLAN_CATALOG.plans.find((plan) => plan.id === planId) || null;
};

export const getPlanCatalog = () => PLAN_CATALOG;

export const getOrCreatePlanConfig = async () => {
  let config = await PlanConfig.findOne().sort({ createdAt: 1 });
  if (!config) {
    config = await PlanConfig.create({
      activePlanId: DEFAULT_PLAN_ID,
      billingCycle: 'monthly',
      addons: [],
      currency: PLAN_CATALOG.currency,
      profitMargin: PLAN_CATALOG.profitMargin
    });
  }
  return config;
};

export const resolveEnabledFeatures = (config) => {
  const plan = getPlanById(config.activePlanId) || getPlanById(DEFAULT_PLAN_ID);
  const baseKeys = Array.isArray(plan?.featureKeys) ? plan.featureKeys : [];

  const addonKeys = (config.addons || [])
    .map((addonName) => ADDON_FEATURES[addonName])
    .filter(Boolean);

  return unique([...baseKeys, ...addonKeys]);
};

export const getActivePlanContext = async () => {
  const config = await getOrCreatePlanConfig();
  const plan = getPlanById(config.activePlanId) || getPlanById(DEFAULT_PLAN_ID);
  const enabledFeatureKeys = resolveEnabledFeatures(config);
  const enabledFeatureMap = Object.fromEntries(enabledFeatureKeys.map((key) => [key, true]));

  return {
    config,
    plan,
    enabledFeatureKeys,
    enabledFeatureMap
  };
};

export const isFeatureEnabled = async (featureKey) => {
  const context = await getActivePlanContext();
  return Boolean(context.enabledFeatureMap[featureKey]);
};

export const ensureFeatureEnabled = async (featureKey, message = 'This feature is not available in your active plan') => {
  const enabled = await isFeatureEnabled(featureKey);
  if (!enabled) throw new ApiError(403, message);
};

export const getStaffAccountLimit = async () => {
  const { plan } = await getActivePlanContext();
  return plan?.limits?.staffAccounts ?? 'Unlimited';
};

export const getActiveStaffCount = async () => {
  return User.countDocuments({
    isActive: true,
    role: { $nin: [ROLES.CUSTOMER, ROLES.SUPER_ADMIN] }
  });
};

export const ensureStaffLimitAvailable = async ({ ignoreUserId } = {}) => {
  const limit = await getStaffAccountLimit();
  if (limit === 'Unlimited') return;

  const count = await getActiveStaffCount();
  if (typeof ignoreUserId === 'string' && ignoreUserId) {
    const user = await User.findById(ignoreUserId).select('isActive role');
    if (user && user.isActive && user.role !== ROLES.CUSTOMER && user.role !== ROLES.SUPER_ADMIN) {
      return;
    }
  }

  if (count >= Number(limit)) {
    throw new ApiError(
      400,
      `Active staff account limit reached for ${limit}. Upgrade your plan to add more staff.`
    );
  }
};
