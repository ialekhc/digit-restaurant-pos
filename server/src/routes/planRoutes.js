import { Router } from 'express';
import {
  getActivePlanController,
  getPlanCatalogController,
  updateActivePlanController
} from '../controllers/planController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate);

router.get('/catalog', getPlanCatalogController);
router.get('/active', getActivePlanController);
router.put('/active', authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN), updateActivePlanController);

export default router;

