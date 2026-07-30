import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Store, Plus, Loader2, Save, Trash2, ImagePlus, Package, Check, X, Pencil, ArrowLeftRight, Globe,
  AlertTriangle,
} from 'lucide-react';
import { showroomAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useShowroomSelectionStore } from '../../store/showroomSelectionStore';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PhotoPicker from '../../components/common/PhotoPicker';
import ShowroomSelectionTable from './ShowroomSelectionTable';
import { resolveMediaSrc, imgErrorFallback } from '../../utils/formatters';
import { EMPTY_DIMENSIONS, productSizeLabel, productDimensions } from '../../utils/dimensions';
import { SHOWROOM_ZONES, SHOWROOM_BRANCHES, SHOWROOM_COLLECTIONS, zoneQtyOf, totalQtyOf, stockSummary } from '../../utils/showroomZones';
import toast from 'react-hot-toast';

// ── Stock rows editor ────────────────────────────────────────────────────────
// One item can sit in several zones at once (5 in Jhalamand A, 10 in Jhalamand C,
// 5 in Kakani A ⇒ total 20). The user edits that spread here; the total is
// derived, never typed.
function StockRows({ rows, onChange }) {
  const setRow = (idx, patch) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const addRow = () => onChange([...rows, { branch: SHOWROOM_BRANCHES[0], zone: 'A', qty: 1 }]);
  const dropRow = (idx) => onChange(rows.filter((_, i) => i !== idx));

  const total = rows.reduce((s, r) => s + (parseInt(r.qty, 10) || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label">Stock by zone</label>
        <span className="text-[13px] text-gray-500">Total qty: <strong className="text-gray-800">{total}</strong></span>
      </div>
      <div className="space-y-2">
        {rows.map((row, idx) => {
          const zones = SHOWROOM_ZONES[row.branch] || [];
          return (
            <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <select
                value={row.branch}
                onChange={(e) => {
                  const branch = e.target.value;
                  const zone = (SHOWROOM_ZONES[branch] || [])[0] || 'A';
                  setRow(idx, { branch, zone });
                }}
                className="input w-full sm:flex-1"
              >
                {SHOWROOM_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                value={row.zone}
                onChange={(e) => setRow(idx, { zone: e.target.value })}
                className="input flex-1 sm:flex-none sm:w-28"
              >
                {zones.map((z) => <option key={z} value={z}>Zone {z}</option>)}
              </select>
              <input
                type="number"
                min="0"
                value={row.qty}
                onChange={(e) => setRow(idx, { qty: e.target.value })}
                placeholder="Qty"
                className="input w-20 sm:w-24"
              />
              <button
                onClick={() => dropRow(idx)}
                disabled={rows.length === 1}
                className="text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:hover:text-gray-300"
                title="Remove this zone"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <button onClick={addRow} className="mt-2 text-xs font-semibold text-brand-700 hover:text-brand-800">
        + Add another zone
      </button>
    </div>
  );
}

// Create + edit form for a showroom product. `product` null → create mode.
export function ProductFormModal({ isOpen, onClose, branch, zone, product, onSaved }) {
  const isEdit = !!product;
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [collection, setCollection] = useState('');
  const [dims, setDims] = useState({ ...EMPTY_DIMENSIONS });
  const [basePrice, setBasePrice] = useState('');
  const [localPrice, setLocalPrice] = useState('');
  const [rows, setRows] = useState([{ branch, zone, qty: 1 }]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate on open — edit loads the product, create starts in this zone.
  useEffect(() => {
    if (!isOpen) return;
    setFile(null);
    setRemoveImage(false);
    if (product) {
      const d = productDimensions(product) || EMPTY_DIMENSIONS;
      setSku(product.sku || '');
      setName(product.name || '');
      setCollection(product.collectionName || '');
      setDims({ length: d.length || '', width: d.width || '', height: d.height || '', unit: d.unit || 'cm' });
      setBasePrice(product.basePrice ? String(product.basePrice) : '');
      setLocalPrice(product.localPrice ? String(product.localPrice) : '');
      setRows(
        product.locations?.length
          ? product.locations.map((l) => ({ branch: l.branch, zone: l.zone, qty: l.qty }))
          : [{ branch, zone, qty: 1 }]
      );
      setPreview(product.image ? resolveMediaSrc(product.image) : '');
    } else {
      setSku('');
      setName('');
      setCollection('');
      setDims({ ...EMPTY_DIMENSIONS });
      setBasePrice('');
      setLocalPrice('');
      setRows([{ branch, zone, qty: 1 }]);
      setPreview('');
    }
  }, [isOpen, product, branch, zone]);

  const pickImage = (f) => {
    if (!f) return;
    setFile(f);
    setRemoveImage(false);
    setPreview(URL.createObjectURL(f));
  };

  const dropImage = () => { setFile(null); setPreview(''); setRemoveImage(true); };

  const save = async () => {
    if (!name.trim()) { toast.error('Product name is required'); return; }
    const locations = rows
      .map((r) => ({ branch: r.branch, zone: r.zone, qty: parseInt(r.qty, 10) || 0 }))
      .filter((r) => r.qty > 0);
    if (!locations.length) { toast.error('Add stock in at least one zone'); return; }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('sku', sku.trim().toUpperCase());
      fd.append('name', name.trim());
      fd.append('collection', collection.trim());
      fd.append('length', dims.length || 0);
      fd.append('width', dims.width || 0);
      fd.append('height', dims.height || 0);
      fd.append('unit', dims.unit || 'cm');
      fd.append('basePrice', basePrice || '0');
      fd.append('localPrice', localPrice || '0');
      fd.append('locations', JSON.stringify(locations));
      if (file) fd.append('image', file);
      if (isEdit && removeImage && !file) fd.append('removeImage', 'true');

      if (isEdit) await showroomAPI.update(product._id, fd);
      else await showroomAPI.create(fd);

      toast.success(isEdit ? 'Product updated' : 'Product added');
      onSaved?.();
      onClose();
    } catch {
      /* interceptor toasts */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={`${isEdit ? 'Edit' : 'Add'} product — ${branch} Zone ${zone}`}
      size="md"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {isEdit ? 'Save changes' : 'Add product'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          {preview ? (
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-2 min-h-[260px] flex flex-col items-center justify-center gap-2">
              <img src={preview} onError={imgErrorFallback} alt="" className="max-h-[300px] w-full object-contain" />
              <PhotoPicker
                onFiles={(files) => pickImage(files[0])}
                label="Replace photo"
                icon={ImagePlus}
              />
            </div>
          ) : (
            <PhotoPicker
              onFiles={(files) => pickImage(files[0])}
              variant="tile"
              label="Add product image"
              hint="optional"
              icon={ImagePlus}
            />
          )}
          {preview && (
            <button
              onClick={dropImage}
              className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/90 border border-gray-300 text-gray-500 hover:text-red-500 flex items-center justify-center"
              title="Remove image"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">SKU</label>
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              placeholder="e.g. SGH-1042"
              className="input uppercase"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label label-required">Product name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Reclaimed Wood Cabinet" className="input" autoFocus />
          </div>
        </div>

        <div>
          <label className="label">Collection</label>
          <input
            list="showroom-collections"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            placeholder="e.g. Chairs, Almirahs, Consoles…"
            className="input"
          />
          <datalist id="showroom-collections">
            {SHOWROOM_COLLECTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div>
          <label className="label">Dimensions</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {['length', 'width', 'height'].map((key) => (
              <div key={key}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dims[key]}
                  onChange={(e) => setDims((d) => ({ ...d, [key]: e.target.value }))}
                  placeholder="0"
                  className="input"
                />
                <p className="text-[12px] text-gray-400 mt-0.5 capitalize">{key}</p>
              </div>
            ))}
            <div>
              <select value={dims.unit} onChange={(e) => setDims((d) => ({ ...d, unit: e.target.value }))} className="input">
                <option value="cm">cm</option>
                <option value="inch">inch</option>
              </select>
              <p className="text-[12px] text-gray-400 mt-0.5">Unit</p>
            </div>
          </div>
        </div>

        <StockRows rows={rows} onChange={setRows} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Base price (₹)</label>
            <input
              type="number"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="0"
              className="input"
            />
            <p className="text-[12px] text-gray-400 mt-0.5">Reference only — never billed</p>
          </div>
          <div>
            <label className="label">Local price (₹)</label>
            <input
              type="number"
              min="0"
              value={localPrice}
              onChange={(e) => setLocalPrice(e.target.value)}
              placeholder="0"
              className="input"
            />
            <p className="text-[12px] text-gray-400 mt-0.5">Billed to walk-in customers</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Move units of one product from one zone to another.
function TransferModal({ isOpen, onClose, product, branch, zone, onMoved }) {
  const [to, setTo] = useState({ branch, zone });
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQty(1);
    setTo({ branch, zone });
  }, [isOpen, branch, zone]);

  if (!product) return null;
  const available = zoneQtyOf(product, branch, zone);

  const move = async () => {
    const n = parseInt(qty, 10) || 0;
    if (n < 1 || n > available) { toast.error(`Enter 1–${available} units`); return; }
    if (to.branch === branch && to.zone === zone) { toast.error('Pick a different destination zone'); return; }
    setSaving(true);
    try {
      await showroomAPI.transfer(product._id, { from: { branch, zone }, to, qty: n });
      toast.success('Stock moved');
      onMoved?.();
      onClose();
    } catch { /* toasted */ } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={`Move stock — ${product.name}`}
      size="sm"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn btn-secondary">Cancel</button>
          <button onClick={move} disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <ArrowLeftRight size={15} />}
            Move
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          From <strong>{branch} Zone {zone}</strong> — {available} unit{available === 1 ? '' : 's'} available.
        </p>
        <div>
          <label className="label">Destination</label>
          <div className="flex items-center gap-2">
            <select
              value={to.branch}
              onChange={(e) => {
                const b = e.target.value;
                setTo({ branch: b, zone: (SHOWROOM_ZONES[b] || [])[0] || 'A' });
              }}
              className="input flex-1"
            >
              {SHOWROOM_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={to.zone} onChange={(e) => setTo((t) => ({ ...t, zone: e.target.value }))} className="input w-32">
              {(SHOWROOM_ZONES[to.branch] || []).map((z) => <option key={z} value={z}>Zone {z}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Qty to move</label>
          <input type="number" min="1" max={available} value={qty} onChange={(e) => setQty(e.target.value)} className="input" />
        </div>
        <p className="text-[13px] text-gray-400">Current spread: {stockSummary(product) || '—'}</p>
      </div>
    </Modal>
  );
}

// Read-only product view — what a plain click (short press) opens.
function ViewProductModal({ product, branch, zone, isOpen, onClose, selected, onToggleSelect }) {
  if (!product) return null;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product.name}
      size="md"
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary">Close</button>
          <button onClick={() => { onToggleSelect(product); onClose(); }} className="btn btn-primary">
            {selected ? <><X size={15} /> Unselect</> : <><Check size={15} /> Select</>}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-linen-100 border border-linen-300 flex items-center justify-center overflow-hidden p-2 min-h-[220px]">
          {product.image ? (
            <img src={resolveMediaSrc(product.image)} onError={imgErrorFallback} alt={product.name} className="max-h-[340px] w-full object-contain" />
          ) : <Package size={40} className="text-gray-300" />}
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[13px] uppercase tracking-wider text-gray-400">SKU</dt>
            <dd className="font-semibold text-gray-800">{product.sku || '—'}</dd>
          </div>
          <div>
            <dt className="text-[13px] uppercase tracking-wider text-gray-400">Dimensions</dt>
            <dd className="font-semibold text-gray-800">{productSizeLabel(product) || '—'}</dd>
          </div>
          <div>
            <dt className="text-[13px] uppercase tracking-wider text-gray-400">Local Price</dt>
            <dd className="font-bold text-brand-700">₹ {Number(product.localPrice || 0).toLocaleString('en-IN')}</dd>
          </div>
          <div>
            <dt className="text-[13px] uppercase tracking-wider text-gray-400">Base Price</dt>
            <dd className="font-semibold text-gray-800">₹ {Number(product.basePrice || 0).toLocaleString('en-IN')}</dd>
          </div>
          <div>
            <dt className="text-[13px] uppercase tracking-wider text-gray-400">In this zone</dt>
            <dd className="font-semibold text-gray-800">{zoneQtyOf(product, branch, zone)} of {totalQtyOf(product)} total</dd>
          </div>
          <div>
            <dt className="text-[13px] uppercase tracking-wider text-gray-400">Stock spread</dt>
            <dd className="font-semibold text-gray-800">{stockSummary(product) || '—'}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}

// Asked once, when the first item of a run is picked: who are we picking for?
// The answer drives the prices shown and where the run ends up.
function SelectionModeModal({ isOpen, onClose, onPick }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Who is this selection for?" size="sm">
      <div className="space-y-3">
        <button
          onClick={() => onPick('local')}
          className="w-full text-left p-4 rounded-xl border border-linen-300 hover:border-brand-400 hover:bg-brand-50/40 transition-all"
        >
          <p className="font-bold text-gray-800 flex items-center gap-2"><Store size={16} className="text-brand-600" /> Local customer</p>
          <p className="text-xs text-gray-500 mt-1">
            Walk-in buyer. Items are priced at their <strong>local price</strong> and the run ends in a local order — bill printed, showroom stock deducted.
          </p>
        </button>
        <button
          onClick={() => onPick('export')}
          className="w-full text-left p-4 rounded-xl border border-linen-300 hover:border-brand-400 hover:bg-brand-50/40 transition-all"
        >
          <p className="font-bold text-gray-800 flex items-center gap-2"><Globe size={16} className="text-brand-600" /> Normal customer</p>
          <p className="text-xs text-gray-500 mt-1">
            Export buyer. You quote each price on the spot; the run ends in an Excel sheet and/or a draft order in Office → Orders.
          </p>
        </button>
      </div>
    </Modal>
  );
}

const LONG_PRESS_MS = 450;

export default function ShowroomZone({ branch, zone }) {
  const can = useAuthStore((s) => s.can);
  const mod = branch === 'Kakani' ? 'showroomKakani' : 'showroomJhalamand';
  const canCreate = can(mod, 'create');
  const canUpdate = can(mod, 'update');
  const canDelete = can(mod, 'delete');

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formTarget, setFormTarget] = useState(null);   // { product } — product null = create
  const [transferTarget, setTransferTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [onlyUnpriced, setOnlyUnpriced] = useState(false);

  const selectedItems = useShowroomSelectionStore((s) => s.items);
  const mode = useShowroomSelectionStore((s) => s.mode);
  const setMode = useShowroomSelectionStore((s) => s.setMode);
  const toggleSelect = useShowroomSelectionStore((s) => s.toggle);
  const unselect = useShowroomSelectionStore((s) => s.remove);

  // First pick of a run has to answer "local or normal customer?" before the
  // item lands in the table — the answer decides which price it carries.
  const [pendingPick, setPendingPick] = useState(null);

  const pickFor = (product) => {
    if (!mode && !selectedItems[product._id]) { setPendingPick(product); return; }
    toggleSelect(product, branch, zone);
  };

  const resolveMode = (chosen) => {
    setMode(chosen);
    if (pendingPick) toggleSelect(pendingPick, branch, zone);
    setPendingPick(null);
  };

  // Long-press (hold ~450ms) toggles selection; a short press opens the product
  // view. `longFired` swallows the click that a completed long-press emits.
  const pressTimer = useRef(null);
  const longFired = useRef(false);

  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
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

  const handleCardClick = (p) => {
    cancelPress();
    if (longFired.current) { longFired.current = false; return; } // long-press already acted
    setViewTarget(p);
  };

  useEffect(() => cancelPress, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await showroomAPI.list({ branch, zone });
      setProducts(res.data?.data?.products || []);
    } catch { setProducts([]); } finally { setLoading(false); }
  }, [branch, zone]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const doDelete = async () => {
    try {
      await showroomAPI.remove(deleteTarget._id);
      unselect(deleteTarget._id); // a deleted product can't stay in the export list
      toast.success('Product removed');
      setDeleteTarget(null);
      fetchProducts();
    } catch { /* toasted */ }
  };

  const unpricedCount = products.filter((p) => !p.localPrice).length;
  const visibleProducts = onlyUnpriced ? products.filter((p) => !p.localPrice) : products;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <Store size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="page-title">{branch} Showroom — Zone {zone}</h1>
            <p className="page-subtitle">
              {products.length} product{products.length === 1 ? '' : 's'} on display · tap to view, hold to select
            </p>
          </div>
        </div>
        {canCreate && (
          <button onClick={() => setFormTarget({ product: null })} className="btn-primary btn">
            <Plus size={16} /> Add product
          </button>
        )}
      </div>

      {/* Items nobody has priced for walk-ins — they'd bill at ₹0 on a local order */}
      {unpricedCount > 0 && (
        <button
          onClick={() => setOnlyUnpriced((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
            onlyUnpriced ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200 hover:border-red-400'
          }`}
        >
          <AlertTriangle size={13} /> No local price ({unpricedCount})
        </button>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
      ) : visibleProducts.length === 0 ? (
        <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">
          {onlyUnpriced
            ? 'Every product in this zone has a local price.'
            : `No products in this zone yet.${canCreate ? ' Click “Add product” to add one.' : ''}`}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleProducts.map((p) => {
            const selected = !!selectedItems[p._id];
            const here = p.zoneQty ?? zoneQtyOf(p, branch, zone);
            const total = totalQtyOf(p);
            return (
              <div
                key={p._id}
                onClick={() => handleCardClick(p)}
                onPointerDown={() => startPress(p)}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()} // touch long-press must not open the OS menu
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); setViewTarget(p); }
                  if (e.key === ' ') { e.preventDefault(); pickFor(p); } // Space = select
                }}
                title="Click to view · hold to select"
                className={`relative cursor-pointer select-none touch-manipulation bg-white border rounded-xl overflow-hidden shadow-card group transition-all ${
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

                {canUpdate && (
                  // Always visible — hover-only hid these on touch devices
                  // (tablets in the showroom), so staff saw no action buttons.
                  <div className="absolute top-2 right-2 z-10 flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setTransferTarget(p); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-7 h-7 rounded-md bg-white/90 border border-gray-300 text-gray-500 hover:text-brand-700 hover:border-brand-400 flex items-center justify-center"
                      title="Move stock to another zone"
                    >
                      <ArrowLeftRight size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFormTarget({ product: p }); }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-7 h-7 rounded-md bg-white/90 border border-gray-300 text-gray-500 hover:text-brand-700 hover:border-brand-400 flex items-center justify-center"
                      title="Edit product"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                )}

                <div className="aspect-square bg-linen-100 flex items-center justify-center overflow-hidden">
                  {p.image ? (
                    <img
                      src={resolveMediaSrc(p.image)}
                      onError={imgErrorFallback}
                      alt={p.name}
                      className={`w-full h-full object-cover transition ${here === 0 ? 'grayscale opacity-60' : ''}`}
                    />
                  ) : <Package size={28} className="text-gray-300" />}
                </div>

                <div className="p-3">
                  {(p.sku || p.collectionName) && (
                    <p className="text-[12px] font-semibold tracking-wider truncate">
                      {p.collectionName && <span className="text-brand-600 uppercase">{p.collectionName}</span>}
                      {p.collectionName && p.sku && <span className="text-gray-300"> · </span>}
                      {p.sku && <span className="text-gray-400">{p.sku}</span>}
                    </p>
                  )}
                  <p className="font-bold text-gray-800 text-sm truncate" title={p.name}>{p.name}</p>
                  <p className="text-xs text-gray-500 truncate">{productSizeLabel(p) || '—'}</p>
                  {here === 0 ? (
                    <p className="mt-0.5" title={stockSummary(p)}>
                      <span className="inline-block px-1.5 py-0.5 rounded text-[12px] font-bold uppercase tracking-wide bg-red-100 text-red-700">
                        Out of stock
                      </span>
                      {total > 0 && <span className="text-[13px] text-gray-400"> · {total} in other zones</span>}
                    </p>
                  ) : (
                    <p className="text-[13px] text-gray-500 mt-0.5" title={stockSummary(p)}>
                      <strong className="text-gray-800">{here}</strong> here
                      {total !== here && <span className="text-gray-400"> · {total} total</span>}
                    </p>
                  )}
                  <div className="flex items-end justify-between mt-1">
                    <div className="min-w-0">
                      {p.localPrice ? (
                        <p className="text-sm font-bold text-brand-700 truncate">
                          ₹ {Number(p.localPrice).toLocaleString('en-IN')}{' '}
                          <span className="text-[12px] font-medium text-gray-400">(Local Price)</span>
                        </p>
                      ) : (
                        <p className="text-[13px] font-semibold text-red-600 flex items-center gap-1">
                          <AlertTriangle size={12} /> No local price set
                        </p>
                      )}
                      <p className="text-[13px] text-gray-400 truncate">
                        ₹ {Number(p.basePrice || 0).toLocaleString('en-IN')} (Base Price)
                      </p>
                    </div>
                    {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ShowroomSelectionTable />

      <SelectionModeModal
        isOpen={!!pendingPick}
        onClose={() => setPendingPick(null)}
        onPick={resolveMode}
      />

      <ProductFormModal
        isOpen={!!formTarget}
        product={formTarget?.product || null}
        branch={branch}
        zone={zone}
        onClose={() => setFormTarget(null)}
        onSaved={fetchProducts}
      />

      <TransferModal
        isOpen={!!transferTarget}
        product={transferTarget}
        branch={branch}
        zone={zone}
        onClose={() => setTransferTarget(null)}
        onMoved={fetchProducts}
      />

      <ViewProductModal
        isOpen={!!viewTarget}
        product={viewTarget}
        branch={branch}
        zone={zone}
        selected={!!(viewTarget && selectedItems[viewTarget._id])}
        onToggleSelect={(p) => pickFor(p)}
        onClose={() => setViewTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Remove product"
        confirmLabel="Remove"
      >
        <p className="text-sm text-gray-600 mt-2">
          Remove <strong>{deleteTarget?.name}</strong> from the showroom? This deletes it from every zone
          ({stockSummary(deleteTarget) || '—'}).
        </p>
      </ConfirmDialog>
    </div>
  );
}
