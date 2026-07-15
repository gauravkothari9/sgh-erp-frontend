import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LogOut, User, Settings, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import NotificationBell from './NotificationBell';
import toast from 'react-hot-toast';

export default function Navbar({ onMenuClick }) {
  const { user, logout, can } = useAuthStore();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <header className="h-16 bg-linen-50 border-b border-linen-300 flex items-center px-3 sm:px-6 gap-3 sm:gap-6 sticky top-0 z-10 transition-all duration-300">
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuClick}
        className="lg:hidden btn-ghost btn p-2"
      >
        <Menu size={18} strokeWidth={1.5} />
      </button>

      {/* Search bar */}
      <div className="flex-1 max-w-md relative hidden sm:block">
        <Search size={16} strokeWidth={1.5} className="absolute left-0 top-1/2 -translate-y-1/2 text-espresso-400" />
        <input
          type="text"
          placeholder="Search orders, customers, SKUs..."
          className="w-full pl-8 py-2 text-sm bg-transparent border-b border-linen-300 text-espresso-900 placeholder-espresso-400 focus:outline-none focus:border-terracotta-500 focus:ring-0 transition-all duration-300"
          readOnly
          onClick={() => toast('Global search coming soon!')}
        />
      </div>

      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Notifications */}
        <NotificationBell />

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 pl-2 pr-2 py-1.5 hover:bg-linen-100 transition-colors border border-transparent hover:border-linen-300"
          >
            <div className="w-8 h-8 bg-espresso-200 flex items-center justify-center text-espresso-900 text-xs font-serif border border-espresso-300">
              {user?.fullName?.[0] || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-espresso-900 leading-tight tracking-wide">{user?.fullName}</p>
              <p className="text-[10px] text-espresso-500 uppercase tracking-widest mt-0.5">
                {user?.role === 'Admin' ? 'Administrator' : user?.designation || 'Employee'}
              </p>
            </div>
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white shadow-card-hover border border-linen-300 py-2 z-20">
                <div className="px-4 py-3 border-b border-linen-200 mb-2 bg-linen-50">
                  <p className="text-sm font-medium text-espresso-900">{user?.fullName}</p>
                  <p className="text-xs text-espresso-500 mt-1 font-light tracking-wide">
                    {user?.role === 'Admin' ? 'Administrator' : user?.designation || user?.role}
                  </p>
                  <p className="text-[11px] text-espresso-400 mt-0.5">{user?.email}</p>
                </div>
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-espresso-600 hover:bg-linen-100 hover:text-espresso-900 transition-colors tracking-wide"
                >
                  <User size={16} strokeWidth={1.5} />
                  My Profile
                </button>
                {can('settings') && (
                  <button
                    onClick={() => { setDropdownOpen(false); navigate('/admin/settings'); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-espresso-600 hover:bg-linen-100 hover:text-espresso-900 transition-colors tracking-wide"
                  >
                    <Settings size={16} strokeWidth={1.5} />
                    Settings
                  </button>
                )}
                <div className="h-px bg-linen-200 my-2" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-terracotta-600 hover:bg-terracotta-50 transition-colors tracking-wide font-medium"
                >
                  <LogOut size={16} strokeWidth={1.5} />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
