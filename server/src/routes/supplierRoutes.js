import { Router } from 'express';
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier
} from '../controllers/supplierController.js';
import { authenticate } from '../middleware/auth.js';
import { featureGate } from '../middleware/featureGate.js';
import { FEATURE_KEYS } from '../config/planCatalog.js';
import { PERMISSIONS } from '../config/constants.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, featureGate(FEATURE_KEYS.SUPPLIER_MANAGEMENT));

router.route('/').get(requirePermission(PERMISSIONS.SUPPLIER_VIEW), getSuppliers).post(requirePermission(PERMISSIONS.SUPPLIER_CREATE), createSupplier);
router.route('/:id').put(requirePermission(PERMISSIONS.SUPPLIER_UPDATE), updateSupplier).delete(requirePermission(PERMISSIONS.SUPPLIER_DELETE), deleteSupplier);

export default router;
