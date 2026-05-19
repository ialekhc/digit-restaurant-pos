import { Router } from 'express';
import {
  createCustomer,
  deleteCustomer,
  getCustomerOrderHistory,
  getCustomers,
  updateCustomer
} from '../controllers/customerController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.CUSTOMER_MANAGEMENT));

router
  .route('/')
  .get(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER, ROLES.CASHIER), getCustomers)
  .post(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER, ROLES.CASHIER), createCustomer);

router
  .route('/:id')
  .put(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER, ROLES.CASHIER), updateCustomer)
  .delete(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), deleteCustomer);

router.get(
  '/:id/order-history',
  authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER, ROLES.CASHIER),
  getCustomerOrderHistory
);

export default router;
