import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useAuth } from '../hooks/useAuth';
import BackgroundPrintProcessor from '../components/BackgroundPrintProcessor';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-transparent">
      <BackgroundPrintProcessor />
      <Sidebar user={user} userRole={user?.role} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-72">
        <Topbar user={user} onMenu={() => setSidebarOpen(true)} onLogout={logout} />

        <main className="p-3 sm:p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1700px]">
            <div className="pointer-events-none mb-4 h-2 w-full rounded-full bg-gradient-to-r from-brand-500 via-brand-300 to-secondary-900 opacity-80" />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
