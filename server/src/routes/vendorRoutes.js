import { Router } from 'express';
import {
  addVendorSubscriptionPayment,
  createVendor,
  deleteVendor,
  deleteVendorSubscriptionPayment,
  getVendorById,
  getVendors,
  updateVendor,
  updateVendorSubscription,
  updateVendorSubscriptionPayment,
  vendorSubscriptionOverview
} from '../controllers/vendorController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = Router();

router.use(authenticate, authorize(ROLES.SUPER_ADMIN));

router.get('/overview', vendorSubscriptionOverview);

router
  .route('/')
  .get(getVendors)
  .post(createVendor);

router
  .route('/:id')
  .get(getVendorById)
  .put(updateVendor)
  .delete(deleteVendor);

router.put('/:id/subscription', updateVendorSubscription);

router.post('/:id/subscription/payments', addVendorSubscriptionPayment);
router.put('/:id/subscription/payments/:paymentId', updateVendorSubscriptionPayment);
router.delete('/:id/subscription/payments/:paymentId', deleteVendorSubscriptionPayment);

export default router;
