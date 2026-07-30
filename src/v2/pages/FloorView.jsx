import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Package } from 'lucide-react';
import { instancesApi, locationsApi } from '../lib/endpoints';

const STAGE_COLORS = {
  IN_SHOWROOM: 'bg-brand-success/10 text-brand-success',
  AVAILABLE: 'bg-brand-success/10 text-brand-success',
  RESERVED: 'bg-brand-warning/10 text-brand-warning',
  SOLD: 'bg-brand-error/10 text-brand-error',
  DISPATCHED: 'bg-brand-inkMuted/10 text-brand-inkMuted',
  IN_TRANSIT: 'bg-brand-accent/10 text-brand-accent',
  RETURNED: 'bg-brand-inkMuted/10 text-brand-inkMuted',
};

const MATERIALS = ['WOOD', 'IRON', 'WOOD_IRON', 'IRON_MARBLE', 'WOOD_MARBLE', 'OTHER'];

export default function FloorViewPage() {
  const { locationId } = useParams();
  const id = locationId;
  const [q, setQ] = useState('');
  const [material, setMaterial] = useState('');
  const [stage, setStage] = useState('');

  const { data: location } = useQuery({
    queryKey: ['v2', 'location', id],
    queryFn: () => locationsApi.get(id).then((r) => r.data.data.location),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'instances', id, q, material, stage],
    queryFn: () =>
      instancesApi
        .list({ locationId: id, q: q || undefined, material: material || undefined, stage: stage || undefined, limit: 60 })
        .then((r) => r.data.data),
  });

  const items = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">{location?.name || 'Showroom'}</h1>
          <p className="text-xs text-brand-inkMuted">
            {data?.total ?? '—'} pieces · <span className="font-mono">{location?.code}</span>
          </p>
        </div>
        <Link to={`/v2/pieces/new?locationId=${id}`} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-primary text-white">
          + Add piece
        </Link>
      </div>

      {/* Search + filter row */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-3 space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-inkMuted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by code or product name…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-brand-border focus:border-brand-primary outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip label="All materials" active={material === ''} onClick={() => setMaterial('')} />
          {MATERIALS.map((m) => (
            <Chip key={m} label={m.replace('_', '+')} active={material === m} onClick={() => setMaterial(m)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip label="All stages" active={stage === ''} onClick={() => setStage('')} />
          {Object.keys(STAGE_COLORS).map((s) => (
            <Chip key={s} label={s.replace('_', ' ')} active={stage === s} onClick={() => setStage(s)} />
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-brand-surface border border-brand-border animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-brand-inkMuted">
          <Package size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No pieces match these filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((p) => {
            const photo = p.photos?.[0];
            return (
              <Link
                key={p.id}
                to={`/v2/pieces/${p.id}`}
                className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden hover:border-brand-primary/40 hover:-translate-y-0.5 transition"
              >
                <div className="aspect-square bg-gradient-to-br from-brand-bg to-white relative">
                  {photo ? (
                    <img src={photo} alt={p.instanceCode} className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-inkMuted/40">
                      <Package size={40} strokeWidth={1.5} />
                    </div>
                  )}
                  <span className={`absolute top-2 left-2 text-[12px] font-bold px-2 py-0.5 rounded-md ${STAGE_COLORS[p.currentStage] || ''}`}>
                    {p.currentStage.replace('_', ' ')}
                  </span>
                  {p.daysOnDisplay != null && (
                    <span className="absolute bottom-2 right-2 text-[12px] font-mono px-2 py-0.5 rounded-md bg-black/60 text-white">
                      {p.daysOnDisplay}d
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-xs font-mono font-bold text-brand-primary truncate">{p.instanceCode}</p>
                  <p className="text-sm font-semibold text-brand-ink truncate">{p.product?.name}</p>
                  <p className="text-sm font-bold text-brand-ink tabular-nums">
                    {p.listedPrice ? `₹${new Intl.NumberFormat('en-IN').format(p.listedPrice)}` : '—'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-[13px] font-semibold px-2.5 py-1 rounded-full border transition ${
        active ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-brand-inkMuted border-brand-border hover:border-brand-primary/40'
      }`}
    >
      {label}
    </button>
  );
}
