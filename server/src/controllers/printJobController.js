import { PrintJob } from '../models/PrintJob.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { buildTenantScopedQuery } from '../services/tenantScopeService.js';
import { markPrintJobFailed, markPrintJobPrinted, retryPrintJob } from '../services/printService.js';

const populateJob = (query) => query.populate('printer').populate('order').populate('payment');

const findScopedJob = async (req, id) => {
  const query = await buildTenantScopedQuery(req.user, { _id: id });
  return populateJob(PrintJob.findOne(query));
};

export const getPendingPrintJobs = asyncHandler(async (req, res) => {
  const { status = 'PENDING', purpose = '', limit = 50 } = req.query;
  const baseQuery = status ? { status: String(status).toUpperCase() } : {};
  if (purpose) baseQuery.station = String(purpose).toUpperCase();

  const data = await populateJob(
    PrintJob.find(await buildTenantScopedQuery(req.user, baseQuery))
      .sort({ createdAt: 1 })
      .limit(Math.min(Number(limit) || 50, 100))
  );
  res.json({ data });
});

export const claimPrintJob = asyncHandler(async (req, res) => {
  const job = await findScopedJob(req, req.params.jobId);
  if (!job) throw new ApiError(404, 'Print job not found');
  if (job.status === 'PRINTED') throw new ApiError(409, 'Printed jobs cannot be claimed');
  if (job.status === 'PROCESSING') throw new ApiError(409, 'Print job is already being processed');
  if (!['PENDING', 'FAILED'].includes(job.status)) throw new ApiError(409, `Cannot claim ${job.status} print job`);

  job.status = 'PROCESSING';
  job.attempts = Number(job.attempts || 0) + 1;
  job.claimedAt = new Date().toISOString();
  job.claimedBy = String(req.body?.clientId || req.user?._id || 'print-station');
  job.errorMessage = '';
  await job.save();

  res.json({ data: await findScopedJob(req, job._id) });
});

export const completePrintJob = asyncHandler(async (req, res) => {
  const job = await findScopedJob(req, req.params.jobId);
  if (!job) throw new ApiError(404, 'Print job not found');
  const data = await markPrintJobPrinted(job);
  res.json({ data });
});

export const failPrintJob = asyncHandler(async (req, res) => {
  const job = await findScopedJob(req, req.params.jobId);
  if (!job) throw new ApiError(404, 'Print job not found');
  const data = await markPrintJobFailed(job, req.body?.errorMessage || req.body?.message || 'Print failed');
  res.json({ data });
});

export const retryPrintJobController = asyncHandler(async (req, res) => {
  const job = await findScopedJob(req, req.params.jobId);
  if (!job) throw new ApiError(404, 'Print job not found');
  const data = await retryPrintJob(job);
  res.json({ data });
});
