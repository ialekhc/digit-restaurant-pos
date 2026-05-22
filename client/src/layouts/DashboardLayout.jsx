import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import BottomNav from '../components/BottomNav';
import { useAuth } from '../hooks/useAuth';
import { planService } from '../api/services';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    let mounted = true;
    planService
      .active()
      .then((data) => {
        if (!mounted) return;
        setEnabledFeatures(new Set(data?.enabledFeatureKeys || []));
      })
      .catch(() => {
        if (!mounted) return;
        setEnabledFeatures(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-transparent">
      <Sidebar
        userRole={user?.role}
        enabledFeatures={enabledFeatures}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="lg:pl-72">
        <Topbar user={user} onMenu={() => setSidebarOpen(true)} onLogout={logout} />

        <main className="p-3 pb-24 sm:p-4 sm:pb-24 lg:p-6 lg:pb-6">
          <div className="mx-auto w-full max-w-[1700px]">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav userRole={user?.role} enabledFeatures={enabledFeatures} />
    </div>
  );
};

export default DashboardLayout;
