import { printJobService, qzSecurityService } from '../api/services';
import { buildPrintHtmlForJob, createPrinterAdapter } from './printingService';

const clientId = `create-order-${Math.random().toString(36).slice(2)}`;

const configuredPrinterName = (job = {}) => (
  job.printer?.printerSystemName || job.printer?.name || ''
).trim();

export const printCreatedOrderJobs = async (jobs = []) => {
  const queuedJobs = Array.isArray(jobs) ? jobs.filter((job) => job?._id) : [];
  if (!queuedJobs.length) {
    return { printedCount: 0, totalCount: 0, errorMessage: 'No active printers are configured for this order.' };
  }

  const adapter = createPrinterAdapter();
  try {
    const security = await qzSecurityService.status();
    if (security?.configured) {
      adapter.configureSecurity({
        getCertificate: () => qzSecurityService.certificate(),
        sign: (request) => qzSecurityService.sign(request)
      });
    }
    if (!adapter.isConnected()) await adapter.connect();
    if (!adapter.isConnected()) {
      throw new Error('QZ Tray is not running. Start QZ Tray and create the order again to print automatically.');
    }
  } catch (error) {
    return {
      printedCount: 0,
      totalCount: queuedJobs.length,
      errorMessage: error.response?.data?.message || error.message || 'Unable to connect to the system printer.'
    };
  }

  let printedCount = 0;
  const errors = [];

  for (const job of queuedJobs) {
    let claimed = false;
    try {
      const claimedJob = await printJobService.claim(job._id, { clientId });
      claimed = true;
      const printerName = configuredPrinterName(claimedJob);
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
      await printJobService.complete(job._id);
      printedCount += 1;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Print failed';
      errors.push(message);
      if (claimed) {
        try {
          await printJobService.fail(job._id, { errorMessage: message });
        } catch (_failError) {
          // Keep the original physical-print failure as the user-facing error.
        }
      }
    }
  }

  return {
    printedCount,
    totalCount: queuedJobs.length,
    errorMessage: errors.length ? [...new Set(errors)].join(' ') : ''
  };
};
