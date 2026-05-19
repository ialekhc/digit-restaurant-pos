import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useAuth } from '../hooks/useAuth';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar userRole={user?.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-72">
        <Topbar user={user} onMenu={() => setSidebarOpen(true)} onLogout={logout} />

        <main className="p-3 sm:p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1700px]">
            <div className="pointer-events-none mb-4 h-2 w-full rounded-full bg-gradient-to-r from-brand-200 via-amber-200 to-aqua-200 opacity-80" />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
