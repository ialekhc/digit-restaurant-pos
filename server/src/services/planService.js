import { ADDON_FEATURES, PLAN_CATALOG } from '../config/planCatalog.js';
import { ROLES } from '../config/constants.js';
import { PlanConfig } from '../models/PlanConfig.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const DEFAULT_PLAN_ID = 'STANDARD';

const unique = (values) => Array.from(new Set(values));

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));

const mergePlan = (basePlan, override = {}) => ({
  ...basePlan,
  ...override,
  id: basePlan.id,
  pricing: {
    ...(basePlan.pricing || {}),
    ...(override.pricing || {})
  },
  limits: {
    ...(basePlan.limits || {}),
    ...(override.limits || {})
  },
  support: {
    ...(basePlan.support || {}),
    ...(override.support || {})
  },
  featureKeys: Array.isArray(override.featureKeys) ? override.featureKeys : basePlan.featureKeys,
  features: Array.isArray(override.features) ? override.features : basePlan.features,
  suitableFor: Array.isArray(override.suitableFor) ? override.suitableFor : basePlan.suitableFor
});

export const getPlanCatalogForConfig = (config) => {
  const customPlans = Array.isArray(config?.customPlans) ? config.customPlans : [];

  const plans = PLAN_CATALOG.plans.map((plan) => {
    const override = customPlans.find((row) => row.id === plan.id);
    return mergePlan(plan, override);
  });

  return {
    ...clone(PLAN_CATALOG),
    currency: config?.currency || PLAN_CATALOG.currency,
    profitMargin: config?.profitMargin || PLAN_CATALOG.profitMargin,
    plans
  };
};

export const getPlanCatalog = async () => {
  const config = await getOrCreatePlanConfig();
  return getPlanCatalogForConfig(config);
};

export const getPlanById = async (planId) => {
  const catalog = await getPlanCatalog();
  return catalog.plans.find((plan) => plan.id === planId) || null;
};

export const getOrCreatePlanConfig = async () => {
  let config = await PlanConfig.findOne().sort({ createdAt: 1 });
  if (!config) {
    config = await PlanConfig.create({
      activePlanId: DEFAULT_PLAN_ID,
      billingCycle: 'monthly',
      addons: [],
      currency: PLAN_CATALOG.currency,
      profitMargin: PLAN_CATALOG.profitMargin,
      customPlans: []
    });
  }
  return config;
};

export const resolveEnabledFeatures = (config) => {
  const catalog = getPlanCatalogForConfig(config);
  const plan = catalog.plans.find((row) => row.id === config.activePlanId) || catalog.plans.find((row) => row.id === DEFAULT_PLAN_ID);
  const baseKeys = Array.isArray(plan?.featureKeys) ? plan.featureKeys : [];

  const addonKeys = (config.addons || [])
    .map((addonName) => ADDON_FEATURES[addonName])
    .filter(Boolean);

  return unique([...baseKeys, ...addonKeys]);
};

export const getActivePlanContext = async () => {
  const config = await getOrCreatePlanConfig();
  const catalog = getPlanCatalogForConfig(config);
  const plan = catalog.plans.find((row) => row.id === config.activePlanId) || catalog.plans.find((row) => row.id === DEFAULT_PLAN_ID);
  const enabledFeatureKeys = resolveEnabledFeatures(config);
  const enabledFeatureMap = Object.fromEntries(enabledFeatureKeys.map((key) => [key, true]));

  return {
    config,
    plan,
    enabledFeatureKeys,
    enabledFeatureMap
  };
};

const numberOrZero = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return parsed;
};

export const updatePlanCatalog = async ({ plans = [], currency, profitMargin }) => {
  if (!Array.isArray(plans)) throw new ApiError(400, 'plans must be an array');

  const config = await getOrCreatePlanConfig();
  const allowedPlanIds = new Set(PLAN_CATALOG.plans.map((plan) => plan.id));

  const customPlans = plans.map((plan) => {
    if (!allowedPlanIds.has(plan.id)) throw new ApiError(400, `Unknown plan: ${plan.id}`);

    return {
      id: plan.id,
      name: String(plan.name || '').trim() || plan.id,
      pricing: {
        monthly: numberOrZero(plan.pricing?.monthly),
        semiAnnual: numberOrZero(plan.pricing?.semiAnnual),
        annual: numberOrZero(plan.pricing?.annual)
      },
      limits: {
        staffAccounts: plan.limits?.staffAccounts === 'Unlimited' ? 'Unlimited' : numberOrZero(plan.limits?.staffAccounts),
        branches: plan.limits?.branches === 'Unlimited' ? 'Unlimited' : numberOrZero(plan.limits?.branches)
      },
      features: Array.isArray(plan.features)
        ? plan.features.map((feature) => String(feature).trim()).filter(Boolean)
        : [],
      suitableFor: Array.isArray(plan.suitableFor)
        ? plan.suitableFor.map((item) => String(item).trim()).filter(Boolean)
        : [],
      recommended: Boolean(plan.recommended)
    };
  });

  config.customPlans = customPlans;
  if (currency) config.currency = String(currency).trim().toUpperCase();
  if (typeof profitMargin !== 'undefined') config.profitMargin = String(profitMargin).trim();

  await config.save();
  return getPlanCatalogForConfig(config);
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
    role: { $nin: [ROLES.CUSTOMER, ROLES.SUPER_ADMIN, ROLES.RESTAURANT_OWNER] }
  });
};

export const ensureStaffLimitAvailable = async ({ ignoreUserId } = {}) => {
  const limit = await getStaffAccountLimit();
  if (limit === 'Unlimited') return;

  const count = await getActiveStaffCount();
  if (typeof ignoreUserId === 'string' && ignoreUserId) {
    const user = await User.findById(ignoreUserId).select('isActive role');
    if (
      user &&
      user.isActive &&
      user.role !== ROLES.CUSTOMER &&
      user.role !== ROLES.SUPER_ADMIN &&
      user.role !== ROLES.RESTAURANT_OWNER
    ) {
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
