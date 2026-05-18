const toneMap = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800',
  OCCUPIED: 'bg-amber-100 text-amber-800',
  RESERVED: 'bg-sky-100 text-sky-800',
  CLEANING: 'bg-slate-200 text-slate-800',
  PENDING: 'bg-amber-100 text-amber-800',
  PREPARING: 'bg-indigo-100 text-indigo-800',
  READY: 'bg-cyan-100 text-cyan-800',
  SERVED: 'bg-lime-100 text-lime-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-100 text-rose-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  UNPAID: 'bg-rose-100 text-rose-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  LOW: 'bg-rose-100 text-rose-800',
  OK: 'bg-emerald-100 text-emerald-800'
};

const StatusBadge = ({ value }) => {
  const key = String(value || '').toUpperCase();
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneMap[key] || 'bg-slate-100 text-slate-700'}`}>
      {value || 'N/A'}
    </span>
  );
};

export default StatusBadge;
