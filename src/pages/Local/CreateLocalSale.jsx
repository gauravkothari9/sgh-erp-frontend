import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Package, Save, Search, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { localCustomerAPI, localSaleAPI } from '../../utils/api';
import { resolveMediaSrc, imgErrorFallback } from '../../utils/formatters';
import { useShowroomSelectionStore } from '../../store/showroomSelectionStore';
import { LocalCustomerModal } from './LocalCustomers';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'];
const money = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

// The local order form. Items arrive from the showroom selection (route state);
// the user picks the walk-in customer, sets qty/price, records payment, saves.
// Saving deducts the units from showroom stock across zones.
export default function CreateLocalSale() {
  const navigate = useNavigate();
  const location = useLocation();

  const clearSelection = useShowroomSelectionStore((s) => s.clear);

  const [items, setItems] = useState(location.state?.saleItems || []);
  const [customer, setCustomer] = useState(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);

  const [discount, setDiscount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (search.length < 1) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await localCustomerAPI.getAll({ search, limit: 8 });
        setResults(res.data?.data?.customers || []);
      } catch { /* toasted */ }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const setItem = (idx, patch) =>
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const dropItem = (idx) => setItems((list) => list.filter((_, i) => i !== idx));

  const qtyOf = (it) => Math.max(parseInt(it.quantity, 10) || 1, 1);
  const priceOf = (it) => Math.max(parseFloat(it.unitPrice) || 0, 0);
  const subtotal = items.reduce((s, it) => s + qtyOf(it) * priceOf(it), 0);
  const total = Math.max(subtotal - (parseFloat(discount) || 0), 0);
  const balance = Math.max(total - (parseFloat(amountPaid) || 0), 0);

  const save = async () => {
    if (!customer) { toast.error('Pick a local customer'); return; }
    if (!items.length) { toast.error('Add at least one item'); return; }

    const overStock = items.find((it) => it.stock !== undefined && qtyOf(it) > it.stock);
    if (overStock) {
      toast.error(`Only ${overStock.stock} unit(s) of "${overStock.name}" in the showrooms`);
      return;
    }

    setSaving(true);
    try {
      const res = await localSaleAPI.create({
        customer: customer._id,
        items: items.map((it) => ({
          product: it.product,
          sku: it.sku,
          name: it.name,
          size: it.size,
          image: it.image,
          comments: it.comments,
          branch: it.branch,
          zone: it.zone,
          quantity: qtyOf(it),
          unitPrice: priceOf(it),
        })),
        discount: parseFloat(discount) || 0,
        paymentMode,
        amountPaid: parseFloat(amountPaid) || 0,
        notes,
      });
      clearSelection(); // the picks are now a real order
      toast.success('Local order created');
      navigate(`/local/orders/${res.data.data.sale._id}`);
    } catch { /* toasted */ } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">New local order</h1>
          <p className="page-subtitle">Sell showroom items to a walk-in customer — stock is deducted on save</p>
        </div>
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save order
        </button>
      </div>

      {/* Customer */}
      <div className="card bg-white border border-linen-300 shadow-card">
        <label className="label label-required">Customer</label>
        {customer ? (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-bold text-gray-800">{customer.name}</p>
              <p className="text-xs text-gray-500">
                {customer.phone}{customer.companyName ? ` · ${customer.companyName}` : ''}{customer.gstin ? ` · ${customer.gstin}` : ''}
              </p>
            </div>
            <button onClick={() => setCustomer(null)} className="text-gray-300 hover:text-red-500" title="Change customer">
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or phone…"
                  className="input pl-9"
                />
              </div>
              <button onClick={() => setNewCustomerOpen(true)} className="btn btn-secondary">
                <UserPlus size={15} /> New customer
              </button>
            </div>
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-w-sm bg-white border border-linen-300 rounded-xl shadow-card-hover max-h-64 overflow-y-auto">
                {results.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => { setCustomer(c); setSearch(''); setResults([]); }}
                    className="w-full text-left px-3 py-2 hover:bg-linen-50 border-b border-linen-200 last:border-0"
                  >
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    <p className="text-[13px] text-gray-400">{c.phone}{c.city ? ` · ${c.city}` : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white border border-linen-300 rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-linen-300 bg-linen-50">
          <p className="font-bold text-gray-800 text-sm">Items ({items.length})</p>
        </div>
        {items.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">
            No items. Pick products in a showroom zone, then hit “Sell locally”.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[56rem]">
              <thead className="bg-linen-100 text-[13px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left w-12">#</th>
                  <th className="px-3 py-2 text-left w-24">Image</th>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-left w-24">Qty</th>
                  <th className="px-3 py-2 text-left w-32">Price (₹)</th>
                  <th className="px-3 py-2 text-right w-28">Amount</th>
                  <th className="px-3 py-2 text-left">Comments</th>
                  <th className="px-3 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-linen-200">
                {items.map((it, idx) => {
                  const over = it.stock !== undefined && qtyOf(it) > it.stock;
                  return (
                    <tr key={it.product || idx}>
                      <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="w-16 h-16 rounded-lg bg-linen-100 border border-linen-300 flex items-center justify-center overflow-hidden">
                          {it.image ? (
                            <img src={resolveMediaSrc(it.image)} onError={imgErrorFallback} alt={it.name} className="w-full h-full object-cover" />
                          ) : <Package size={16} className="text-gray-300" />}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-800">{it.name}</p>
                        <p className="text-[13px] text-gray-400">
                          {it.sku ? `${it.sku} · ` : ''}{it.size || '—'}{it.branch ? ` · ${it.branch} ${it.zone}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="1"
                          max={it.stock}
                          value={it.quantity}
                          onChange={(e) => setItem(idx, { quantity: e.target.value })}
                          className={`input py-1.5 text-sm ${over ? 'border-red-400' : ''}`}
                        />
                        {it.stock !== undefined && (
                          <p className={`text-[12px] mt-0.5 ${over ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                            {over ? `Only ${it.stock} in stock` : `${it.stock} available`}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          value={it.unitPrice}
                          onChange={(e) => setItem(idx, { unitPrice: e.target.value })}
                          placeholder="0"
                          className="input py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800">{money(qtyOf(it) * priceOf(it))}</td>
                      <td className="px-3 py-2">
                        <input
                          value={it.comments || ''}
                          onChange={(e) => setItem(idx, { comments: e.target.value })}
                          placeholder="Add a comment…"
                          className="input py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => dropItem(idx)} className="text-gray-300 hover:text-red-500" title="Remove item">
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card bg-white border border-linen-300 shadow-card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Payment mode</label>
              <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="input">
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount paid (₹)</label>
              <input type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0" className="input" />
            </div>
            <div>
              <label className="label">Discount (₹)</label>
              <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="input" />
            </div>
            <div>
              <label className="label">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" />
            </div>
          </div>
        </div>

        <div className="card bg-white border border-linen-300 shadow-card">
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-semibold text-gray-800">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-500">Discount</span>
            <span className="font-semibold text-gray-800">− {money(parseFloat(discount) || 0)}</span>
          </div>
          <div className="flex justify-between text-base py-2 border-t border-linen-200 mt-1">
            <span className="font-bold text-gray-800">Total</span>
            <span className="font-bold text-brand-700">{money(total)}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-500">Paid</span>
            <span className="font-semibold text-gray-800">{money(parseFloat(amountPaid) || 0)}</span>
          </div>
          <div className="flex justify-between text-sm py-1">
            <span className="text-gray-500">Balance due</span>
            <span className={`font-bold ${balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money(balance)}</span>
          </div>
        </div>
      </div>

      <LocalCustomerModal
        isOpen={newCustomerOpen}
        customer={null}
        onClose={() => setNewCustomerOpen(false)}
        onSaved={(c) => setCustomer(c)}
      />
    </div>
  );
}
