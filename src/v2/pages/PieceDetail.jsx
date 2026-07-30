import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package, MapPin, Calendar, IndianRupee, QrCode, Download,
  Bookmark, ShoppingCart, MoveRight, History, ChevronLeft,
} from 'lucide-react';
import { instancesApi } from '../lib/endpoints';
import { useAuthV2 } from '../stores/authStore';
import toast from 'react-hot-toast';

export default function PieceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const pid = id;
  const can = useAuthV2((s) => s.can);
  const qc = useQueryClient();

  const [photoIdx, setPhotoIdx] = useState(0);
  const [showQR, setShowQR] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'instance', pid],
    queryFn: () => instancesApi.get(pid).then((r) => r.data.data.instance),
  });
  const { data: history } = useQuery({
    queryKey: ['v2', 'instance', pid, 'history'],
    queryFn: () => instancesApi.history(pid).then((r) => r.data.data.entries),
  });

  const updatePrice = useMutation({
    mutationFn: async (newPrice) => {
      const fd = new FormData();
      fd.append('listedPrice', newPrice);
      return instancesApi.update(pid, fd);
    },
    onSuccess: () => {
      toast.success('Price updated');
      qc.invalidateQueries({ queryKey: ['v2', 'instance', pid] });
    },
  });

  if (isLoading) return <div className="text-sm text-brand-inkMuted">Loading…</div>;
  if (!data) return <div className="text-sm text-brand-error">Piece not found</div>;

  const photos = data.photos || [];
  const photo = photos[photoIdx];
  const qrUrl = instancesApi.qrUrl(pid);

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-brand-inkMuted flex items-center gap-1">
        <ChevronLeft size={14} /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Photo carousel + QR */}
        <div className="lg:col-span-2 space-y-3">
          <div className="aspect-square bg-brand-surface border border-brand-border rounded-xl overflow-hidden flex items-center justify-center">
            {photo ? (
              <img src={photo} alt={data.instanceCode} className="w-full h-full object-contain p-2" />
            ) : (
              <Package size={64} className="text-brand-inkMuted/40" strokeWidth={1.5} />
            )}
          </div>
          {photos.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setPhotoIdx(i)}
                  className={`aspect-square rounded-md overflow-hidden border-2 ${i === photoIdx ? 'border-brand-primary' : 'border-brand-border'}`}
                >
                  <img src={p} alt="" className="w-full h-full object-contain bg-white" />
                </button>
              ))}
            </div>
          )}

          {/* QR card */}
          <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-inkMuted">Instance code</p>
              <button onClick={() => setShowQR(!showQR)} className="text-xs text-brand-primary font-semibold flex items-center gap-1">
                <QrCode size={13} /> {showQR ? 'Hide' : 'Show'} QR
              </button>
            </div>
            <p className="font-mono text-base font-bold text-brand-ink">{data.instanceCode}</p>
            {showQR && (
              <div className="mt-3 space-y-2">
                <img src={qrUrl} alt="QR" className="w-full max-w-[200px] mx-auto bg-white p-2 rounded-md border border-brand-border" />
                <a href={qrUrl} download={`${data.instanceCode}.png`} className="block text-center text-xs text-brand-primary font-semibold">
                  <Download size={12} className="inline mr-1" /> Download PNG
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-3 space-y-4">
          <div>
            <p className="text-xs font-mono text-brand-primary">{data.product?.code}</p>
            <h1 className="text-2xl font-bold text-brand-ink">{data.product?.name}</h1>
            <p className="text-xs text-brand-inkMuted">{data.product?.materialType?.replace('_', ' + ')} · {data.product?.category}</p>
          </div>

          {/* Status row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge label={data.currentStage.replace('_', ' ')} />
            {data.daysOnDisplay != null && (
              <span className="text-xs text-brand-inkMuted flex items-center gap-1">
                <Calendar size={12} /> {data.daysOnDisplay} days on display
              </span>
            )}
            {data.currentLocation && (
              <span className="text-xs text-brand-inkMuted flex items-center gap-1">
                <MapPin size={12} /> {data.currentLocation.name}
              </span>
            )}
          </div>

          {/* Price */}
          <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-brand-inkMuted mb-1">Listed price</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-bold text-brand-ink tabular-nums">
                <IndianRupee size={18} className="inline -mt-1" />
                {new Intl.NumberFormat('en-IN').format(data.listedPrice || 0)}
              </p>
              {can('MANAGER') && (
                <button
                  onClick={() => {
                    const next = prompt('New listed price:', data.listedPrice);
                    if (next != null && !Number.isNaN(Number(next))) updatePrice.mutate(Number(next));
                  }}
                  className="text-xs text-brand-primary font-semibold"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Dimensions + notes */}
          {data.actualDimensions && (
            <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-brand-inkMuted mb-2">Dimensions</p>
              <p className="text-sm font-mono text-brand-ink">
                {data.actualDimensions.length || '—'} × {data.actualDimensions.width || '—'} × {data.actualDimensions.height || '—'} {data.actualDimensions.unit || 'cm'}
                {data.actualDimensions.weight ? ` · ${data.actualDimensions.weight}kg` : ''}
              </p>
            </div>
          )}
          {data.qualityNotes && (
            <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
              <p className="text-xs uppercase tracking-wider text-brand-inkMuted mb-1">Notes</p>
              <p className="text-sm text-brand-ink leading-relaxed">{data.qualityNotes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Link to={`/v2/pieces/${pid}/reserve`} className="action"><Bookmark size={14} /> Reserve</Link>
            <Link to={`/v2/pieces/${pid}/sale`} className="action action-primary"><ShoppingCart size={14} /> Record sale</Link>
            <Link to={`/v2/pieces/${pid}/transfer`} className="action"><MoveRight size={14} /> Transfer</Link>
          </div>

          {/* History */}
          <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
            <p className="text-xs uppercase tracking-wider text-brand-inkMuted mb-3 flex items-center gap-1.5">
              <History size={12} /> Movement history
            </p>
            {!history || history.length === 0 ? (
              <p className="text-xs text-brand-inkMuted">No movements yet</p>
            ) : (
              <ol className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="text-xs border-l-2 border-brand-primary/30 pl-3 py-0.5">
                    <p className="font-semibold text-brand-ink">{h.voucherType} · <span className="font-mono text-brand-primary">{h.voucherNo}</span></p>
                    <p className="text-brand-inkMuted">
                      {h.location?.name} · qty {String(h.quantity)} · {new Date(h.postingDate).toLocaleString()}
                    </p>
                    {h.remarks && <p className="text-brand-inkMuted italic">{h.remarks}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ label }) {
  return (
    <span className="inline-flex items-center text-[13px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-brand-primary/10 text-brand-primary">
      {label}
    </span>
  );
}
