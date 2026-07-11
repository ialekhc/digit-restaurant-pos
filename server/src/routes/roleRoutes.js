import { Router } from 'express';
import { getRolePermissions, getRoles } from '../controllers/accessController.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, requireAnyPermission([PERMISSIONS.USER_VIEW, PERMISSIONS.USER_ASSIGN_ROLE, PERMISSIONS.PLATFORM_VIEW]));
router.get('/', getRoles);
router.get('/:role/permissions', getRolePermissions);

export default router;
