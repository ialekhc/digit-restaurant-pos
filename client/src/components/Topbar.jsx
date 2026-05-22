import { useLocation } from 'react-router-dom';
import { PAGE_TITLES } from '../utils/constants';
import Button from './ui/Button';

const Topbar = ({ onMenu, user, onLogout }) => {
  const location = useLocation();

  const title = PAGE_TITLES[location.pathname] || 'Restaurant RMS';
  const now = new Date().toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur sm:px-4 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="min-w-0 flex items-center gap-2 sm:gap-3">
        <button
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 lg:hidden"
          onClick={onMenu}
          type="button"
        >
          Menu
        </button>
        <div className="min-w-0">
          <h2 className="truncate font-display text-base font-semibold text-slate-800 sm:text-lg">{title}</h2>
          <p className="text-[11px] text-slate-500 sm:text-xs">{now}</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-700">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.role}</p>
        </div>
        <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 sm:inline-flex">
          {user?.role}
        </span>
        <Button type="button" onClick={onLogout} variant="secondary" size="sm" className="px-2.5 text-xs sm:px-3 sm:text-sm">
          Logout
        </Button>
      </div>
      </div>
    </header>
  );
};

export default Topbar;
