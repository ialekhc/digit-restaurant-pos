import { Router } from 'express';
import { getPermissions, getPermissionRegistrySummary } from '../controllers/accessController.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate);
router.get('/', requireAnyPermission([PERMISSIONS.USER_VIEW, PERMISSIONS.PLATFORM_VIEW, PERMISSIONS.SETTINGS_VIEW]), getPermissions);
router.get('/summary', requireAnyPermission([PERMISSIONS.USER_VIEW, PERMISSIONS.PLATFORM_VIEW]), getPermissionRegistrySummary);

export default router;
