import { Router } from 'express';
import {
  createMenuItem,
  deleteMenuItem,
  getMenuItemById,
  getMenuItems,
  updateMenuItem
} from '../controllers/menuItemController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { upload } from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.MENU_MANAGEMENT));

router
  .route('/')
  .get(getMenuItems)
  .post(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), upload.single('image'), createMenuItem);

router
  .route('/:id')
  .get(getMenuItemById)
  .put(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), upload.single('image'), updateMenuItem)
  .delete(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), deleteMenuItem);

export default router;
