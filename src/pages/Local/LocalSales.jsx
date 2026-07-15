import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Receipt, Search, Loader2 } from 'lucide-react';
import { localSaleAPI } from '../../utils/api';

const money = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const StatusPill = ({ status }) => (
  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
    status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'Partial' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : status === 'Refund Due' ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-red-50 text-red-700 border-red-200'
  }`}>
    {status}
  </span>
);

// Every walk-in sale made off the showroom floor.
export default function LocalSales() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await localSaleAPI.getAll({ search, paymentStatus: status || undefined });
      setSales(res.data?.data?.sales || []);
    } catch { setSales([]); } finally { setLoading(false); }
  }, [search, status]);

  useEffect(() => {
    const t = setTimeout(fetchSales, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchSales, search]);

  const totals = sales.reduce(
    (acc, s) => ({ amount: acc.amount + (s.totalAmount || 0), due: acc.due + (s.balanceDue || 0) }),
    { amount: 0, due: 0 }
  );

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <Receipt size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="page-title">Local Orders</h1>
            <p className="page-subtitle">
              {sales.length} order{sales.length === 1 ? '' : 's'} · {money(totals.amount)} billed
              {totals.due > 0 && <span className="text-red-600"> · {money(totals.due)} due</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order no., customer, phone…"
            className="input pl-9"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-40">
          <option value="">All payments</option>
          <option value="Paid">Paid</option>
          <option value="Partial">Partial</option>
          <option value="Unpaid">Unpaid</option>
          <option value="Refund Due">Refund Due</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
      ) : sales.length === 0 ? (
        <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">
          No local orders yet. Pick items in a showroom zone and hit “Sell locally”.
        </div>
      ) : (
        <div className="bg-white border border-linen-300 rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[42rem]">
              <thead className="bg-linen-100 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left">Order</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Items</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Due</th>
                  <th className="px-3 py-2 text-left">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linen-200">
                {sales.map((s) => (
                  <tr key={s._id} onClick={() => navigate(`/local/orders/${s._id}`)} className="cursor-pointer hover:bg-linen-50">
                    <td className="px-3 py-2 font-semibold text-gray-800">{s.saleNumber}</td>
                    <td className="px-3 py-2 text-gray-600">{day(s.saleDate)}</td>
                    <td className="px-3 py-2">
                      <p className="text-gray-800">{s.customerName}</p>
                      <p className="text-[11px] text-gray-400">{s.customerPhone}</p>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{s.items?.length || 0}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-800">{money(s.totalAmount)}</td>
                    <td className={`px-3 py-2 text-right ${s.balanceDue > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {money(s.balanceDue)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={s.paymentStatus} />
                      <span className="ml-2 text-[11px] text-gray-400">{s.paymentMode}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
