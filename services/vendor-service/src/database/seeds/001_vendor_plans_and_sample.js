import { PLAN_CATALOG } from '../../config/planCatalog.js';

const planLimits = {
  STARTER: { branches: 1, users: 3, products: 250 },
  STANDARD: { branches: 1, users: 8, products: 750 },
  PREMIUM: { branches: 2, users: 15, products: 2000 },
  ENTERPRISE: { branches: null, users: null, products: null }
};

const title = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/(^|_)([a-z])/g, (_match, prefix, letter) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`);

export const run = async (client) => {
  for (const plan of PLAN_CATALOG.plans) {
    const limits = planLimits[plan.id] || {};
    const planName = plan.name || `${title(plan.id)} Plan`;
    await client.query(
      `INSERT INTO subscription_plans (
        name, code, description, monthly_price, yearly_price, max_branches, max_users, max_products, features, is_active
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE)
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        monthly_price = EXCLUDED.monthly_price,
        yearly_price = EXCLUDED.yearly_price,
        max_branches = EXCLUDED.max_branches,
        max_users = EXCLUDED.max_users,
        max_products = EXCLUDED.max_products,
        features = EXCLUDED.features,
        is_active = TRUE`,
      [
        planName,
        plan.id,
        `${planName} subscription package`,
        plan.pricing.monthly,
        plan.pricing.annual,
        limits.branches,
        limits.users,
        limits.products,
        JSON.stringify(plan.features || plan.featureKeys || [])
      ]
    );
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    console.log('[vendor-db] skipped sample restaurant seed in production');
    return;
  }

  const { rows: restaurants } = await client.query(
    `INSERT INTO restaurants (name, legal_name, slug, email, phone, status, settings)
     VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       legal_name = EXCLUDED.legal_name,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       status = 'ACTIVE'
     RETURNING id`,
    ['Digit Demo Restaurant', 'Digit Demo Restaurant Pvt. Ltd.', 'digit-demo-restaurant', 'owner@restaurant.local', '9800000000', '{}']
  );

  const { rows: plans } = await client.query('SELECT id FROM subscription_plans WHERE code = $1', ['STANDARD']);
  await client.query(
    `INSERT INTO restaurant_subscriptions (restaurant_id, plan_id, status, starts_at, current_period_start, current_period_end, auto_renew)
     VALUES ($1,$2,'ACTIVE',NOW(),NOW(),NOW() + INTERVAL '1 year',TRUE)
     ON CONFLICT DO NOTHING`,
    [restaurants[0].id, plans[0].id]
  );
};
