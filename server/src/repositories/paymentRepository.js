import { query } from '../database/query.js';

export const paymentRepository = {
  async listByOrder({ orderId, restaurantId, branchIds = [] }) {
    const params = [orderId, restaurantId];
    const branchSql = branchIds.length ? ` AND branch_id = ANY($${params.push(branchIds)}::uuid[])` : '';
    return (await query(`SELECT * FROM payments WHERE order_id = $1 AND restaurant_id = $2${branchSql} ORDER BY created_at DESC`, params)).rows;
  },

  async create(client, payment) {
    const { rows } = await client.query(
      `INSERT INTO payments (
        restaurant_id, branch_id, order_id, register_session_id, payment_number, method, status, amount,
        transaction_reference, gateway_reference, received_by, paid_at, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,COALESCE($12::timestamptz,NOW()),$13)
      RETURNING *`,
      [
        payment.restaurantId,
        payment.branchId,
        payment.orderId,
        payment.registerSessionId || null,
        payment.paymentNumber,
        payment.method,
        payment.status || 'PAID',
        payment.amount,
        payment.transactionReference || null,
        payment.gatewayReference || null,
        payment.receivedBy || null,
        payment.paidAt || null,
        payment.metadata || {}
      ]
    );
    return rows[0];
  },

  async lockPayment(client, { paymentId, restaurantId, branchId }) {
    const { rows } = await client.query(
      'SELECT * FROM payments WHERE id = $1 AND restaurant_id = $2 AND branch_id = $3 FOR UPDATE',
      [paymentId, restaurantId, branchId]
    );
    return rows[0] || null;
  }
};
