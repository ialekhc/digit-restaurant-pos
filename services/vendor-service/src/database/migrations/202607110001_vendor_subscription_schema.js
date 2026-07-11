export const name = '202607110001_vendor_subscription_schema';

const enumSql = (typeName, values) => `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeName}') THEN
    CREATE TYPE ${typeName} AS ENUM (${values.map((value) => `'${value}'`).join(', ')});
  END IF;
END $$;`;

export const up = async (client) => {
  await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await client.query('CREATE EXTENSION IF NOT EXISTS "citext"');
  await client.query(enumSql('restaurant_status', ['PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED']));
  await client.query(enumSql('subscription_status', ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED']));
  await client.query(enumSql('payment_method', ['CASH', 'CARD', 'QR', 'BANK_TRANSFER', 'WALLET', 'CREDIT', 'OTHER']));
  await client.query(enumSql('payment_status', ['PENDING', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED']));

  await client.query(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id UUID,
      name VARCHAR(180) NOT NULL,
      legal_name VARCHAR(220),
      slug VARCHAR(160) NOT NULL UNIQUE,
      email CITEXT,
      phone VARCHAR(40),
      pan_vat_number VARCHAR(80),
      tax_registration_number VARCHAR(80),
      logo_url TEXT,
      cover_image_url TEXT,
      currency_code CHAR(3) NOT NULL DEFAULT 'NPR',
      timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Kathmandu',
      status restaurant_status NOT NULL DEFAULT 'PENDING',
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(120) NOT NULL,
      code VARCHAR(40) NOT NULL UNIQUE CHECK (code IN ('STARTER', 'STANDARD', 'PREMIUM', 'ENTERPRISE')),
      description TEXT,
      monthly_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_price >= 0),
      yearly_price NUMERIC(14,2) CHECK (yearly_price IS NULL OR yearly_price >= 0),
      max_branches INTEGER CHECK (max_branches IS NULL OR max_branches > 0),
      max_users INTEGER CHECK (max_users IS NULL OR max_users > 0),
      max_products INTEGER CHECK (max_products IS NULL OR max_products > 0),
      features JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS restaurant_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      plan_id UUID NOT NULL REFERENCES subscription_plans(id),
      status subscription_status NOT NULL DEFAULT 'TRIAL',
      starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      trial_ends_at TIMESTAMPTZ,
      current_period_start TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS subscription_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      subscription_id UUID REFERENCES restaurant_subscriptions(id),
      amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
      currency_code CHAR(3) NOT NULL DEFAULT 'NPR',
      payment_method payment_method NOT NULL DEFAULT 'CASH',
      payment_reference VARCHAR(180),
      status payment_status NOT NULL DEFAULT 'PAID',
      paid_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS vendor_onboarding_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      event_type VARCHAR(100) NOT NULL,
      previous_status restaurant_status,
      new_status restaurant_status,
      performed_by UUID,
      notes TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(status) WHERE deleted_at IS NULL');
  await client.query('CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON restaurants(owner_user_id) WHERE deleted_at IS NULL');
  await client.query('CREATE INDEX IF NOT EXISTS idx_restaurant_subscriptions_restaurant ON restaurant_subscriptions(restaurant_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_restaurant_subscriptions_status ON restaurant_subscriptions(status, current_period_end)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_subscription_payments_restaurant_created ON subscription_payments(restaurant_id, created_at DESC)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_vendor_onboarding_events_restaurant_created ON vendor_onboarding_events(restaurant_id, created_at DESC)');

  for (const table of ['restaurants', 'subscription_plans', 'restaurant_subscriptions', 'subscription_payments']) {
    await client.query(`DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table}`);
    await client.query(`CREATE TRIGGER trg_${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);
  }
};

export const down = async (client) => {
  await client.query('DROP TABLE IF EXISTS vendor_onboarding_events CASCADE');
  await client.query('DROP TABLE IF EXISTS subscription_payments CASCADE');
  await client.query('DROP TABLE IF EXISTS restaurant_subscriptions CASCADE');
  await client.query('DROP TABLE IF EXISTS subscription_plans CASCADE');
  await client.query('DROP TABLE IF EXISTS restaurants CASCADE');
};
