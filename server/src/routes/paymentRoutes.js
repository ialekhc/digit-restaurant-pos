import { Router } from 'express';
import { createPayment, getPaymentById, getPayments } from '../controllers/paymentController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.BASIC_BILLING));

router
  .route('/')
  .post(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER), createPayment)
  .get(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER), getPayments);

router
  .route('/:id')
  .get(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.CASHIER), getPaymentById);

export default router;
