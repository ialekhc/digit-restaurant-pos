import { query } from '../database/query.js';

export const menuRepository = {
  async listItems({ restaurantId, branchId, availableOnly = false }) {
    const params = [restaurantId, branchId];
    const availableSql = availableOnly ? ' AND mi.is_available = TRUE AND COALESCE(bmi.is_available, TRUE) = TRUE' : '';
    return (await query(
      `SELECT mi.*, mc.name AS category_name, COALESCE(bmi.selling_price, mi.base_price) AS resolved_price,
              COALESCE(bmi.is_available, mi.is_available) AS branch_available
       FROM menu_items mi
       LEFT JOIN menu_categories mc ON mc.id = mi.category_id
       LEFT JOIN branch_menu_items bmi ON bmi.menu_item_id = mi.id AND bmi.branch_id = $2
       WHERE mi.restaurant_id = $1 AND mi.deleted_at IS NULL AND mi.is_active = TRUE${availableSql}
       ORDER BY mc.display_order ASC, mi.name ASC`,
      params
    )).rows;
  },

  async findPricedItem({ menuItemId, restaurantId, branchId }) {
    const { rows } = await query(
      `SELECT mi.*, COALESCE(bmi.selling_price, mi.base_price) AS resolved_price,
              COALESCE(bmi.is_available, mi.is_available) AS branch_available
       FROM menu_items mi
       LEFT JOIN branch_menu_items bmi ON bmi.menu_item_id = mi.id AND bmi.branch_id = $3
       WHERE mi.id = $1 AND mi.restaurant_id = $2 AND mi.deleted_at IS NULL LIMIT 1`,
      [menuItemId, restaurantId, branchId]
    );
    return rows[0] || null;
  }
};
