import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Package } from 'lucide-react';
import { reportsApi } from '../lib/endpoints';

const MATERIALS = ['', 'WOOD', 'IRON', 'WOOD_IRON', 'IRON_MARBLE', 'WOOD_MARBLE', 'OTHER'];

export default function CrossSearchPage() {
  const [q, setQ] = useState('');
  const [material, setMaterial] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'cross', q, material],
    queryFn: () => reportsApi.crossSearch({ q: q || undefined, material: material || undefined }).then((r) => r.data.data.groups),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-ink">All pieces · cross-showroom</h1>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-3 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-inkMuted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by instance code, product…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-brand-border"
          />
        </div>
        <select value={material} onChange={(e) => setMaterial(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-brand-border">
          {MATERIALS.map((m) => <option key={m} value={m}>{m || 'All materials'}</option>)}
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-brand-inkMuted">Searching…</p>
      ) : (
        Object.entries(data || {}).map(([code, g]) => (
          <section key={code} className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-inkMuted">
              {g.showroom?.name || code} <span className="font-mono">({code})</span> · {g.items.length}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {g.items.map((p) => (
                <Link key={p.id} to={`/v2/pieces/${p.id}`} className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden hover:border-brand-primary/40 transition">
                  <div className="aspect-square bg-brand-bg">
                    {p.photos?.[0]
                      ? <img src={p.photos[0]} alt="" className="w-full h-full object-contain p-2" />
                      : <div className="w-full h-full flex items-center justify-center text-brand-inkMuted/40"><Package size={32} /></div>
                    }
                  </div>
                  <div className="p-2">
                    <p className="text-[12px] font-mono text-brand-primary truncate">{p.instanceCode}</p>
                    <p className="text-xs font-semibold text-brand-ink truncate">{p.product?.name}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
