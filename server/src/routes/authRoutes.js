import { Router } from 'express';
import { changePassword, getProfile, login, register } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/constants.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.post('/register', authenticate, requirePermission(PERMISSIONS.USER_CREATE), register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);
router.put('/change-password', authenticate, changePassword);

export default router;
