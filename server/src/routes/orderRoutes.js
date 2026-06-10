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
  .get(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER, ROLES.WAITER, ROLES.KITCHEN, ROLES.BARISTA), getOrders)
  .post(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER), createOrder);

router
  .route('/:id')
  .get(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER, ROLES.WAITER, ROLES.KITCHEN, ROLES.BARISTA), getOrderById);

router.patch('/:id/status', authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER, ROLES.KITCHEN, ROLES.BARISTA), updateOrderStatus);
router.patch('/:id/cancel', authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER, ROLES.CASHIER), cancelOrder);

export default router;
