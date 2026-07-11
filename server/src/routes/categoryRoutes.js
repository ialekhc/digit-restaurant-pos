import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory
} from '../controllers/categoryController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.CATEGORY_MANAGEMENT));

router.route('/').get(requirePermission(PERMISSIONS.MENU_VIEW), getCategories).post(requirePermission(PERMISSIONS.MENU_CREATE), createCategory);

router
  .route('/:id')
  .put(requirePermission(PERMISSIONS.MENU_UPDATE), updateCategory)
  .delete(requirePermission(PERMISSIONS.MENU_DELETE), deleteCategory);

export default router;
