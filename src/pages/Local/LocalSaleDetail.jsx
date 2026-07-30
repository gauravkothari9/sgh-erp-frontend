import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer, Package, IndianRupee, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { localSaleAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { resolveMediaSrc, imgErrorFallback } from '../../utils/formatters';
import { SHOWROOM_ZONES, SHOWROOM_BRANCHES } from '../../utils/showroomZones';
import Modal from '../../components/common/Modal';

const money = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'];

// Record a further payment against an order that isn't fully paid.
function PaymentModal({ isOpen, onClose, sale, onSaved }) {
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !sale) return;
    setAmountPaid(String(sale.amountPaid || 0));
    setPaymentMode(sale.paymentMode || 'Cash');
  }, [isOpen, sale]);

  const save = async () => {
    setSaving(true);
    try {
      await localSaleAPI.updatePayment(sale._id, {
        amountPaid: parseFloat(amountPaid) || 0,
        paymentMode,
      });
      toast.success('Payment updated');
      onSaved?.();
      onClose();
    } catch { /* toasted */ } finally { setSaving(false); }
  };

  if (!sale) return null;
  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title="Update payment"
      size="sm"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Order total <strong>{money(sale.totalAmount)}</strong></p>
        <div>
          <label className="label">Total amount paid (₹)</label>
          <input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="input" />
          <p className="text-[12px] text-gray-400 mt-0.5">Cumulative, not an increment.</p>
        </div>
        <div>
          <label className="label">Payment mode</label>
          <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="input">
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

// Take items back off a bill. Returned units go back onto the showroom floor —
// into the zone they were sold from unless another zone is picked — and drop out
// of the billed amount.
function ReturnModal({ isOpen, onClose, sale, onSaved }) {
  const [qtys, setQtys] = useState({});     // index → qty being returned
  const [zones, setZones] = useState({});   // index → { branch, zone }
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !sale) return;
    setQtys({});
    setZones(Object.fromEntries(
      sale.items.map((it, i) => [i, {
        branch: it.branch || SHOWROOM_BRANCHES[0],
        zone: it.zone || (SHOWROOM_ZONES[it.branch || SHOWROOM_BRANCHES[0]] || ['A'])[0],
      }])
    ));
    setReason('');
  }, [isOpen, sale]);

  if (!sale) return null;

  const remainingOf = (it) => (it.quantity || 0) - (it.returnedQty || 0);
  const rows = sale.items
    .map((it, index) => ({ it, index }))
    .filter(({ it }) => remainingOf(it) > 0);

  const refund = rows.reduce((s, { it, index }) => {
    const q = Math.min(parseInt(qtys[index], 10) || 0, remainingOf(it));
    return s + q * (it.unitPrice || 0);
  }, 0);

  const save = async () => {
    const items = rows
      .map(({ it, index }) => ({
        index,
        qty: Math.min(parseInt(qtys[index], 10) || 0, remainingOf(it)),
        branch: zones[index]?.branch,
        zone: zones[index]?.zone,
      }))
      .filter((r) => r.qty > 0);

    if (!items.length) { toast.error('Enter a return quantity'); return; }

    setSaving(true);
    try {
      await localSaleAPI.returnItems(sale._id, { items, reason });
      toast.success('Items returned to the showroom');
      onSaved?.();
      onClose();
    } catch { /* toasted */ } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={`Return items — ${sale.saleNumber}`}
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || refund <= 0} className="btn btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />}
            Return {refund > 0 ? `(${money(refund)})` : ''}
          </button>
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Every item on this order has already been returned.</p>
      ) : (
        <div className="space-y-4">
          <table className="w-full text-sm">
            <thead className="bg-linen-100 text-[13px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-2 py-2 text-left">Item</th>
                <th className="px-2 py-2 text-center w-24">Sold</th>
                <th className="px-2 py-2 text-left w-24">Return</th>
                <th className="px-2 py-2 text-left w-56">Back to zone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linen-200">
              {rows.map(({ it, index }) => {
                const max = remainingOf(it);
                const z = zones[index] || {};
                return (
                  <tr key={index}>
                    <td className="px-2 py-2">
                      <p className="font-semibold text-gray-800">{it.name}</p>
                      <p className="text-[13px] text-gray-400">{it.sku ? `${it.sku} · ` : ''}{money(it.unitPrice)} each</p>
                    </td>
                    <td className="px-2 py-2 text-center text-gray-600">
                      {max}
                      {it.returnedQty > 0 && <span className="block text-[12px] text-gray-400">{it.returnedQty} already back</span>}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        max={max}
                        value={qtys[index] ?? ''}
                        onChange={(e) => setQtys((q) => ({ ...q, [index]: e.target.value }))}
                        placeholder="0"
                        className="input py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-2">
                        <select
                          value={z.branch || ''}
                          onChange={(e) => {
                            const branch = e.target.value;
                            setZones((s) => ({ ...s, [index]: { branch, zone: (SHOWROOM_ZONES[branch] || ['A'])[0] } }));
                          }}
                          className="input py-1.5 text-sm flex-1"
                        >
                          {SHOWROOM_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <select
                          value={z.zone || ''}
                          onChange={(e) => setZones((s) => ({ ...s, [index]: { ...s[index], zone: e.target.value } }))}
                          className="input py-1.5 text-sm w-28"
                        >
                          {(SHOWROOM_ZONES[z.branch] || []).map((zz) => <option key={zz} value={zz}>Zone {zz}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div>
            <label className="label">Reason</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. damaged on delivery" className="input" />
          </div>

          <p className="text-xs text-gray-500">
            The bill drops by <strong className="text-gray-800">{money(refund)}</strong>. If the customer already paid more than
            the new total, the order flips to <strong>Refund Due</strong>.
          </p>
        </div>
      )}
    </Modal>
  );
}

// A local order + its printable bill. `window.print()` prints only the invoice
// block — everything else is hidden by the print rules below.
export default function LocalSaleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);

  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const fetchSale = useCallback(async () => {
    setLoading(true);
    try {
      const res = await localSaleAPI.getById(id);
      setSale(res.data?.data?.sale || null);
    } catch { setSale(null); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchSale(); }, [fetchSale]);

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>;
  }
  if (!sale) {
    return <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">Local order not found.</div>;
  }

  const c = sale.customer || {};
  const canReturn = sale.items.some((it) => (it.quantity || 0) - (it.returnedQty || 0) > 0);

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #local-invoice, #local-invoice * { visibility: visible; }
          #local-invoice { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between">
        <button onClick={() => navigate('/local/orders')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <ArrowLeft size={15} /> Local orders
        </button>
        <div className="flex items-center gap-2">
          {can('localSales', 'update') && canReturn && (
            <button onClick={() => setReturnOpen(true)} className="btn btn-secondary">
              <Undo2 size={15} /> Return items
            </button>
          )}
          {can('localSales', 'update') && sale.balanceDue > 0 && (
            <button onClick={() => setPayOpen(true)} className="btn btn-secondary">
              <IndianRupee size={15} /> Record payment
            </button>
          )}
          <button onClick={() => window.print()} className="btn btn-primary">
            <Printer size={15} /> Print bill
          </button>
        </div>
      </div>

      {/* ── Printable invoice ───────────────────────────────────────────── */}
      <div id="local-invoice" className="bg-white border border-linen-300 rounded-xl shadow-card p-6">
        <div className="flex items-start justify-between border-b border-linen-300 pb-4">
          <div>
            <p className="font-serif font-bold text-xl text-espresso-900">SGH Crafts</p>
            <p className="text-[13px] text-gray-500 uppercase tracking-widest">Showroom Bill</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-800">{sale.saleNumber}</p>
            <p className="text-xs text-gray-500">{day(sale.saleDate)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-4 text-sm">
          <div>
            <p className="text-[13px] uppercase tracking-wider text-gray-400">Billed to</p>
            <p className="font-bold text-gray-800">{sale.customerName || c.name}</p>
            <p className="text-gray-600">{sale.customerPhone || c.phone}</p>
            {c.address && <p className="text-gray-600">{[c.address, c.city].filter(Boolean).join(', ')}</p>}
            {c.companyName && <p className="text-gray-600">{c.companyName}</p>}
            {c.gstin && <p className="text-gray-600">GSTIN: {c.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-[13px] uppercase tracking-wider text-gray-400">Payment</p>
            <p className="font-semibold text-gray-800">{sale.paymentMode}</p>
            <p className={`font-bold ${sale.balanceDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {sale.paymentStatus}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[40rem]">
          <thead className="bg-linen-100 text-[13px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-2 py-2 text-left w-10">#</th>
              <th className="px-2 py-2 text-left w-20">Image</th>
              <th className="px-2 py-2 text-left">Item</th>
              <th className="px-2 py-2 text-left">Size</th>
              <th className="px-2 py-2 text-center w-14">Qty</th>
              <th className="px-2 py-2 text-right w-24">Rate</th>
              <th className="px-2 py-2 text-right w-28">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-linen-200">
            {sale.items.map((it, idx) => (
              <tr key={idx}>
                <td className="px-2 py-2 text-gray-500">{idx + 1}</td>
                <td className="px-2 py-2">
                  <div className="w-14 h-14 rounded-lg bg-linen-100 border border-linen-300 flex items-center justify-center overflow-hidden">
                    {it.image ? (
                      <img src={resolveMediaSrc(it.image)} onError={imgErrorFallback} alt={it.name} className="w-full h-full object-cover" />
                    ) : <Package size={14} className="text-gray-300" />}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <p className="font-semibold text-gray-800">{it.name}</p>
                  {it.sku && <p className="text-[13px] text-gray-400">{it.sku}</p>}
                  {it.comments && <p className="text-[13px] text-gray-500 italic">{it.comments}</p>}
                </td>
                <td className="px-2 py-2 text-gray-600">{it.size || '—'}</td>
                <td className="px-2 py-2 text-center text-gray-800">
                  {(it.quantity || 0) - (it.returnedQty || 0)}
                  {it.returnedQty > 0 && (
                    <span className="block text-[12px] text-red-500">{it.returnedQty} returned</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right text-gray-600">{money(it.unitPrice)}</td>
                <td className="px-2 py-2 text-right font-bold text-gray-800">{money(it.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex justify-end pt-4">
          <div className="w-full max-w-xs text-sm">
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-semibold text-gray-800">{money(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Discount</span>
                <span className="font-semibold text-gray-800">− {money(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-t border-linen-300 mt-1">
              <span className="font-bold text-gray-800">Total</span>
              <span className="font-bold text-brand-700 text-base">{money(sale.totalAmount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-500">Paid</span>
              <span className="font-semibold text-gray-800">{money(sale.amountPaid)}</span>
            </div>
            {sale.returnedValue > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Returned</span>
                <span className="font-semibold text-red-600">− {money(sale.returnedValue)}</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-gray-500">{sale.refundDue > 0 ? 'Refund due' : 'Balance due'}</span>
              <span className={`font-bold ${sale.balanceDue > 0 || sale.refundDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {money(sale.refundDue > 0 ? sale.refundDue : sale.balanceDue)}
              </span>
            </div>
          </div>
        </div>

        {sale.returns?.length > 0 && (
          <div className="border-t border-linen-200 pt-3 mt-3">
            <p className="text-[13px] uppercase tracking-wider text-gray-400 mb-1">Returns</p>
            {sale.returns.map((r, i) => (
              <p key={i} className="text-xs text-gray-600">
                {day(r.at)} — {r.items.map((x) => `${x.qty} × ${x.name} → ${x.branch} ${x.zone}`).join(', ')}
                {' · '}{money(r.refundValue)}{r.reason ? ` · ${r.reason}` : ''}
              </p>
            ))}
          </div>
        )}

        {sale.notes && <p className="text-xs text-gray-500 border-t border-linen-200 pt-3 mt-3">{sale.notes}</p>}
        <p className="text-[12px] text-gray-400 text-center pt-4">Thank you for your purchase.</p>
      </div>

      <PaymentModal isOpen={payOpen} onClose={() => setPayOpen(false)} sale={sale} onSaved={fetchSale} />
      <ReturnModal isOpen={returnOpen} onClose={() => setReturnOpen(false)} sale={sale} onSaved={fetchSale} />
    </div>
  );
}
