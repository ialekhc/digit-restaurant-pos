import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendOk } from '../utils/httpResponse.js';
import { vendorService } from '../services/vendorService.js';

export const listVendors = asyncHandler(async (req, res) => {
  const data = await vendorService.list(req.validated);
  return sendOk(res, data);
});

export const getVendor = asyncHandler(async (req, res) => {
  const data = await vendorService.getById(req.params.id);
  return sendOk(res, data);
});

export const createVendor = asyncHandler(async (req, res) => {
  const data = await vendorService.create(req.validated, req.user?.id);
  return sendCreated(res, data);
});

export const updateVendor = asyncHandler(async (req, res) => {
  const data = await vendorService.update(req.params.id, req.validated);
  return sendOk(res, data);
});

export const deleteVendor = asyncHandler(async (req, res) => {
  await vendorService.remove(req.params.id);
  return sendOk(res, null, 'Vendor deleted');
});

export const updateSubscription = asyncHandler(async (req, res) => {
  const data = await vendorService.updateSubscription(req.params.id, req.validated);
  return sendOk(res, data);
});

export const addSubscriptionPayment = asyncHandler(async (req, res) => {
  const data = await vendorService.addSubscriptionPayment(req.params.id, req.validated);
  return sendCreated(res, data);
});

export const updateSubscriptionPayment = asyncHandler(async (req, res) => {
  const data = await vendorService.updateSubscriptionPayment(req.params.id, req.params.paymentId, req.validated);
  return sendOk(res, data);
});

export const deleteSubscriptionPayment = asyncHandler(async (req, res) => {
  const data = await vendorService.deleteSubscriptionPayment(req.params.id, req.params.paymentId);
  return sendOk(res, data);
});

export const getSubscriptionOverview = asyncHandler(async (_req, res) => {
  const data = await vendorService.getSubscriptionOverview();
  return sendOk(res, data);
});
