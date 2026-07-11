import bcrypt from 'bcrypt';
import { closePool, query } from './query.js';
import { withTransaction } from './transaction.js';

const args = new Set(process.argv.slice(2));
const collectionArg = process.argv.find((arg) => arg.startsWith('--collection='));
const targetCollection = collectionArg?.split('=')[1];
const execute = args.has('--execute');
const verify = args.has('--verify');
const dryRun = args.has('--dry-run') || !execute;

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const asNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const text = (value, fallback = '') => (value === null || typeof value === 'undefined' ? fallback : String(value));

const getDefaultScope = async (client) => {
  const restaurants = await client.query("SELECT id FROM restaurants WHERE slug = 'digit-demo-restaurant' AND deleted_at IS NULL LIMIT 1");
  if (!restaurants.rows.length) throw new Error('No restaurant found for document migration. Run vendor migration/seed first.');
  const restaurantId = restaurants.rows[0].id;
  const branches = await client.query("SELECT id FROM branches WHERE restaurant_id = $1 AND code = 'MAIN' AND deleted_at IS NULL LIMIT 1", [restaurantId]);
  if (!branches.rows.length) throw new Error('No MAIN branch found for document migration. Run core seed first.');
  return { restaurantId, branchId: branches.rows[0].id };
};

const loadDocs = async (client, collection) => {
  const { rows } = await client.query('SELECT id, data FROM app_documents WHERE collection = $1 ORDER BY created_at ASC', [collection]);
  return rows.map((row) => ({ legacyId: row.id, data: row.data || {} }));
};

const recordFailure = async (client, collection, legacyId, error, payload) => {
  await client.query(
    'INSERT INTO app_document_migration_failures (collection, document_id, error_message, payload) VALUES ($1,$2,$3,$4)',
    [collection, legacyId, error.message || String(error), payload]
  );
};

const processDocument = async (client, collection, legacyId, data, callback) => {
  const savepoint = `sp_${collection.replace(/[^a-z0-9_]/gi, '_')}_${String(legacyId).replace(/[^a-z0-9_]/gi, '_').slice(0, 24)}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await callback();
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await recordFailure(client, collection, legacyId, error, data);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
};

const getUserId = async (client, legacyIdOrDoc) => {
  const legacyId = typeof legacyIdOrDoc === 'object' ? legacyIdOrDoc?._id : legacyIdOrDoc;
  if (!legacyId) return null;
  if (isUuid(legacyId)) {
    const byId = await client.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [legacyId]);
    if (byId.rows[0]) return byId.rows[0].id;
  }
  const byLegacy = await client.query('SELECT id FROM users WHERE legacy_id = $1 LIMIT 1', [String(legacyId)]);
  return byLegacy.rows[0]?.id || null;
};

const migrateUsers = async (client) => {
  const docs = await loadDocs(client, 'users');
  for (const { legacyId, data } of docs) {
    await processDocument(client, 'users', legacyId, data, async () => {
      await client.query(
        `WITH existing AS (
           SELECT id FROM users
           WHERE legacy_id = $1 OR (email IS NOT NULL AND email = $3::citext)
           LIMIT 1
         ), updated AS (
           UPDATE users SET
             legacy_id = COALESCE(users.legacy_id, $1),
             full_name = $2,
             phone = COALESCE($4, users.phone),
             status = $6,
             updated_at = COALESCE($8::timestamptz, NOW())
           WHERE id IN (SELECT id FROM existing)
           RETURNING id
         ), inserted AS (
           INSERT INTO users (legacy_id, full_name, email, phone, password_hash, status, created_at, updated_at)
           SELECT $1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW()),COALESCE($8::timestamptz,NOW())
           WHERE NOT EXISTS (SELECT 1 FROM existing)
           RETURNING id
         )
         SELECT id FROM updated UNION ALL SELECT id FROM inserted`,
        [
          legacyId,
          data.name || data.full_name || 'Unnamed User',
          data.email || null,
          data.phone || null,
          data.password || data.password_hash || (await bcrypt.hash('ChangeMe@12345', 10)),
          data.isActive === false ? 'INACTIVE' : 'ACTIVE',
          data.createdAt || data.created_at || null,
          data.updatedAt || data.updated_at || null
        ]
      );
    });
  }
  return docs.length;
};

const ensureCategory = async (client, restaurantId, legacyId, data) => {
  const name = data.name || 'Uncategorized';
  const { rows } = await client.query(
    `WITH existing AS (
       SELECT id FROM menu_categories WHERE restaurant_id = $1 AND name = $2 AND deleted_at IS NULL LIMIT 1
     ), inserted AS (
       INSERT INTO menu_categories (restaurant_id, name, description, is_active, created_at, updated_at)
       SELECT $1,$2,$3,$4,COALESCE($5::timestamptz,NOW()),COALESCE($6::timestamptz,NOW())
       WHERE NOT EXISTS (SELECT 1 FROM existing)
       RETURNING id
     )
     SELECT id FROM inserted UNION ALL SELECT id FROM existing LIMIT 1`,
    [restaurantId, name, data.description || '', data.isActive !== false, data.createdAt || null, data.updatedAt || null]
  );
  return rows[0].id;
};

const migrateCategories = async (client, scope) => {
  const docs = await loadDocs(client, 'categories');
  for (const doc of docs) {
    await processDocument(client, 'categories', doc.legacyId, doc.data, async () => {
      await ensureCategory(client, scope.restaurantId, doc.legacyId, doc.data);
    });
  }
  return docs.length;
};

const migrateMenuItems = async (client, scope) => {
  const docs = await loadDocs(client, 'menu_items');
  const categoryDocs = new Map((await loadDocs(client, 'categories')).map((doc) => [String(doc.legacyId), doc.data]));
  for (const { legacyId, data } of docs) {
    await processDocument(client, 'menu_items', legacyId, data, async () => {
      const categoryDoc = categoryDocs.get(String(data.category)) || { name: 'Uncategorized' };
      const categoryId = await ensureCategory(client, scope.restaurantId, data.category || 'uncategorized', categoryDoc);
      const sku = data.sku || `LEGACY-${legacyId}`.slice(0, 80);
      const { rows } = await client.query(
        `INSERT INTO menu_items (
          restaurant_id, category_id, sku, name, description, base_price, image_url, preparation_time_minutes, is_available, is_active, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,COALESCE($10::timestamptz,NOW()),COALESCE($11::timestamptz,NOW()))
        ON CONFLICT (restaurant_id, sku) DO UPDATE SET
          category_id = EXCLUDED.category_id,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          base_price = EXCLUDED.base_price,
          image_url = EXCLUDED.image_url,
          preparation_time_minutes = EXCLUDED.preparation_time_minutes,
          is_available = EXCLUDED.is_available
        RETURNING id`,
        [
          scope.restaurantId,
          categoryId,
          sku,
          data.name || 'Unnamed Item',
          data.description || '',
          asNumber(data.price || data.base_price),
          data.image || data.image_url || null,
          asNumber(data.preparationTime || data.preparation_time_minutes || 0),
          data.isAvailable !== false,
          data.createdAt || null,
          data.updatedAt || null
        ]
      );
      await client.query(
        `INSERT INTO branch_menu_items (branch_id, menu_item_id, selling_price, is_available, is_visible)
         VALUES ($1,$2,$3,$4,TRUE)
         ON CONFLICT (branch_id, menu_item_id) DO UPDATE SET selling_price = EXCLUDED.selling_price, is_available = EXCLUDED.is_available`,
        [scope.branchId, rows[0].id, asNumber(data.price || data.base_price), data.isAvailable !== false]
      );
    });
  }
  return docs.length;
};

const migrateTables = async (client, scope) => {
  const docs = await loadDocs(client, 'tables');
  for (const { legacyId, data } of docs) {
    await processDocument(client, 'tables', legacyId, data, async () => {
      const code = text(data.tableNumber || data.code || legacyId).slice(0, 60);
      await client.query(
        `INSERT INTO restaurant_tables (restaurant_id, branch_id, name, code, capacity, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW()),COALESCE($8::timestamptz,NOW()))
         ON CONFLICT (branch_id, code) DO UPDATE SET name = EXCLUDED.name, capacity = EXCLUDED.capacity, status = EXCLUDED.status`,
        [scope.restaurantId, scope.branchId, `Table ${code}`, code, asNumber(data.seatingCapacity || data.capacity || 2), data.status || 'AVAILABLE', data.createdAt || null, data.updatedAt || null]
      );
    });
  }
  return docs.length;
};

const migrateCustomers = async (client, scope) => {
  const docs = await loadDocs(client, 'customers');
  for (const { legacyId, data } of docs) {
    await processDocument(client, 'customers', legacyId, data, async () => {
      await client.query(
        `INSERT INTO customers (restaurant_id, full_name, phone, email, loyalty_points, notes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,NOW()),COALESCE($8::timestamptz,NOW()))
         ON CONFLICT (restaurant_id, phone) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email, loyalty_points = EXCLUDED.loyalty_points`,
        [scope.restaurantId, data.name || data.full_name || 'Customer', data.phone || `legacy-${legacyId}`, data.email || null, asNumber(data.loyaltyPoints), data.address || data.notes || '', data.createdAt || null, data.updatedAt || null]
      );
    });
  }
  return docs.length;
};

const migrateSuppliers = async (client, scope) => {
  const docs = await loadDocs(client, 'suppliers');
  for (const { legacyId, data } of docs) {
    await processDocument(client, 'suppliers', legacyId, data, async () => {
      await client.query(
        `INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, address, is_active, created_at, updated_at)
         SELECT $1,$2::varchar,$3,$4,$5,$6,TRUE,COALESCE($7::timestamptz,NOW()),COALESCE($8::timestamptz,NOW())
         WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE restaurant_id = $1 AND name = $2::varchar AND deleted_at IS NULL)`,
        [scope.restaurantId, data.name || data.companyName || `Supplier ${legacyId}`, data.contactPerson || '', data.phone || '', data.email || null, data.address || '', data.createdAt || null, data.updatedAt || null]
      );
    });
  }
  return docs.length;
};

const migrateInventory = async (client, scope) => {
  const docs = await loadDocs(client, 'inventory_items');
  const unit = await client.query(
    `WITH existing AS (SELECT id FROM units WHERE restaurant_id = $1 AND symbol = 'unit' LIMIT 1),
     inserted AS (INSERT INTO units (restaurant_id, name, symbol, precision_scale) SELECT $1,'Unit','unit',3 WHERE NOT EXISTS (SELECT 1 FROM existing) RETURNING id)
     SELECT id FROM inserted UNION ALL SELECT id FROM existing LIMIT 1`,
    [scope.restaurantId]
  );
  const unitId = unit.rows[0].id;
  for (const { legacyId, data } of docs) {
    await processDocument(client, 'inventory_items', legacyId, data, async () => {
      const sku = data.sku || `INV-${legacyId}`.slice(0, 80);
      const item = await client.query(
        `INSERT INTO inventory_items (restaurant_id, name, sku, unit_id, cost_per_unit, minimum_stock_level, reorder_level, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$6,TRUE,COALESCE($7::timestamptz,NOW()),COALESCE($8::timestamptz,NOW()))
         ON CONFLICT (restaurant_id, sku) DO UPDATE SET name = EXCLUDED.name, cost_per_unit = EXCLUDED.cost_per_unit, minimum_stock_level = EXCLUDED.minimum_stock_level
         RETURNING id`,
        [scope.restaurantId, data.name || `Inventory ${legacyId}`, sku, unitId, asNumber(data.purchasePrice), asNumber(data.minimumStockLevel || 0), data.createdAt || null, data.updatedAt || null]
      );
      await client.query(
        `INSERT INTO branch_inventory (branch_id, inventory_item_id, quantity_on_hand, average_cost)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (branch_id, inventory_item_id) DO UPDATE SET quantity_on_hand = EXCLUDED.quantity_on_hand, average_cost = EXCLUDED.average_cost`,
        [scope.branchId, item.rows[0].id, asNumber(data.quantity), asNumber(data.purchasePrice)]
      );
    });
  }
  return docs.length;
};

const handlers = {
  users: migrateUsers,
  categories: migrateCategories,
  menu_items: migrateMenuItems,
  tables: migrateTables,
  customers: migrateCustomers,
  suppliers: migrateSuppliers,
  inventory_items: migrateInventory
};

const verifyCounts = async () => {
  const pairs = [
    ['users', 'users'],
    ['categories', 'menu_categories'],
    ['menu_items', 'menu_items'],
    ['tables', 'restaurant_tables'],
    ['customers', 'customers'],
    ['suppliers', 'suppliers'],
    ['inventory_items', 'inventory_items']
  ];
  const data = [];
  for (const [collection, table] of pairs) {
    const docs = await query('SELECT COUNT(*)::int AS count FROM app_documents WHERE collection = $1', [collection]);
    const rows = await query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    data.push({ collection, documentCount: docs.rows[0].count, relationalCount: rows.rows[0].count });
  }
  return data;
};

try {
  if (verify) {
    console.table(await verifyCounts());
  } else {
    const collections = targetCollection ? [targetCollection] : Object.keys(handlers);
    if (dryRun) {
      for (const collection of collections) {
        const docs = await query('SELECT COUNT(*)::int AS count FROM app_documents WHERE collection = $1', [collection]);
        console.log(`[dry-run] ${collection}: ${docs.rows[0].count} documents ready for migration`);
      }
    } else {
      await withTransaction(async (client) => {
        const scope = await getDefaultScope(client);
        for (const collection of collections) {
          const handler = handlers[collection];
          if (!handler) {
            console.log(`[core-doc-migration] skipped unsupported collection ${collection}`);
            continue;
          }
          await client.query('DELETE FROM app_document_migration_failures WHERE collection = $1', [collection]);
          const migrated = await handler(client, scope);
          console.log(`[core-doc-migration] processed ${migrated} ${collection} documents`);
        }
      });
    }
  }
} finally {
  await closePool();
}
