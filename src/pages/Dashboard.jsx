import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, ShoppingBag, FolderOpen, Factory, Store, Receipt, ShieldCheck, Package,
  Settings as SettingsIcon, Container as ContainerIcon, Share2, LayoutGrid,
  ArrowRight, ArrowUpRight, IndianRupee, AlertTriangle, Loader2, TrendingUp, FileText,
} from 'lucide-react';
import { dashboardAPI } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { formatCurrency } from '../utils/formatters';

const inr = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—');

const today = () =>
  new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// ── Primitives ───────────────────────────────────────────────────────────────

// A metric. `tone` colours the accent rule and icon; `alert` turns the whole
// tile amber/red so a problem reads at a glance from across the room.
const Metric = ({ icon: Icon, label, value, sub, tone = 'brand', onClick, alert }) => {
  const tones = {
    brand:   'text-brand-700 bg-brand-50',
    blue:    'text-blue-600 bg-blue-50',
    indigo:  'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    rose:    'text-rose-600 bg-rose-50',
    gray:    'text-gray-600 bg-gray-100',
  };
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden bg-white border rounded-xl p-4 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5' : ''
      } ${alert ? 'border-red-200' : 'border-linen-300 shadow-card'}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${alert ? 'bg-red-500' : 'bg-transparent'}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 truncate">{label}</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${alert ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${alert ? 'bg-red-50 text-red-600' : tones[tone]}`}>
          <Icon size={17} strokeWidth={1.8} />
        </div>
      </div>
      {onClick && <ArrowUpRight size={13} className="absolute bottom-3 right-3 text-gray-200" />}
    </div>
  );
};

const Section = ({ title, subtitle, action, children }) => (
  <section className="space-y-3">
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold text-espresso-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const SectionLink = ({ to, label, navigate }) => (
  <button onClick={() => navigate(to)} className="text-[11px] font-semibold text-brand-700 hover:text-brand-800 flex items-center gap-0.5 shrink-0">
    {label} <ArrowRight size={12} />
  </button>
);

const Panel = ({ children, className = '' }) => (
  <div className={`bg-white border border-linen-300 rounded-xl shadow-card overflow-hidden ${className}`}>{children}</div>
);

const Pill = ({ status }) => {
  const tone =
    status === 'Paid' || status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : status === 'Refund Due' ? 'bg-blue-50 text-blue-700 border-blue-200'
    : status === 'Unpaid' || status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-linen-100 text-gray-600 border-linen-300';
  return <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${tone}`}>{status}</span>;
};

const ModuleTile = ({ icon: Icon, label, desc, onClick }) => (
  <button
    onClick={onClick}
    className="group text-left bg-white border border-linen-300 rounded-xl shadow-card hover:shadow-card-hover hover:border-brand-300 transition-all p-3.5 flex items-center gap-3"
  >
    <div className="w-9 h-9 rounded-lg bg-linen-100 text-espresso-700 group-hover:bg-brand-50 group-hover:text-brand-700 flex items-center justify-center shrink-0 transition-colors">
      <Icon size={17} strokeWidth={1.8} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-800 truncate">{label}</p>
      <p className="text-[11px] text-gray-400 truncate">{desc}</p>
    </div>
    <ArrowRight size={14} className="text-gray-300 group-hover:text-brand-600 transition-colors shrink-0" />
  </button>
);

const MODULE_TILES = [
  { key: 'customers',         to: '/office/customers',       icon: Users,         label: 'Customers',           desc: 'Client directory & files' },
  { key: 'orders',            to: '/office/orders',          icon: ShoppingBag,   label: 'Orders',              desc: 'Sales orders & invoices' },
  { key: 'buyerCatalogue',    to: '/office/buyer-catalogue', icon: FolderOpen,    label: 'Buyer Catalogue',     desc: 'Product catalogues' },
  { key: 'container',         to: '/office/container',       icon: ContainerIcon, label: 'Container',           desc: 'Import / export containers' },
  { key: 'showroomKakani',    to: '/showroom/collections',   icon: LayoutGrid,    label: 'Collections',         desc: 'All showroom stock' },
  { key: 'showroomKakani',    to: '/showroom/kakani',        icon: Store,         label: 'Kakani Showroom',     desc: 'Zones A–C' },
  { key: 'showroomJhalamand', to: '/showroom/jhalamand',     icon: Store,         label: 'Jhalamand Showroom',  desc: 'Zones A–D' },
  { key: 'localCustomers',    to: '/local/customers',        icon: Users,         label: 'Local Customers',     desc: 'Walk-in buyers' },
  { key: 'localSales',        to: '/local/orders',           icon: Receipt,       label: 'Local Orders',        desc: 'Showroom-floor bills' },
  { key: 'production',        to: '/factory/production',     icon: Factory,       label: 'Production',          desc: 'Factory workflow board' },
  { key: 'outsourced',        to: '/outsourced',             icon: Share2,        label: 'Outsourced',          desc: 'External vendor work' },
  { key: 'users',             to: '/admin/users',            icon: ShieldCheck,   label: 'Users & Permissions', desc: 'Manage team access' },
  { key: 'settings',          to: '/admin/settings',         icon: SettingsIcon,  label: 'System Settings',     desc: 'App configuration' },
];

/**
 * The dashboard is assembled from whatever the server sends back, and the server
 * only computes the sections this user's permissions cover. An Admin sees orders
 * + production + showroom + local + team; a showroom employee sees showroom (and
 * local, if granted) and nothing else — no empty shells, no 403s.
 */
export default function Dashboard() {
  const { user, can, isAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    dashboardAPI
      .get()
      .then((res) => { if (alive) setData(res.data?.data || null); })
      .catch(() => { if (alive) setData(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const tiles = MODULE_TILES.filter((t) => can(t.key));
  const has = (s) => data?.sections?.includes(s);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
        <Loader2 className="animate-spin" size={18} /> Loading your dashboard…
      </div>
    );
  }

  // Things that need a human today, hoisted to the top so nobody has to hunt.
  const alerts = [
    has('production') && data.production.needsSetup > 0 && {
      text: `${data.production.needsSetup} production item${data.production.needsSetup === 1 ? '' : 's'} still unrouted`,
      to: '/factory/production',
    },
    has('showroom') && data.showroom.noLocalPrice > 0 && {
      text: `${data.showroom.noLocalPrice} showroom product${data.showroom.noLocalPrice === 1 ? '' : 's'} have no local price`,
      to: '/showroom/collections?missing=1',
    },
    has('local') && data.local.balanceDue > 0 && {
      text: `${inr(data.local.balanceDue)} outstanding across ${data.local.unpaid} local order${data.local.unpaid === 1 ? '' : 's'}`,
      to: '/local/orders',
    },
    has('local') && data.local.refundDue > 0 && {
      text: `${inr(data.local.refundDue)} refund owed back to customers`,
      to: '/local/orders',
    },
  ].filter(Boolean);

  return (
    <div className="space-y-8 pb-4">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-linen-300 shadow-card px-6 py-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-400">{today()}</p>
          <h1 className="text-2xl font-serif font-bold text-espresso-900 mt-1 tracking-tight">
            Welcome back, {user?.fullName?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin()
              ? 'Full platform overview — orders, production, showrooms, local sales and team.'
              : 'Everything your modules cover, in one place.'}
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-linen-100 text-espresso-600 border border-linen-300">
          {user?.role}{user?.department ? ` · ${user.department}` : ''}
        </span>
      </div>

      {/* ── Needs attention ──────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 divide-y divide-red-100 overflow-hidden">
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={() => navigate(a.to)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-red-50 transition-colors"
            >
              <AlertTriangle size={15} className="text-red-600 shrink-0" />
              <span className="text-sm text-red-800 flex-1">{a.text}</span>
              <ArrowRight size={14} className="text-red-400 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* ── Orders ───────────────────────────────────────────────────────── */}
      {has('orders') && (
        <Section
          title="Orders"
          subtitle="Export pipeline"
          action={<SectionLink to="/office/orders" label="All orders" navigate={navigate} />}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={ShoppingBag} label="Total orders" value={data.orders.total} sub={`${data.orders.thisMonth} this month`} tone="blue" onClick={() => navigate('/office/orders')} />
            <Metric icon={FileText} label="Drafts" value={data.orders.drafts} sub="Awaiting finalization" tone="gray" />
            <Metric icon={Factory} label="In process" value={data.orders.inProcess} sub={`${data.orders.finalized} finalized, not started`} tone="indigo" />
            <Metric icon={TrendingUp} label="Order value" value={formatCurrency(data.orders.revenue, 'USD')} sub="Excludes drafts & cancelled" tone="emerald" />
          </div>

          {data.orders.recent?.length > 0 && (
            <Panel>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[38rem]">
                <thead className="bg-linen-50 text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Order</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Customer</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Value</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linen-200">
                  {data.orders.recent.map((o) => (
                    <tr key={o._id} onClick={() => navigate(`/office/orders/${o._id}`)} className="cursor-pointer hover:bg-linen-50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{o.orderNumber}</td>
                      <td className="px-4 py-2.5 text-gray-600 truncate max-w-[16rem]">{o.customer?.companyName || o.fileNumber}</td>
                      <td className="px-4 py-2.5"><Pill status={o.orderStatus} /></td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">{formatCurrency(o.finalAmount, o.currency || 'USD')}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs whitespace-nowrap">{day(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Panel>
          )}
        </Section>
      )}

      {/* ── Production ───────────────────────────────────────────────────── */}
      {has('production') && (
        <Section
          title="Production"
          subtitle="Units moving through the factory"
          action={<SectionLink to="/factory/production" label="Open board" navigate={navigate} />}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
              <Metric icon={Package} label="Items in play" value={data.production.itemsInPlay} sub="Across processing orders" tone="indigo" onClick={() => navigate('/factory/production')} />
              <Metric icon={AlertTriangle} label="Needs setup" value={data.production.needsSetup} sub="Unrouted items" tone="brand" alert={data.production.needsSetup > 0} onClick={() => navigate('/factory/production')} />
              <Metric icon={ContainerIcon} label="Ready for container" value={data.production.readyForContainer} sub="Units finished" tone="emerald" />
            </div>

            <Panel className="lg:col-span-2 p-4">
              <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-3">Units per stage</p>
              {data.production.byStage?.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Nothing on the board right now.</p>
              ) : (
                <div className="space-y-2">
                  {data.production.byStage.map((s) => {
                    const max = Math.max(...data.production.byStage.map((x) => x.units), 1);
                    return (
                      <div key={s.stage} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-40 shrink-0 truncate">{s.stage}</span>
                        <div className="flex-1 h-2 bg-linen-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(s.units / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-800 w-10 text-right tabular-nums">{s.units}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </Section>
      )}

      {/* ── Showroom ─────────────────────────────────────────────────────── */}
      {has('showroom') && (
        <Section
          title="Showroom"
          subtitle={data.showroom.branches.join(' & ')}
          action={<SectionLink to="/showroom/collections" label="Collections" navigate={navigate} />}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={LayoutGrid} label="Products" value={data.showroom.items} sub="On display" tone="rose" onClick={() => navigate('/showroom/collections')} />
            <Metric icon={Package} label="Units on floor" value={data.showroom.units} sub="Across all zones" tone="rose" />
            {data.showroom.perBranch.map((b) => (
              <Metric
                key={b.branch}
                icon={Store}
                label={b.branch}
                value={b.units}
                sub={`${b.items} product${b.items === 1 ? '' : 's'}`}
                tone="brand"
                onClick={() => navigate(`/showroom/${b.branch.toLowerCase()}`)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ── Local sales ──────────────────────────────────────────────────── */}
      {has('local') && (
        <Section
          title="Local sales"
          subtitle="Walk-in business off the showroom floor"
          action={<SectionLink to="/local/orders" label="All local orders" navigate={navigate} />}
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric icon={Receipt} label="Local orders" value={data.local.orders} sub={`${data.local.today} today`} tone="emerald" onClick={() => navigate('/local/orders')} />
            <Metric icon={IndianRupee} label="Billed this month" value={inr(data.local.monthRevenue)} sub={`${inr(data.local.revenue)} all time`} tone="emerald" />
            <Metric icon={AlertTriangle} label="Balance due" value={inr(data.local.balanceDue)} sub={`${data.local.unpaid} unsettled`} tone="brand" alert={data.local.balanceDue > 0} onClick={() => navigate('/local/orders')} />
            {data.local.refundDue > 0 ? (
              <Metric icon={IndianRupee} label="Refund due" value={inr(data.local.refundDue)} sub="Owed back after returns" tone="blue" alert onClick={() => navigate('/local/orders')} />
            ) : (
              data.local.customers != null && (
                <Metric icon={Users} label="Local customers" value={data.local.customers} sub="Walk-in directory" tone="brand" onClick={() => navigate('/local/customers')} />
              )
            )}
          </div>

          {data.local.recent?.length > 0 && (
            <Panel>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[38rem]">
                <thead className="bg-linen-50 text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Order</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Customer</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Payment</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linen-200">
                  {data.local.recent.map((s) => (
                    <tr key={s._id} onClick={() => navigate(`/local/orders/${s._id}`)} className="cursor-pointer hover:bg-linen-50 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{s.saleNumber}</td>
                      <td className="px-4 py-2.5 text-gray-600 truncate max-w-[16rem]">{s.customerName}</td>
                      <td className="px-4 py-2.5"><Pill status={s.paymentStatus} /></td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800 tabular-nums whitespace-nowrap">{inr(s.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs whitespace-nowrap">{day(s.saleDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Panel>
          )}
        </Section>
      )}

      {/* ── Directory ────────────────────────────────────────────────────── */}
      {(has('customers') || has('team')) && (
        <Section title="Directory" subtitle="People on the platform">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {has('customers') && (
              <Metric icon={Users} label="Export customers" value={data.customers.total} sub={`${data.customers.thisMonth} added this month`} tone="brand" onClick={() => navigate('/office/customers')} />
            )}
            {has('team') && (
              <>
                <Metric icon={ShieldCheck} label="Team" value={data.team.total} sub={`${data.team.active} active`} tone="gray" onClick={() => navigate('/admin/users')} />
                <Metric icon={ShieldCheck} label="Admins" value={data.team.admins} sub={`${data.team.employees} employees`} tone="indigo" onClick={() => navigate('/admin/users')} />
              </>
            )}
          </div>
        </Section>
      )}

      {/* ── Quick access ─────────────────────────────────────────────────── */}
      {tiles.length > 0 && (
        <Section title="Modules" subtitle="Everything you have access to">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tiles.map((t, i) => (
              <ModuleTile key={`${t.key}-${i}`} icon={t.icon} label={t.label} desc={t.desc} onClick={() => navigate(t.to)} />
            ))}
          </div>
        </Section>
      )}

      {data?.sections?.length === 0 && tiles.length === 0 && (
        <Panel className="p-12 text-center text-gray-400">
          No modules have been assigned to you yet. Ask an Admin to grant access.
        </Panel>
      )}
    </div>
  );
}
