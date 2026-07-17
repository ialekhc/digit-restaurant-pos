import crypto from 'crypto';
import { ApiError } from '../utils/ApiError.js';

const readSecret = (plainName, base64Name) => {
  const encoded = String(process.env[base64Name] || '').trim();
  if (encoded) return Buffer.from(encoded, 'base64').toString('utf8').trim();
  return String(process.env[plainName] || '').replace(/\\n/g, '\n').trim();
};

export const getQzSigningConfig = () => {
  const certificate = readSecret('QZ_DIGITAL_CERTIFICATE', 'QZ_DIGITAL_CERTIFICATE_BASE64');
  const privateKey = readSecret('QZ_PRIVATE_KEY', 'QZ_PRIVATE_KEY_BASE64');
  return {
    configured: Boolean(certificate && privateKey),
    certificate,
    privateKey
  };
};

export const signQzRequest = (request) => {
  const value = String(request || '');
  if (!value) throw new ApiError(400, 'QZ signing request is required');
  if (value.length > 1_000_000) throw new ApiError(413, 'QZ signing request is too large');

  const { configured, privateKey } = getQzSigningConfig();
  if (!configured) throw new ApiError(503, 'QZ request signing is not configured on the server');

  try {
    return crypto.sign('RSA-SHA512', Buffer.from(value, 'utf8'), privateKey).toString('base64');
  } catch (_error) {
    throw new ApiError(500, 'Unable to sign the QZ request; verify the configured private key');
  }
};
