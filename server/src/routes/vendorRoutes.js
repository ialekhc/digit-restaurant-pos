import { Router } from 'express';
import {
  addVendorSubscriptionPayment,
  createVendor,
  deleteVendor,
  deleteVendorSubscriptionPayment,
  getMyVendorSubscription,
  getVendorById,
  getVendors,
  updateVendor,
  updateVendorSubscription,
  updateVendorSubscriptionStatus,
  updateVendorSubscriptionPayment,
  vendorSubscriptionOverview
} from '../controllers/vendorController.js';
import { authenticate } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/constants.js';
import { requireAnyPermission, requirePermission } from '../middleware/permissions.js';

const router = Router();

router.use(authenticate);

const requirePlatformVendorAccess = requireAnyPermission([
  PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE,
  PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE
]);

router.get('/my-subscription', requirePermission(PERMISSIONS.SUBSCRIPTION_VIEW), getMyVendorSubscription);
router.get('/overview', requirePlatformVendorAccess, vendorSubscriptionOverview);

router
  .route('/')
  .get(requirePlatformVendorAccess, getVendors)
  .post(requirePermission(PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE), createVendor);
router
  .route('/:id')
  .get(requirePlatformVendorAccess, getVendorById)
  .put(requirePermission(PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE), updateVendor)
  .delete(requirePermission(PERMISSIONS.PLATFORM_RESTAURANTS_MANAGE), deleteVendor);

router.put('/:id/subscription', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), updateVendorSubscription);
router.post('/:id/subscription/:action', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), updateVendorSubscriptionStatus);
router.post('/:id/subscription/payments', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), addVendorSubscriptionPayment);
router.put('/:id/subscription/payments/:paymentId', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), updateVendorSubscriptionPayment);
router.delete('/:id/subscription/payments/:paymentId', requirePermission(PERMISSIONS.PLATFORM_SUBSCRIPTIONS_MANAGE), deleteVendorSubscriptionPayment);

export default router;
