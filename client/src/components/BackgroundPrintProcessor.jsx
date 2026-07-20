import { useCallback, useEffect, useRef } from 'react';
import { printJobService, qzSecurityService } from '../api/services';
import { ORDERS_SYNCED_EVENT } from '../api/axios';
import { buildPrintHtmlForJob, createPrinterAdapter } from '../utils/printingService';
import {
  loadPrinterRoutes,
  PROCESS_PRINT_JOBS_EVENT,
  PRINT_JOB_RESULT_EVENT,
  systemPrinterNameForJob
} from '../utils/printStationRoutes';

const POLL_INTERVAL_MS = 1000;
const CONNECTION_RETRY_INTERVAL_MS = 15000;
const DIRECT_PRINT_GRACE_MS = 1500;
const clientId = `background-print-${Math.random().toString(36).slice(2)}`;

const notifyResult = (detail) => {
  window.dispatchEvent(new CustomEvent(PRINT_JOB_RESULT_EVENT, { detail }));
};

const BackgroundPrintProcessor = () => {
  const adapterRef = useRef(createPrinterAdapter());
  const runningRef = useRef(false);
  const processingRef = useRef(new Set());
  const lastConnectionAttemptRef = useRef(0);

  const connectPrinter = useCallback(async (force = false) => {
    const adapter = adapterRef.current;
    if (adapter.isConnected()) return true;

    const now = Date.now();
    if (!force && now - lastConnectionAttemptRef.current < CONNECTION_RETRY_INTERVAL_MS) return false;
    lastConnectionAttemptRef.current = now;

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
      await adapter.connect();
      return adapter.isConnected();
    } catch (_error) {
      return false;
    }
  }, []);

  const processPendingJobs = useCallback(async ({ forceConnect = false } = {}) => {
    const adapter = adapterRef.current;
    if (runningRef.current) return;

    const routes = loadPrinterRoutes();
    runningRef.current = true;
    try {
      if (!adapter.isConnected() && !(await connectPrinter(forceConnect))) return;

      const pending = await printJobService.pending({ status: 'PENDING', limit: 100 });
      const jobs = Array.isArray(pending) ? pending : [];

      for (const job of jobs) {
        // Give the order/cancellation screen the first chance to print and show
        // an immediate error. Older unclaimed jobs (including QR orders) are
        // then safely picked up by the background station.
        if (Date.now() - new Date(job.createdAt || 0).getTime() < DIRECT_PRINT_GRACE_MS) continue;

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
  }, [connectPrinter]);

  useEffect(() => {
    const processAutomatically = () => processPendingJobs();
    const processImmediately = () => processPendingJobs({ forceConnect: true });
    processAutomatically();
    const timer = window.setInterval(processAutomatically, POLL_INTERVAL_MS);
    window.addEventListener('focus', processImmediately);
    window.addEventListener('online', processImmediately);
    window.addEventListener(ORDERS_SYNCED_EVENT, processImmediately);
    window.addEventListener(PROCESS_PRINT_JOBS_EVENT, processImmediately);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', processImmediately);
      window.removeEventListener('online', processImmediately);
      window.removeEventListener(ORDERS_SYNCED_EVENT, processImmediately);
      window.removeEventListener(PROCESS_PRINT_JOBS_EVENT, processImmediately);
    };
  }, [processPendingJobs]);

  return null;
};

export default BackgroundPrintProcessor;
