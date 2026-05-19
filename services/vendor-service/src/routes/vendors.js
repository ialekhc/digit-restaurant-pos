import { Router } from 'express';
import {
  addSubscriptionPayment,
  createVendor,
  deleteSubscriptionPayment,
  deleteVendor,
  getSubscriptionOverview,
  getVendor,
  listVendors,
  updateSubscription,
  updateSubscriptionPayment,
  updateVendor
} from '../controllers/vendorController.js';
import { authenticate, authorizeSuperAdmin } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  parseAddPaymentBody,
  parseCreateVendorBody,
  parseListVendorsQuery,
  parseUpdatePaymentBody,
  parseUpdateSubscriptionBody,
  parseUpdateVendorBody
} from '../validators/vendorValidators.js';

const router = Router();

router.use(authenticate, authorizeSuperAdmin);

router.get('/overview', getSubscriptionOverview);

router
  .route('/')
  .get(validateRequest(parseListVendorsQuery), listVendors)
  .post(validateRequest(parseCreateVendorBody), createVendor);

router
  .route('/:id')
  .get(getVendor)
  .put(validateRequest(parseUpdateVendorBody), updateVendor)
  .delete(deleteVendor);

router.put('/:id/subscription', validateRequest(parseUpdateSubscriptionBody), updateSubscription);

router.post('/:id/subscription/payments', validateRequest(parseAddPaymentBody), addSubscriptionPayment);
router.put('/:id/subscription/payments/:paymentId', validateRequest(parseUpdatePaymentBody), updateSubscriptionPayment);
router.delete('/:id/subscription/payments/:paymentId', deleteSubscriptionPayment);

export default router;
