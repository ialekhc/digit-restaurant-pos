import { User } from '../models/User.js';
import { ROLES } from '../config/constants.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ensureStaffLimitAvailable } from '../services/planService.js';

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

const ensureOwnerCanManageRole = (req, role) => {
  if (!isRestaurantOwner(req)) return;
  if (!OWNER_MANAGEABLE_ROLES.includes(role)) {
    throw new ApiError(403, 'Forbidden: vendor admin cannot assign this role');
  }
};

const ensureOwnerCanAccessUser = (req, user) => {
  if (!isRestaurantOwner(req)) return;
  if (String(user.ownerUser || '') !== String(req.user._id)) {
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
  if (isRestaurantOwner(req)) {
    query.ownerUser = req.user._id;
  }

  const users = await User.find(query).select(userProjection).sort({ createdAt: -1 });
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
  ensureOwnerCanManageRole(req, nextRole);
  const nextActive = typeof isActive === 'boolean' ? isActive : true;
  if (nextActive && ![ROLES.CUSTOMER, ROLES.SUPER_ADMIN, ROLES.RESTAURANT_OWNER].includes(nextRole)) {
    await ensureStaffLimitAvailable();
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    isActive,
    ownerUser: isRestaurantOwner(req) ? req.user._id : null
  });
  const sanitized = await User.findById(user._id).select(userProjection);
  res.status(201).json({ data: sanitized });
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(userProjection);
  if (!user) throw new ApiError(404, 'User not found');
  ensureOwnerCanAccessUser(req, user);
  res.json({ data: user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { password, ...rest } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  ensureOwnerCanAccessUser(req, user);

  const nextRole = rest.role || user.role;
  ensureOwnerCanManageRole(req, nextRole);
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

  const sanitized = await User.findById(user._id).select(userProjection);
  res.json({ data: sanitized });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  ensureOwnerCanAccessUser(req, user);

  if (String(user._id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  await user.deleteOne();
  res.json({ message: 'User deleted successfully' });
});
