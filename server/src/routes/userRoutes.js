import { Router } from 'express';
import {
  assignUserRole,
  createUser,
  deleteUser,
  getUserAccess,
  getUserById,
  getUsers,
  updateUserApprovalLimits,
  updateUserBranchAccess,
  updateUserPermissions,
  updateUser
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate);

router.route('/').get(requirePermission(PERMISSIONS.USER_VIEW), getUsers).post(requirePermission(PERMISSIONS.USER_CREATE), createUser);
router.get('/:id/access', requirePermission(PERMISSIONS.USER_VIEW), getUserAccess);
router.post('/:id/roles', requirePermission(PERMISSIONS.USER_ASSIGN_ROLE), assignUserRole);
router.patch('/:id/roles', requirePermission(PERMISSIONS.USER_ASSIGN_ROLE), assignUserRole);
router.patch('/:id/permissions', requirePermission(PERMISSIONS.USER_ASSIGN_ROLE), updateUserPermissions);
router.patch('/:id/branch-access', requirePermission(PERMISSIONS.USER_ASSIGN_BRANCH), updateUserBranchAccess);
router.patch('/:id/approval-limits', requireAnyPermission([PERMISSIONS.USER_UPDATE, PERMISSIONS.DISCOUNT_MANAGE]), updateUserApprovalLimits);
router
  .route('/:id')
  .get(requirePermission(PERMISSIONS.USER_VIEW), getUserById)
  .put(requirePermission(PERMISSIONS.USER_UPDATE), updateUser)
  .delete(requirePermission(PERMISSIONS.USER_DEACTIVATE), deleteUser);

export default router;
