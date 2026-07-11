import { query } from '../database/query.js';

export const orderRepository = {
  async findById({ orderId, restaurantId, branchIds = [] }) {
    const params = [orderId, restaurantId];
    const branchSql = branchIds.length ? ` AND branch_id = ANY($${params.push(branchIds)}::uuid[])` : '';
    const { rows } = await query(`SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2${branchSql} LIMIT 1`, params);
    return rows[0] || null;
  },

  async listByStatus({ restaurantId, branchIds = [], status, limit = 50, offset = 0 }) {
    const params = [restaurantId];
    let sql = 'SELECT * FROM orders WHERE restaurant_id = $1';
    if (branchIds.length) sql += ` AND branch_id = ANY($${params.push(branchIds)}::uuid[])`;
    if (status) sql += ` AND status = $${params.push(status)}`;
    sql += ` ORDER BY created_at DESC LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`;
    return (await query(sql, params)).rows;
  },

  async createWithItems(client, { order, items, statusReason }) {
    const orderResult = await client.query(
      `INSERT INTO orders (
        restaurant_id, branch_id, order_number, customer_id, table_id, waiter_user_id, order_type, status, payment_status,
        subtotal, discount_amount, tax_amount, service_charge_amount, delivery_charge, rounding_amount, grand_total, due_amount,
        notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,$17,$18)
      RETURNING *`,
      [
        order.restaurantId,
        order.branchId,
        order.orderNumber,
        order.customerId || null,
        order.tableId || null,
        order.waiterUserId || null,
        order.orderType,
        order.status || 'PENDING',
        order.paymentStatus || 'PENDING',
        order.subtotal,
        order.discountAmount || 0,
        order.taxAmount || 0,
        order.serviceChargeAmount || 0,
        order.deliveryCharge || 0,
        order.roundingAmount || 0,
        order.grandTotal,
        order.notes || null,
        order.createdBy || null
      ]
    );
    const createdOrder = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (
          restaurant_id, branch_id, order_id, menu_item_id, item_name, item_sku, quantity, unit_price, discount_amount, tax_amount, line_total, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          createdOrder.restaurant_id,
          createdOrder.branch_id,
          createdOrder.id,
          item.menuItemId || null,
          item.itemName,
          item.itemSku || null,
          item.quantity,
          item.unitPrice,
          item.discountAmount || 0,
          item.taxAmount || 0,
          item.lineTotal,
          item.notes || null
        ]
      );
    }

    await client.query(
      'INSERT INTO order_status_history (restaurant_id, branch_id, order_id, previous_status, new_status, changed_by, reason) VALUES ($1,$2,$3,NULL,$4,$5,$6)',
      [createdOrder.restaurant_id, createdOrder.branch_id, createdOrder.id, createdOrder.status, order.createdBy || null, statusReason || 'Order created']
    );

    return createdOrder;
  }
};
