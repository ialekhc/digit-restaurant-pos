import { Router } from 'express';
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventory,
  updateInventoryItem,
  updateStock
} from '../controllers/inventoryController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.INVENTORY_MANAGEMENT));

router
  .route('/')
  .get(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), getInventory)
  .post(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), createInventoryItem);

router
  .route('/:id')
  .put(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), updateInventoryItem)
  .delete(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), deleteInventoryItem);

router.patch('/:id/stock', authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), updateStock);

export default router;
