import { useState, useEffect, useMemo } from 'react';
import { Factory, Warehouse, Hammer, Truck, Share2, Boxes, Loader2, Save } from 'lucide-react';
import Modal from '../common/Modal';
import { productionAPI } from '../../utils/api';
import toast from 'react-hot-toast';

/**
 * Routes a single order item through the shop-floor decision tree:
 *   Branch (Kakani | Jhalamand)
 *     → Jhalamand: Category (Antique | Production) [+ maker]
 *     → Kakani: Sourcing (In-house → category + maker | Outsourced → supplier)
 * On save it PATCHes the item's production info, which auto-starts its stage.
 */
const Choice = ({ active, onClick, icon: Icon, label, sub }) => (
  <button
    type="button"
    onClick={onClick}
    // min-w keeps two tiles per row on a 360px phone, then they grow to fill.
    className={`flex-1 min-w-[130px] flex flex-col items-center gap-1.5 px-3 sm:px-4 py-4 rounded-xl border-2 text-center transition-all ${
      active
        ? 'border-brand-500 bg-brand-50 text-brand-800'
        : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50/40'
    }`}
  >
    <Icon size={22} strokeWidth={1.6} />
    <span className="text-sm font-semibold">{label}</span>
    {sub && <span className="text-[13px] text-gray-400">{sub}</span>}
  </button>
);

const Field = ({ label, type = 'text', value, onChange, placeholder }) => (
  <div>
    <label className="label">{label}</label>
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input"
    />
  </div>
);

export default function RouteItemModal({ isOpen, onClose, orderId, item, onRouted }) {
  const [makers, setMakers] = useState([]);
  const [branch, setBranch] = useState('');
  const [category, setCategory] = useState('');
  const [sourcing, setSourcing] = useState('');
  const [subUnit, setSubUnit] = useState('');   // Kakani in-house: Manufacturing | Iron Khata
  const [maker, setMaker] = useState('');
  const [outsource, setOutsource] = useState({
    supplierName: '', supplierContact: '',
    sampleProvidedDate: '', lastCallDate: '', estimatedDeliveryDate: '',
  });
  const [saving, setSaving] = useState(false);

  // Load makers once; prefill from the item's existing routing.
  useEffect(() => {
    if (!isOpen) return;
    productionAPI.getConfig().then((res) => {
      setMakers(res.data?.data?.makers || []);
    }).catch(() => {});
    const p = item?.production || {};
    setBranch(p.branch || '');
    setCategory(p.productionType || '');
    setSourcing(p.sourcing || '');
    setSubUnit(p.subUnit || '');
    setMaker(p.maker || '');
    const o = p.outsource || {};
    const d = (v) => (v ? String(v).slice(0, 10) : '');
    setOutsource({
      supplierName: o.supplierName || '', supplierContact: o.supplierContact || '',
      sampleProvidedDate: d(o.sampleProvidedDate), lastCallDate: d(o.lastCallDate),
      estimatedDeliveryDate: d(o.estimatedDeliveryDate),
    });
  }, [isOpen, item]);

  const isOutsource = branch === 'Kakani' && sourcing === 'Outsourced';
  const isKakaniInhouse = branch === 'Kakani' && sourcing === 'In-house';
  // 'Iron Khata' is now a workshop tile, not a person — drop it from the maker
  // list so it isn't picked in both places.
  const makerOptions = useMemo(
    () => makers.filter((m) => (!branch || m.location === branch) && m.name !== 'Iron Khata'),
    [makers, branch]
  );

  const canSave =
    (branch === 'Jhalamand' && !!category) ||
    (isKakaniInhouse && !!subUnit) ||
    (branch === 'Kakani' && sourcing === 'In Stock') ||
    (isOutsource && !!outsource.supplierName.trim());

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = { branch };
      if (branch === 'Jhalamand') {
        payload.category = category;
        payload.sourcing = 'In-house';
        if (maker) payload.maker = maker;
      } else if (isOutsource) {
        payload.sourcing = 'Outsourced';
        payload.outsource = outsource;
      } else if (sourcing === 'In Stock') {
        payload.sourcing = 'In Stock';
      } else {
        // Kakani in-house — the workshop tile is required; maker is an optional
        // person within the Manufacturing unit (Iron Khata has no sub-maker).
        payload.sourcing = 'In-house';
        payload.category = category || 'Production';
        payload.subUnit = subUnit;
        if (subUnit === 'Manufacturing' && maker) payload.maker = maker;
      }
      const res = await productionAPI.setItemProduction(orderId, item._id, payload);
      toast.success('Item routed');
      onRouted?.(res.data?.data?.item);
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
      title={`Route item — ${item?.companySKU || ''}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn-secondary btn">Cancel</button>
          <button onClick={handleSave} disabled={saving || !canSave} className="btn-primary btn">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving…' : 'Route item'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Step 1 — Branch */}
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">1 · Which unit?</p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Choice active={branch === 'Kakani'} onClick={() => { setBranch('Kakani'); setCategory(''); setSourcing(''); setSubUnit(''); setMaker(''); }} icon={Factory} label="Kakani" sub="Finishing + container" />
            <Choice active={branch === 'Jhalamand'} onClick={() => { setBranch('Jhalamand'); setSourcing('In-house'); setSubUnit(''); setMaker(''); }} icon={Warehouse} label="Jhalamand" sub="Ships to Kakani" />
          </div>
        </div>

        {/* Step 2 — Jhalamand: category */}
        {branch === 'Jhalamand' && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">2 · Type</p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Choice active={category === 'Antique'} onClick={() => setCategory('Antique')} icon={Hammer} label="Antiques" sub="One of a kind" />
              <Choice active={category === 'Production'} onClick={() => setCategory('Production')} icon={Factory} label="Production" sub="Made to order" />
            </div>
          </div>
        )}

        {/* Step 2 — Kakani: sourcing */}
        {branch === 'Kakani' && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">2 · Made how?</p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Choice active={sourcing === 'In-house'} onClick={() => { setSourcing('In-house'); setCategory('Production'); }} icon={Hammer} label="In-house" sub="Made at Kakani" />
              <Choice active={sourcing === 'Outsourced'} onClick={() => { setSourcing('Outsourced'); setCategory(''); setSubUnit(''); setMaker(''); }} icon={Share2} label="Outsource" sub="External supplier" />
            </div>
          </div>
        )}

        {/* Step 3 — Kakani in-house: which workshop makes it */}
        {isKakaniInhouse && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">3 · Which workshop?</p>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Choice active={subUnit === 'Manufacturing'} onClick={() => setSubUnit('Manufacturing')} icon={Factory} label="Manufacturing Unit" sub="Made at Kakani" />
              <Choice active={subUnit === 'Iron Khata'} onClick={() => { setSubUnit('Iron Khata'); setMaker(''); }} icon={Boxes} label="Iron Khata" sub="Iron Khata workshop" />
            </div>
          </div>
        )}

        {/* Maker — Jhalamand, or the Kakani Manufacturing unit (Iron Khata has none) */}
        {((branch === 'Jhalamand' && category) || (isKakaniInhouse && subUnit === 'Manufacturing')) && (
          <div>
            <label className="label">Maker <span className="text-gray-400 font-normal">(optional)</span></label>
            <select value={maker} onChange={(e) => setMaker(e.target.value)} className="input">
              <option value="">— Assign later —</option>
              {makerOptions.map((m) => (
                <option key={m.name} value={m.name}>{m.name} ({m.location})</option>
              ))}
            </select>
          </div>
        )}

        {/* Outsource details */}
        {isOutsource && (
          <div className="space-y-3 border border-brand-100 rounded-xl p-4 bg-brand-50/30">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <Truck size={13} /> Supplier details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Supplier name" value={outsource.supplierName} onChange={(v) => setOutsource((o) => ({ ...o, supplierName: v }))} placeholder="e.g. Rajesh Handicrafts" />
              <Field label="Contact no." value={outsource.supplierContact} onChange={(v) => setOutsource((o) => ({ ...o, supplierContact: v }))} placeholder="+91 …" />
              <Field label="Sample provided on" type="date" value={outsource.sampleProvidedDate} onChange={(v) => setOutsource((o) => ({ ...o, sampleProvidedDate: v }))} />
              <Field label="Last call date" type="date" value={outsource.lastCallDate} onChange={(v) => setOutsource((o) => ({ ...o, lastCallDate: v }))} />
              <Field label="Est. delivery from supplier" type="date" value={outsource.estimatedDeliveryDate} onChange={(v) => setOutsource((o) => ({ ...o, estimatedDeliveryDate: v }))} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
