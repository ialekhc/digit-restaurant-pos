import { Router } from 'express';
import { getMyAccessScope, getMyPermissions } from '../controllers/accessController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.get('/permissions', getMyPermissions);
router.get('/access-scope', getMyAccessScope);

export default router;
