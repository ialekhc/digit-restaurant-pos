import { printJobService, qzSecurityService } from '../api/services';
import { buildPrintHtmlForJob, createPrinterAdapter } from './printingService';
import {
  isReceiptJob,
  isStationKotJob,
  loadPrinterRoutes,
  releaseDirectPrintJob,
  reserveDirectPrintJobs,
  systemPrinterNameForJob
} from './printStationRoutes';

const clientId = `direct-print-${Math.random().toString(36).slice(2)}`;

const printJobsDirectly = async ({ jobs = [], predicate, emptyMessage }) => {
  const queuedJobs = Array.isArray(jobs) ? jobs.filter((job) => job?._id && predicate(job)) : [];
  if (!queuedJobs.length) {
    return { printedCount: 0, totalCount: 0, errorMessage: emptyMessage };
  }

  reserveDirectPrintJobs(queuedJobs);
  const adapter = createPrinterAdapter();
  try {
    if (!adapter.usesNativePrinting()) {
      const security = await qzSecurityService.status();
      if (security?.configured) {
        adapter.configureSecurity({
          getCertificate: () => qzSecurityService.certificate(),
          sign: (request) => qzSecurityService.sign(request)
        });
      }
    }
    if (!adapter.isConnected()) await adapter.connect();
    if (!adapter.isConnected()) {
      throw new Error('QZ Tray is not running. Start QZ Tray, then use Retry Print in Print Station.');
    }
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Unable to connect to the system printer.';
    queuedJobs.forEach((job) => releaseDirectPrintJob(job._id));
    return {
      printedCount: 0,
      totalCount: queuedJobs.length,
      errorMessage: message
    };
  }

  let printedCount = 0;
  const errors = [];
  const printerRoutes = loadPrinterRoutes();

  for (const queuedJob of queuedJobs) {
    let claimedJob = null;
    try {
      // Claim only when the adapter is ready, then print immediately. This
      // prevents jobs getting stuck PROCESSING after a connection failure.
      claimedJob = await printJobService.claim(queuedJob._id, { clientId });
      const printerName = systemPrinterNameForJob(claimedJob, printerRoutes).trim();
      if (!printerName) throw new Error(`No system printer is configured for ${claimedJob.station || 'this ticket'}.`);

      await adapter.printHtml({
        html: buildPrintHtmlForJob(claimedJob),
        printer: {
          ...(claimedJob.printer || {}),
          name: printerName,
          connectionType: 'QZ_TRAY'
        },
        job: claimedJob
      });
      await printJobService.complete(claimedJob._id);
      printedCount += 1;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Print failed';
      errors.push(message);
      if (claimedJob?._id) {
        try {
          await printJobService.fail(claimedJob._id, { errorMessage: message });
        } catch (_failError) {
          // Keep the original physical-print failure as the user-facing error.
        }
      }
    } finally {
      releaseDirectPrintJob(queuedJob._id);
    }
  }

  return {
    printedCount,
    totalCount: queuedJobs.length,
    errorMessage: [...new Set(errors)].join(' ')
  };
};

export const printCreatedOrderJobs = async (jobs = []) => printJobsDirectly({
  jobs,
  predicate: isStationKotJob,
  emptyMessage: 'No active printers are configured for this order.'
});

export const printReceiptJobs = async (jobs = []) => printJobsDirectly({
  jobs,
  predicate: isReceiptJob,
  emptyMessage: 'No receipt print job was created.'
});
