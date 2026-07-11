import { query } from '../database/query.js';

export const supplierRepository = {
  async list({ restaurantId, limit = 50, offset = 0 }) {
    return (await query('SELECT * FROM suppliers WHERE restaurant_id = $1 AND deleted_at IS NULL ORDER BY name ASC LIMIT $2 OFFSET $3', [restaurantId, limit, offset])).rows;
  }
};
