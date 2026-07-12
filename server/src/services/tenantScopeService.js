import { ROLES } from '../config/constants.js';
import { User } from '../models/User.js';
import { Vendor } from '../models/Vendor.js';

const NO_MATCH_ID = '__NO_TENANT_MATCH__';

const unique = (values = []) => [...new Set(values.filter(Boolean).map(String))];

const mergeQueries = (baseQuery = {}, scopeQuery = {}) => {
  if (!scopeQuery || !Object.keys(scopeQuery).length) return baseQuery;
  if (!baseQuery || !Object.keys(baseQuery).length) return scopeQuery;
  return { $and: [baseQuery, scopeQuery] };
};

export const isPlatformScopeUser = (user) => user?.role === ROLES.SUPER_ADMIN;

export const resolveTenantScope = async (user) => {
  if (!user) return { platform: false, restaurantId: null, ownerUserId: null, userIds: [] };
  if (isPlatformScopeUser(user)) return { platform: true, restaurantId: null, ownerUserId: null, userIds: [] };

  let restaurantId = user.restaurantId || null;
  let ownerUserId = user.ownerUser || null;

  if (user.role === ROLES.RESTAURANT_OWNER) {
    ownerUserId = user._id;
    if (!restaurantId) {
      const vendor = await Vendor.findOne({ loginUser: user._id }).select('_id');
      restaurantId = vendor?._id || null;
    }
  }

  if (!restaurantId && ownerUserId) {
    const owner = await User.findById(ownerUserId).select('restaurantId');
    restaurantId = owner?.restaurantId || null;
  }

  const userQueryBranches = [];
  if (restaurantId) userQueryBranches.push({ restaurantId });
  if (ownerUserId) userQueryBranches.push({ ownerUser: ownerUserId }, { _id: ownerUserId });
  userQueryBranches.push({ _id: user._id });

  const tenantUsers = await User.find({ $or: userQueryBranches }).select('_id');
  const userIds = unique([user._id, ownerUserId, ...tenantUsers.map((row) => row._id)]);

  return {
    platform: false,
    restaurantId,
    ownerUserId,
    userIds
  };
};

export const buildTenantScopedQuery = async (
  user,
  baseQuery = {},
  { directField = 'restaurantId', userFields = [] } = {}
) => {
  const scope = await resolveTenantScope(user);
  if (scope.platform) return baseQuery;

  const branches = [];
  if (directField && scope.restaurantId) branches.push({ [directField]: scope.restaurantId });
  userFields.forEach((field) => {
    if (scope.userIds.length) branches.push({ [field]: { $in: scope.userIds } });
  });

  const scopeQuery = branches.length ? { $or: branches } : { _id: NO_MATCH_ID };
  return mergeQueries(baseQuery, scopeQuery);
};

export const withTenantFields = async (user, payload = {}) => {
  const scope = await resolveTenantScope(user);
  if (scope.platform || !scope.restaurantId) return payload;
  return {
    ...payload,
    restaurantId: scope.restaurantId
  };
};
