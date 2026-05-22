const toneMap = {
  AVAILABLE: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  OCCUPIED: 'border border-amber-200 bg-amber-50 text-amber-700',
  RESERVED: 'border border-sky-200 bg-sky-50 text-sky-700',
  CLEANING: 'border border-slate-200 bg-slate-100 text-slate-700',
  PENDING: 'border border-orange-200 bg-orange-50 text-orange-700',
  PREPARING: 'border border-cyan-200 bg-cyan-50 text-cyan-700',
  READY: 'border border-blue-200 bg-blue-50 text-blue-700',
  SERVED: 'border border-lime-200 bg-lime-50 text-lime-700',
  COMPLETED: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border border-rose-200 bg-rose-50 text-rose-700',
  PAID: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
  UNPAID: 'border border-rose-200 bg-rose-50 text-rose-700',
  PARTIAL: 'border border-amber-200 bg-amber-50 text-amber-700',
  LOW: 'border border-rose-200 bg-rose-50 text-rose-700',
  OK: 'border border-emerald-200 bg-emerald-50 text-emerald-700'
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
