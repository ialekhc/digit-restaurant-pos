const toneMap = {
  AVAILABLE: 'border border-emerald-200 bg-emerald-100 text-emerald-800',
  OCCUPIED: 'border border-amber-200 bg-amber-100 text-amber-800',
  RESERVED: 'border border-sky-200 bg-sky-100 text-sky-800',
  Unavailable: 'border border-slate-200 bg-slate-100 text-slate-700',
  PENDING: 'border border-orange-200 bg-orange-100 text-orange-800',
  PREPARING: 'border border-aqua-200 bg-aqua-100 text-aqua-800',
  READY: 'border border-cyan-200 bg-cyan-100 text-cyan-800',
  SERVED: 'border border-lime-200 bg-lime-100 text-lime-800',
  PACKED: 'border border-lime-200 bg-lime-100 text-lime-800',
  COMPLETED: 'border border-emerald-200 bg-emerald-100 text-emerald-800',
  CANCELLED: 'border border-rose-200 bg-rose-100 text-rose-800',
  PAID: 'border border-emerald-200 bg-emerald-100 text-emerald-800',
  UNPAID: 'border border-rose-200 bg-rose-100 text-rose-800',
  PARTIAL: 'border border-amber-200 bg-amber-100 text-amber-800',
  LOW: 'border border-rose-200 bg-rose-100 text-rose-800',
  OK: 'border border-emerald-200 bg-emerald-100 text-emerald-800'
};

const StatusBadge = ({ value }) => {
  const key = String(value || '').toUpperCase();
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneMap[key] || 'border border-slate-200 bg-slate-100 text-slate-700'}`}>
      {value || 'N/A'}
    </span>
  );
};

export default StatusBadge;
