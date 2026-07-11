import { Router } from 'express';
import { createPayment, getPaymentById, getPayments } from '../controllers/paymentController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.BASIC_BILLING));

router.route('/').post(requirePermission(PERMISSIONS.PAYMENT_COLLECT), createPayment).get(requirePermission(PERMISSIONS.PAYMENT_VIEW), getPayments);
router.route('/:id').get(requirePermission(PERMISSIONS.PAYMENT_VIEW), getPaymentById);

export default router;
