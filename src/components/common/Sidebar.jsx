import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  LayoutGrid,
  Users as UsersIcon,
  ShoppingBag,
  FolderOpen,
  ShieldCheck,
  Settings as SettingsIcon,
  Factory,
  Wrench,
  Sparkles,
  Package,
  Truck,
  ClipboardCheck,
  Receipt,
  Share2,
  Boxes,
  Container as ContainerIcon,
  Store,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

// `onNavigate` closes the mobile drawer — without it, tapping a link on a phone
// leaves the overlay covering the page you just navigated to.
const NavItem = ({ to, icon: Icon, label, badge, onNavigate }) => (
  <NavLink
    to={to}
    onClick={onNavigate}
    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
  >
    <Icon size={17} strokeWidth={1.5} />
    <span className="flex-1">{label}</span>
    {badge && (
      <span className="text-[10px] bg-terracotta-100 text-terracotta-800 px-2 py-0.5 rounded-none font-medium uppercase tracking-wider">
        {badge}
      </span>
    )}
  </NavLink>
);

const Section = ({ title, items, onNavigate }) => {
  if (items.length === 0) return null;
  return (
    <>
      <div className="section-divider" />
      <p className="text-[10px] font-medium text-espresso-400 uppercase tracking-widest px-4 mb-2">
        {title}
      </p>
      {items.map((item) => (
        <NavItem key={item.to} {...item} onNavigate={onNavigate} />
      ))}
    </>
  );
};

export default function Sidebar({ onClose }) {
  const { user, can, isAdmin } = useAuthStore();
  const { pathname } = useLocation();
  const navRef = useRef(null);

  // Bring the active link into view. On a phone/tablet the drawer remounts each
  // time the hamburger is tapped and the nav resets to the top — so if the
  // current section is far down (e.g. Kakani → Polish) you'd have to scroll to
  // find where you are. Centre it instead, both on open and on route change.
  useEffect(() => {
    const el = navRef.current?.querySelector('.sidebar-link.active');
    if (!el) return;
    const raf = requestAnimationFrame(() =>
      el.scrollIntoView({ block: 'center', behavior: 'auto' })
    );
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  const officeItems = [
    { to: '/office/customers', icon: UsersIcon, label: 'Customers', module: 'customers' },
    { to: '/office/orders', icon: ShoppingBag, label: 'Orders', module: 'orders' },
    { to: '/office/buyer-catalogue', icon: FolderOpen, label: 'Buyer Catalogue', module: 'buyerCatalogue' },
    { to: '/office/container', icon: ContainerIcon, label: 'Container', module: 'container' },
  ].filter((item) => can(item.module));

  const factoryItems = [
    { to: '/factory/production', icon: Factory, label: 'Production', module: 'production' },
  ].filter((item) => can(item.module));

  const outsourcedItems = [
    { to: '/outsourced', icon: Share2, label: 'Outsourced', module: 'outsourced' },
  ].filter((item) => can(item.module));

  const jhalamandItems = [
    { to: '/branches/jhalamand/orders', icon: ShoppingBag, label: 'Orders', module: 'jhalamand' },
    { to: '/branches/jhalamand/in-transit', icon: Truck, label: 'In-Transit', module: 'jhalamand' },
  ].filter((item) => can(item.module));

  const kakaniItems = [
    { to: '/branches/kakani/orders', icon: ShoppingBag, label: 'Orders', module: 'kakani' },
    { to: '/branches/kakani/orders-in-transit', icon: Truck, label: 'Orders In-Transit', module: 'kakani' },
    { to: '/branches/kakani/repairing', icon: Wrench, label: 'Repairing / Manufacturing', module: 'kakani' },
    { to: '/branches/kakani/polish', icon: Sparkles, label: 'Polish', module: 'kakani' },
    { to: '/branches/kakani/qc', icon: ClipboardCheck, label: 'QC', module: 'kakani' },
    { to: '/branches/kakani/packing', icon: Package, label: 'Packing', module: 'kakani' },
    { to: '/branches/kakani/iron-khata', icon: Boxes, label: 'Iron Khata', module: 'kakani' },
  ].filter((item) => can(item.module));

  const showroomItems = [
    // Collections span both branches — one showroom permission is enough.
    (can('showroomKakani') || can('showroomJhalamand')) && {
      to: '/showroom/collections', icon: LayoutGrid, label: 'Collections', module: 'showroomKakani',
    },
    can('showroomKakani') && { to: '/showroom/kakani', icon: Store, label: 'Kakani', module: 'showroomKakani' },
    can('showroomJhalamand') && { to: '/showroom/jhalamand', icon: Store, label: 'Jhalamand', module: 'showroomJhalamand' },
  ].filter(Boolean);

  const localItems = [
    { to: '/local/customers', icon: UsersIcon, label: 'Customers', module: 'localCustomers' },
    { to: '/local/orders', icon: Receipt, label: 'Orders', module: 'localSales' },
  ].filter((item) => can(item.module));

  const adminItems = [
    (isAdmin() || can('users')) && {
      to: '/admin/users',
      icon: ShieldCheck,
      label: 'Users & Permissions',
      module: 'users',
    },
    can('settings') && {
      to: '/admin/settings',
      icon: SettingsIcon,
      label: 'System Settings',
      module: 'settings',
    },
  ].filter(Boolean);

  return (
    <div className="flex flex-col h-full bg-linen-50 border-r border-linen-300 w-64">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-linen-300">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-transparent border border-terracotta-600 flex items-center justify-center text-terracotta-600 font-serif font-bold text-xl rounded-none">
            S
          </div>
          <div>
            <p className="font-serif font-bold text-espresso-900 text-lg leading-tight tracking-tight">SGH ERP</p>
            <p className="text-[10px] text-espresso-500 uppercase tracking-widest leading-tight mt-1">SGH Crafts</p>
          </div>
        </div>
      </div>

      {/* Navigation — permission-filtered */}
      <nav ref={navRef} className="flex-1 py-6 space-y-1 overflow-y-auto">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" onNavigate={onClose} />

        <Section title="Office Module" items={officeItems} onNavigate={onClose} />
        <Section title="Showroom" items={showroomItems} onNavigate={onClose} />
        <Section title="Local" items={localItems} onNavigate={onClose} />
        <Section title="Factory" items={factoryItems} onNavigate={onClose} />
        <Section title="Jhalamand" items={jhalamandItems} onNavigate={onClose} />
        <Section title="Outsourced" items={outsourcedItems} onNavigate={onClose} />
        <Section title="Kakani" items={kakaniItems} onNavigate={onClose} />
        <Section title="Administration" items={adminItems} onNavigate={onClose} />
      </nav>

      {/* User info */}
      <div className="px-6 py-5 border-t border-linen-300 bg-linen-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-espresso-200 flex items-center justify-center text-espresso-900 text-sm font-serif rounded-none border border-espresso-300">
            {user?.fullName?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-espresso-900 truncate">{user?.fullName}</p>
            <p className="text-xs text-espresso-500 truncate font-light tracking-wide mt-0.5">
              {user?.role === 'Admin' ? 'Administrator' : user?.designation || user?.role}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
