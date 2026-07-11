import { Router } from 'express';
import { createPurchase, getPurchases } from '../controllers/purchaseController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.INVENTORY_MANAGEMENT));

router.route('/').get(requirePermission(PERMISSIONS.PURCHASE_VIEW), getPurchases).post(requirePermission(PERMISSIONS.PURCHASE_CREATE), createPurchase);

export default router;
