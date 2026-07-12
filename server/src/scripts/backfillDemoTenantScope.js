import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { pool } from '../config/postgres.js';
import { Category } from '../models/Category.js';
import { Customer } from '../models/Customer.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { MenuItem } from '../models/MenuItem.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { PurchaseEntry } from '../models/PurchaseEntry.js';
import { Supplier } from '../models/Supplier.js';
import { Table } from '../models/Table.js';
import { User } from '../models/User.js';
import { Vendor } from '../models/Vendor.js';
import { ROLES } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const tenantModels = [
  ['categories', Category],
  ['menu_items', MenuItem],
  ['tables', Table],
  ['suppliers', Supplier],
  ['inventory_items', InventoryItem],
  ['customers', Customer],
  ['orders', Order],
  ['payments', Payment],
  ['purchase_entries', PurchaseEntry]
];

const chooseDefaultVendor = async () => {
  const vendors = await Vendor.find({}).sort({ createdAt: 1 });
  return vendors.find((vendor) => vendor.loginUser && vendor.isActive) || vendors.find((vendor) => vendor.loginUser) || vendors[0] || null;
};

const backfillUsers = async ({ vendor, ownerUserId }) => {
  const users = await User.find({});
  let updated = 0;

  for (const user of users) {
    if (user.role === ROLES.SUPER_ADMIN) continue;

    const shouldAttachOwner = user.role === ROLES.RESTAURANT_OWNER && String(user._id) === String(ownerUserId);
    const shouldAttachTenantUser = user.role !== ROLES.RESTAURANT_OWNER && !user.restaurantId;
    if (!shouldAttachOwner && !shouldAttachTenantUser) continue;

    user.restaurantId = vendor._id;
    user.ownerUser = shouldAttachOwner ? user._id : user.role === ROLES.CUSTOMER ? null : ownerUserId;
    await user.save();
    updated += 1;
  }

  return updated;
};

const ensureDemoCustomerUser = async (restaurantId) => {
  const existing = await User.findOne({ email: 'customer@restaurant.local' });
  if (existing) {
    existing.role = ROLES.CUSTOMER;
    existing.restaurantId = restaurantId;
    existing.ownerUser = null;
    existing.isActive = true;
    await existing.save();
    return 'updated';
  }

  await User.create({
    name: 'Customer User',
    email: 'customer@restaurant.local',
    password: 'Customer@12345',
    role: ROLES.CUSTOMER,
    phone: '+10000000008',
    restaurantId,
    ownerUser: null,
    isActive: true
  });
  return 'created';
};

const backfillModel = async ([label, Model], restaurantId) => {
  const docs = await Model.find({
    $or: [
      { restaurantId: { $exists: false } },
      { restaurantId: null },
      { restaurantId: '' }
    ]
  });

  for (const doc of docs) {
    doc.restaurantId = restaurantId;
    await doc.save();
  }

  return { label, updated: docs.length };
};

const run = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Refusing to backfill demo tenant scope in production without ALLOW_PRODUCTION_SEED=true');
  }

  await connectDB();

  const vendor = await chooseDefaultVendor();
  if (!vendor) throw new Error('No vendor found. Run the seed first or create a vendor.');
  if (!vendor.loginUser) throw new Error(`Vendor ${vendor.vendorName} has no login user to use as tenant owner.`);

  const owner = await User.findById(vendor.loginUser);
  if (!owner) throw new Error(`Vendor owner user ${vendor.loginUser} not found.`);

  owner.role = ROLES.RESTAURANT_OWNER;
  owner.restaurantId = vendor._id;
  owner.ownerUser = owner._id;
  await owner.save();

  const userUpdates = await backfillUsers({ vendor, ownerUserId: owner._id });
  const customerUserResult = await ensureDemoCustomerUser(vendor._id);
  const modelUpdates = [];
  for (const entry of tenantModels) {
    modelUpdates.push(await backfillModel(entry, vendor._id));
  }

  console.log(`Demo tenant scope backfilled to vendor: ${vendor.vendorName} (${vendor._id})`);
  console.log(`Users updated: ${userUpdates}`);
  console.log(`Customer test user: ${customerUserResult}`);
  modelUpdates.forEach((result) => console.log(`${result.label} updated: ${result.updated}`));
};

run()
  .catch((error) => {
    console.error('Demo tenant scope backfill failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
