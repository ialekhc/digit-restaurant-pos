import { Router } from 'express';
import {
  createCustomer,
  deleteCustomer,
  getCustomerOrderHistory,
  getCustomers,
  updateCustomer
} from '../controllers/customerController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.CUSTOMER_MANAGEMENT));

router.route('/').get(requirePermission(PERMISSIONS.CUSTOMER_VIEW), getCustomers).post(requirePermission(PERMISSIONS.CUSTOMER_CREATE), createCustomer);

router
  .route('/:id')
  .put(requirePermission(PERMISSIONS.CUSTOMER_UPDATE), updateCustomer)
  .delete(requirePermission(PERMISSIONS.CUSTOMER_DELETE), deleteCustomer);

router.get('/:id/order-history', requirePermission(PERMISSIONS.CUSTOMER_VIEW), getCustomerOrderHistory);

export default router;
