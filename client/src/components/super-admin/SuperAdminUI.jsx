import { useAuth } from '../../hooks/useAuth';

const join = (...classes) => classes.filter(Boolean).join(' ');

export const SuperAdminHeader = ({
  title = 'Super Admin Control',
  subtitle = 'Platform management, subscriptions, vendor health, and governance',
  right
}) => {
  const { user, logout } = useAuth();
  const roleLabel = String(user?.role || 'SUPER_ADMIN').replaceAll('_', ' ');

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {right}
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <p className="text-sm font-semibold text-slate-800">{user?.name || 'Platform Owner'}</p>
            <p className="text-xs text-slate-500">{user?.email || roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Logout
          </button>
        </div>
      </div>
    </section>
  );
};

export const SuperAdminSection = ({ title, subtitle, right, className = '', children }) => {
  return (
    <section className={join('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5', className)}>
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h3 className="font-display text-lg font-semibold tracking-tight text-slate-800">{title}</h3> : null}
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {right ? <div className="flex flex-wrap items-center gap-2">{right}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
};

export const SuperAdminStatCard = ({ label, value }) => {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-800">{value}</p>
    </article>
  );
};
