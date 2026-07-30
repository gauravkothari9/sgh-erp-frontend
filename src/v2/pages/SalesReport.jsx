import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { reportsApi } from '../lib/endpoints';

export default function SalesReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'reports', 'sales', from, to],
    queryFn: () => reportsApi.salesSummary({ from, to }).then((r) => r.data.data),
  });

  const exportXLSX = () => {
    const rows = (data?.items || []).map((i) => ({
      saleNo: i.saleNo,
      date: i.saleDate,
      instance: i.instance?.instanceCode,
      product: i.instance?.product?.name,
      customer: i.customerName,
      price: i.salePrice,
      discount: i.discount,
      paymentStatus: i.paymentStatus,
      dispatchStatus: i.dispatchStatus,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, `sales-${from}_to_${to}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-brand-ink">Sales report</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="text-xs px-2 py-1 rounded border border-brand-border" />
          <span className="text-xs text-brand-inkMuted">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="text-xs px-2 py-1 rounded border border-brand-border" />
          <button onClick={exportXLSX} className="text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-md border border-brand-border bg-brand-surface">
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Tot label="Count" value={data?.totals?.count ?? '—'} />
        <Tot label="Revenue" value={data?.totals ? `₹${new Intl.NumberFormat('en-IN').format(data.totals.revenue)}` : '—'} />
        <Tot label="Avg sale" value={data?.totals ? `₹${new Intl.NumberFormat('en-IN').format(Math.round(data.totals.avgSalePrice))}` : '—'} />
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-bg">
            <tr className="text-left text-[12px] uppercase tracking-wider text-brand-inkMuted">
              <th className="px-3 py-2">Sale #</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Piece</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2">Payment</th>
              <th className="px-3 py-2">Dispatch</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="p-6 text-center text-brand-inkMuted">Loading…</td></tr>
            ) : (
              (data?.items || []).map((s) => (
                <tr key={s.id} className="border-t border-brand-border">
                  <td className="px-3 py-2 font-mono text-xs text-brand-primary">{s.saleNo}</td>
                  <td className="px-3 py-2 text-xs">{new Date(s.saleDate).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-xs">{s.instance?.instanceCode}</td>
                  <td className="px-3 py-2">{s.customerName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">₹{new Intl.NumberFormat('en-IN').format(s.salePrice)}</td>
                  <td className="px-3 py-2 text-xs">{s.paymentStatus}</td>
                  <td className="px-3 py-2 text-xs">{s.dispatchStatus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tot({ label, value }) {
  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-3">
      <p className="text-[12px] uppercase tracking-wider text-brand-inkMuted">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
