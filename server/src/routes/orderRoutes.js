import { Router } from 'express';
import {
  cancelOrder,
  createOrder,
  getOrderById,
  getOrders,
  updateOrderStatus
} from '../controllers/orderController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.ORDER_HISTORY));

router
  .route('/')
  .get(authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER, ROLES.WAITER, ROLES.KITCHEN), getOrders)
  .post(authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAITER), createOrder);

router
  .route('/:id')
  .get(authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER, ROLES.WAITER, ROLES.KITCHEN), getOrderById);

router.patch('/:id/status', authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAITER, ROLES.KITCHEN), updateOrderStatus);
router.patch('/:id/cancel', authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAITER, ROLES.CASHIER), cancelOrder);

export default router;
