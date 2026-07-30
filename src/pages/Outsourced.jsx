import { useState } from 'react';
import { Share2, Phone, Save, Loader2 } from 'lucide-react';
import StageView from '../components/production/StageView';
import { productionAPI } from '../utils/api';
import { formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

const asDateInput = (v) => (v ? String(v).slice(0, 10) : '');

// Supplier panel shown on each outsourced item — includes an editable "last
// call date" the office updates as they chase the supplier.
function OutsourceExtra({ card }) {
  const o = card.outsource || {};
  const [lastCall, setLastCall] = useState(asDateInput(o.lastCallDate));
  const [saving, setSaving] = useState(false);
  const dirty = lastCall !== asDateInput(o.lastCallDate);

  const save = async () => {
    setSaving(true);
    try {
      await productionAPI.setItemProduction(card.orderId, card.itemId, {
        outsource: { lastCallDate: lastCall || null },
      });
      toast.success('Last call date updated');
    } catch {
      /* interceptor toasts */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 border-t border-linen-200 pt-2 space-y-1 text-[13px] text-gray-600">
      <div className="flex items-center gap-1 font-semibold text-gray-700 min-w-0">
        <Share2 size={11} className="shrink-0" />
        <span className="truncate">{o.supplierName || 'Supplier not set'}</span>
      </div>
      {o.supplierContact && (
        <div className="flex items-center gap-1 text-gray-500 min-w-0">
          <Phone size={11} className="shrink-0" />
          <span className="truncate">{o.supplierContact}</span>
        </div>
      )}
      {o.sampleProvidedDate && <div>Sample: {formatDate(o.sampleProvidedDate)}</div>}
      {o.estimatedDeliveryDate && <div>Est. delivery: {formatDate(o.estimatedDeliveryDate)}</div>}
      {/* Wraps on narrow cards — the native date input has a hard min width */}
      <div className="flex items-center flex-wrap gap-1.5 pt-1">
        <span className="text-gray-500">Last call:</span>
        <input
          type="date"
          value={lastCall}
          onChange={(e) => setLastCall(e.target.value)}
          className="input py-0.5 px-1.5 text-[13px] h-7 w-auto max-w-full min-w-0 flex-1 sm:flex-none"
        />
        {dirty && (
          <button onClick={save} disabled={saving} className="btn-primary btn btn-sm text-[12px] py-0.5 shrink-0">
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Outsourced() {
  return (
    <StageView
      title="Outsourced"
      subtitle="Items with external suppliers — move them into a Kakani stage when they arrive"
      icon={Share2}
      // Only pieces still at the supplier (awaiting sample / just received) show
      // here. Once moved into a production stage they leave this section and
      // appear in the matching Kakani stage view.
      filters={{ sourcing: 'Outsourced', stage: 'Sample Provided,Received' }}
      // Single "Move" action → pick which Kakani stage the arrived goods go to.
      moveToStages={['Polish', 'QC', 'Packing', 'Ready for Container']}
      renderExtra={(card) => <OutsourceExtra key={card.itemId} card={card} />}
      emptyText="No outsourced items awaiting a supplier."
    />
  );
}
