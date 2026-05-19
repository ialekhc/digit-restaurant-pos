import { Router } from 'express';
import { changePassword, getProfile, login, register } from '../controllers/authController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.post('/register', authenticate, authorize(ROLES.ADMIN, ROLES.RESTAURANT_OWNER), register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);
router.put('/change-password', authenticate, changePassword);

export default router;
