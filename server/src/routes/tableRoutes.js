import { Router } from 'express';
import {
  createTable,
  deleteTable,
  getTables,
  transferTable,
  updateTable,
  updateTableStatus
} from '../controllers/tableController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.TABLE_MANAGEMENT));

router.route('/').get(requirePermission(PERMISSIONS.TABLE_VIEW), getTables).post(requirePermission(PERMISSIONS.TABLE_MANAGE), createTable);
router.patch('/transfer', requirePermission(PERMISSIONS.ORDER_TRANSFER), transferTable);

router
  .route('/:id')
  .put(requirePermission(PERMISSIONS.TABLE_MANAGE), updateTable)
  .delete(requirePermission(PERMISSIONS.TABLE_MANAGE), deleteTable);

router.patch('/:id/status', requirePermission(PERMISSIONS.TABLE_ASSIGN), updateTableStatus);

export default router;
