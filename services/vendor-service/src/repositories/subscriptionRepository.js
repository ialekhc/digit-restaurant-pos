import { query } from '../database/query.js';

export const subscriptionRepository = {
  async listPlans() {
    return (await query('SELECT * FROM subscription_plans WHERE is_active = TRUE ORDER BY monthly_price ASC')).rows;
  },

  async findRestaurantSubscription(restaurantId) {
    const { rows } = await query(
      `SELECT rs.*, sp.code AS plan_code, sp.name AS plan_name
       FROM restaurant_subscriptions rs
       JOIN subscription_plans sp ON sp.id = rs.plan_id
       WHERE rs.restaurant_id = $1
       ORDER BY rs.created_at DESC
       LIMIT 1`,
      [restaurantId]
    );
    return rows[0] || null;
  }
};
