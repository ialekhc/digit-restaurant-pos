import { closePool, query } from './query.js';
import { withTransaction } from './transaction.js';

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const verify = args.has('--verify');
const dryRun = args.has('--dry-run') || !execute;

const slugify = (value) =>
  String(value || 'restaurant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);

const asNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const subscriptionStatus = (value) => {
  const normalized = String(value || 'ACTIVE').toUpperCase();
  if (normalized === 'PAUSED') return 'SUSPENDED';
  if (normalized === 'INACTIVE') return 'CANCELLED';
  return ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'].includes(normalized) ? normalized : 'ACTIVE';
};
const paymentMethod = (value) => {
  const normalized = String(value || 'CASH').toUpperCase();
  if (normalized === 'ONLINE') return 'OTHER';
  if (normalized === 'SPLIT') return 'OTHER';
  return ['CASH', 'CARD', 'QR', 'BANK_TRANSFER', 'WALLET', 'CREDIT', 'OTHER'].includes(normalized) ? normalized : 'OTHER';
};
const paymentStatus = (value) => {
  const normalized = String(value || 'PAID').toUpperCase();
  if (normalized === 'UNPAID') return 'PENDING';
  if (normalized === 'PARTIAL') return 'PARTIALLY_PAID';
  return ['PENDING', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED'].includes(normalized)
    ? normalized
    : 'PAID';
};

const loadVendors = async (client) => {
  const { rows } = await client.query("SELECT id, data FROM app_documents WHERE collection = 'vendors' ORDER BY created_at ASC");
  return rows.map((row) => ({ legacyId: row.id, data: row.data || {} }));
};

const findPlanId = async (client, planId) => {
  const { rows } = await client.query('SELECT id FROM subscription_plans WHERE code = $1 LIMIT 1', [planId || 'STARTER']);
  if (rows[0]) return rows[0].id;
  const fallback = await client.query("SELECT id FROM subscription_plans WHERE code = 'STARTER' LIMIT 1");
  return fallback.rows[0]?.id;
};

const migrate = async (client) => {
  const docs = await loadVendors(client);
  for (const { legacyId, data } of docs) {
    const subscription = data.subscription || {};
    const slug = slugify(data.slug || data.vendorName || data.name || legacyId);
    const restaurant = await client.query(
      `INSERT INTO restaurants (name, legal_name, slug, email, phone, status, settings, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,NOW()),COALESCE($9::timestamptz,NOW()))
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         legal_name = EXCLUDED.legal_name,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         status = EXCLUDED.status
       RETURNING id`,
      [
        data.vendorName || data.name || 'Legacy Vendor',
        data.legalName || data.vendorName || data.name || 'Legacy Vendor',
        slug,
        data.email || null,
        data.phone || null,
        data.isActive === false ? 'SUSPENDED' : 'ACTIVE',
        JSON.stringify({ legacyVendorId: legacyId, address: data.address || '', notes: data.notes || '' }),
        data.createdAt || null,
        data.updatedAt || null
      ]
    );

    const planId = await findPlanId(client, subscription.planId);
    if (planId) {
      const sub = await client.query(
        `WITH existing AS (
           SELECT id FROM restaurant_subscriptions WHERE restaurant_id = $1 ORDER BY created_at DESC LIMIT 1
         ), updated AS (
           UPDATE restaurant_subscriptions SET
             plan_id = $2,
             status = $3,
             current_period_end = $5::timestamptz,
             auto_renew = TRUE
           WHERE id IN (SELECT id FROM existing)
           RETURNING id
         ), inserted AS (
           INSERT INTO restaurant_subscriptions (restaurant_id, plan_id, status, starts_at, current_period_start, current_period_end, auto_renew)
           SELECT $1,$2,$3,COALESCE($4::timestamptz,NOW()),COALESCE($4::timestamptz,NOW()),$5::timestamptz,TRUE
           WHERE NOT EXISTS (SELECT 1 FROM existing)
           RETURNING id
         )
         SELECT id FROM updated UNION ALL SELECT id FROM inserted`,
        [restaurant.rows[0].id, planId, subscriptionStatus(subscription.status), subscription.startsOn || null, subscription.endsOn || null]
      );

      const paymentHistory = Array.isArray(data.paymentHistory) ? data.paymentHistory : [];
      for (const payment of paymentHistory) {
        await client.query(
          `INSERT INTO subscription_payments (restaurant_id, subscription_id, amount, currency_code, payment_method, payment_reference, status, paid_at, notes)
           VALUES ($1,$2,$3,'NPR',$4,$5,$6,COALESCE($7::timestamptz,NOW()),$8)
           ON CONFLICT DO NOTHING`,
          [
            restaurant.rows[0].id,
            sub.rows[0]?.id || null,
            asNumber(payment.amount),
            paymentMethod(payment.method),
            payment.reference || payment.paymentReference || null,
            paymentStatus(payment.status),
            payment.paymentDate || payment.createdAt || null,
            payment.notes || ''
          ]
        );
      }
    }
  }
  return docs.length;
};

try {
  if (verify) {
    const docs = await query("SELECT COUNT(*)::int AS count FROM app_documents WHERE collection = 'vendors'");
    const restaurants = await query('SELECT COUNT(*)::int AS count FROM restaurants');
    const subscriptions = await query('SELECT COUNT(*)::int AS count FROM restaurant_subscriptions');
    console.table([{ collection: 'vendors', documentCount: docs.rows[0].count, restaurantCount: restaurants.rows[0].count, subscriptionCount: subscriptions.rows[0].count }]);
  } else if (dryRun) {
    const docs = await query("SELECT COUNT(*)::int AS count FROM app_documents WHERE collection = 'vendors'");
    console.log(`[dry-run] vendors: ${docs.rows[0].count} documents ready for migration`);
  } else {
    await withTransaction(async (client) => {
      const count = await migrate(client);
      console.log(`[vendor-doc-migration] processed ${count} vendor documents`);
    });
  }
} finally {
  await closePool();
}
