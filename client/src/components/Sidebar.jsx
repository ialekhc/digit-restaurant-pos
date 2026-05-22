import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { getVisibleNavItems, NAV_GROUPS } from '../utils/navigation';
const linkBase = 'block rounded-xl px-4 py-2.5 text-sm font-semibold transition border';

const Sidebar = ({ userRole, enabledFeatures, open, onClose }) => {
  const roleLabel = userRole ? userRole.replaceAll('_', ' ') : 'GUEST';

  const items = useMemo(() => {
    return getVisibleNavItems({ role: userRole, enabledFeatures });
  }, [enabledFeatures, userRole]);

  return (
    <>
      {open ? <button className="fixed inset-0 z-20 bg-slate-900/30 lg:hidden" onClick={onClose} /> : null}

      <aside
        className={`fixed z-30 h-full w-72 overflow-y-auto border-r border-slate-200 bg-white text-slate-700 shadow-xl shadow-slate-300/25 transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-slate-200 p-5">
          <h1 className="font-display text-xl font-bold text-slate-800">Restaurant RMS</h1>
          <p className="text-xs text-slate-500">Management Panel</p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Signed in role</p>
            <p className="text-sm font-semibold text-slate-700">{roleLabel}</p>
          </div>
        </div>

        <nav className="space-y-4 p-4">
          {NAV_GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.group === group);
            if (!groupItems.length) return null;

            return (
              <div key={group}>
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group}</p>
                <div className="space-y-1">
                  {groupItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `${linkBase} ${
                          isActive
                            ? 'border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200/70'
                            : 'border-transparent bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
