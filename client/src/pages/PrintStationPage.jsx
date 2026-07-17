import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { printJobService } from '../api/services';
import Button from '../components/ui/Button';
import Panel from '../components/ui/Panel';
import Select from '../components/ui/Select';
import { buildPrintHtmlForJob, createPrinterAdapter } from '../utils/printingService';

const stationBadge = {
  KITCHEN: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  BAR: 'bg-sky-100 text-sky-800 border-sky-200',
  SMOKE: 'bg-amber-100 text-amber-800 border-amber-200',
  COUNTER: 'bg-violet-100 text-violet-800 border-violet-200'
};

const clientId = `print-station-${Math.random().toString(36).slice(2)}`;

const PrintStationPage = () => {
  const adapterRef = useRef(null);
  const processingRef = useRef(new Set());
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]);
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [printerName, setPrinterName] = useState('');
  const [autoProcess, setAutoProcess] = useState(true);
  const [bridgeStatus, setBridgeStatus] = useState('Disconnected');
  const [error, setError] = useState('');

  const adapter = useMemo(() => {
    if (!adapterRef.current) adapterRef.current = createPrinterAdapter();
    return adapterRef.current;
  }, []);

  const printerOptions = useMemo(() => [
    { value: '', label: 'All system printers' },
    ...systemPrinters.map((name) => ({ value: name, label: name }))
  ], [systemPrinters]);

  const loadSystemPrinters = useCallback(async () => {
    if (!adapter.isConnected()) return;
    try {
      const discovered = await adapter.getPrinters();
      const names = (Array.isArray(discovered) ? discovered : [discovered])
        .map((name) => String(name || '').trim())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right));
      setSystemPrinters([...new Set(names)]);
    } catch (err) {
      setBridgeStatus(`Printer discovery failed: ${err.message}`);
    }
  }, [adapter]);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await printJobService.pending({ limit: 100 });
      const pendingJobs = Array.isArray(data) ? data : [];
      const selectedName = printerName.trim().toLowerCase();
      setJobs(selectedName
        ? pendingJobs.filter((job) => String(job.printer?.printerSystemName || '').trim().toLowerCase() === selectedName)
        : pendingJobs);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load print jobs');
    }
  }, [printerName]);

  const printJob = useCallback(async (job) => {
    const id = job._id;
    if (!id || processingRef.current.has(id)) return;
    processingRef.current.add(id);

    try {
      const claimed = await printJobService.claim(id, { clientId });
      const html = buildPrintHtmlForJob(claimed);
      await adapter.printHtml({ html, printer: claimed.printer, job: claimed });
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
  }, [adapter]);

  useEffect(() => {
    adapter.connect()
      .then(async () => {
        setBridgeStatus(adapter.statusMessage());
        await loadSystemPrinters();
      })
      .catch((err) => setBridgeStatus(`Disconnected: ${err.message}`));
  }, [adapter, loadSystemPrinters]);

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
    if (!autoProcess || !jobs.length) return;
    jobs.forEach((job) => printJob(job));
  }, [autoProcess, jobs, printJob]);

  const retry = async (job) => {
    try {
      await printJobService.retry(job._id);
      await fetchJobs();
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
            {job.order?.orderNumber || job.payload?.orderNumber || 'No order'} • {job.printer?.printerSystemName || job.printer?.name || 'Printer not configured'}
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
          <Button size="sm" variant="secondary" onClick={() => retry(job)}>Retry</Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      <Panel
        title="Print Station"
        subtitle="Claims pending jobs, routes them to the configured printer, and records success or failure."
        right={<Button variant="secondary" onClick={() => { fetchJobs(); loadSystemPrinters(); }}>Refresh</Button>}
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
          <label className="flex items-end gap-2 rounded-2xl border border-brand-100 bg-white/80 p-4 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={autoProcess} onChange={(e) => setAutoProcess(e.target.checked)} />
            Auto process jobs
          </label>
        </div>
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
