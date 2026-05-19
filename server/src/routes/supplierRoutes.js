import { Router } from 'express';
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier
} from '../controllers/supplierController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { ROLES } from '../config/constants.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';

const router = Router();

router.use(
  authenticate,
  featureGate(FEATURE_KEYS.SUPPLIER_MANAGEMENT),
  authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER, ROLES.MANAGER)
);

router.route('/').get(getSuppliers).post(createSupplier);
router.route('/:id').put(updateSupplier).delete(deleteSupplier);

export default router;
