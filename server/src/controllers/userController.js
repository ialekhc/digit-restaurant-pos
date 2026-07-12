import { User } from '../models/User.js';
import { Vendor } from '../models/Vendor.js';
import { ALL_PERMISSIONS, PERMISSIONS, ROLES } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ensureStaffLimitAvailable } from '../services/planService.js';
import { buildPublicUser, canAssignRole, hasPermission, resolveUserAccess } from '../services/permissionService.js';

const userProjection = '-password';
const OWNER_MANAGEABLE_ROLES = [
  ROLES.MANAGER,
  ROLES.CASHIER,
  ROLES.WAITER,
  ROLES.CHEF,
  ROLES.INVENTORY_MANAGER,
  ROLES.ACCOUNTANT,
  ROLES.DELIVERY_PARTNER,
  ROLES.CUSTOMER_SUPPORT,
  ROLES.KITCHEN,
  ROLES.BARISTA
];

const isRestaurantOwner = (req) => req.user?.role === ROLES.RESTAURANT_OWNER;
const isPlatformUser = (req) => req.user?.role === ROLES.SUPER_ADMIN || hasPermission(req.user, PERMISSIONS.PLATFORM_VIEW);

const resolveVendorIdForOwner = async (ownerUserId) => {
  if (!ownerUserId) return null;
  const vendor = await Vendor.findOne({ loginUser: ownerUserId }).select('_id');
  return vendor?._id || null;
};

const resolveActorTenantScope = async (req) => {
  const actorId = req.user?._id || null;
  if (!actorId) return { platform: false, actorId: null, ownerUserId: null, restaurantId: null };
  if (isPlatformUser(req)) return { platform: true, actorId, ownerUserId: null, restaurantId: null };

  let ownerUserId = req.user.ownerUser || null;
  let restaurantId = req.user.restaurantId || null;

  if (isRestaurantOwner(req)) {
    ownerUserId = actorId;
    restaurantId = restaurantId || (await resolveVendorIdForOwner(actorId));
  }

  if (!restaurantId && ownerUserId) {
    const owner = await User.findById(ownerUserId).select('restaurantId');
    restaurantId = owner?.restaurantId || (await resolveVendorIdForOwner(ownerUserId));
  }

  return { platform: false, actorId, ownerUserId, restaurantId };
};

const buildTenantUserFilter = (scope) => {
  if (scope.platform) return {};

  const branches = [];
  if (scope.restaurantId) branches.push({ restaurantId: scope.restaurantId });
  if (scope.ownerUserId) branches.push({ ownerUser: scope.ownerUserId });
  if (scope.actorId) branches.push({ _id: scope.actorId });

  return branches.length ? { $or: branches } : { _id: scope.actorId };
};

const mergeQueryWithTenantFilter = (query, tenantFilter) => {
  if (!tenantFilter || Object.keys(tenantFilter).length === 0) return query;
  if (!query || Object.keys(query).length === 0) return tenantFilter;
  return { $and: [query, tenantFilter] };
};

const isUserInsideScope = (scope, user) => {
  if (scope.platform) return true;
  if (!user) return false;
  if (scope.actorId && String(user._id) === String(scope.actorId)) return true;
  if (scope.restaurantId && String(user.restaurantId || '') === String(scope.restaurantId)) return true;
  if (scope.ownerUserId && String(user.ownerUser || '') === String(scope.ownerUserId)) return true;
  return false;
};

const ensureOwnerCanManageRole = (req, role) => {
  if (!isRestaurantOwner(req)) return;
  if (!OWNER_MANAGEABLE_ROLES.includes(role)) {
    throw new ApiError(403, 'Forbidden: vendor admin cannot assign this role');
  }
};

const ensureActorCanAssignRole = (req, role) => {
  ensureOwnerCanManageRole(req, role);
  if (!canAssignRole(req.user, role)) {
    throw new ApiError(403, 'Forbidden: you cannot assign this role');
  }
};

const ensureActorCanAccessUser = async (req, user) => {
  const scope = await resolveActorTenantScope(req);
  if (!isUserInsideScope(scope, user)) {
    throw new ApiError(404, 'User not found');
  }
};

export const getUsers = asyncHandler(async (req, res) => {
  const { search = '', role = '' } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  if (role) query.role = role;

  const scope = await resolveActorTenantScope(req);
  const scopedQuery = mergeQueryWithTenantFilter(query, buildTenantUserFilter(scope));

  const users = await User.find(scopedQuery).select(userProjection).sort({ createdAt: -1 });
  res.json({ data: users });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, isActive } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email and password are required');
  }

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, 'Email already exists');

  const nextRole = role || ROLES.WAITER;
  ensureActorCanAssignRole(req, nextRole);
  if (Array.isArray(req.body.branchIds) && req.body.branchIds.length && !hasPermission(req.user, PERMISSIONS.USER_ASSIGN_BRANCH)) {
    throw new ApiError(403, 'Forbidden: you cannot assign branch access');
  }
  const nextActive = typeof isActive === 'boolean' ? isActive : true;
  if (nextActive && ![ROLES.CUSTOMER, ROLES.SUPER_ADMIN, ROLES.RESTAURANT_OWNER].includes(nextRole)) {
    await ensureStaffLimitAvailable();
  }

  const scope = await resolveActorTenantScope(req);
  const ownerUser = scope.platform ? req.body.ownerUser || null : scope.ownerUserId || req.user.ownerUser || req.user._id;
  const restaurantId = scope.platform ? req.body.restaurantId || null : scope.restaurantId || req.user.restaurantId || null;

  const user = await User.create({
    name,
    email,
    password,
    role: nextRole,
    phone,
    isActive,
    ownerUser,
    restaurantId,
    branchIds: Array.isArray(req.body.branchIds) ? req.body.branchIds : []
  });
  const sanitized = buildPublicUser(await User.findById(user._id).select(userProjection));
  res.status(201).json({ data: sanitized });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(userProjection);
  if (!user) throw new ApiError(404, 'User not found');
  await ensureActorCanAccessUser(req, user);
  res.json({ data: user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const {
    password,
    additionalPermissions,
    deniedPermissions,
    branchIds,
    restaurantId,
    discountLimitPercent,
    refundLimitAmount,
    voidLimitAmount,
    ...rest
  } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await ensureActorCanAccessUser(req, user);

  const nextRole = rest.role || user.role;
  if (rest.role && !hasPermission(req.user, PERMISSIONS.USER_ASSIGN_ROLE)) {
    throw new ApiError(403, 'Forbidden: you cannot assign roles');
  }
  ensureActorCanAssignRole(req, nextRole);
  const nextActive = typeof rest.isActive === 'boolean' ? rest.isActive : user.isActive;
  const willConsumeStaffSlot = nextActive && ![ROLES.CUSTOMER, ROLES.SUPER_ADMIN, ROLES.RESTAURANT_OWNER].includes(nextRole);
  const currentlyConsumesStaffSlot =
    user.isActive && ![ROLES.CUSTOMER, ROLES.SUPER_ADMIN, ROLES.RESTAURANT_OWNER].includes(user.role);

  if (willConsumeStaffSlot && !currentlyConsumesStaffSlot) {
    await ensureStaffLimitAvailable({ ignoreUserId: String(user._id) });
  }

  Object.assign(user, rest);
  if (password) user.password = password;

  await user.save();

  const sanitized = buildPublicUser(await User.findById(user._id).select(userProjection));
  res.json({ data: sanitized });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await ensureActorCanAccessUser(req, user);

  if (String(user._id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  await user.deleteOne();
  res.json({ message: 'User deleted successfully' });
});

export const getUserAccess = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(userProjection);
  if (!user) throw new ApiError(404, 'User not found');
  await ensureActorCanAccessUser(req, user);
  res.json({ data: resolveUserAccess(user) });
});

export const assignUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!role) throw new ApiError(400, 'Role is required');
  ensureActorCanAssignRole(req, role);

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await ensureActorCanAccessUser(req, user);
  if (String(user._id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot change your own role');
  }

  user.role = role;
  await user.save();
  res.json({ data: buildPublicUser(user) });
});

export const updateUserPermissions = asyncHandler(async (req, res) => {
  const { additionalPermissions = [], deniedPermissions = [] } = req.body;
  const cleanAdditional = additionalPermissions.filter((permission) => ALL_PERMISSIONS.includes(permission));
  const cleanDenied = deniedPermissions.filter((permission) => ALL_PERMISSIONS.includes(permission));

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await ensureActorCanAccessUser(req, user);
  if (String(user._id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot change your own permission overrides');
  }

  user.additionalPermissions = [...new Set(cleanAdditional)];
  user.deniedPermissions = [...new Set(cleanDenied)];
  await user.save();
  res.json({ data: buildPublicUser(user) });
});

export const updateUserBranchAccess = asyncHandler(async (req, res) => {
  const { restaurantId = null, branchIds = [] } = req.body;
  if (!Array.isArray(branchIds)) throw new ApiError(400, 'branchIds must be an array');

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await ensureActorCanAccessUser(req, user);

  const scope = await resolveActorTenantScope(req);
  user.restaurantId = scope.platform ? restaurantId : scope.restaurantId || user.restaurantId || null;
  user.branchIds = branchIds;
  await user.save();
  res.json({ data: buildPublicUser(user) });
});

export const updateUserApprovalLimits = asyncHandler(async (req, res) => {
  const { discountLimitPercent, refundLimitAmount, voidLimitAmount } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await ensureActorCanAccessUser(req, user);

  if (typeof discountLimitPercent !== 'undefined') user.discountLimitPercent = Number(discountLimitPercent);
  if (typeof refundLimitAmount !== 'undefined') user.refundLimitAmount = Number(refundLimitAmount);
  if (typeof voidLimitAmount !== 'undefined') user.voidLimitAmount = Number(voidLimitAmount);

  await user.save();
  res.json({ data: buildPublicUser(user) });
});
