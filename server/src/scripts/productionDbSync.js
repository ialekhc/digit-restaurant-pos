import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { pool } from '../config/postgres.js';
import { ROLES } from '../config/constants.js';
import { User } from '../models/User.js';
import { Vendor } from '../models/Vendor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());

const config = {
  resetDefaultPasswords: truthy(process.env.PRODUCTION_SYNC_RESET_DEFAULT_PASSWORDS),
  superAdminEmail: normalizeEmail(process.env.PRODUCTION_SUPER_ADMIN_EMAIL || 'superadmin@restaurant.local'),
  superAdminPassword: process.env.PRODUCTION_SUPER_ADMIN_PASSWORD || 'SuperAdmin@12345',
  ownerEmail: normalizeEmail(process.env.PRODUCTION_OWNER_EMAIL || 'owner@jiggs.com'),
  ownerPassword: process.env.PRODUCTION_OWNER_PASSWORD || 'Owner@12345',
  ownerName: process.env.PRODUCTION_OWNER_NAME || 'Jiggs Cafe Owner',
  vendorName: process.env.PRODUCTION_VENDOR_NAME || 'Jiggs Cafe'
};

const ensureUser = async ({ email, password, name, role, resetPassword = false, restaurantId = null, ownerUser = null }) => {
  let user = await User.findOne({ email });
  let action = 'unchanged';

  if (!user) {
    user = await User.create({
      name,
      email,
      password,
      role,
      restaurantId,
      ownerUser,
      isActive: true
    });
    return { user, action: 'created' };
  }

  user.email = email;
  user.name = user.name || name;
  user.role = role;
  user.isActive = true;

  if (restaurantId) user.restaurantId = restaurantId;
  if (ownerUser) user.ownerUser = ownerUser;

  if (resetPassword || !user.password) {
    user.password = password;
    action = 'password-reset';
  } else {
    try {
      const isExpectedPassword = await bcrypt.compare(password, user.password);
      if (!isExpectedPassword && config.resetDefaultPasswords) {
        user.password = password;
        action = 'password-reset';
      }
    } catch {
      user.password = password;
      action = 'password-reset';
    }
  }

  await user.save();
  return { user, action };
};

const findOrCreatePrimaryVendor = async () => {
  const existingByLogin = await Vendor.findOne({ loginEmail: config.ownerEmail });
  if (existingByLogin) return { vendor: existingByLogin, action: 'found-by-login' };

  const existingByName = await Vendor.findOne({ vendorName: config.vendorName });
  if (existingByName) return { vendor: existingByName, action: 'found-by-name' };

  const activeVendors = await Vendor.find({ isActive: true }).sort({ createdAt: 1 }).limit(1);
  if (activeVendors[0]) return { vendor: activeVendors[0], action: 'found-active' };

  const vendor = await Vendor.create({
    vendorName: config.vendorName,
    email: config.ownerEmail,
    isActive: true,
    subscription: {
      planId: 'STANDARD',
      billingCycle: 'monthly',
      amount: 2499,
      addons: [],
      status: 'ACTIVE',
      startsOn: new Date().toISOString()
    }
  });

  return { vendor, action: 'created' };
};

const linkVendorOwner = async ({ vendor, owner }) => {
  let changed = false;

  if (String(vendor.loginUser || '') !== String(owner._id)) {
    vendor.loginUser = owner._id;
    changed = true;
  }
  if (vendor.loginEmail !== owner.email) {
    vendor.loginEmail = owner.email;
    changed = true;
  }
  if (!vendor.loginEnabled) {
    vendor.loginEnabled = true;
    changed = true;
  }
  if (!vendor.isActive) {
    vendor.isActive = true;
    changed = true;
  }

  if (changed) await vendor.save();
  return changed ? 'updated' : 'unchanged';
};

const backfillVendorScopedUsers = async ({ vendor, owner }) => {
  const users = await User.find({ ownerUser: owner._id });
  let updated = 0;

  for (const user of users) {
    if (user.role === ROLES.SUPER_ADMIN) continue;
    if (String(user.restaurantId || '') === String(vendor._id)) continue;
    user.restaurantId = vendor._id;
    await user.save();
    updated += 1;
  }

  return updated;
};

const run = async () => {
  await connectDB();

  const superAdmin = await ensureUser({
    email: config.superAdminEmail,
    password: config.superAdminPassword,
    name: 'Platform Super Admin',
    role: ROLES.SUPER_ADMIN,
    resetPassword: config.resetDefaultPasswords
  });

  const { vendor, action: vendorAction } = await findOrCreatePrimaryVendor();

  const owner = await ensureUser({
    email: config.ownerEmail,
    password: config.ownerPassword,
    name: config.ownerName,
    role: ROLES.RESTAURANT_OWNER,
    resetPassword: config.resetDefaultPasswords,
    restaurantId: vendor._id
  });
  owner.user.ownerUser = owner.user._id;
  await owner.user.save();

  const vendorLinkAction = await linkVendorOwner({ vendor, owner: owner.user });
  const scopedUsersUpdated = await backfillVendorScopedUsers({ vendor, owner: owner.user });

  console.log('[production-db-sync] completed');
  console.log(`[production-db-sync] super admin: ${superAdmin.action} (${superAdmin.user.email})`);
  console.log(`[production-db-sync] vendor: ${vendorAction} (${vendor.vendorName})`);
  console.log(`[production-db-sync] owner: ${owner.action} (${owner.user.email})`);
  console.log(`[production-db-sync] vendor login link: ${vendorLinkAction}`);
  console.log(`[production-db-sync] scoped staff users updated: ${scopedUsersUpdated}`);
};

run()
  .catch((error) => {
    console.error('[production-db-sync] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
