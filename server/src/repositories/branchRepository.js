import { query } from '../database/query.js';

export const branchRepository = {
  async list({ restaurantId, branchIds = [] }) {
    const params = [restaurantId];
    const branchSql = branchIds.length ? ` AND id = ANY($${params.push(branchIds)}::uuid[])` : '';
    return (await query(`SELECT * FROM branches WHERE restaurant_id = $1 AND deleted_at IS NULL${branchSql} ORDER BY is_main_branch DESC, name ASC`, params)).rows;
  },

  async findById({ branchId, restaurantId }) {
    const { rows } = await query('SELECT * FROM branches WHERE id = $1 AND restaurant_id = $2 AND deleted_at IS NULL LIMIT 1', [branchId, restaurantId]);
    return rows[0] || null;
  }
};
