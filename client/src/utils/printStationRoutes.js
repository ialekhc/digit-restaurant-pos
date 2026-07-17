export const PRINTER_ROUTES_KEY = 'rms_print_station_routes_v1';
export const AUTO_PROCESS_PRINT_JOBS_KEY = 'rms_print_station_auto_process_v1';
export const PRINT_JOB_RESULT_EVENT = 'rms:print-job-result';
export const PROCESS_PRINT_JOBS_EVENT = 'rms:process-print-jobs';

export const requestPrintJobProcessing = () => {
  window.dispatchEvent(new CustomEvent(PROCESS_PRINT_JOBS_EVENT));
};

export const loadPrinterRoutes = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(PRINTER_ROUTES_KEY) || '{}');
    return { kitchen: stored.kitchen || '', reception: stored.reception || '' };
  } catch (_error) {
    return { kitchen: '', reception: '' };
  }
};

export const savePrinterRoutes = (routes) => {
  localStorage.setItem(PRINTER_ROUTES_KEY, JSON.stringify({
    kitchen: routes?.kitchen || '',
    reception: routes?.reception || ''
  }));
};

export const shouldAutoProcessPrintJobs = () => localStorage.getItem(AUTO_PROCESS_PRINT_JOBS_KEY) !== 'false';

export const setAutoProcessPrintJobs = (enabled) => {
  localStorage.setItem(AUTO_PROCESS_PRINT_JOBS_KEY, enabled ? 'true' : 'false');
};

export const routeKeyForJob = (job = {}) => {
  if (job.documentType === 'TEST_PRINT') return '';
  if (job.station === 'KITCHEN') return 'kitchen';
  if (['BAR', 'SMOKE', 'COUNTER'].includes(job.station)) return 'reception';
  return '';
};

export const systemPrinterNameForJob = (job, routes) => {
  const routeKey = routeKeyForJob(job);
  if (routeKey) return routes?.[routeKey] || '';
  return job.printer?.name || job.printer?.printerSystemName || '';
};
