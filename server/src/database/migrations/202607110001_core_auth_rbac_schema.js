export const name = '202607110001_core_auth_rbac_schema';

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
  await client.query(enumSql('user_status', ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'INVITED']));

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
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_id TEXT UNIQUE,
      full_name VARCHAR(180) NOT NULL,
      email CITEXT,
      phone VARCHAR(40),
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      status user_status NOT NULL DEFAULT 'ACTIVE',
      email_verified_at TIMESTAMPTZ,
      phone_verified_at TIMESTAMPTZ,
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CHECK (email IS NOT NULL OR phone IS NOT NULL)
    );
  `);

  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL AND deleted_at IS NULL');
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users(phone) WHERE phone IS NOT NULL AND deleted_at IS NULL');

  await client.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID REFERENCES restaurants(id),
      name VARCHAR(120) NOT NULL,
      code VARCHAR(80) NOT NULL,
      description TEXT,
      hierarchy_level INTEGER NOT NULL DEFAULT 0,
      is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_platform_code ON roles(code) WHERE restaurant_id IS NULL');
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_restaurant_code ON roles(restaurant_id, code) WHERE restaurant_id IS NOT NULL');

  await client.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(120) NOT NULL UNIQUE,
      module VARCHAR(80) NOT NULL,
      action VARCHAR(80) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (role_id, permission_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_restaurant_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      restaurant_id UUID REFERENCES restaurants(id),
      role_id UUID NOT NULL REFERENCES roles(id),
      discount_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_limit_percent >= 0 AND discount_limit_percent <= 100),
      refund_limit_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (refund_limit_amount >= 0),
      void_limit_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (void_limit_amount >= 0),
      status user_status NOT NULL DEFAULT 'ACTIVE',
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, restaurant_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_permission_overrides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_restaurant_role_id UUID NOT NULL REFERENCES user_restaurant_roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      is_allowed BOOLEAN NOT NULL,
      reason TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_restaurant_role_id, permission_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      device_name VARCHAR(120),
      ip_address INET,
      user_agent TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_user_restaurant_roles_user_restaurant ON user_restaurant_roles(user_id, restaurant_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_user_restaurant_roles_restaurant ON user_restaurant_roles(restaurant_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON refresh_tokens(user_id, expires_at) WHERE revoked_at IS NULL');

  for (const table of ['users', 'roles', 'user_restaurant_roles']) {
    await client.query(`DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table}`);
    await client.query(`CREATE TRIGGER trg_${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);
  }
};

export const down = async (client) => {
  await client.query('DROP TABLE IF EXISTS refresh_tokens CASCADE');
  await client.query('DROP TABLE IF EXISTS user_permission_overrides CASCADE');
  await client.query('DROP TABLE IF EXISTS user_restaurant_roles CASCADE');
  await client.query('DROP TABLE IF EXISTS role_permissions CASCADE');
  await client.query('DROP TABLE IF EXISTS permissions CASCADE');
  await client.query('DROP TABLE IF EXISTS roles CASCADE');
  await client.query('DROP TABLE IF EXISTS users CASCADE');
};
