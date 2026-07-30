import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { reportsApi } from '../lib/endpoints';

const bucket = (d) =>
  d > 90 ? 'bg-brand-error/10 text-brand-error'
  : d > 60 ? 'bg-orange-100 text-orange-700'
  : d > 30 ? 'bg-brand-warning/10 text-brand-warning'
  : 'bg-brand-success/10 text-brand-success';

export default function AgingReportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['v2', 'reports', 'aging'],
    queryFn: () => reportsApi.aging().then((r) => r.data.data.rows),
  });

  const exportXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(data || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Aging');
    XLSX.writeFile(wb, `aging-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-ink">Aging report</h1>
        <button onClick={exportXLSX} className="text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-md border border-brand-border bg-brand-surface">
          <Download size={12} /> Export
        </button>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-bg sticky top-0">
            <tr className="text-left text-[12px] uppercase tracking-wider text-brand-inkMuted">
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Showroom</th>
              <th className="px-3 py-2 text-right">Listed</th>
              <th className="px-3 py-2 text-right">Days</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-brand-inkMuted">Loading…</td></tr>
            ) : (
              (data || []).map((r) => (
                <tr key={r.id} className="border-t border-brand-border">
                  <td className="px-3 py-2 font-mono text-xs text-brand-primary">{r.instanceCode}</td>
                  <td className="px-3 py-2">{r.productName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.showroom}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.listedPrice ? `₹${new Intl.NumberFormat('en-IN').format(r.listedPrice)}` : '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${bucket(r.daysOnDisplay)}`}>{r.daysOnDisplay}d</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
