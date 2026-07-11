import { Router } from 'express';
import {
  createMenuItem,
  deleteMenuItem,
  getMenuItemById,
  getMenuItems,
  importMenuItems,
  updateMenuItem
} from '../controllers/menuItemController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { upload } from '../middleware/upload.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.MENU_MANAGEMENT));

router
  .route('/')
  .get(requirePermission(PERMISSIONS.MENU_VIEW), getMenuItems)
  .post(requirePermission(PERMISSIONS.MENU_CREATE), upload.single('image'), createMenuItem);

router.post('/import', requirePermission(PERMISSIONS.MENU_CREATE), importMenuItems);

router
  .route('/:id')
  .get(requirePermission(PERMISSIONS.MENU_VIEW), getMenuItemById)
  .put(requirePermission(PERMISSIONS.MENU_UPDATE), upload.single('image'), updateMenuItem)
  .delete(requirePermission(PERMISSIONS.MENU_DELETE), deleteMenuItem);

export default router;
