export const name = '202607130001_multi_printer_routing_schema';

export const up = async (client) => {
  await client.query(`
    ALTER TABLE menu_items
    ADD COLUMN IF NOT EXISTS preparation_station VARCHAR(20) NOT NULL DEFAULT 'KITCHEN'
  `);
  await client.query(`
    ALTER TABLE menu_items
    DROP CONSTRAINT IF EXISTS chk_menu_items_preparation_station
  `);
  await client.query(`
    ALTER TABLE menu_items
    ADD CONSTRAINT chk_menu_items_preparation_station
    CHECK (preparation_station IN ('KITCHEN', 'BAR', 'SMOKE', 'NONE'))
  `);

  await client.query(`
    ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS preparation_station VARCHAR(20) NOT NULL DEFAULT 'KITCHEN'
  `);
  await client.query(`
    ALTER TABLE order_items
    DROP CONSTRAINT IF EXISTS chk_order_items_preparation_station
  `);
  await client.query(`
    ALTER TABLE order_items
    ADD CONSTRAINT chk_order_items_preparation_station
    CHECK (preparation_station IN ('KITCHEN', 'BAR', 'SMOKE', 'NONE'))
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS printers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vendor_id UUID,
      restaurant_id UUID,
      name VARCHAR(160) NOT NULL,
      purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('KITCHEN', 'BAR', 'SMOKE', 'COUNTER')),
      printer_system_name VARCHAR(255) NOT NULL DEFAULT '',
      connection_type VARCHAR(40) NOT NULL DEFAULT 'SYSTEM',
      ip_address VARCHAR(120) NOT NULL DEFAULT '',
      port VARCHAR(20) NOT NULL DEFAULT '',
      paper_width_mm INTEGER NOT NULL DEFAULT 58 CHECK (paper_width_mm > 0),
      copies INTEGER NOT NULL DEFAULT 1 CHECK (copies > 0),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (restaurant_id, purpose)
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS print_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vendor_id UUID,
      restaurant_id UUID,
      printer_id UUID REFERENCES printers(id),
      order_id UUID,
      payment_id UUID,
      document_type VARCHAR(80) NOT NULL,
      station VARCHAR(20) NOT NULL DEFAULT '',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PRINTED', 'FAILED', 'CANCELLED')),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
      error_message TEXT NOT NULL DEFAULT '',
      idempotency_key VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      printed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_printers_restaurant_purpose ON printers(restaurant_id, purpose)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_print_jobs_restaurant_status ON print_jobs(restaurant_id, status, created_at)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_print_jobs_order ON print_jobs(order_id)');
};

export const down = async (client) => {
  await client.query('DROP TABLE IF EXISTS print_jobs');
  await client.query('DROP TABLE IF EXISTS printers');
  await client.query('ALTER TABLE order_items DROP CONSTRAINT IF EXISTS chk_order_items_preparation_station');
  await client.query('ALTER TABLE order_items DROP COLUMN IF EXISTS preparation_station');
  await client.query('ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS chk_menu_items_preparation_station');
  await client.query('ALTER TABLE menu_items DROP COLUMN IF EXISTS preparation_station');
};
