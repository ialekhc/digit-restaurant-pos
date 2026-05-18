import { currency } from '../utils/format';

const accentMap = {
  brand: 'text-brand-700',
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  slate: 'text-slate-700',
  amber: 'text-amber-700'
};

const StatCard = ({ label, value, money = false, accent = 'brand' }) => {
  return (
    <div className="app-card p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold tracking-tight ${accentMap[accent] || accentMap.brand}`}>
        {money ? currency(value) : value}
      </p>
    </div>
  );
};

export default StatCard;
