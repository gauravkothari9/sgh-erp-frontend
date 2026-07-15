import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-linen-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-50 flex">
            <Sidebar onClose={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-5 md:p-6 max-w-screen-2xl mx-auto fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
