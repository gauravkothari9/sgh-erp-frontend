import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Store, Package, Calendar, IndianRupee, Bookmark, ScanLine, Plus, AlertTriangle } from 'lucide-react';
import { reportsApi, locationsApi } from '../lib/endpoints';

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
const inr = (n) => `₹${fmt(n)}`;

export default function DashboardPage() {
  const [scope, setScope] = useState('all'); // all | JHL | KKN

  const { data: locData } = useQuery({
    queryKey: ['v2', 'locations'],
    queryFn: () => locationsApi.list().then((r) => r.data.data),
  });
  const { data: summary, isLoading } = useQuery({
    queryKey: ['v2', 'reports', 'showroom-summary'],
    queryFn: () => reportsApi.showroomSummary().then((r) => r.data.data.rows),
  });
  const { data: aging } = useQuery({
    queryKey: ['v2', 'reports', 'aging'],
    queryFn: () => reportsApi.aging().then((r) => r.data.data.rows),
  });

  const filtered = useMemo(() => {
    if (!summary) return [];
    if (scope === 'all') return summary;
    return summary.filter((r) => r.showroom.code.startsWith(scope));
  }, [summary, scope]);

  const totalPieces = filtered.reduce((s, r) => s + r.pieces, 0);
  const totalValue = filtered.reduce((s, r) => s + Number(r.totalValue || 0), 0);
  const totalReserved = filtered.reduce((s, r) => s + r.reserved, 0);
  const totalSold30 = filtered.reduce((s, r) => s + r.soldLast30Days, 0);
  const totalAged60 = (aging || []).filter((a) => a.daysOnDisplay > 60 && (scope === 'all' || a.showroom?.startsWith(scope))).length;

  return (
    <div className="space-y-5">
      {/* Scope selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-brand-ink">Dashboard</h1>
          <p className="text-sm text-brand-inkMuted">7 showrooms across Jhalamand &amp; Kakani</p>
        </div>
        <div className="flex items-center gap-1 bg-brand-surface border border-brand-border rounded-full p-1">
          {[
            { v: 'all', label: 'All' },
            { v: 'JHL', label: 'Jhalamand' },
            { v: 'KKN', label: 'Kakani' },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setScope(opt.v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${scope === opt.v ? 'bg-brand-primary text-white' : 'text-brand-inkMuted'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={Package} label="On display" value={fmt(totalPieces)} accent="bg-brand-primary/10 text-brand-primary" />
        <Kpi icon={IndianRupee} label="Total value" value={inr(totalValue)} accent="bg-brand-accent/10 text-brand-accent" />
        <Kpi icon={Bookmark} label="Reserved" value={fmt(totalReserved)} accent="bg-brand-warning/10 text-brand-warning" />
        <Kpi icon={Calendar} label="Sold (30d)" value={fmt(totalSold30)} accent="bg-brand-success/10 text-brand-success" />
        <Kpi icon={AlertTriangle} label="Aged > 60d" value={fmt(totalAged60)} accent="bg-brand-error/10 text-brand-error" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2">
        <QuickAction to="/v2/scan" icon={ScanLine} label="Scan QR" />
        <QuickAction to="/v2/pieces/new" icon={Plus} label="New piece" />
        <QuickAction to="/v2/pieces" icon={Package} label="All pieces" />
      </div>

      {/* Showroom cards */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-brand-inkMuted mb-2">Showrooms</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-brand-surface border border-brand-border animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((r) => (
              <Link
                key={r.showroom.id}
                to={`/v2/showrooms/${r.showroom.id}`}
                className="bg-brand-surface border border-brand-border rounded-xl p-4 hover:border-brand-primary/40 hover:shadow-sm transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                      <Store size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-brand-ink">{r.showroom.name}</p>
                      <p className="text-[11px] font-mono text-brand-inkMuted">{r.showroom.code}</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-brand-ink tabular-nums">{r.pieces}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Value" value={inr(r.totalValue)} />
                  <Stat label="Reserved" value={fmt(r.reserved)} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Locations directory */}
      {locData?.hierarchy && (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-inkMuted mb-2">Locations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {locData.hierarchy.map((p) => (
              <div key={p.id} className="bg-brand-surface border border-brand-border rounded-xl p-4">
                <p className="text-sm font-bold text-brand-ink">{p.name}</p>
                <p className="text-[11px] font-mono text-brand-inkMuted mb-2">{p.code}</p>
                <ul className="space-y-1">
                  {p.children.map((c) => (
                    <li key={c.id}>
                      <Link to={`/v2/showrooms/${c.id}`} className="text-xs text-brand-inkMuted hover:text-brand-primary">
                        {c.name} ({c.code})
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
      <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center mb-2`}>
        <Icon size={15} />
      </div>
      <p className="text-[10px] uppercase tracking-wider text-brand-inkMuted">{label}</p>
      <p className="text-lg font-bold text-brand-ink tabular-nums">{value}</p>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-center gap-2 bg-brand-surface border border-brand-border rounded-xl py-3 text-sm font-semibold text-brand-ink hover:border-brand-primary hover:text-brand-primary transition"
    >
      <Icon size={16} /> {label}
    </Link>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-brand-bg rounded-lg px-2.5 py-1.5">
      <p className="text-[10px] text-brand-inkMuted">{label}</p>
      <p className="text-sm font-semibold text-brand-ink tabular-nums">{value}</p>
    </div>
  );
}
