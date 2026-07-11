export const name = '202607110002_core_restaurant_operations_schema';

const enumSql = (typeName, values) => `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${typeName}') THEN
    CREATE TYPE ${typeName} AS ENUM (${values.map((value) => `'${value}'`).join(', ')});
  END IF;
END $$;`;

const triggerUpdatedAt = async (client, tables) => {
  for (const table of tables) {
    await client.query(`DROP TRIGGER IF EXISTS trg_${table}_updated_at ON ${table}`);
    await client.query(`CREATE TRIGGER trg_${table}_updated_at BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION set_updated_at()`);
  }
};

export const up = async (client) => {
  await client.query(enumSql('branch_status', ['ACTIVE', 'INACTIVE', 'TEMPORARILY_CLOSED']));
  await client.query(enumSql('order_type', ['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'PICKUP', 'ONLINE', 'QR_ORDER']));
  await client.query(enumSql('order_status', ['DRAFT', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCEL_REQUESTED', 'CANCELLED', 'VOID_REQUESTED', 'VOIDED']));
  await client.query(enumSql('payment_status', ['PENDING', 'PARTIALLY_PAID', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED']));
  await client.query(enumSql('payment_method', ['CASH', 'CARD', 'QR', 'BANK_TRANSFER', 'WALLET', 'CREDIT', 'OTHER']));
  await client.query(enumSql('kitchen_ticket_status', ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED']));
  await client.query(enumSql('inventory_movement_type', ['OPENING_STOCK', 'PURCHASE', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'WASTAGE', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN']));

  await client.query(`
    CREATE TABLE IF NOT EXISTS branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      name VARCHAR(160) NOT NULL,
      code VARCHAR(60) NOT NULL,
      phone VARCHAR(40),
      email CITEXT,
      address_line_1 TEXT,
      address_line_2 TEXT,
      city VARCHAR(100),
      district VARCHAR(100),
      province VARCHAR(100),
      country VARCHAR(100) NOT NULL DEFAULT 'Nepal',
      postal_code VARCHAR(30),
      latitude NUMERIC(10,7),
      longitude NUMERIC(10,7),
      opening_time TIME,
      closing_time TIME,
      status branch_status NOT NULL DEFAULT 'ACTIVE',
      is_main_branch BOOLEAN NOT NULL DEFAULT FALSE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      UNIQUE(restaurant_id, code)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_branch_assignments (
      user_restaurant_role_id UUID NOT NULL REFERENCES user_restaurant_roles(id) ON DELETE CASCADE,
      branch_id UUID NOT NULL REFERENCES branches(id),
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_restaurant_role_id, branch_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS taxes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      name VARCHAR(120) NOT NULL,
      rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (rate_percent >= 0 AND rate_percent <= 100),
      is_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS service_charges (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      name VARCHAR(120) NOT NULL,
      rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (rate_percent >= 0 AND rate_percent <= 100),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS payment_method_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID REFERENCES branches(id),
      method payment_method NOT NULL,
      display_name VARCHAR(120) NOT NULL,
      configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      parent_id UUID REFERENCES menu_categories(id),
      name VARCHAR(160) NOT NULL,
      description TEXT,
      image_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      category_id UUID REFERENCES menu_categories(id),
      sku VARCHAR(80),
      name VARCHAR(180) NOT NULL,
      description TEXT,
      base_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
      cost_price NUMERIC(14,2) CHECK (cost_price IS NULL OR cost_price >= 0),
      image_url TEXT,
      preparation_time_minutes INTEGER NOT NULL DEFAULT 0 CHECK (preparation_time_minutes >= 0),
      is_vegetarian BOOLEAN NOT NULL DEFAULT FALSE,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      track_inventory BOOLEAN NOT NULL DEFAULT FALSE,
      tax_id UUID REFERENCES taxes(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      UNIQUE(restaurant_id, sku)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS branch_menu_items (
      branch_id UUID NOT NULL REFERENCES branches(id),
      menu_item_id UUID NOT NULL REFERENCES menu_items(id),
      selling_price NUMERIC(14,2) CHECK (selling_price IS NULL OR selling_price >= 0),
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      is_visible BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (branch_id, menu_item_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      name VARCHAR(160) NOT NULL,
      description TEXT,
      available_from TIME,
      available_until TIME,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS menu_menu_items (
      menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      menu_item_id UUID NOT NULL REFERENCES menu_items(id),
      display_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (menu_id, menu_item_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS modifier_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      name VARCHAR(160) NOT NULL,
      min_selection INTEGER NOT NULL DEFAULT 0 CHECK (min_selection >= 0),
      max_selection INTEGER NOT NULL DEFAULT 1 CHECK (max_selection >= 0),
      is_required BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (max_selection >= min_selection)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS modifier_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
      name VARCHAR(160) NOT NULL,
      additional_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (additional_price >= 0),
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS menu_item_modifier_groups (
      menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
      display_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (menu_item_id, modifier_group_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS restaurant_floors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      name VARCHAR(120) NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      floor_id UUID REFERENCES restaurant_floors(id),
      name VARCHAR(80) NOT NULL,
      code VARCHAR(60) NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','OCCUPIED','RESERVED','CLEANING','OUT_OF_SERVICE')),
      qr_code_value TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      UNIQUE(branch_id, code)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS table_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      table_id UUID NOT NULL REFERENCES restaurant_tables(id),
      waiter_user_id UUID REFERENCES users(id),
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      created_by UUID REFERENCES users(id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      full_name VARCHAR(180) NOT NULL,
      phone VARCHAR(40),
      email CITEXT,
      loyalty_points INTEGER NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
      credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      UNIQUE(restaurant_id, phone)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_addresses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      label VARCHAR(80),
      contact_name VARCHAR(180),
      contact_phone VARCHAR(40),
      address_line_1 TEXT NOT NULL,
      address_line_2 TEXT,
      city VARCHAR(100),
      district VARCHAR(100),
      latitude NUMERIC(10,7),
      longitude NUMERIC(10,7),
      delivery_instructions TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS shifts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      opened_by UUID REFERENCES users(id),
      closed_by UUID REFERENCES users(id),
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      opening_cash NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (opening_cash >= 0),
      expected_closing_cash NUMERIC(14,2),
      actual_closing_cash NUMERIC(14,2),
      cash_difference NUMERIC(14,2),
      status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','RECONCILED')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS cash_registers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      name VARCHAR(120) NOT NULL,
      code VARCHAR(60) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(branch_id, code)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS cash_register_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
      shift_id UUID REFERENCES shifts(id),
      cashier_user_id UUID REFERENCES users(id),
      opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
      expected_balance NUMERIC(14,2),
      closing_balance NUMERIC(14,2),
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','RECONCILED')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_register_sessions_one_open ON cash_register_sessions(cash_register_id) WHERE status = 'OPEN'");

  await client.query(`
    CREATE TABLE IF NOT EXISTS cash_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      register_session_id UUID REFERENCES cash_register_sessions(id),
      movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('CASH_IN','CASH_OUT','EXPENSE','ADJUSTMENT','BANK_DROP')),
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      reason TEXT NOT NULL,
      created_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS number_sequences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      document_type VARCHAR(40) NOT NULL,
      prefix VARCHAR(30) NOT NULL,
      current_value BIGINT NOT NULL DEFAULT 0 CHECK (current_value >= 0),
      reset_period VARCHAR(20) NOT NULL DEFAULT 'NEVER' CHECK (reset_period IN ('NEVER','DAILY','MONTHLY','YEARLY')),
      last_reset_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(branch_id, document_type)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      order_number VARCHAR(80) NOT NULL,
      customer_id UUID REFERENCES customers(id),
      table_id UUID REFERENCES restaurant_tables(id),
      waiter_user_id UUID REFERENCES users(id),
      cashier_user_id UUID REFERENCES users(id),
      shift_id UUID REFERENCES shifts(id),
      order_type order_type NOT NULL,
      status order_status NOT NULL DEFAULT 'PENDING',
      payment_status payment_status NOT NULL DEFAULT 'PENDING',
      guest_count INTEGER NOT NULL DEFAULT 1 CHECK (guest_count > 0),
      subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      service_charge_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (service_charge_amount >= 0),
      delivery_charge NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (delivery_charge >= 0),
      rounding_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
      grand_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
      paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      due_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (due_amount >= 0),
      notes TEXT,
      placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(branch_id, order_number)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id UUID REFERENCES menu_items(id),
      item_name VARCHAR(180) NOT NULL,
      item_sku VARCHAR(80),
      quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
      discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),
      notes TEXT,
      kitchen_status kitchen_ticket_status NOT NULL DEFAULT 'NEW',
      is_voided BOOLEAN NOT NULL DEFAULT FALSE,
      void_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS order_item_modifiers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
      modifier_option_id UUID REFERENCES modifier_options(id),
      modifier_name VARCHAR(160) NOT NULL,
      additional_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (additional_price >= 0),
      quantity NUMERIC(14,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      order_id UUID NOT NULL REFERENCES orders(id),
      previous_status order_status,
      new_status order_status NOT NULL,
      changed_by UUID REFERENCES users(id),
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS order_discounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      order_id UUID NOT NULL REFERENCES orders(id),
      discount_type VARCHAR(30) NOT NULL CHECK (discount_type IN ('PERCENT','AMOUNT')),
      discount_value NUMERIC(14,2) NOT NULL CHECK (discount_value >= 0),
      discount_amount NUMERIC(14,2) NOT NULL CHECK (discount_amount >= 0),
      reason TEXT,
      applied_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS order_cancellations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      order_id UUID NOT NULL REFERENCES orders(id),
      reason TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','REJECTED')),
      requested_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS order_voids (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      order_id UUID NOT NULL REFERENCES orders(id),
      reason TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','REJECTED')),
      requested_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      order_id UUID NOT NULL REFERENCES orders(id),
      register_session_id UUID REFERENCES cash_register_sessions(id),
      payment_number VARCHAR(80) NOT NULL,
      method payment_method NOT NULL,
      status payment_status NOT NULL DEFAULT 'PAID',
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      transaction_reference VARCHAR(180),
      gateway_reference VARCHAR(180),
      received_by UUID REFERENCES users(id),
      paid_at TIMESTAMPTZ,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(branch_id, payment_number)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS refunds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      order_id UUID NOT NULL REFERENCES orders(id),
      payment_id UUID NOT NULL REFERENCES payments(id),
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      reason TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','REJECTED','PROCESSING','PROCESSED','FAILED')),
      requested_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      processed_by UUID REFERENCES users(id),
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      approved_at TIMESTAMPTZ,
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      name VARCHAR(160) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      category_id UUID REFERENCES expense_categories(id),
      expense_number VARCHAR(80) NOT NULL,
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      payment_method payment_method NOT NULL DEFAULT 'CASH',
      description TEXT,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(branch_id, expense_number)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS kitchen_stations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      name VARCHAR(120) NOT NULL,
      code VARCHAR(50) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(branch_id, code)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS menu_item_kitchen_stations (
      menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      kitchen_station_id UUID NOT NULL REFERENCES kitchen_stations(id) ON DELETE CASCADE,
      PRIMARY KEY (menu_item_id, kitchen_station_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS kitchen_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      order_id UUID NOT NULL REFERENCES orders(id),
      kitchen_station_id UUID NOT NULL REFERENCES kitchen_stations(id),
      ticket_number VARCHAR(80) NOT NULL,
      status kitchen_ticket_status NOT NULL DEFAULT 'NEW',
      accepted_by UUID REFERENCES users(id),
      started_at TIMESTAMPTZ,
      ready_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(branch_id, ticket_number)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS kitchen_ticket_items (
      kitchen_ticket_id UUID NOT NULL REFERENCES kitchen_tickets(id) ON DELETE CASCADE,
      order_item_id UUID NOT NULL REFERENCES order_items(id),
      status kitchen_ticket_status NOT NULL DEFAULT 'NEW',
      started_at TIMESTAMPTZ,
      ready_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (kitchen_ticket_id, order_item_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS units (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      name VARCHAR(80) NOT NULL,
      symbol VARCHAR(20) NOT NULL,
      precision_scale INTEGER NOT NULL DEFAULT 3 CHECK (precision_scale >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(restaurant_id, symbol)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      name VARCHAR(180) NOT NULL,
      sku VARCHAR(80) NOT NULL,
      unit_id UUID REFERENCES units(id),
      cost_per_unit NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (cost_per_unit >= 0),
      minimum_stock_level NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (minimum_stock_level >= 0),
      reorder_level NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      UNIQUE(restaurant_id, sku)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS branch_inventory (
      branch_id UUID NOT NULL REFERENCES branches(id),
      inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
      quantity_on_hand NUMERIC(14,3) NOT NULL DEFAULT 0,
      reserved_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
      average_cost NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (branch_id, inventory_item_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS recipe_items (
      menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
      quantity_required NUMERIC(14,3) NOT NULL CHECK (quantity_required > 0),
      wastage_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (wastage_percent >= 0 AND wastage_percent <= 100),
      PRIMARY KEY (menu_item_id, inventory_item_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
      movement_type inventory_movement_type NOT NULL,
      quantity NUMERIC(14,3) NOT NULL,
      unit_cost NUMERIC(14,4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
      reference_type VARCHAR(80),
      reference_id UUID,
      reason TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
      previous_quantity NUMERIC(14,3) NOT NULL,
      new_quantity NUMERIC(14,3) NOT NULL,
      difference_quantity NUMERIC(14,3) NOT NULL,
      reason TEXT NOT NULL,
      adjusted_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_transfers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      from_branch_id UUID NOT NULL REFERENCES branches(id),
      to_branch_id UUID NOT NULL REFERENCES branches(id),
      status VARCHAR(30) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','DISPATCHED','RECEIVED','CANCELLED')),
      requested_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      dispatched_at TIMESTAMPTZ,
      received_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS inventory_transfer_items (
      inventory_transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
      inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
      requested_quantity NUMERIC(14,3) NOT NULL CHECK (requested_quantity > 0),
      dispatched_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (dispatched_quantity >= 0),
      received_quantity NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
      PRIMARY KEY (inventory_transfer_id, inventory_item_id)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      name VARCHAR(180) NOT NULL,
      contact_person VARCHAR(180),
      phone VARCHAR(40),
      email CITEXT,
      address TEXT,
      tax_number VARCHAR(80),
      opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      supplier_id UUID REFERENCES suppliers(id),
      purchase_order_number VARCHAR(80) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
      subtotal NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      grand_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
      expected_delivery_date DATE,
      created_by UUID REFERENCES users(id),
      approved_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(branch_id, purchase_order_number)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
      quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
      unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
      line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS goods_receipts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      purchase_order_id UUID REFERENCES purchase_orders(id),
      supplier_id UUID REFERENCES suppliers(id),
      receipt_number VARCHAR(80) NOT NULL,
      received_by UUID REFERENCES users(id),
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(branch_id, receipt_number)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS goods_receipt_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
      inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
      quantity_received NUMERIC(14,3) NOT NULL CHECK (quantity_received > 0),
      unit_cost NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
      expiry_date DATE,
      batch_number VARCHAR(100)
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      customer_id UUID REFERENCES customers(id),
      table_id UUID REFERENCES restaurant_tables(id),
      customer_name VARCHAR(180) NOT NULL,
      customer_phone VARCHAR(40),
      guest_count INTEGER NOT NULL CHECK (guest_count > 0),
      reservation_at TIMESTAMPTZ NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','SEATED','CANCELLED','NO_SHOW')),
      notes TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      user_id UUID NOT NULL REFERENCES users(id),
      clock_in_at TIMESTAMPTZ NOT NULL,
      clock_out_at TIMESTAMPTZ,
      clock_in_method VARCHAR(40),
      clock_out_method VARCHAR(40),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      customer_id UUID NOT NULL REFERENCES customers(id),
      order_id UUID REFERENCES orders(id),
      transaction_type VARCHAR(40) NOT NULL,
      points INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS customer_credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID NOT NULL REFERENCES restaurants(id),
      branch_id UUID NOT NULL REFERENCES branches(id),
      customer_id UUID NOT NULL REFERENCES customers(id),
      order_id UUID REFERENCES orders(id),
      transaction_type VARCHAR(40) NOT NULL CHECK (transaction_type IN ('CREDIT_SALE','PAYMENT','ADJUSTMENT','WRITE_OFF')),
      amount NUMERIC(14,2) NOT NULL,
      balance_after NUMERIC(14,2) NOT NULL,
      notes TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      restaurant_id UUID REFERENCES restaurants(id),
      branch_id UUID REFERENCES branches(id),
      user_id UUID REFERENCES users(id),
      action VARCHAR(120) NOT NULL,
      resource_type VARCHAR(120) NOT NULL,
      resource_id UUID,
      old_values JSONB,
      new_values JSONB,
      reason TEXT,
      ip_address INET,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS app_document_migration_failures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      collection TEXT NOT NULL,
      document_id TEXT,
      error_message TEXT NOT NULL,
      payload JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_branches_restaurant ON branches(restaurant_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_active_menu_items ON menu_items(restaurant_id, category_id) WHERE deleted_at IS NULL AND is_active = TRUE');
  await client.query('CREATE INDEX IF NOT EXISTS idx_orders_restaurant_branch ON orders(restaurant_id, branch_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_orders_branch_status_created ON orders(branch_id, status, created_at DESC)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_payments_branch_created ON payments(branch_id, created_at DESC)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_branch_status ON kitchen_tickets(branch_id, status, created_at)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_created ON inventory_movements(branch_id, inventory_item_id, created_at DESC)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_customers_restaurant_phone ON customers(restaurant_id, phone)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_restaurant_created ON audit_logs(restaurant_id, created_at DESC)');

  await triggerUpdatedAt(client, [
    'branches','taxes','service_charges','payment_method_settings','menu_categories','menu_items','menus','modifier_groups','modifier_options',
    'restaurant_floors','restaurant_tables','customers','customer_addresses','shifts','cash_registers','cash_register_sessions','number_sequences',
    'orders','order_items','payments','refunds','expense_categories','expenses','kitchen_stations','kitchen_tickets','units','inventory_items',
    'inventory_transfers','suppliers','purchase_orders','reservations','attendance_records'
  ]);
};

export const down = async (client) => {
  const tables = [
    'app_document_migration_failures','audit_logs','customer_credit_transactions','loyalty_transactions','attendance_records','reservations',
    'goods_receipt_items','goods_receipts','purchase_order_items','purchase_orders','suppliers','inventory_transfer_items','inventory_transfers',
    'stock_adjustments','inventory_movements','recipe_items','branch_inventory','inventory_items','units','kitchen_ticket_items','kitchen_tickets',
    'menu_item_kitchen_stations','kitchen_stations','expenses','expense_categories','refunds','payments','order_voids','order_cancellations',
    'order_discounts','order_status_history','order_item_modifiers','order_items','orders','number_sequences','cash_movements',
    'cash_register_sessions','cash_registers','shifts','customer_addresses','customers','table_assignments','restaurant_tables','restaurant_floors',
    'menu_item_modifier_groups','modifier_options','modifier_groups','menu_menu_items','menus','branch_menu_items','menu_items','menu_categories',
    'payment_method_settings','service_charges','taxes','user_branch_assignments','branches'
  ];
  for (const table of tables) {
    await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
  }
};
