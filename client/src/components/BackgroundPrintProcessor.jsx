import { useCallback, useEffect, useRef } from 'react';
import { printJobService } from '../api/services';
import { buildPrintHtmlForJob, createPrinterAdapter } from '../utils/printingService';
import {
  loadPrinterRoutes,
  PRINT_JOB_RESULT_EVENT,
  shouldAutoProcessPrintJobs,
  systemPrinterNameForJob
} from '../utils/printStationRoutes';

const POLL_INTERVAL_MS = 1500;
const clientId = `background-print-${Math.random().toString(36).slice(2)}`;

const notifyResult = (detail) => {
  window.dispatchEvent(new CustomEvent(PRINT_JOB_RESULT_EVENT, { detail }));
};

const BackgroundPrintProcessor = () => {
  const adapterRef = useRef(createPrinterAdapter());
  const runningRef = useRef(false);
  const processingRef = useRef(new Set());

  const processPendingJobs = useCallback(async () => {
    const adapter = adapterRef.current;
    if (runningRef.current || !adapter.isConnected() || !shouldAutoProcessPrintJobs()) return;

    runningRef.current = true;
    try {
      const routes = loadPrinterRoutes();
      const pending = await printJobService.pending({ status: 'PENDING', limit: 100 });
      const jobs = Array.isArray(pending) ? pending : [];

      for (const job of jobs) {
        const id = job._id;
        const printerName = systemPrinterNameForJob(job, routes);
        if (!id || !printerName || processingRef.current.has(id)) continue;

        processingRef.current.add(id);
        let claimed = false;
        try {
          const printJob = await printJobService.claim(id, { clientId });
          claimed = true;
          const html = buildPrintHtmlForJob(printJob);
          const physicalPrinter = {
            ...(printJob.printer || {}),
            name: printerName,
            connectionType: 'QZ_TRAY'
          };
          await adapter.printHtml({ html, printer: physicalPrinter, job: printJob });
          const completed = await printJobService.complete(id);
          notifyResult({ job: completed, status: 'PRINTED' });
        } catch (error) {
          const message = error.response?.data?.message || error.message || 'Print failed';
          let failedJob = job;
          if (claimed) {
            try {
              failedJob = await printJobService.fail(id, { errorMessage: message });
            } catch (_failError) {
              // Preserve the original print error for the Print Station UI.
            }
          }
          notifyResult({ job: failedJob, status: 'FAILED', errorMessage: message });
        } finally {
          processingRef.current.delete(id);
        }
      }
    } catch (_error) {
      // The visible Print Station page handles API errors. Background polling
      // stays quiet on pages where the current user cannot view print jobs.
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    processPendingJobs();
    const timer = window.setInterval(processPendingJobs, POLL_INTERVAL_MS);
    window.addEventListener('focus', processPendingJobs);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', processPendingJobs);
    };
  }, [processPendingJobs]);

  return null;
};

export default BackgroundPrintProcessor;
