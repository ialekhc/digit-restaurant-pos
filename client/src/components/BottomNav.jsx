import { NavLink, useLocation } from 'react-router-dom';
import { getMobileNavItems } from '../utils/navigation';

const iconClass = 'h-5 w-5';

const iconByPath = {
  '/dashboard': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z" fill="currentColor" />
    </svg>
  ),
  '/orders': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M5 4h14a1 1 0 0 1 1 1v14H4V5a1 1 0 0 1 1-1Zm2 4v2h10V8H7Zm0 4v2h10v-2H7Z" fill="currentColor" />
    </svg>
  ),
  '/orders/create': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" fill="currentColor" />
    </svg>
  ),
  '/tables': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M4 7h16v4H4V7Zm2 5h2v5H6v-5Zm10 0h2v5h-2v-5ZM9 12h6v5H9v-5Z" fill="currentColor" />
    </svg>
  ),
  '/billing': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Zm3 4v2h6V7H9Zm0 4v2h6v-2H9Z" fill="currentColor" />
    </svg>
  ),
  '/kitchen': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M7 4h2v8H7V4Zm4 0h2v8h-2V4Zm4 0h2v8h-2V4ZM5 14h14v6H5v-6Z" fill="currentColor" />
    </svg>
  ),
  '/reports': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M5 3h14v18H5V3Zm3 12h2v3H8v-3Zm3-4h2v7h-2v-7Zm3 2h2v5h-2v-5Z" fill="currentColor" />
    </svg>
  ),
  '/inventory': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M4 7 12 3l8 4-8 4-8-4Zm0 4 8 4 8-4v6l-8 4-8-4v-6Z" fill="currentColor" />
    </svg>
  ),
  '/customers': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 1 1 14 0H5Z" fill="currentColor" />
    </svg>
  ),
  '/settings': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="m19.4 13 .1-1-.1-1 2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6c-.6.2-1.2.6-1.7 1l-2.4-1-2 3.5 2 1.5-.1 1 .1 1-2 1.5 2 3.5 2.4-1c.5.4 1.1.8 1.7 1l.3 2.6h4l.3-2.6c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.5-2-1.5ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" fill="currentColor" />
    </svg>
  ),
  '/super-admin/dashboard': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z" fill="currentColor" />
    </svg>
  ),
  '/super-admin/vendors': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0H4Z" fill="currentColor" />
    </svg>
  ),
  '/super-admin/subscriptions': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M5 4h14v16H5V4Zm2 3v2h10V7H7Zm0 4v2h10v-2H7Zm0 4v2h6v-2H7Z" fill="currentColor" />
    </svg>
  ),
  '/super-admin/plans': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M4 6h16v3H4V6Zm0 5h10v3H4v-3Zm0 5h16v3H4v-3Z" fill="currentColor" />
    </svg>
  ),
  '/super-admin/users': (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 20a6 6 0 0 1 12 0H3Zm12 0a5 5 0 0 1 6-4.8V20h-6Z" fill="currentColor" />
    </svg>
  )
};

const getIcon = (path) => {
  return iconByPath[path] || (
    <svg viewBox="0 0 24 24" fill="none" className={iconClass}>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
};

const isPathActive = ({ currentPath, itemPath }) => {
  if (currentPath === itemPath) return true;
  if (currentPath.startsWith(`${itemPath}/`)) return true;
  return false;
};

const BottomNav = ({ userRole, enabledFeatures }) => {
  const location = useLocation();
  const items = getMobileNavItems({ role: userRole, enabledFeatures });

  if (!items.length) return null;

  return (
    <nav className="mobile-bottom-nav lg:hidden">
      {items.map((item) => {
        const active = isPathActive({ currentPath: location.pathname, itemPath: item.path });
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={`mobile-nav-item ${active ? 'mobile-nav-item-active' : ''}`}
          >
            <span className="mobile-nav-icon">{getIcon(item.path)}</span>
            <span className="mobile-nav-label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};

export default BottomNav;

