import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, ArrowRight, ArrowLeft, Package, Folder, ChevronRight } from 'lucide-react';
import { productionAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { useDebounce } from '../../hooks/useDebounce';
import { resolveMediaSrc, imgErrorFallback } from '../../utils/formatters';
import Modal from '../common/Modal';
import RouteItemModal from '../orders/RouteItemModal';
import ImageLightbox from '../common/ImageLightbox';

// Popup asking how many pieces to move to another stage (forward or back).
function MoveQtyModal({ card, toStage, saving, onClose, onConfirm }) {
  const [qty, setQty] = useState(card.quantity);
  const clamp = (n) => Math.max(1, Math.min(card.quantity, n || 1));
  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={`Move to ${toStage}`}
      size="sm"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn-secondary btn btn-sm">Cancel</button>
          <button onClick={() => onConfirm(qty)} disabled={saving} className="btn-primary btn btn-sm">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            Move {qty} pc{qty === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          <strong className="font-mono">{card.companySKU}</strong> — {card.quantity} pc{card.quantity === 1 ? '' : 's'} at{' '}
          <strong className="text-gray-900">{card.currentStage}</strong>. How many move to{' '}
          <strong className="text-gray-900">{toStage}</strong>?
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="number" min={1} max={card.quantity} value={qty}
            onChange={(e) => setQty(clamp(parseInt(e.target.value, 10)))} className="input w-24" autoFocus />
          <button onClick={() => setQty(card.quantity)} className="btn-secondary btn btn-sm">Move all ({card.quantity})</button>
        </div>
      </div>
    </Modal>
  );
}

// Popup that picks BOTH a destination stage and how many pieces move there.
// Used where a plain next/prev step isn't enough — e.g. moving outsourced goods
// straight into Polish / QC / Packing.
function MoveToStageModal({ card, stages, saving, onClose, onConfirm }) {
  const options = stages.filter((s) => s !== card.currentStage);
  const [toStage, setToStage] = useState(options[0] || '');
  const [qty, setQty] = useState(card.quantity);
  const clamp = (n) => Math.max(1, Math.min(card.quantity, n || 1));
  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title="Move to stage"
      size="sm"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn-secondary btn btn-sm">Cancel</button>
          <button
            onClick={() => onConfirm(toStage, qty)}
            disabled={saving || !toStage}
            className="btn-primary btn btn-sm"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
            Move {qty} pc{qty === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          <strong className="font-mono">{card.companySKU}</strong> — {card.quantity} pc{card.quantity === 1 ? '' : 's'} at{' '}
          <strong className="text-gray-900">{card.currentStage}</strong>.
        </p>
        <div>
          <label className="label">Move to stage</label>
          <select value={toStage} onChange={(e) => setToStage(e.target.value)} className="input" autoFocus>
            {options.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">How many pieces</label>
          <div className="flex flex-wrap items-center gap-2">
            <input type="number" min={1} max={card.quantity} value={qty}
              onChange={(e) => setQty(clamp(parseInt(e.target.value, 10)))} className="input w-24" />
            <button onClick={() => setQty(card.quantity)} className="btn-secondary btn btn-sm">Move all ({card.quantity})</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Shared table view for every branch/stage screen. Navigation is always the same
 * three-level drill: customer file → the orders in that file → that order's
 * items. Only what a row shows and does changes with the mode:
 *   mode="overview" (Kakani/Jhalamand Orders, Production) — one row per item with
 *                    its full stage distribution (e.g. 4 Repairing · 1 Polish …).
 *   mode="stage"    (Repairing/Polish/QC/Packing/…) — one row per item at that
 *                    stage, with a quantity move action.
 */
export default function StageView({
  title, subtitle, icon: Icon = Package, filters = {}, mode = 'stage',
  advance = false, allowRoute = false, renderExtra, emptyText = 'No items here yet.',
  // When set (array of stage names), the Action becomes a single "Move" button
  // that opens a stage picker offering these destinations — used by Outsourced
  // to hand finished supplier goods into a chosen Kakani production stage.
  moveToStages = null,
  // Folder grouping: 'file' (default — one folder per customer file) or 'order'
  // (one folder per order, so a file holding several orders shows each order
  // separately with its own items).
  groupBy = 'file',
  // With file grouping, an opened file shows its items grouped under each order
  // — the three-level File → Orders → Items drill. On by default so every
  // branch/stage screen navigates identically to Production; pass
  // nestOrders={false} for a flat File → Items view.
  nestOrders = true,
}) {
  const byOrder = groupBy === 'order';
  const navigate = useNavigate();
  const { can, isAdmin } = useAuthStore();
  const canUpdate = can('production', 'update') || isAdmin();
  const isOverview = mode === 'overview';

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState(null);
  const [move, setMove] = useState(null); // { card, dir: 'next' | 'back' }
  const [moveTo, setMoveTo] = useState(null); // { card } — stage-picker move
  const [routeCard, setRouteCard] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { images:[urls], index }
  const [search, setSearch] = useState('');
  const [openFile, setOpenFile] = useState(null);
  const [openOrder, setOpenOrder] = useState(null); // 3-level drill: order within a file
  const debounced = useDebounce(search, 350);

  const filterKey = JSON.stringify(filters);
  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productionAPI.getBoard({
        ...filters,
        group: isOverview ? 'item' : undefined,
        search: debounced || undefined,
      });
      setCards(res.data?.data?.cards || []);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, debounced, isOverview]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  const keyOf = (c) => `${c.orderId}-${c.itemId}-${c.currentStage}`;

  const confirmMove = async (qty) => {
    const { card, dir } = move;
    setBusyKey(keyOf(card));
    try {
      await productionAPI.advanceStage(card.orderId, card.itemId, { fromStage: card.currentStage, qty, direction: dir });
      setMove(null);
      await fetchCards();
    } catch { /* toasted */ } finally { setBusyKey(null); }
  };

  const confirmMoveTo = async (toStage, qty) => {
    const { card } = moveTo;
    setBusyKey(keyOf(card));
    try {
      await productionAPI.advanceStage(card.orderId, card.itemId, { fromStage: card.currentStage, toStage, qty });
      setMoveTo(null);
      await fetchCards();
    } catch { /* toasted */ } finally { setBusyKey(null); }
  };

  const toggleFlag = async (card, field) => {
    try {
      await productionAPI.setItemProduction(card.orderId, card.itemId, { [field]: !card[field] });
      await fetchCards();
    } catch { /* toasted */ }
  };

  const toggleFilePriority = async (folder) => {
    const allPriority = folder.items.every((i) => i.priority);
    try {
      // Order-grouped folders flag just that order; file-grouped flag the file.
      if (byOrder && folder.orderId) {
        await productionAPI.setOrderFlags(folder.orderId, { priority: !allPriority });
      } else {
        await productionAPI.setFileFlags(folder.fileNumber, { priority: !allPriority });
      }
      await fetchCards();
    } catch { /* toasted */ }
  };

  // Flag every item of one order (used by the nested order sections).
  const toggleOrderPriority = async (orderId, items) => {
    const allPriority = items.every((i) => i.priority);
    try {
      await productionAPI.setOrderFlags(orderId, { priority: !allPriority });
      await fetchCards();
    } catch { /* toasted */ }
  };

  // Group an opened file's items by their order, preserving first-seen order.
  const orderGroupsOf = (items) => {
    const map = new Map();
    for (const c of items) {
      const key = String(c.orderId || c.orderNumber || '—');
      if (!map.has(key)) {
        map.set(key, { orderId: c.orderId, orderNumber: c.orderNumber || '—', items: [], units: 0 });
      }
      const g = map.get(key);
      g.items.push(c);
      g.units += c.quantity || 0;
    }
    return [...map.values()].sort((a, b) => String(a.orderNumber).localeCompare(String(b.orderNumber)));
  };

  const openLightbox = (card) => {
    const imgs = (card.images?.length ? card.images : [card.image]).filter(Boolean).map(resolveMediaSrc);
    if (imgs.length) setLightbox({ images: imgs, index: 0 });
  };

  const folders = useMemo(() => {
    const map = {};
    for (const c of cards) {
      // One folder per order (byOrder) or per file. The key must be unique per
      // group — orderId keeps two orders in the same file apart.
      const key = byOrder ? String(c.orderId || c.orderNumber || '—') : (c.fileNumber || '—');
      if (!map[key]) {
        map[key] = {
          key,
          orderId: c.orderId,
          orderNumber: c.orderNumber || '',
          fileNumber: c.fileNumber || '—',
          customerName: c.customerName,
          items: [], units: 0,
        };
      }
      map[key].items.push(c);
      map[key].units += c.quantity || 0;
    }
    const val = (f) => (byOrder ? String(f.orderNumber) : String(f.fileNumber));
    return Object.values(map).sort((a, b) => val(a).localeCompare(val(b)));
  }, [cards, byOrder]);

  const openFolder = openFile ? folders.find((f) => f.key === openFile) : null;

  // ── Shared cell renderers ──
  const ImgCell = ({ card }) => (
    <button
      onClick={() => openLightbox(card)}
      className="w-14 h-14 rounded-lg overflow-hidden bg-linen-100 flex items-center justify-center hover:ring-2 hover:ring-brand-300 transition-all"
      title="View image"
    >
      {card.image ? (
        <img src={resolveMediaSrc(card.image)} onError={imgErrorFallback} alt="" className="w-full h-full object-cover" />
      ) : <Package size={18} className="text-gray-300" />}
    </button>
  );

  // `row` lays the flags out horizontally — used by the phone card, where a
  // vertical stack would waste a whole column of width.
  const FlagsCell = ({ card, row = false }) => (
    <div className={row ? 'flex items-center gap-1' : 'flex flex-col items-stretch gap-1'}>
      <button
        onClick={() => canUpdate && toggleFlag(card, 'priority')}
        title="Toggle priority"
        className={`text-[13px] font-bold px-2 py-1 rounded border transition-colors ${
          card.priority ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-amber-300'
        }`}
      >
        Priority
      </button>
      <button
        onClick={() => canUpdate && toggleFlag(card, 'running')}
        title="Toggle running / idle"
        className={`text-[13px] font-bold px-2 py-1 rounded border transition-colors ${
          card.running ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-emerald-300'
        }`}
      >
        {card.running ? 'Running' : 'Idle'}
      </button>
    </div>
  );

  const ItemCell = ({ card }) => (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-xs font-bold text-gray-800 break-all">{card.companySKU || '—'}</span>
        {card.branch && <span className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded bg-brand-100 text-brand-800">{card.branch}</span>}
      </div>
      <p className="text-xs text-gray-600 break-words">{card.itemDescription || '—'}</p>
      <button onClick={() => navigate(`/office/orders/${card.orderId}`)} className="text-[13px] text-brand-600 hover:underline">
        {card.orderNumber}
      </button>
      {card.maker && <span className="ml-2 text-[12px] text-gray-400">{card.maker}</span>}
      {renderExtra && <div>{renderExtra(card)}</div>}
    </div>
  );

  const Distribution = ({ card }) => (
    (card.stageQty || []).length === 0 ? (
      <span className="text-[13px] text-amber-600">Unrouted</span>
    ) : (
      <div className="space-y-0.5 whitespace-nowrap">
        {card.stageQty.map((s) => (
          <div key={s.stage} className="flex items-baseline gap-1.5 text-[13px] leading-tight">
            <span className={`w-6 text-right font-bold tabular-nums ${s.stage === 'Ready for Container' ? 'text-emerald-700' : 'text-gray-800'}`}>{s.qty}</span>
            <span className={s.stage === 'Ready for Container' ? 'text-emerald-700 font-medium' : 'text-gray-600'}>{s.stage}</span>
          </div>
        ))}
        <div className="flex items-baseline gap-1.5 text-[13px] leading-tight border-t border-gray-200 pt-0.5 mt-0.5 font-bold text-gray-800">
          <span className="w-6 text-right tabular-nums">{card.totalQty}</span>
          <span>Total</span>
        </div>
      </div>
    )
  );

  // Same actions in both layouts — the table right-aligns them, the phone card
  // lets them wrap onto their own line.
  const Actions = ({ card, className = '' }) => {
    if (card.needsSetup) {
      return allowRoute && canUpdate ? (
        <button onClick={() => setRouteCard(card)} className="btn-primary btn btn-sm text-[13px] whitespace-nowrap">Assign</button>
      ) : <span className="text-[13px] text-gray-300">—</span>;
    }
    // Stage-picker move (opt-in via moveToStages) — one button, a chosen target.
    if (!isOverview && moveToStages?.length && canUpdate) {
      return (
        <button
          onClick={() => setMoveTo({ card })}
          disabled={busyKey === keyOf(card)}
          className="btn-primary btn btn-sm text-[13px] whitespace-nowrap"
        >
          {busyKey === keyOf(card) ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
          Move
        </button>
      );
    }
    if (!isOverview && advance && canUpdate && (card.nextStage || card.prevStage)) {
      return (
        <div className={`flex flex-wrap items-center gap-1 ${className}`}>
          {isAdmin() && card.prevStage && (
            <button
              onClick={() => setMove({ card, dir: 'back' })}
              disabled={busyKey === keyOf(card)}
              title={`Move back to ${card.prevStage}`}
              className="btn-secondary btn btn-sm p-1.5"
            >
              <ArrowLeft size={12} />
            </button>
          )}
          {card.nextStage && (
            <button onClick={() => setMove({ card, dir: 'next' })} disabled={busyKey === keyOf(card)} className="btn-primary btn btn-sm text-[13px] whitespace-nowrap">
              {busyKey === keyOf(card) ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
              Move to {card.nextStage}
            </button>
          )}
        </div>
      );
    }
    return <span className="text-[13px] text-gray-300">—</span>;
  };

  const Th = ({ children, className = '' }) => (
    <th className={`px-3 py-2 text-left font-semibold text-gray-500 border border-gray-300 whitespace-nowrap ${className}`}>{children}</th>
  );

  // Phone layout: one stacked card per item instead of a 7-column table.
  const renderCards = (items) => (
    <div className="space-y-3 md:hidden">
      {items.map((card) => (
        <div
          key={keyOf(card)}
          className={`rounded-xl border p-3 space-y-3 ${card.priority ? 'border-amber-300 bg-amber-50/50' : 'border-gray-300 bg-white'}`}
        >
          <div className="flex gap-3">
            <ImgCell card={card} />
            <div className="min-w-0 flex-1"><ItemCell card={card} /></div>
          </div>

          {card.comments && (
            <p className="text-sm font-bold text-gray-800 break-words">{card.comments}</p>
          )}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {!isOverview && (
                <p className="text-[13px] text-gray-500 mb-1">
                  Qty here <span className="font-bold text-gray-800 tabular-nums">{card.quantity}</span>
                </p>
              )}
              <Distribution card={card} />
            </div>
            <FlagsCell card={card} row />
          </div>

          <Actions card={card} />
        </div>
      ))}
    </div>
  );

  const renderTable = (items) => (
    <div className="hidden md:block overflow-x-auto border border-gray-300 rounded-xl">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-brand-50/60 text-[12px] uppercase tracking-wide">
          <tr>
            <Th>Flags</Th>
            <Th>Image</Th>
            <Th>Item</Th>
            <Th>Comments</Th>
            {!isOverview && <Th className="text-right">Qty here</Th>}
            <Th>Stages</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((card) => (
            <tr key={keyOf(card)} className={`hover:bg-brand-50/40 ${card.priority ? 'bg-amber-50/40' : ''}`}>
              <td className="border border-gray-300 px-3 py-2"><FlagsCell card={card} /></td>
              <td className="border border-gray-300 px-3 py-2"><ImgCell card={card} /></td>
              <td className="border border-gray-300 px-3 py-2 max-w-[240px]"><ItemCell card={card} /></td>
              <td className="border border-gray-300 px-3 py-2 max-w-[220px] text-sm font-bold text-gray-800">{card.comments || '—'}</td>
              {!isOverview && (
                <td className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-800 tabular-nums align-top">{card.quantity}</td>
              )}
              <td className="border border-gray-300 px-3 py-2 align-top"><Distribution card={card} /></td>
              <td className="border border-gray-300 px-3 py-2 text-right align-top">
                <Actions card={card} className="justify-end" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Cards below md, table from md up.
  const renderItems = (items) => (
    <>
      {renderCards(items)}
      {renderTable(items)}
    </>
  );

  return (
    <div className="space-y-5">
      {title && (
        <div className="page-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
              <Icon size={20} strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <h1 className="page-title">{title}</h1>
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full sm:max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SKU, file, description, maker…" className="input pl-9" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
      ) : cards.length === 0 ? (
        <div className="bg-white border border-linen-300 rounded-xl p-8 sm:p-12 text-center text-gray-400">{emptyText}</div>
      ) : openFolder && nestOrders && !byOrder ? (
        // ── Three-level drill: File → Orders → Items ──
        (() => {
          const orderGroups = orderGroupsOf(openFolder.items);
          const selected = openOrder
            ? orderGroups.find((g) => String(g.orderId || g.orderNumber) === openOrder)
            : null;

          // Level 3 — the chosen order's items.
          if (selected) {
            const allPriority = selected.items.length > 0 && selected.items.every((i) => i.priority);
            return (
              <div className="space-y-4">
                <button onClick={() => setOpenOrder(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                  <ArrowLeft size={14} /> Back to orders in {openFolder.fileNumber}
                </button>
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-brand-700">Order</span>
                  <button onClick={() => navigate(`/office/orders/${selected.orderId}`)} className="font-mono font-bold text-brand-800 text-sm hover:underline break-all">
                    {selected.orderNumber}
                  </button>
                  <span className="text-xs font-mono text-gray-400 whitespace-nowrap">file {openFolder.fileNumber}</span>
                  <span className="text-sm text-gray-500 truncate max-w-full">{openFolder.customerName}</span>
                  <span className="text-[12px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">{selected.units} pcs</span>
                  {canUpdate && selected.orderId && (
                    <button
                      onClick={() => toggleOrderPriority(selected.orderId, selected.items)}
                      className={`sm:ml-2 text-xs font-bold px-3 py-1 rounded border transition-colors ${
                        allPriority ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      {allPriority ? '★ Priority order — clear' : 'Mark order priority'}
                    </button>
                  )}
                </div>
                {renderItems(selected.items)}
              </div>
            );
          }

          // Level 2 — the file's orders as a clickable list.
          const fileAllPriority = openFolder.items.length > 0 && openFolder.items.every((i) => i.priority);
          return (
            <div className="space-y-4">
              <button onClick={() => { setOpenFile(null); setOpenOrder(null); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft size={14} /> Back to files
              </button>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <Folder size={18} className="text-brand-500 shrink-0" />
                <span className="font-mono font-bold text-brand-800 break-all">{openFolder.fileNumber}</span>
                <span className="text-sm text-gray-500 truncate max-w-full">{openFolder.customerName}</span>
                <span className="text-[12px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">{openFolder.units} pcs</span>
                {canUpdate && (
                  <button
                    onClick={() => toggleFilePriority(openFolder)}
                    className={`sm:ml-2 text-xs font-bold px-3 py-1 rounded border transition-colors ${
                      fileAllPriority ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-amber-300'
                    }`}
                  >
                    {fileAllPriority ? '★ Priority file — clear' : 'Mark whole file priority'}
                  </button>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-600">
                {orderGroups.length} order{orderGroups.length === 1 ? '' : 's'} in this file
              </p>
              <div className="space-y-3">
                {orderGroups.map((og) => (
                  <div
                    key={og.orderId || og.orderNumber}
                    onClick={() => setOpenOrder(String(og.orderId || og.orderNumber))}
                    className="bg-white rounded-xl shadow-sm border border-brand-100 px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-brand-50 hover:border-brand-300 transition-all group"
                  >
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 min-w-0">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-brand-700">Order</span>
                      <span className="font-mono font-bold text-brand-800 text-sm group-hover:text-brand-900 break-all">{og.orderNumber}</span>
                      {og.items.some((i) => i.priority) && (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">★ Priority</span>
                      )}
                      <span className="bg-gray-100 border border-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                        {og.items.length} item{og.items.length === 1 ? '' : 's'} · {og.units} pc{og.units === 1 ? '' : 's'}
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0 group-hover:text-brand-500 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          );
        })()
      ) : openFolder ? (
        <div className="space-y-4">
          <button onClick={() => setOpenFile(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={14} /> Back to {byOrder ? 'orders' : 'files'}
          </button>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Folder size={18} className="text-brand-500 shrink-0" />
            <span className="font-mono font-bold text-brand-800 break-all">
              {byOrder ? openFolder.orderNumber : openFolder.fileNumber}
            </span>
            {byOrder && openFolder.fileNumber !== '—' && (
              <span className="text-xs font-mono text-gray-400 whitespace-nowrap">file {openFolder.fileNumber}</span>
            )}
            <span className="text-sm text-gray-500 truncate max-w-full">{openFolder.customerName}</span>
            <span className="text-[12px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">{openFolder.units} pcs</span>
            {canUpdate && (() => {
              const allPriority = openFolder.items.length > 0 && openFolder.items.every((i) => i.priority);
              const noun = byOrder ? 'order' : 'file';
              return (
                <button
                  onClick={() => toggleFilePriority(openFolder)}
                  className={`sm:ml-2 text-xs font-bold px-3 py-1 rounded border transition-colors ${
                    allPriority ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-amber-300'
                  }`}
                >
                  {allPriority ? `★ Priority ${noun} — clear` : `Mark whole ${noun} priority`}
                </button>
              );
            })()}
          </div>
          {renderItems(openFolder.items)}
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-3">
            {folders.length} {byOrder ? 'order' : 'file'}{folders.length === 1 ? '' : 's'} · {cards.reduce((s, c) => s + (c.quantity || 0), 0)} pcs
          </p>
          <div className="space-y-3">
            {folders.map((f) => (
              <div
                key={f.key}
                onClick={() => { setOpenFile(f.key); setOpenOrder(null); }}
                className="bg-white rounded-xl shadow-sm border border-brand-100 px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-brand-50 hover:border-brand-300 transition-all group"
              >
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 min-w-0">
                  <Folder size={20} className="text-brand-500 shrink-0 group-hover:text-brand-700 transition-colors" />
                  <span className="font-mono font-bold text-brand-800 text-sm group-hover:text-brand-900 break-all">
                    {byOrder ? f.orderNumber : f.fileNumber}
                  </span>
                  {byOrder && f.fileNumber !== '—' && (
                    <span className="font-mono text-xs text-gray-400 whitespace-nowrap">file {f.fileNumber}</span>
                  )}
                  <span className="text-gray-500 text-sm truncate max-w-full">{f.customerName}</span>
                  <span className="bg-gray-100 border border-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                    {f.units} pc{f.units === 1 ? '' : 's'}
                  </span>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0 group-hover:text-brand-500 transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}

      {move && (
        <MoveQtyModal
          card={move.card}
          toStage={move.dir === 'back' ? move.card.prevStage : move.card.nextStage}
          saving={busyKey === keyOf(move.card)}
          onClose={() => setMove(null)}
          onConfirm={confirmMove}
        />
      )}

      {moveTo && (
        <MoveToStageModal
          card={moveTo.card}
          stages={moveToStages}
          saving={busyKey === keyOf(moveTo.card)}
          onClose={() => setMoveTo(null)}
          onConfirm={confirmMoveTo}
        />
      )}

      <RouteItemModal
        isOpen={!!routeCard}
        orderId={routeCard?.orderId}
        item={routeCard ? {
          _id: routeCard.itemId, companySKU: routeCard.companySKU,
          production: { branch: routeCard.branch, productionType: routeCard.productionType, sourcing: routeCard.sourcing, maker: routeCard.maker, outsource: routeCard.outsource },
        } : null}
        onClose={() => setRouteCard(null)}
        onRouted={() => { setRouteCard(null); fetchCards(); }}
      />

      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onChange={(i) => setLightbox((l) => ({ ...l, index: i }))}
        />
      )}
    </div>
  );
}
