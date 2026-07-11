import { Router } from 'express';
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventory,
  updateInventoryItem,
  updateStock
} from '../controllers/inventoryController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.INVENTORY_MANAGEMENT));

router.route('/').get(requirePermission(PERMISSIONS.INVENTORY_VIEW), getInventory).post(requirePermission(PERMISSIONS.INVENTORY_MANAGE), createInventoryItem);

router
  .route('/:id')
  .put(requirePermission(PERMISSIONS.INVENTORY_MANAGE), updateInventoryItem)
  .delete(requirePermission(PERMISSIONS.INVENTORY_MANAGE), deleteInventoryItem);

router.patch('/:id/stock', requireAnyPermission([PERMISSIONS.INVENTORY_ADJUST, PERMISSIONS.INVENTORY_MANAGE]), updateStock);

export default router;
