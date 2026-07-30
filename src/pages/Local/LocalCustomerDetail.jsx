import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Pencil, Phone, Mail, MapPin, Receipt, IndianRupee } from 'lucide-react';
import { localCustomerAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import { LocalCustomerModal } from './LocalCustomers';

const money = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// Customer profile + their purchase history (every local order they've placed).
export default function LocalCustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await localCustomerAPI.getById(id);
      setData(res.data?.data || null);
    } catch { setData(null); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

  if (loading) {
    return <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>;
  }
  if (!data?.customer) {
    return <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">Customer not found.</div>;
  }

  const { customer: c, sales = [], stats } = data;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/local/customers')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
        <ArrowLeft size={15} /> Local customers
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{c.name}</h1>
          <p className="page-subtitle">{c.companyName || 'Walk-in customer'}{c.gstin ? ` · GSTIN ${c.gstin}` : ''}</p>
        </div>
        {can('localCustomers', 'update') && (
          <button onClick={() => setEditing(true)} className="btn btn-secondary">
            <Pencil size={15} /> Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile */}
        <div className="card bg-white border border-linen-300 shadow-card space-y-2">
          <p className="text-sm text-gray-700 flex items-center gap-2"><Phone size={14} className="text-gray-400" /> {c.phone}{c.altPhone ? ` · ${c.altPhone}` : ''}</p>
          {c.email && <p className="text-sm text-gray-700 flex items-center gap-2"><Mail size={14} className="text-gray-400" /> {c.email}</p>}
          {(c.address || c.city) && (
            <p className="text-sm text-gray-700 flex items-start gap-2">
              <MapPin size={14} className="text-gray-400 mt-0.5 shrink-0" />
              <span>{[c.address, c.city].filter(Boolean).join(', ')}</span>
            </p>
          )}
          {c.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {c.tags.map((t) => (
                <span key={t} className="text-[12px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">{t}</span>
              ))}
            </div>
          )}
          {c.notes && <p className="text-xs text-gray-500 pt-1 border-t border-linen-200 mt-2">{c.notes}</p>}
        </div>

        {/* Stats */}
        <div className="card bg-white border border-linen-300 shadow-card">
          <p className="text-[13px] uppercase tracking-wider text-gray-400">Orders</p>
          <p className="text-2xl font-bold text-gray-800 mt-1 flex items-center gap-2">
            <Receipt size={18} className="text-brand-600" /> {stats?.sales || 0}
          </p>
          <p className="text-[13px] uppercase tracking-wider text-gray-400 mt-4">Total spent</p>
          <p className="text-xl font-bold text-brand-700 mt-1">{money(stats?.totalSpent)}</p>
        </div>

        <div className="card bg-white border border-linen-300 shadow-card">
          <p className="text-[13px] uppercase tracking-wider text-gray-400">Balance due</p>
          <p className={`text-2xl font-bold mt-1 flex items-center gap-1 ${stats?.balanceDue > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            <IndianRupee size={18} /> {Number(stats?.balanceDue || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {stats?.balanceDue > 0 ? 'Outstanding across their orders' : 'Everything settled'}
          </p>
        </div>
      </div>

      {/* Purchase history */}
      <div className="bg-white border border-linen-300 rounded-xl shadow-card overflow-hidden">
        <div className="px-4 py-3 border-b border-linen-300 bg-linen-50">
          <p className="font-bold text-gray-800 text-sm">Purchase history</p>
        </div>
        {sales.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">No local orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[42rem]">
              <thead className="bg-linen-100 text-[13px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Items</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linen-200">
                {sales.map((s) => (
                  <tr
                    key={s._id}
                    onClick={() => navigate(`/local/orders/${s._id}`)}
                    className="cursor-pointer hover:bg-linen-50"
                  >
                    <td className="px-3 py-2 font-semibold text-gray-800">{s.saleNumber}</td>
                    <td className="px-3 py-2 text-gray-600">{day(s.saleDate)}</td>
                    <td className="px-3 py-2 text-gray-600">{s.items?.length || 0}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-800">{money(s.totalAmount)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{money(s.amountPaid)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[12px] px-2 py-0.5 rounded-full border ${
                        s.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : s.paymentStatus === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {s.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <LocalCustomerModal
        isOpen={editing}
        customer={c}
        onClose={() => setEditing(false)}
        onSaved={fetchCustomer}
      />
    </div>
  );
}
