import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, X, FolderOpen, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import {
  useCatalogueSelectionStore,
  selectGroupedByFile,
} from '../../store/catalogueSelectionStore';

/**
 * Floating action bar that surfaces the cross-folder catalogue selection.
 * Mounted on every Buyer Catalogue page so the user can keep adding products
 * from different Buyer Files, then hit "Create Order with Selected" to roll
 * the lot into a fresh order draft.
 *
 * The customer is *not* pre-selected because the items can span multiple
 * buyers — the user picks the destination customer inside CreateOrder.
 */
export default function CatalogueSelectionBar() {
  const navigate = useNavigate();
  const items = useCatalogueSelectionStore((s) => s.items);
  const clear = useCatalogueSelectionStore((s) => s.clear);
  const remove = useCatalogueSelectionStore((s) => s.remove);
  const groups = useCatalogueSelectionStore(selectGroupedByFile);

  const [expanded, setExpanded] = useState(false);

  const count = Object.keys(items).length;
  if (count === 0) return null;

  const goCreateOrder = () => {
    const prefilled = Object.values(items).map((e) => e.product);
    navigate('/office/orders/new', { state: { prefilledItems: prefilled } });
  };

  return (
    <div className="sticky top-2 z-30">
      {/* Clamp to the viewport so the bar can never push the page sideways on phones */}
      <div className="bg-brand-600 text-white shadow-lg rounded-xl w-[min(100%,calc(100vw-2rem))] mx-auto">
        {/* Compact header row — stacks on phones so both buttons stay reachable */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-4 sm:px-5 py-3">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-2 sm:gap-3 text-sm font-semibold hover:opacity-90 min-w-0 text-left"
            title={expanded ? 'Hide selection details' : 'Show selection details'}
          >
            <ShoppingCart size={18} className="shrink-0" />
            <span className="truncate">
              {count} product{count > 1 ? 's' : ''} selected
              {groups.length > 1 && ` · from ${groups.length} files`}
            </span>
            {expanded ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={clear}
              className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded transition-colors shrink-0"
              title="Clear all selections"
            >
              <Trash2 size={12} className="inline mr-1" />
              Clear
            </button>
            <button
              onClick={goCreateOrder}
              className="text-xs font-bold bg-white text-brand-700 hover:bg-brand-50 px-4 py-1.5 rounded transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-none min-w-0"
            >
              <ShoppingCart size={14} className="shrink-0" />
              <span className="truncate">Create Order with Selected</span>
            </button>
          </div>
        </div>

        {/* Expanded breakdown: grouped by file with per-item remove */}
        {expanded && (
          <div className="border-t border-white/20 px-4 sm:px-5 py-3 max-h-[50vh] sm:max-h-80 overflow-y-auto bg-brand-700/40 rounded-b-xl">
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.fileNumber || 'unknown'}>
                  <div className="flex items-center gap-2 text-[13px] uppercase tracking-wider font-bold text-white/80 mb-1.5">
                    <FolderOpen size={12} className="shrink-0" />
                    <span className="truncate">{g.fileNumber || 'Unknown file'}</span>
                    {g.buyerName && (
                      <span className="text-white/60 font-medium normal-case tracking-normal truncate hidden sm:inline">
                        — {g.buyerName}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 bg-white/15 text-white text-[12px] px-2 py-0.5 rounded-full font-bold">
                      {g.items.length}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {g.items.map((p) => (
                      <li
                        key={p._id}
                        className="flex items-center gap-2 text-xs bg-white/10 rounded px-2 py-1"
                      >
                        <span className="font-mono font-bold shrink-0">{p.sku}</span>
                        <span className="text-white/70 truncate flex-1 min-w-0">
                          {p.itemDescription || '—'}
                        </span>
                        <button
                          onClick={() => remove(p._id)}
                          className="text-white/60 hover:text-white p-0.5 shrink-0"
                          title="Remove from selection"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
