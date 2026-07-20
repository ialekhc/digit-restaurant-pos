import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { printJobService, qzSecurityService } from '../api/services';
import Button from '../components/ui/Button';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import { buildPrintHtmlForJob, createPrinterAdapter } from '../utils/printingService';
import {
  loadPrinterRoutes,
  PRINT_JOB_RESULT_EVENT,
  routeKeyForJob,
  savePrinterRoutes,
  systemPrinterNameForJob
} from '../utils/printStationRoutes';

const stationBadge = {
  KITCHEN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  BAR: 'bg-sky-100 text-sky-800 border-sky-200',
  SMOKE: 'bg-amber-100 text-amber-800 border-amber-200',
  COUNTER: 'bg-violet-100 text-violet-800 border-violet-200'
};

const clientId = `print-station-${Math.random().toString(36).slice(2)}`;
const printerRouteDefinitions = [
  { key: 'kitchen', label: 'Kitchen Printer Name', purpose: 'KITCHEN / FOOD' },
  { key: 'bar', label: 'Bar Printer Name', purpose: 'BAR' },
  { key: 'smoke', label: 'Hookah Printer Name', purpose: 'HOOKAH' },
  { key: 'counter', label: 'Reception Printer Name', purpose: 'RECEPTION' }
];

const PrintStationPage = () => {
  const adapterRef = useRef(null);
  const processingRef = useRef(new Set());
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]);
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [printerName, setPrinterName] = useState('');
  const [printerRoutes, setPrinterRoutes] = useState(loadPrinterRoutes);
  const [bridgeStatus, setBridgeStatus] = useState('Not connected');
  const [connecting, setConnecting] = useState(false);
  const [testingRoute, setTestingRoute] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const adapter = useMemo(() => {
    if (!adapterRef.current) adapterRef.current = createPrinterAdapter();
    return adapterRef.current;
  }, []);

  const printerOptions = useMemo(() => [
    { value: '', label: 'All system printers' },
    ...systemPrinters.map((name) => ({ value: name, label: name }))
  ], [systemPrinters]);

  const routePrinterOptions = useMemo(() => [
    { value: '', label: systemPrinters.length ? 'Select an installed printer name' : 'Connect printers to load names' },
    ...systemPrinters.map((name) => ({ value: name, label: name }))
  ], [systemPrinters]);

  const loadSystemPrinters = useCallback(async () => {
    try {
      if (!adapter.isConnected()) return;
      const discovered = await adapter.getPrinters();
      const names = (Array.isArray(discovered) ? discovered : [discovered])
        .map((name) => String(name || '').trim())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));
      const installedNames = [...new Set(names)];
      setSystemPrinters(installedNames);

      const installedName = (savedName) => installedNames.find(
        (name) => name.toLowerCase() === String(savedName || '').trim().toLowerCase()
      ) || '';
      const nextRoutes = Object.fromEntries(
        printerRouteDefinitions.map(({ key }) => [key, installedName(printerRoutes[key])])
      );
      const removedStaleRoute = printerRouteDefinitions.some(
        ({ key }) => printerRoutes[key] && !nextRoutes[key]
      );
      setPrinterRoutes(nextRoutes);
      if (removedStaleRoute) {
        setMessage('An old printer name was removed because it is no longer installed. Select the current Windows printer names below.');
      }
      if (printerName && !installedName(printerName)) setPrinterName('');
    } catch (err) {
      setBridgeStatus(`Printer discovery failed: ${err.message}`);
    }
  }, [adapter, printerName, printerRoutes]);

  const connectPrinters = useCallback(async () => {
    setConnecting(true);
    setMessage('');
    setError('');
    try {
      const nativePrinting = adapter.usesNativePrinting();
      const security = nativePrinting ? { configured: true } : await qzSecurityService.status();
      if (!nativePrinting && security?.configured) {
        adapter.configureSecurity({
          getCertificate: () => qzSecurityService.certificate(),
          sign: (request) => qzSecurityService.sign(request)
        });
      }

      if (adapter.isConnected()) await adapter.disconnect();
      await adapter.connect();
      if (!adapter.isConnected()) {
        throw new Error('QZ Tray is not available. Start QZ Tray and try again.');
      }

      setBridgeStatus(nativePrinting
        ? 'Desktop printer bridge connected'
        : security?.configured ? 'QZ Tray connected (trusted)' : 'QZ Tray connected (approval required)');
      if (!nativePrinting && !security?.configured) {
        setError('Trusted QZ signing is not configured. QZ Tray may ask once; choose Allow and Remember this decision, or configure the server signing certificate.');
      }
      await loadSystemPrinters();
    } catch (err) {
      setBridgeStatus('Not connected');
      setError(err.response?.data?.message || err.message || 'Unable to connect to QZ Tray');
    } finally {
      setConnecting(false);
    }
  }, [adapter, loadSystemPrinters]);

  const testAssignedPrinter = useCallback(async (routeKey) => {
    setMessage('');
    setError('');
    if (!adapter.isConnected()) {
      setError('Connect printers before running a test print');
      return;
    }

    const selectedName = printerRoutes[routeKey];
    const route = printerRouteDefinitions.find(({ key }) => key === routeKey);
    if (!selectedName) {
      setError(`Select the ${route?.label || routeKey} first`);
      return;
    }

    setTestingRoute(routeKey);
    try {
      await adapter.testPrint({
        printer: {
          name: selectedName,
          connectionType: 'QZ_TRAY',
          paperWidthMm: 58,
          copies: 1,
          purpose: route?.purpose || routeKey.toUpperCase()
        }
      });
      setMessage(`Test page sent successfully to printer "${selectedName}"`);
    } catch (err) {
      setError(err.message || 'Test print failed');
    } finally {
      setTestingRoute('');
    }
  }, [adapter, printerRoutes]);

  const fetchJobs = useCallback(async () => {
    try {
      const [pending, failed] = await Promise.all([
        printJobService.pending({ status: 'PENDING', limit: 100 }),
        printJobService.pending({ status: 'FAILED', limit: 100 })
      ]);
      const pendingJobs = [
        ...(Array.isArray(pending) ? pending : []),
        ...(Array.isArray(failed) ? failed : [])
      ];
      const selectedName = printerName.trim().toLowerCase();
      setJobs(selectedName
        ? pendingJobs.filter((job) => systemPrinterNameForJob(job, printerRoutes).trim().toLowerCase() === selectedName)
        : pendingJobs);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load print jobs');
    }
  }, [printerName, printerRoutes]);

  const printJob = useCallback(async (job) => {
    const id = job._id;
    if (!id || processingRef.current.has(id)) return;
    if (!adapter.isConnected()) {
      setError('Connect printers before processing print jobs');
      return;
    }
    const selectedSystemPrinter = systemPrinterNameForJob(job, printerRoutes);
    if (!selectedSystemPrinter) {
      const routeKey = routeKeyForJob(job);
      const routeLabel = printerRouteDefinitions.find((route) => route.key === routeKey)?.label || job.station;
      setError(`Select the ${routeLabel} printer before processing this job`);
      return;
    }
    processingRef.current.add(id);

    try {
      const claimed = await printJobService.claim(id, { clientId });
      const html = buildPrintHtmlForJob(claimed);
      const physicalPrinter = {
        ...(claimed.printer || {}),
        name: selectedSystemPrinter,
        connectionType: 'QZ_TRAY'
      };
      await adapter.printHtml({ html, printer: physicalPrinter, job: claimed });
      const completed = await printJobService.complete(id);
      setHistory((prev) => [{ ...completed, localStatus: 'PRINTED' }, ...prev].slice(0, 30));
      setJobs((prev) => prev.filter((row) => row._id !== id));
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Print failed';
      try {
        const failed = await printJobService.fail(id, { errorMessage: message });
        setHistory((prev) => [{ ...failed, localStatus: 'FAILED' }, ...prev].slice(0, 30));
      } catch (_inner) {
        setHistory((prev) => [{ ...job, localStatus: 'FAILED', errorMessage: message }, ...prev].slice(0, 30));
      }
      setError(message);
    } finally {
      processingRef.current.delete(id);
    }
  }, [adapter, printerRoutes]);

  useEffect(() => {
    savePrinterRoutes(printerRoutes);
  }, [printerRoutes]);

  useEffect(() => {
    if (!adapter.isConnected()) return;
    setBridgeStatus('QZ Tray connected');
    loadSystemPrinters();
    // The shared adapter stays connected while navigating between dashboard pages.
    // This restores visible printer names without opening a new QZ connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter]);

  useEffect(() => {
    fetchJobs();
    const timer = window.setInterval(fetchJobs, 5000);
    const onFocus = () => fetchJobs();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchJobs]);

  useEffect(() => {
    const onResult = (event) => {
      const { job, status, errorMessage } = event.detail || {};
      if (!job?._id) return;
      setHistory((previous) => [{ ...job, localStatus: status, errorMessage }, ...previous].slice(0, 30));
      if (status === 'PRINTED') {
        setJobs((previous) => previous.filter((row) => row._id !== job._id));
        setMessage(`Printed ${job.documentType?.replaceAll('_', ' ') || 'ticket'} successfully`);
      } else if (status === 'FAILED') {
        setError(errorMessage || 'Print failed');
        fetchJobs();
      }
    };
    window.addEventListener(PRINT_JOB_RESULT_EVENT, onResult);
    return () => window.removeEventListener(PRINT_JOB_RESULT_EVENT, onResult);
  }, [fetchJobs]);

  const retry = async (job) => {
    try {
      const pendingJob = await printJobService.retry(job._id);
      await printJob(pendingJob);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to retry print job');
    }
  };

  const renderJobCard = (job, showActions = true) => (
    <div key={job._id} className="rounded-2xl border border-brand-100 bg-white/85 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{job.documentType?.replaceAll('_', ' ')}</p>
          <p className="text-xs text-slate-500">
            {job.order?.orderNumber || job.payload?.orderNumber || 'No order'} • Printer: {systemPrinterNameForJob(job, printerRoutes) || 'Not assigned'}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${stationBadge[job.station] || 'border-slate-200 bg-slate-100 text-slate-700'}`}>
          {job.station || 'GENERAL'}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <span>Status: <strong>{job.localStatus || job.status}</strong></span>
        <span>Attempts: <strong>{job.attempts || 0}</strong></span>
        <span>Created: <strong>{job.createdAt ? new Date(job.createdAt).toLocaleTimeString() : '-'}</strong></span>
      </div>
      {job.errorMessage ? <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{job.errorMessage}</p> : null}
      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => printJob(job)}>Print Now</Button>
          {job.status === 'FAILED' || job.localStatus === 'FAILED' ? (
            <Button size="sm" variant="secondary" onClick={() => retry(job)}>Retry Print</Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      <Panel
        title="Print Station"
        subtitle="Claims pending jobs, routes them to the configured printer, and records success or failure."
        right={(
          <div className="flex flex-wrap gap-2">
            <Button onClick={connectPrinters} disabled={connecting}>
              {connecting ? 'Connecting...' : adapter.isConnected() ? 'Reconnect Printers' : 'Connect Printers'}
            </Button>
            <Button variant="secondary" onClick={fetchJobs}>Refresh Jobs</Button>
          </div>
        )}
      >
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Bridge</p>
            <p className="mt-1 text-lg font-bold text-emerald-950">{bridgeStatus}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-xs font-semibold uppercase text-sky-700">Pending</p>
            <p className="mt-1 text-lg font-bold text-sky-950">{jobs.length}</p>
          </div>
          <Select label="Queue Filter" value={printerName} onChange={(e) => setPrinterName(e.target.value)} options={printerOptions} />
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Auto Printing</p>
            <p className="mt-1 text-sm font-bold text-emerald-950">Always on</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-brand-100 bg-white/80 p-4">
          <p className="mb-3 text-sm font-bold text-slate-900">Section Printer Assignment</p>
          <div className="grid gap-3 md:grid-cols-2">
            {printerRouteDefinitions.map((route) => (
              <div key={route.key} className="rounded-xl border border-brand-100 bg-white p-3">
                <Select
                  label={route.label}
                  value={printerRoutes[route.key]}
                  onChange={(event) => setPrinterRoutes((routes) => ({ ...routes, [route.key]: event.target.value }))}
                  options={routePrinterOptions}
                  helperText="Uses the exact installed printer name, not its driver or model."
                />
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  disabled={!printerRoutes[route.key] || testingRoute === route.key}
                  onClick={() => testAssignedPrinter(route.key)}
                >
                  {testingRoute === route.key ? 'Testing...' : `Test ${route.purpose} Printer`}
                </Button>
              </div>
            ))}
          </div>
        </div>
        {message ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Pending Jobs" subtitle="Jobs are claimed before printing to avoid duplicate processing.">
          <div className="space-y-3">
            {jobs.length ? jobs.map((job) => renderJobCard(job)) : <p className="rounded-2xl border border-dashed border-brand-200 p-6 text-sm text-slate-500">No pending print jobs.</p>}
          </div>
        </Panel>
        <Panel title="Recent Print Results" subtitle="Local processing history for this print station session.">
          <div className="space-y-3">
            {history.length ? history.map((job) => renderJobCard(job, false)) : <p className="rounded-2xl border border-dashed border-brand-200 p-6 text-sm text-slate-500">No jobs processed in this session.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default PrintStationPage;
