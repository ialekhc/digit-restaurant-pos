import { ROLES } from '../config/constants.js';
import { isFeatureEnabled } from '../services/planService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const featureGate = (featureKey, message) =>
  asyncHandler(async (req, _res, next) => {
    if (req.user?.role === ROLES.SUPER_ADMIN) return next();

    const enabled = await isFeatureEnabled(featureKey);
    if (!enabled) {
      throw new ApiError(403, message || `Feature not available in the active plan: ${featureKey}`);
    }
    next();
  });

