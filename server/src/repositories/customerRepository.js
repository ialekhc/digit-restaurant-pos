import { query } from '../database/query.js';

export const customerRepository = {
  async findByPhone({ restaurantId, phone }) {
    const { rows } = await query('SELECT * FROM customers WHERE restaurant_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1', [restaurantId, phone]);
    return rows[0] || null;
  },

  async list({ restaurantId, limit = 50, offset = 0 }) {
    return (await query('SELECT * FROM customers WHERE restaurant_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT $2 OFFSET $3', [restaurantId, limit, offset])).rows;
  }
};
