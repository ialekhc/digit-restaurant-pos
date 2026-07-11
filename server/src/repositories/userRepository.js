import { query } from '../database/query.js';

export const userRepository = {
  async findByEmail(email) {
    const { rows } = await query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1', [email]);
    return rows[0] || null;
  },

  async findAccessByUserId(userId) {
    const { rows } = await query(
      `SELECT urr.*, r.code AS role_code, r.hierarchy_level,
        COALESCE(json_agg(DISTINCT uba.branch_id) FILTER (WHERE uba.branch_id IS NOT NULL), '[]') AS branch_ids
       FROM user_restaurant_roles urr
       JOIN roles r ON r.id = urr.role_id
       LEFT JOIN user_branch_assignments uba ON uba.user_restaurant_role_id = urr.id
       WHERE urr.user_id = $1 AND urr.status = 'ACTIVE'
       GROUP BY urr.id, r.code, r.hierarchy_level`,
      [userId]
    );
    return rows;
  },

  async effectivePermissions(userRestaurantRoleId) {
    const { rows } = await query(
      `SELECT p.code, COALESCE(upo.is_allowed, TRUE) AS is_allowed
       FROM user_restaurant_roles urr
       JOIN role_permissions rp ON rp.role_id = urr.role_id
       JOIN permissions p ON p.id = rp.permission_id
       LEFT JOIN user_permission_overrides upo
         ON upo.user_restaurant_role_id = urr.id AND upo.permission_id = p.id
       WHERE urr.id = $1
       UNION
       SELECT p.code, upo.is_allowed
       FROM user_permission_overrides upo
       JOIN permissions p ON p.id = upo.permission_id
       WHERE upo.user_restaurant_role_id = $1`,
      [userRestaurantRoleId]
    );
    return rows.filter((row) => row.is_allowed).map((row) => row.code);
  }
};
