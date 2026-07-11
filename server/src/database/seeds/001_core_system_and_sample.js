import bcrypt from 'bcrypt';
import { ALL_PERMISSIONS, APPROVAL_LIMIT_DEFAULTS, ROLE_LEVELS, ROLE_PERMISSIONS, ROLES } from '../../config/constants.js';

const roleLabels = {
  SUPER_ADMIN: 'Super Admin',
  RESTAURANT_OWNER: 'Restaurant Owner',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  CASHIER: 'Cashier',
  WAITER: 'Waiter',
  KITCHEN: 'Kitchen'
};

const devUsers = [
  { role: ROLES.SUPER_ADMIN, name: 'Platform Super Admin', email: 'superadmin@restaurant.local', password: 'SuperAdmin@12345' },
  { role: ROLES.RESTAURANT_OWNER, name: 'Restaurant Owner', email: 'owner@restaurant.local', password: 'Owner@12345' },
  { role: ROLES.ADMIN, name: 'Restaurant Admin', email: 'admin@restaurant.local', password: 'Admin@12345' },
  { role: ROLES.MANAGER, name: 'Restaurant Manager', email: 'manager@restaurant.local', password: 'Manager@12345' },
  { role: ROLES.CASHIER, name: 'Cashier User', email: 'cashier@restaurant.local', password: 'Cashier@12345' },
  { role: ROLES.WAITER, name: 'Waiter User', email: 'waiter@restaurant.local', password: 'Waiter@12345' },
  { role: ROLES.KITCHEN, name: 'Kitchen User', email: 'kitchen@restaurant.local', password: 'Kitchen@12345' }
];

const splitPermission = (code) => {
  const [module, action] = code.split('.');
  return { module, action };
};

const upsertReturningId = async (client, sql, params) => {
  const { rows } = await client.query(sql, params);
  return rows[0].id;
};

export const run = async (client) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error('Refusing to run development core seed in production without ALLOW_PRODUCTION_SEED=true');
  }

  for (const permission of ALL_PERMISSIONS) {
    const { module, action } = splitPermission(permission);
    await client.query(
      `INSERT INTO permissions (code, module, action, description)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, action = EXCLUDED.action, description = EXCLUDED.description`,
      [permission, module, action, `${action.replaceAll('_', ' ')} permission for ${module}`]
    );
  }

  const roleIds = new Map();
  for (const role of Object.values(ROLES).filter((item) => roleLabels[item])) {
    const roleId = await upsertReturningId(
      client,
      `INSERT INTO roles (restaurant_id, name, code, description, hierarchy_level, is_system_role, is_active)
       VALUES (NULL,$1,$2,$3,$4,TRUE,TRUE)
       ON CONFLICT (code) WHERE restaurant_id IS NULL DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         hierarchy_level = EXCLUDED.hierarchy_level,
         is_active = TRUE
       RETURNING id`,
      [roleLabels[role], role, `${roleLabels[role]} system role`, ROLE_LEVELS[role] || 0]
    );
    roleIds.set(role, roleId);
  }

  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    if (!roleIds.has(role)) continue;
    for (const permission of permissions) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE code = $2
         ON CONFLICT DO NOTHING`,
        [roleIds.get(role), permission]
      );
    }
  }

  const { rows: restaurantRows } = await client.query("SELECT id FROM restaurants WHERE slug = 'digit-demo-restaurant' AND deleted_at IS NULL LIMIT 1");
  if (!restaurantRows.length) {
    throw new Error('Sample restaurant not found. Run vendor db seed before core db seed.');
  }
  const restaurantId = restaurantRows[0].id;

  const branchId = await upsertReturningId(
    client,
    `INSERT INTO branches (restaurant_id, name, code, phone, city, district, province, status, is_main_branch)
     VALUES ($1,'Main Branch','MAIN','9800000000','Kathmandu','Kathmandu','Bagmati','ACTIVE',TRUE)
     ON CONFLICT (restaurant_id, code) DO UPDATE SET name = EXCLUDED.name, status = 'ACTIVE', is_main_branch = TRUE
     RETURNING id`,
    [restaurantId]
  );

  const userIds = new Map();
  for (const user of devUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const userId = await upsertReturningId(
      client,
      `INSERT INTO users (full_name, email, password_hash, status)
       VALUES ($1,$2,$3,'ACTIVE')
       ON CONFLICT (email) WHERE email IS NOT NULL AND deleted_at IS NULL DO UPDATE SET
         full_name = EXCLUDED.full_name,
         status = 'ACTIVE'
       RETURNING id`,
      [user.name, user.email, passwordHash]
    );
    userIds.set(user.role, userId);

    const roleId = roleIds.get(user.role);
    if (roleId) {
      const limits = APPROVAL_LIMIT_DEFAULTS[user.role] || { discountLimitPercent: 0, refundLimitAmount: 0, voidLimitAmount: 0 };
      const { rows } = await client.query(
        `INSERT INTO user_restaurant_roles (
          user_id, restaurant_id, role_id, discount_limit_percent, refund_limit_amount, void_limit_amount, status, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',$7)
        ON CONFLICT (user_id, restaurant_id) DO UPDATE SET
          role_id = EXCLUDED.role_id,
          discount_limit_percent = EXCLUDED.discount_limit_percent,
          refund_limit_amount = EXCLUDED.refund_limit_amount,
          void_limit_amount = EXCLUDED.void_limit_amount,
          status = 'ACTIVE'
        RETURNING id`,
        [
          userId,
          user.role === ROLES.SUPER_ADMIN ? null : restaurantId,
          roleId,
          limits.discountLimitPercent,
          limits.refundLimitAmount,
          limits.voidLimitAmount,
          userIds.get(ROLES.SUPER_ADMIN) || userId
        ]
      );
      if (user.role !== ROLES.SUPER_ADMIN) {
        await client.query(
          `INSERT INTO user_branch_assignments (user_restaurant_role_id, branch_id, is_primary)
           VALUES ($1,$2,TRUE)
           ON CONFLICT (user_restaurant_role_id, branch_id) DO UPDATE SET is_primary = TRUE`,
          [rows[0].id, branchId]
        );
      }
    }
  }

  const foodCategoryId = await upsertReturningId(
    client,
    `WITH existing AS (
       SELECT id FROM menu_categories WHERE restaurant_id = $1 AND name = 'Food' AND deleted_at IS NULL LIMIT 1
     ), inserted AS (
       INSERT INTO menu_categories (restaurant_id, name, description, display_order)
       SELECT $1,'Food','Main food menu',1
       WHERE NOT EXISTS (SELECT 1 FROM existing)
       RETURNING id
     )
     SELECT id FROM inserted UNION ALL SELECT id FROM existing LIMIT 1`,
    [restaurantId]
  );

  const momoId = await upsertReturningId(
    client,
    `INSERT INTO menu_items (restaurant_id, category_id, sku, name, description, base_price, preparation_time_minutes, is_available, is_active)
     VALUES ($1,$2,'FOOD-MOMO','Chicken Mo:Mo','Steamed dumplings',220,15,TRUE,TRUE)
     ON CONFLICT (restaurant_id, sku) DO UPDATE SET name = EXCLUDED.name, base_price = EXCLUDED.base_price, is_available = TRUE
     RETURNING id`,
    [restaurantId, foodCategoryId]
  );
  await client.query(
    `INSERT INTO branch_menu_items (branch_id, menu_item_id, selling_price, is_available, is_visible)
     VALUES ($1,$2,220,TRUE,TRUE)
     ON CONFLICT (branch_id, menu_item_id) DO UPDATE SET selling_price = EXCLUDED.selling_price, is_available = TRUE, is_visible = TRUE`,
    [branchId, momoId]
  );

  const floorId = await upsertReturningId(
    client,
    `WITH existing AS (
       SELECT id FROM restaurant_floors WHERE branch_id = $2 AND name = 'Ground Floor' LIMIT 1
     ), inserted AS (
       INSERT INTO restaurant_floors (restaurant_id, branch_id, name, display_order)
       SELECT $1,$2,'Ground Floor',1
       WHERE NOT EXISTS (SELECT 1 FROM existing)
       RETURNING id
     )
     SELECT id FROM inserted UNION ALL SELECT id FROM existing LIMIT 1`,
    [restaurantId, branchId]
  );

  for (let index = 1; index <= 8; index += 1) {
    await client.query(
      `INSERT INTO restaurant_tables (restaurant_id, branch_id, floor_id, name, code, capacity, status)
       VALUES ($1,$2,$3,$4,$5,$6,'AVAILABLE')
       ON CONFLICT (branch_id, code) DO UPDATE SET name = EXCLUDED.name, capacity = EXCLUDED.capacity`,
      [restaurantId, branchId, floorId, `Table ${index}`, `T${index}`, index <= 4 ? 4 : 6]
    );
  }

  await client.query(
    `INSERT INTO kitchen_stations (restaurant_id, branch_id, name, code)
     VALUES ($1,$2,'Food Kitchen','FOOD')
     ON CONFLICT (branch_id, code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE`,
    [restaurantId, branchId]
  );

  const unitId = await upsertReturningId(
    client,
    `INSERT INTO units (restaurant_id, name, symbol, precision_scale)
     VALUES ($1,'Kilogram','kg',3)
     ON CONFLICT (restaurant_id, symbol) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [restaurantId]
  );

  await client.query(
    `INSERT INTO inventory_items (restaurant_id, name, sku, unit_id, cost_per_unit, minimum_stock_level, reorder_level)
     VALUES ($1,'Chicken','INV-CHICKEN',$2,480,5,10)
     ON CONFLICT (restaurant_id, sku) DO UPDATE SET name = EXCLUDED.name, cost_per_unit = EXCLUDED.cost_per_unit`,
    [restaurantId, unitId]
  );

  await client.query(
    `INSERT INTO suppliers (restaurant_id, name, contact_person, phone, opening_balance)
     SELECT $1,'Local Supplier','Supplier Contact','9811111111',0
     WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE restaurant_id = $1 AND name = 'Local Supplier' AND deleted_at IS NULL)`,
    [restaurantId]
  );

  await client.query(
    `INSERT INTO customers (restaurant_id, full_name, phone, loyalty_points, credit_limit)
     VALUES ($1,'Walk-in Customer','9800000001',0,0)
     ON CONFLICT (restaurant_id, phone) DO UPDATE SET full_name = EXCLUDED.full_name`,
    [restaurantId]
  );
};
