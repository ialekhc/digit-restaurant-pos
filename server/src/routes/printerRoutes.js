import { Router } from 'express';
import { createPrinter, deletePrinter, getPrinters, testPrinter, updatePrinter } from '../controllers/printerController.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission } from '../middleware/permissions.js';

const router = Router();
const configurePermissions = [PERMISSIONS.PLATFORM_MANAGE, PERMISSIONS.SETTINGS_UPDATE, PERMISSIONS.RESTAURANT_SETTINGS_MANAGE];
const viewPermissions = [PERMISSIONS.PLATFORM_VIEW, PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.KITCHEN_VIEW_ORDERS, PERMISSIONS.PAYMENT_VIEW];

router.use(authenticate);
router.route('/')
  .get(requireAnyPermission(viewPermissions), getPrinters)
  .post(requireAnyPermission(configurePermissions), createPrinter);

router.route('/:printerId')
  .patch(requireAnyPermission(configurePermissions), updatePrinter)
  .delete(requireAnyPermission(configurePermissions), deletePrinter);

router.post('/:printerId/test', requireAnyPermission(configurePermissions), testPrinter);

export default router;
