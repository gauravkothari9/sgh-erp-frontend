import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Loader2, Package, Search, Check, Store, Globe, AlertTriangle, Pencil } from 'lucide-react';
import { showroomAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useShowroomSelectionStore } from '../../store/showroomSelectionStore';
import Modal from '../../components/common/Modal';
import ShowroomSelectionTable from './ShowroomSelectionTable';
import ImageLightbox from '../../components/common/ImageLightbox';
import { ProductFormModal } from './ShowroomZone';
import { resolveMediaSrc, imgErrorFallback } from '../../utils/formatters';
import { productSizeLabel } from '../../utils/dimensions';
import { totalQtyOf, stockSummary } from '../../utils/showroomZones';

const LONG_PRESS_MS = 450;

// Same question the zone pages ask on the first pick of a run.
function SelectionModeModal({ isOpen, onClose, onPick }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Who is this selection for?" size="sm">
      <div className="space-y-3">
        <button
          onClick={() => onPick('local')}
          className="w-full text-left p-4 rounded-xl border border-linen-300 hover:border-brand-400 hover:bg-brand-50/40 transition-all"
        >
          <p className="font-bold text-gray-800 flex items-center gap-2"><Store size={16} className="text-brand-600" /> Local customer</p>
          <p className="text-xs text-gray-500 mt-1">Walk-in buyer — priced at the local price, ends in a local order.</p>
        </button>
        <button
          onClick={() => onPick('export')}
          className="w-full text-left p-4 rounded-xl border border-linen-300 hover:border-brand-400 hover:bg-brand-50/40 transition-all"
        >
          <p className="font-bold text-gray-800 flex items-center gap-2"><Globe size={16} className="text-brand-600" /> Normal customer</p>
          <p className="text-xs text-gray-500 mt-1">Export buyer — you quote each price, ends in Excel and/or a draft order.</p>
        </button>
      </div>
    </Modal>
  );
}

// Every showroom product grouped by collection (Chairs, Almirahs, Consoles…),
// across BOTH branches and all their zones. Same tap-to-view / hold-to-select
// behaviour as a zone page — a pick carries the product's first location.
export default function ShowroomCollections() {
  const can = useAuthStore((s) => s.can);
  // Only offer a branch the user can actually read.
  const branchTabs = [
    can('showroomKakani') && 'Kakani',
    can('showroomJhalamand') && 'Jhalamand',
  ].filter(Boolean);

  // Deep links from the branch landing: ?branch=Kakani&missing=1
  const [params] = useSearchParams();

  const [collections, setCollections] = useState([]);
  const [missingCount, setMissingCount] = useState(0);
  const [onlyMissingPrice, setOnlyMissingPrice] = useState(params.get('missing') === '1');
  const [active, setActive] = useState('');   // '' = all collections
  const [branch, setBranch] = useState(
    branchTabs.includes(params.get('branch')) ? params.get('branch') : ''
  );
  const [editTarget, setEditTarget] = useState(null); // product being edited
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedItems = useShowroomSelectionStore((s) => s.items);
  const mode = useShowroomSelectionStore((s) => s.mode);
  const setMode = useShowroomSelectionStore((s) => s.setMode);
  const toggleSelect = useShowroomSelectionStore((s) => s.toggle);
  const [pendingPick, setPendingPick] = useState(null);

  const pressTimer = useRef(null);
  const longFired = useRef(false);

  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  // A collection card isn't tied to a zone — a pick draws from the product's
  // first stocked location, and stock deduction spills into other zones anyway.
  const primaryLocation = (p) => p.locations?.[0] || { branch: p.branch, zone: p.zone };

  // Editing a product that straddles both showrooms needs update rights on both,
  // same rule the API enforces.
  const canEdit = (p) => {
    const branches = [...new Set((p.locations || []).map((l) => l.branch))];
    return branches.length > 0 && branches.every((b) =>
      can(b === 'Kakani' ? 'showroomKakani' : 'showroomJhalamand', 'update')
    );
  };

  const pickFor = (p) => {
    const loc = primaryLocation(p);
    if (!mode && !selectedItems[p._id]) { setPendingPick(p); return; }
    toggleSelect(p, loc.branch, loc.zone);
  };

  const resolveMode = (chosen) => {
    setMode(chosen);
    if (pendingPick) {
      const loc = primaryLocation(pendingPick);
      toggleSelect(pendingPick, loc.branch, loc.zone);
    }
    setPendingPick(null);
  };

  const startPress = (p) => {
    longFired.current = false;
    cancelPress();
    pressTimer.current = setTimeout(() => {
      longFired.current = true;
      pressTimer.current = null;
      pickFor(p);
      navigator.vibrate?.(30);
    }, LONG_PRESS_MS);
  };

  useEffect(() => cancelPress, []);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await showroomAPI.getCollections({ branch: branch || undefined });
      setCollections(res.data?.data?.collections || []);
      setMissingCount(res.data?.data?.missingLocalPrice || 0);
    } catch { setCollections([]); setMissingCount(0); }
  }, [branch]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await showroomAPI.getCollectionProducts({
        branch: branch || undefined,
        collection: active || undefined,
        search: search || undefined,
        missingLocalPrice: onlyMissingPrice ? 1 : undefined,
      });
      setProducts(res.data?.data?.products || []);
    } catch { setProducts([]); } finally { setLoading(false); }
  }, [branch, active, search, onlyMissingPrice]);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);
  useEffect(() => {
    const t = setTimeout(fetchProducts, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchProducts, search]);

  const totalItems = collections.reduce((s, c) => s + c.items, 0);
  const totalUnits = collections.reduce((s, c) => s + c.units, 0);

  // A short click opens the photo — the lightbox browses every product on screen
  // that has one.
  const photoProducts = products.filter((p) => p.image);
  const lightboxImages = photoProducts.map((p) => resolveMediaSrc(p.image));
  const openPhoto = (p) => {
    const idx = photoProducts.findIndex((x) => x._id === p._id);
    if (idx >= 0) setLightboxIdx(idx);
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <LayoutGrid size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="page-title">Collections</h1>
            <p className="page-subtitle">
              {totalItems} product{totalItems === 1 ? '' : 's'} · {totalUnits} unit{totalUnits === 1 ? '' : 's'}
              {' '}in {branch || (branchTabs.length > 1 ? 'Kakani & Jhalamand' : branchTabs[0] || 'the showrooms')}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          {/* Branch toggle — all showrooms, or one of them */}
          {branchTabs.length > 1 && (
            <div className="flex rounded-xl border border-linen-300 bg-white p-0.5 self-start sm:self-auto">
              {[{ key: '', label: 'All' }, ...branchTabs.map((b) => ({ key: b, label: b }))].map((t) => (
                <button
                  key={t.key || 'all'}
                  onClick={() => setBranch(t.key)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    branch === t.key ? 'bg-brand-600 text-white' : 'text-gray-600 hover:text-brand-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <div className="relative w-full sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU, collection…"
              className="input pl-9"
            />
          </div>
        </div>
      </div>

      {/* Collection filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActive('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
            !active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-linen-300 hover:border-brand-300'
          }`}
        >
          All ({totalItems})
        </button>
        {collections.map((c) => (
          <button
            key={c.collection}
            onClick={() => setActive(c.collection)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              active === c.collection ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-linen-300 hover:border-brand-300'
            }`}
          >
            {c.collection} ({c.items})
          </button>
        ))}

        {/* Items nobody has priced for walk-in customers — they'd bill at ₹0 */}
        {missingCount > 0 && (
          <button
            onClick={() => setOnlyMissingPrice((v) => !v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
              onlyMissingPrice
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-red-50 text-red-700 border-red-200 hover:border-red-400'
            }`}
          >
            <AlertTriangle size={13} /> No local price ({missingCount})
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">
          No products{active ? ` in ${active}` : ''}{search ? ' matching that search' : ''}.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((p) => {
            const selected = !!selectedItems[p._id];
            return (
              <div
                key={p._id}
                onPointerDown={() => startPress(p)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => {
                  cancelPress();
                  if (longFired.current) { longFired.current = false; return; } // the hold already selected
                  openPhoto(p);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); openPhoto(p); }
                  if (e.key === ' ') { e.preventDefault(); pickFor(p); }
                }}
                title="Click to view photo · hold to select"
                className={`relative cursor-pointer select-none touch-manipulation bg-white border rounded-xl overflow-hidden shadow-card transition-all ${
                  selected ? 'border-brand-600 ring-2 ring-brand-500/40' : 'border-gray-300 hover:border-brand-300'
                }`}
              >
                <span
                  className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${
                    selected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white/90 border-gray-300 text-transparent'
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </span>

                {/* Edit works from here too — a product can be fixed without walking
                    to the zone it sits in. Needs update rights on every branch it
                    is stocked in. */}
                {canEdit(p) && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditTarget(p); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 z-10 w-7 h-7 rounded-md bg-white/90 border border-gray-300 text-gray-500 hover:text-brand-700 hover:border-brand-400 flex items-center justify-center"
                    title="Edit product"
                  >
                    <Pencil size={13} />
                  </button>
                )}

                <div className="aspect-square bg-linen-100 flex items-center justify-center overflow-hidden">
                  {p.image ? (
                    <img src={resolveMediaSrc(p.image)} onError={imgErrorFallback} alt={p.name} className="w-full h-full object-cover" />
                  ) : <Package size={28} className="text-gray-300" />}
                </div>

                <div className="p-3">
                  {p.collectionName && <p className="text-[12px] font-semibold text-brand-600 uppercase tracking-wider truncate">{p.collectionName}</p>}
                  <p className="font-bold text-gray-800 text-sm truncate" title={p.name}>{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">{productSizeLabel(p) || '—'}</p>
                  <p className="text-[13px] text-gray-500 mt-0.5 truncate" title={stockSummary(p)}>
                    <strong className="text-gray-800">{totalQtyOf(p)}</strong> in stock · {stockSummary(p) || '—'}
                  </p>
                  {p.localPrice ? (
                    <p className="text-sm font-bold text-brand-700 mt-1">
                      ₹ {Number(p.localPrice).toLocaleString('en-IN')}{' '}
                      <span className="text-[12px] font-medium text-gray-400">(Local Price)</span>
                    </p>
                  ) : (
                    <p className="text-[13px] font-semibold text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> No local price set
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ShowroomSelectionTable />

      <ProductFormModal
        isOpen={!!editTarget}
        product={editTarget}
        branch={editTarget ? primaryLocation(editTarget).branch : ''}
        zone={editTarget ? primaryLocation(editTarget).zone : ''}
        onClose={() => setEditTarget(null)}
        onSaved={() => { fetchProducts(); fetchCollections(); }}
        onRotated={() => fetchProducts()}
      />

      <SelectionModeModal
        isOpen={!!pendingPick}
        onClose={() => setPendingPick(null)}
        onPick={resolveMode}
      />

      {lightboxIdx !== null && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          index={lightboxIdx}
          title={photoProducts[lightboxIdx]?.name || ''}
          onChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}
