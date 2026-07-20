export const PRINTER_ROUTES_KEY = 'rms_print_station_routes_v1';
export const AUTO_PROCESS_PRINT_JOBS_KEY = 'rms_print_station_auto_process_v1';
export const PRINT_JOB_RESULT_EVENT = 'rms:print-job-result';
export const PROCESS_PRINT_JOBS_EVENT = 'rms:process-print-jobs';

export const isCounterOrderBillJob = (job = {}) => job.documentType === 'COUNTER_ORDER_BILL';

export const isStationKotJob = (job = {}) => (
  ['KITCHEN', 'BAR', 'SMOKE'].includes(String(job.station || '').toUpperCase()) &&
  job.documentType !== 'COUNTER_ORDER_BILL'
);

export const requestPrintJobProcessing = () => {
  window.dispatchEvent(new CustomEvent(PROCESS_PRINT_JOBS_EVENT));
};

export const loadPrinterRoutes = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(PRINTER_ROUTES_KEY) || '{}');
    return {
      kitchen: stored.kitchen || '',
      bar: stored.bar || stored.reception || '',
      smoke: stored.smoke || stored.reception || '',
      counter: stored.counter || stored.reception || ''
    };
  } catch (_error) {
    return { kitchen: '', bar: '', smoke: '', counter: '' };
  }
};

export const savePrinterRoutes = (routes) => {
  localStorage.setItem(PRINTER_ROUTES_KEY, JSON.stringify({
    kitchen: routes?.kitchen || '',
    bar: routes?.bar || '',
    smoke: routes?.smoke || '',
    counter: routes?.counter || ''
  }));
};

export const shouldAutoProcessPrintJobs = () => localStorage.getItem(AUTO_PROCESS_PRINT_JOBS_KEY) !== 'false';

export const setAutoProcessPrintJobs = (enabled) => {
  localStorage.setItem(AUTO_PROCESS_PRINT_JOBS_KEY, enabled ? 'true' : 'false');
};

export const routeKeyForJob = (job = {}) => {
  if (job.documentType === 'TEST_PRINT') return '';
  if (job.station === 'KITCHEN') return 'kitchen';
  if (job.station === 'BAR') return 'bar';
  if (job.station === 'SMOKE') return 'smoke';
  if (job.station === 'COUNTER') return 'counter';
  return '';
};

export const systemPrinterNameForJob = (job, routes) => {
  const routeKey = routeKeyForJob(job);
  if (routeKey && routes?.[routeKey]) return routes[routeKey];
  return job.printer?.printerSystemName || job.printer?.name || '';
};
