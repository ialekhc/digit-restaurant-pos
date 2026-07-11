import { query } from '../database/query.js';

export const restaurantRepository = {
  async findActiveById(id) {
    const { rows } = await query("SELECT id, name, slug, currency_code, timezone, status FROM restaurants WHERE id = $1 AND deleted_at IS NULL AND status = 'ACTIVE' LIMIT 1", [id]);
    return rows[0] || null;
  }
};
