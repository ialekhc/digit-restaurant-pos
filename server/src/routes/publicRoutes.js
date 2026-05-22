import { Router } from 'express';
import { createQrOrder, getQrMenuByTable, getQrMetaByTable } from '../controllers/publicOrderController.js';

const router = Router();

router.get('/qr-menu/:tableId', getQrMenuByTable);
router.get('/qr-meta/:tableId', getQrMetaByTable);
router.post('/qr-menu/:tableId/orders', createQrOrder);

export default router;
