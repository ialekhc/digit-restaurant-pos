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
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate, requireAnyPermission([PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE, PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE]));

router.get('/overview', vendorSubscriptionOverview);

router.route('/').get(getVendors).post(requirePermission(PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE), createVendor);
router
  .route('/:id')
  .get(getVendorById)
  .put(requirePermission(PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE), updateVendor)
  .delete(requirePermission(PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE), deleteVendor);

router.put('/:id/subscription', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), updateVendorSubscription);
router.post('/:id/subscription/payments', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), addVendorSubscriptionPayment);
router.put('/:id/subscription/payments/:paymentId', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), updateVendorSubscriptionPayment);
router.delete('/:id/subscription/payments/:paymentId', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), deleteVendorSubscriptionPayment);

export default router;
