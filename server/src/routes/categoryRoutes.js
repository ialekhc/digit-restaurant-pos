import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory
} from '../controllers/categoryController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.CATEGORY_MANAGEMENT));

router
  .route('/')
  .get(getCategories)
  .post(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), createCategory);

router
  .route('/:id')
  .put(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), updateCategory)
  .delete(authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER), deleteCategory);

export default router;
