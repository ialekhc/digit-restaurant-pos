import { Router } from 'express';
import {
  cancelOrder,
  cancelOrderItems,
  addOrderItems,
  createOrder,
  deleteOrder,
  getOrderById,
  getOrders,
  printAddedItems,
  printCancellation,
  printReceipt,
  printStationTickets,
  updateOrderItems,
  updateOrderStatus
} from '../controllers/orderController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.ORDER_HISTORY));

router
  .route('/')
  .get(requireAnyPermission([PERMISSIONS.ORDER_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS]), getOrders)
  .post(requirePermission(PERMISSIONS.ORDER_CREATE), createOrder);

router
  .route('/:id')
  .get(requireAnyPermission([PERMISSIONS.ORDER_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS]), getOrderById)
  .delete(requirePermission(PERMISSIONS.ORDER_DELETE), deleteOrder);

router.patch('/:id/status', requireAnyPermission([PERMISSIONS.ORDER_UPDATE, PERMISSIONS.KITCHEN_UPDATE_STATUS]), updateOrderStatus);
router.patch('/:id/items', requirePermission(PERMISSIONS.ORDER_UPDATE), updateOrderItems);
router.post('/:id/items', requirePermission(PERMISSIONS.ORDER_UPDATE), addOrderItems);
router.patch('/:id/cancel-items', requireAnyPermission([PERMISSIONS.ORDER_CANCEL, PERMISSIONS.ORDER_VOID]), cancelOrderItems);
router.patch('/:id/cancel', requireAnyPermission([PERMISSIONS.ORDER_CANCEL, PERMISSIONS.ORDER_VOID]), cancelOrder);
router.post('/:orderId/print-station-tickets', requireAnyPermission([PERMISSIONS.ORDER_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS]), printStationTickets);
router.post('/:orderId/print-added-items', requireAnyPermission([PERMISSIONS.ORDER_UPDATE, PERMISSIONS.KITCHEN_UPDATE_STATUS]), printAddedItems);
router.post('/:orderId/print-cancellation', requireAnyPermission([PERMISSIONS.ORDER_CANCEL, PERMISSIONS.ORDER_VOID]), printCancellation);
router.post('/:orderId/print-receipt', requireAnyPermission([PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_COLLECT]), printReceipt);

export default router;
