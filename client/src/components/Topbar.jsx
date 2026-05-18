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
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium lg:hidden"
          onClick={onMenu}
          type="button"
        >
          Menu
        </button>
        <div>
          <h2 className="text-base font-semibold text-slate-800 sm:text-lg">{title}</h2>
          <p className="text-[11px] text-slate-500 sm:text-xs">{now}</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-slate-700">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.role}</p>
        </div>
        <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 sm:inline-flex">
          {user?.role}
        </span>
        <Button type="button" onClick={onLogout} variant="danger" size="sm" className="sm:text-sm">
          Logout
        </Button>
      </div>
    </header>
  );
};

export default Topbar;
