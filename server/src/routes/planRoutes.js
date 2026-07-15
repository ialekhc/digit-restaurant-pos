import { Router } from 'express';
import {
  getActivePlanController,
  getPlanCatalogController,
  updateActivePlanController,
  updatePlanCatalogController
} from '../controllers/planController.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/catalog', requireAnyPermission([PERMISSIONS.SUBSCRIPTION_VIEW, PERMISSIONS.PLATFORM_VIEW, PERMISSIONS.SETTINGS_VIEW]), getPlanCatalogController);
router.put('/catalog', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), updatePlanCatalogController);
router.get('/active', getActivePlanController);
router.put('/active', requireAnyPermission([PERMISSIONS.SUBSCRIPTION_MANAGE, PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE]), updateActivePlanController);

export default router;
