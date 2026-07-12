import { Router } from 'express';
import {
  cancelOrder,
  createOrder,
  deleteOrder,
  getOrderById,
  getOrders,
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
router.patch('/:id/cancel', requireAnyPermission([PERMISSIONS.ORDER_CANCEL, PERMISSIONS.ORDER_VOID]), cancelOrder);

export default router;
