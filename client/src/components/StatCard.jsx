import { currency } from '../utils/format';

const accentMap = {
  brand: 'text-slate-800 bg-white border-slate-200',
  emerald: 'text-slate-800 bg-emerald-50 border-emerald-200',
  rose: 'text-slate-800 bg-rose-50 border-rose-200',
  slate: 'text-slate-800 bg-slate-50 border-slate-200',
  amber: 'text-slate-800 bg-amber-50 border-amber-200'
};

const StatCard = ({ label, value, money = false, accent = 'brand' }) => {
  const tone = accentMap[accent] || accentMap.brand;
  return (
    <div className={`app-card border p-4 ${tone}`}>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">
        {money ? currency(value) : value}
      </p>
    </div>
  );
};

export default StatCard;
