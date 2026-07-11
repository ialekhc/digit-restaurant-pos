import { query } from '../database/query.js';

export const inventoryRepository = {
  async findBranchBalanceForUpdate(client, { branchId, inventoryItemId }) {
    const { rows } = await client.query(
      'SELECT * FROM branch_inventory WHERE branch_id = $1 AND inventory_item_id = $2 FOR UPDATE',
      [branchId, inventoryItemId]
    );
    return rows[0] || null;
  },

  async insertMovement(client, movement) {
    const { rows } = await client.query(
      `INSERT INTO inventory_movements (
        restaurant_id, branch_id, inventory_item_id, movement_type, quantity, unit_cost, reference_type, reference_id, reason, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        movement.restaurantId,
        movement.branchId,
        movement.inventoryItemId,
        movement.movementType,
        movement.quantity,
        movement.unitCost || null,
        movement.referenceType || null,
        movement.referenceId || null,
        movement.reason || null,
        movement.createdBy || null
      ]
    );
    return rows[0];
  },

  async listLowStock({ restaurantId, branchIds = [] }) {
    const params = [restaurantId];
    const branchSql = branchIds.length ? ` AND bi.branch_id = ANY($${params.push(branchIds)}::uuid[])` : '';
    return (await query(
      `SELECT ii.*, bi.branch_id, bi.quantity_on_hand
       FROM inventory_items ii
       JOIN branch_inventory bi ON bi.inventory_item_id = ii.id
       WHERE ii.restaurant_id = $1${branchSql}
         AND ii.deleted_at IS NULL
         AND bi.quantity_on_hand <= ii.minimum_stock_level
       ORDER BY ii.name ASC`,
      params
    )).rows;
  }
};
