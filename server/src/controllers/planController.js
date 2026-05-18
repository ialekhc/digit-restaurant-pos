import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getPlanCatalog, getActivePlanContext, getOrCreatePlanConfig, getPlanById } from '../services/planService.js';

export const getPlanCatalogController = asyncHandler(async (_req, res) => {
  res.json({ data: getPlanCatalog() });
});

export const getActivePlanController = asyncHandler(async (_req, res) => {
  const context = await getActivePlanContext();
  res.json({
    data: {
      config: context.config,
      activePlan: context.plan,
      enabledFeatureKeys: context.enabledFeatureKeys
    }
  });
});

export const updateActivePlanController = asyncHandler(async (req, res) => {
  const { activePlanId, billingCycle, addons } = req.body;

  if (!activePlanId) throw new ApiError(400, 'activePlanId is required');
  const plan = getPlanById(activePlanId);
  if (!plan) throw new ApiError(404, 'Plan not found');

  const config = await getOrCreatePlanConfig();
  config.activePlanId = activePlanId;

  if (billingCycle) {
    const allowedCycles = ['monthly', 'semiAnnual', 'annual'];
    if (!allowedCycles.includes(billingCycle)) {
      throw new ApiError(400, `billingCycle must be one of: ${allowedCycles.join(', ')}`);
    }
    config.billingCycle = billingCycle;
  }

  if (Array.isArray(addons)) {
    const addonNames = getPlanCatalog().addons.map((addon) => addon.name);
    const invalid = addons.filter((addonName) => !addonNames.includes(addonName));
    if (invalid.length) throw new ApiError(400, `Invalid addons: ${invalid.join(', ')}`);
    config.addons = addons;
  }

  await config.save();

  const context = await getActivePlanContext();
  res.json({
    message: 'Active plan updated successfully',
    data: {
      config: context.config,
      activePlan: context.plan,
      enabledFeatureKeys: context.enabledFeatureKeys
    }
  });
});

