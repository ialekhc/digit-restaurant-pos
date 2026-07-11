import { PERMISSIONS } from '../config/constants.js';
import { isFeatureEnabled } from '../services/planService.js';
import { hasPermission } from '../services/permissionService.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const featureGate = (featureKey, message) =>
  asyncHandler(async (req, _res, next) => {
    if (hasPermission(req.user, PERMISSIONS.PLATFORM_MANAGE)) return next();

    const enabled = await isFeatureEnabled(featureKey);
    if (!enabled) {
      throw new ApiError(403, message || `Feature not available in the active plan: ${featureKey}`);
    }
    next();
  });
