import { Router } from 'express';
import {
  createTable,
  deleteTable,
  getTables,
  transferTable,
  updateTable,
  updateTableStatus
} from '../controllers/tableController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.TABLE_MANAGEMENT));

router
  .route('/')
  .get(getTables)
  .post(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), createTable);

router.patch('/transfer', authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER), transferTable);

router
  .route('/:id')
  .put(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), updateTable)
  .delete(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), deleteTable);

router.patch('/:id/status', authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER, ROLES.WAITER), updateTableStatus);

export default router;
