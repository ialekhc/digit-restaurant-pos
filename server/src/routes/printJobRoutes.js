import { Router } from 'express';
import {
  claimPrintJob,
  completePrintJob,
  failPrintJob,
  getPendingPrintJobs,
  retryPrintJobController
} from '../controllers/printJobController.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission } from '../middleware/permissions.js';

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

router.get('/pending', getPendingPrintJobs);
router.post('/:jobId/claim', claimPrintJob);
router.post('/:jobId/complete', completePrintJob);
router.post('/:jobId/fail', failPrintJob);
router.post('/:jobId/retry', retryPrintJobController);

export default router;
