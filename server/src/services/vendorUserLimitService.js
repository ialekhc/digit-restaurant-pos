import { ROLES } from '../config/constants.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

export const VENDOR_USER_LIMIT = 20;

export const isVendorCountedUserRole = (role) => ![ROLES.CUSTOMER, ROLES.SUPER_ADMIN].includes(role);

export const buildVendorUserQuery = ({ restaurantId, ownerUserId, ignoreUserId } = {}) => {
  const branches = [];
  if (restaurantId) branches.push({ restaurantId });
  if (ownerUserId) branches.push({ ownerUser: ownerUserId });

  if (!branches.length) return null;

  const scopedQuery = {
    role: { $ne: ROLES.CUSTOMER },
    $or: branches
  };

  if (!ignoreUserId) return scopedQuery;
  return {
    $and: [scopedQuery, { _id: { $ne: ignoreUserId } }]
  };
};

export const countVendorUsers = async ({ restaurantId, ownerUserId, ignoreUserId } = {}) => {
  const query = buildVendorUserQuery({ restaurantId, ownerUserId, ignoreUserId });
  if (!query) return 0;
  return User.countDocuments(query);
};

export const ensureVendorUserLimitAvailable = async ({
  restaurantId,
  ownerUserId,
  ignoreUserId,
  limit = VENDOR_USER_LIMIT
} = {}) => {
  const currentCount = await countVendorUsers({ restaurantId, ownerUserId, ignoreUserId });
  if (currentCount >= limit) {
    throw new ApiError(400, `Vendor user limit reached. Each vendor can have a maximum of ${limit} users.`);
  }
};
