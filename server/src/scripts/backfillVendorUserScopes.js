import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { pool } from '../config/postgres.js';
import { Vendor } from '../models/Vendor.js';
import { User } from '../models/User.js';
import { ROLES } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const backfillVendorUserScopes = async () => {
  await connectDB();

  const vendors = await Vendor.find({});
  let vendorOwnersUpdated = 0;
  let staffUsersUpdated = 0;

  for (const vendor of vendors) {
    if (!vendor.loginUser) continue;

    const owner = await User.findById(vendor.loginUser);
    if (!owner) continue;

    owner.restaurantId = vendor._id;
    owner.ownerUser = owner._id;
    owner.role = ROLES.RESTAURANT_OWNER;
    await owner.save();
    vendorOwnersUpdated += 1;

    const staffUsers = await User.find({ ownerUser: owner._id });
    for (const staffUser of staffUsers) {
      if (String(staffUser._id) === String(owner._id)) continue;
      staffUser.restaurantId = vendor._id;
      await staffUser.save();
      staffUsersUpdated += 1;
    }
  }

  console.log(
    `Vendor user scopes backfilled. Vendors checked: ${vendors.length}, vendor owners updated: ${vendorOwnersUpdated}, staff users updated: ${staffUsersUpdated}`
  );
};

backfillVendorUserScopes()
  .catch((error) => {
    console.error('Vendor user scope backfill failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
