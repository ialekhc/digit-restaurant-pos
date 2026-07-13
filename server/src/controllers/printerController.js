import { Printer, PRINTER_CONNECTION_TYPES, PRINTER_PURPOSES } from '../models/Printer.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildTenantScopedQuery, resolveTenantScope, withTenantFields } from '../services/tenantScopeService.js';
import { createTestPrintJob } from '../services/printService.js';

const asPurpose = (value) => String(value || '').trim().toUpperCase();

const validatePrinterPayload = (body = {}, partial = false) => {
  const payload = {};

  if (!partial || typeof body.name !== 'undefined') {
    payload.name = String(body.name || '').trim();
    if (!payload.name) throw new ApiError(400, 'Printer name is required');
  }

  if (!partial || typeof body.purpose !== 'undefined') {
    payload.purpose = asPurpose(body.purpose);
    if (!PRINTER_PURPOSES.includes(payload.purpose)) {
      throw new ApiError(400, `Printer purpose must be one of: ${PRINTER_PURPOSES.join(', ')}`);
    }
  }

  if (!partial || typeof body.connectionType !== 'undefined') {
    payload.connectionType = String(body.connectionType || 'SYSTEM').trim().toUpperCase();
    if (!PRINTER_CONNECTION_TYPES.includes(payload.connectionType)) {
      throw new ApiError(400, `Connection type must be one of: ${PRINTER_CONNECTION_TYPES.join(', ')}`);
    }
  }

  ['printerSystemName', 'ipAddress', 'port'].forEach((field) => {
    if (typeof body[field] !== 'undefined') payload[field] = String(body[field] || '').trim();
  });

  if (typeof body.paperWidthMm !== 'undefined') {
    const width = Number(body.paperWidthMm);
    if (!Number.isFinite(width) || width <= 0) throw new ApiError(400, 'Paper width must be greater than zero');
    payload.paperWidthMm = width;
  }

  if (typeof body.copies !== 'undefined') {
    const copies = Number(body.copies);
    if (!Number.isInteger(copies) || copies <= 0) throw new ApiError(400, 'Copies must be a positive integer');
    payload.copies = copies;
  }

  if (typeof body.isActive !== 'undefined') {
    payload.isActive = typeof body.isActive === 'string' ? body.isActive === 'true' : Boolean(body.isActive);
  }

  if (typeof body.lastStatus !== 'undefined') payload.lastStatus = String(body.lastStatus || '').trim().toUpperCase();
  if (typeof body.lastError !== 'undefined') payload.lastError = String(body.lastError || '').trim();

  return payload;
};

export const getPrinters = asyncHandler(async (req, res) => {
  const { purpose = '' } = req.query;
  const baseQuery = purpose ? { purpose: asPurpose(purpose) } : {};
  const data = await Printer.find(await buildTenantScopedQuery(req.user, baseQuery)).sort({ purpose: 1, createdAt: 1 });
  res.json({ data });
});

export const createPrinter = asyncHandler(async (req, res) => {
  const scope = await resolveTenantScope(req.user);
  if (!scope.platform && !scope.restaurantId) throw new ApiError(403, 'Restaurant scope is required');

  const payload = validatePrinterPayload(req.body);
  const restaurantId = scope.platform && req.body.restaurantId ? String(req.body.restaurantId) : scope.restaurantId;
  if (!restaurantId) throw new ApiError(400, 'restaurantId is required for platform printer creation');

  const existing = await Printer.findOne({ restaurantId, purpose: payload.purpose });
  if (existing) throw new ApiError(409, `${payload.purpose} printer is already configured for this restaurant`);

  const data = await Printer.create(await withTenantFields(req.user, { ...payload, restaurantId }));
  res.status(201).json({ data });
});

export const updatePrinter = asyncHandler(async (req, res) => {
  const printer = await Printer.findOne(await buildTenantScopedQuery(req.user, { _id: req.params.printerId }));
  if (!printer) throw new ApiError(404, 'Printer not found');

  const payload = validatePrinterPayload(req.body, true);
  if (payload.purpose && payload.purpose !== printer.purpose) {
    const duplicate = await Printer.findOne({ restaurantId: printer.restaurantId, purpose: payload.purpose });
    if (duplicate && String(duplicate._id) !== String(printer._id)) {
      throw new ApiError(409, `${payload.purpose} printer is already configured for this restaurant`);
    }
  }

  Object.assign(printer, payload);
  await printer.save();
  res.json({ data: printer });
});

export const deletePrinter = asyncHandler(async (req, res) => {
  const printer = await Printer.findOne(await buildTenantScopedQuery(req.user, { _id: req.params.printerId }));
  if (!printer) throw new ApiError(404, 'Printer not found');
  await printer.deleteOne();
  res.json({ message: 'Printer deleted' });
});

export const testPrinter = asyncHandler(async (req, res) => {
  const printer = await Printer.findOne(await buildTenantScopedQuery(req.user, { _id: req.params.printerId }));
  if (!printer) throw new ApiError(404, 'Printer not found');
  const data = await createTestPrintJob({ user: req.user, printer });
  res.status(201).json({ data });
});
