import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Home, Store, ScanLine, Package, LogOut, MoreHorizontal } from 'lucide-react';
import { useAuthV2 } from '../stores/authStore';
import { authApi } from '../lib/endpoints';

const TABS = [
  { to: '/v2/dashboard', label: 'Home', icon: Home },
  { to: '/v2/pieces', label: 'Pieces', icon: Package },
  { to: '/v2/scan', label: 'Scan', icon: ScanLine, fab: true },
  { to: '/v2/reports/aging', label: 'Reports', icon: Store },
  { to: '/v2/admin/locations', label: 'More', icon: MoreHorizontal },
];

export default function V2Shell({ children }) {
  const user = useAuthV2((s) => s.user);
  const logout = useAuthV2((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    logout();
    navigate('/v2/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink">
      {/* Top bar (desktop) */}
      <header className="hidden md:flex items-center justify-between px-6 h-14 bg-brand-surface border-b border-brand-border sticky top-0 z-30">
        <Link to="/v2/dashboard" className="font-bold text-brand-ink tracking-tight">
          SGH Crafts <span className="text-brand-primary">/ Showroom</span>
        </Link>
        <nav className="flex items-center gap-2">
          {TABS.filter((t) => !t.fab).map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium ${isActive ? 'bg-brand-primary/10 text-brand-primary' : 'text-brand-inkMuted hover:text-brand-ink'}`
              }
            >
              {t.label}
            </NavLink>
          ))}
          <button onClick={handleLogout} className="ml-2 text-sm text-brand-inkMuted hover:text-brand-error inline-flex items-center gap-1">
            <LogOut size={14} /> {user?.name || 'Logout'}
          </button>
        </nav>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-between px-4 h-12 bg-brand-surface border-b border-brand-border sticky top-0 z-30">
        <Link to="/v2/dashboard" className="font-bold text-brand-ink text-sm">
          SGH <span className="text-brand-primary">/ Showroom</span>
        </Link>
        <span className="text-xs text-brand-inkMuted truncate max-w-[40%]">{user?.name}</span>
      </header>

      <main className="px-4 md:px-6 py-4 pb-24 md:pb-8 max-w-7xl mx-auto">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-brand-surface border-t border-brand-border">
        <ul className="grid grid-cols-5 h-16">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.to} className="flex">
                <NavLink
                  to={t.to}
                  className={({ isActive }) =>
                    `flex-1 flex flex-col items-center justify-center text-[10px] gap-1 ${
                      t.fab
                        ? 'relative -mt-5 mx-2 mb-2 rounded-full bg-brand-primary text-white shadow-lg'
                        : isActive
                          ? 'text-brand-primary'
                          : 'text-brand-inkMuted'
                    }`
                  }
                >
                  <Icon size={t.fab ? 22 : 18} />
                  <span className={t.fab ? 'sr-only' : ''}>{t.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
