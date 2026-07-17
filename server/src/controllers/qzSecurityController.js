import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { getQzSigningConfig, signQzRequest } from '../services/qzSecurityService.js';

export const getQzSecurityStatus = asyncHandler(async (_req, res) => {
  const { configured } = getQzSigningConfig();
  res.json({ data: { configured, algorithm: 'SHA512' } });
});

export const getQzCertificate = asyncHandler(async (_req, res) => {
  const { configured, certificate } = getQzSigningConfig();
  if (!configured) throw new ApiError(503, 'QZ request signing is not configured on the server');
  res.json({ data: { certificate } });
});

export const signQzMessage = asyncHandler(async (req, res) => {
  const signature = signQzRequest(req.body?.request);
  res.json({ data: { signature } });
});
