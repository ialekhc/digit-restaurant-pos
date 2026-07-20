import { printJobService, qzSecurityService } from '../api/services';
import { buildPrintHtmlForJob, createPrinterAdapter } from './printingService';
import { loadPrinterRoutes, systemPrinterNameForJob } from './printStationRoutes';

const clientId = `create-order-${Math.random().toString(36).slice(2)}`;

export const printCreatedOrderJobs = async (jobs = []) => {
  const queuedJobs = Array.isArray(jobs) ? jobs.filter((job) => job?._id) : [];
  if (!queuedJobs.length) {
    return { printedCount: 0, totalCount: 0, errorMessage: 'No active printers are configured for this order.' };
  }

  const claimedJobs = [];
  const claimErrors = [];
  for (const job of queuedJobs) {
    try {
      claimedJobs.push(await printJobService.claim(job._id, { clientId }));
    } catch (error) {
      claimErrors.push(error.response?.data?.message || error.message || 'Unable to claim print job');
    }
  }

  if (!claimedJobs.length) {
    return {
      printedCount: 0,
      totalCount: queuedJobs.length,
      errorMessage: [...new Set(claimErrors)].join(' ') || 'Unable to claim KOT print jobs.'
    };
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
      throw new Error('QZ Tray is not running. Start QZ Tray, then use Retry Print in Print Station.');
    }
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Unable to connect to the system printer.';
    await Promise.allSettled(
      claimedJobs.map((job) => printJobService.fail(job._id, { errorMessage: message }))
    );
    return {
      printedCount: 0,
      totalCount: queuedJobs.length,
      errorMessage: message
    };
  }

  let printedCount = 0;
  const errors = [];
  const printerRoutes = loadPrinterRoutes();

  for (const claimedJob of claimedJobs) {
    try {
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
      try {
        await printJobService.fail(claimedJob._id, { errorMessage: message });
      } catch (_failError) {
        // Keep the original physical-print failure as the user-facing error.
      }
    }
  }

  return {
    printedCount,
    totalCount: queuedJobs.length,
    errorMessage: [...new Set([...claimErrors, ...errors])].join(' ')
  };
};
