import { Router } from 'express';
import { getQzCertificate, getQzSecurityStatus, signQzMessage } from '../controllers/qzSecurityController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAnyPermission } from '../middleware/permissions.js';
import { PERMISSIONS } from '../config/constants.js';

const router = Router();
const printStationPermissions = [
  PERMISSIONS.PLATFORM_MANAGE,
  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.KITCHEN_VIEW_ORDERS,
  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.ORDER_VIEW,
  PERMISSIONS.ORDER_CREATE
];

router.use(authenticate, requireAnyPermission(printStationPermissions));
router.get('/status', getQzSecurityStatus);
router.get('/certificate', getQzCertificate);
router.post('/sign', signQzMessage);

export default router;
