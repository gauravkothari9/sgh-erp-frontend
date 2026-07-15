import { useState, useEffect, useCallback } from 'react';
import {
  Container as ContainerIcon, Search, Loader2, Folder, CheckCircle2,
  ArrowLeft, ChevronRight, Package,
} from 'lucide-react';
import { containerAPI } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { useDebounce } from '../hooks/useDebounce';
import { resolveMediaSrc, imgErrorFallback, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

// Reusable progress bar.
const Bar = ({ percent, complete }) => (
  <div className="flex-1 h-2 rounded-full bg-linen-200 overflow-hidden">
    <div className={`h-full rounded-full transition-all ${complete ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${percent}%` }} />
  </div>
);

// Container completion tracker — a 3-level drill-down, each on its own screen:
//   Files → Orders (with progress) → Order items (stage breakdown + pieces left).
export default function Container() {
  const [files, setFiles] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 350);

  const [openFile, setOpenFile] = useState(null);    // fileNumber
  const [detail, setDetail] = useState(null);        // { orders, customerName }
  const [detailLoading, setDetailLoading] = useState(false);
  const [openOrder, setOpenOrder] = useState(null);  // order object (its own screen)
  const [completing, setCompleting] = useState(false);
  const canComplete = useAuthStore((s) => s.can)('orders', 'update');

  const markComplete = async () => {
    setCompleting(true);
    try {
      await containerAPI.completeOrder(openOrder.orderId);
      toast.success(`${openOrder.orderNumber} marked completed`);
      const fn = openFile;
      setOpenOrder(null);
      const res = await containerAPI.getFile(fn); // refresh — completed order drops off
      setDetail(res.data?.data || null);
    } catch { /* toasted */ } finally { setCompleting(false); }
  };

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await containerAPI.getProgress({ search: debounced || undefined });
      setFiles(res.data?.data?.files || []);
      setTotals(res.data?.data?.totals || null);
    } catch { setFiles([]); } finally { setLoading(false); }
  }, [debounced]);

  useEffect(() => { if (!openFile) fetchFiles(); }, [fetchFiles, openFile]);

  const openFileDetail = async (fileNumber) => {
    setOpenFile(fileNumber);
    setDetail(null);
    setOpenOrder(null);
    setDetailLoading(true);
    try {
      const res = await containerAPI.getFile(fileNumber);
      setDetail(res.data?.data || null);
    } catch { setDetail(null); } finally { setDetailLoading(false); }
  };

  // ── Screen 3: a single order's items ──
  if (openOrder) {
    return (
      <div className="space-y-5">
        <button onClick={() => setOpenOrder(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Back to {openFile}
        </button>

        <div className="page-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <Package size={20} strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <h1 className="page-title font-mono truncate">{openOrder.orderNumber}</h1>
              <p className="page-subtitle">
                {openFile} · {openOrder.orderStatus} · <strong className="text-amber-700">{openOrder.pending} pcs left for container</strong> ({openOrder.ready}/{openOrder.total} ready)
              </p>
            </div>
          </div>
          {canComplete && openOrder.complete && (
            <button onClick={markComplete} disabled={completing} className="btn text-sm bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto justify-center">
              {completing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Mark order completed
            </button>
          )}
        </div>

        {openOrder.complete && (
          <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2 rounded-lg">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>All {openOrder.total} pieces are Ready for Container. Mark the order completed to close it — it will move to Office → Orders and leave every production/stage view.</span>
          </div>
        )}

        <div className="flex items-center gap-3 max-w-lg">
          <Bar percent={openOrder.percent} complete={openOrder.complete} />
          <span className="text-xs font-semibold text-gray-600 tabular-nums shrink-0">{openOrder.percent}%</span>
        </div>

        {/* Desktop: full stage-breakdown table */}
        <div className="hidden md:block overflow-x-auto border border-gray-300 rounded-xl">
          <table className="w-full min-w-[48rem] text-sm border-collapse">
            <thead className="bg-brand-50/60 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left">Image</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Item</th>
                <th className="border border-gray-300 px-3 py-2 text-left">Where the pieces are</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
                <th className="border border-gray-300 px-3 py-2 text-right">Left for container</th>
              </tr>
            </thead>
            <tbody>
              {openOrder.items.map((it) => (
                <tr key={it.itemId} className="hover:bg-brand-50/40">
                  <td className="border border-gray-300 px-3 py-2">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-linen-100 flex items-center justify-center">
                      {it.image ? <img src={resolveMediaSrc(it.image)} onError={imgErrorFallback} alt="" className="w-full h-full object-cover" /> : <Package size={18} className="text-gray-300" />}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    <div className="font-mono font-bold text-gray-800">{it.companySKU}</div>
                    <div className="text-gray-500 text-xs">{it.itemDescription}</div>
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    {!it.routed ? (
                      <span className="text-amber-600 text-xs">Not yet in production</span>
                    ) : (
                      <div className="space-y-0.5 whitespace-nowrap">
                        {it.stageQty.map((s) => (
                          <div key={s.stage} className="flex items-baseline gap-1.5 leading-tight text-xs">
                            <span className={`w-6 text-right font-bold tabular-nums ${s.stage === 'Ready for Container' ? 'text-emerald-700' : 'text-gray-800'}`}>{s.qty}</span>
                            <span className={s.stage === 'Ready for Container' ? 'text-emerald-700 font-medium' : 'text-gray-600'}>{s.stage}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-bold tabular-nums">{it.totalQty}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-bold tabular-nums">
                    {it.pending === 0 ? <span className="text-emerald-700">0 ✓</span> : <span className="text-amber-700">{it.pending}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phone: same rows as cards */}
        <div className="md:hidden space-y-2">
          {openOrder.items.map((it) => (
            <div key={it.itemId} className="bg-white border border-gray-300 rounded-xl p-3">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-linen-100 flex items-center justify-center shrink-0">
                  {it.image ? <img src={resolveMediaSrc(it.image)} onError={imgErrorFallback} alt="" className="w-full h-full object-cover" /> : <Package size={18} className="text-gray-300" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono font-bold text-gray-800 text-sm truncate">{it.companySKU}</div>
                  <div className="text-gray-500 text-xs line-clamp-2">{it.itemDescription}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400">Left</div>
                  <div className="font-bold tabular-nums text-sm">
                    {it.pending === 0 ? <span className="text-emerald-700">0 ✓</span> : <span className="text-amber-700">{it.pending}</span>}
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-linen-200 text-xs space-y-1">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold tabular-nums text-gray-800">{it.totalQty}</span>
                </div>
                <div>
                  <span className="text-gray-500">Where the pieces are</span>
                  {!it.routed ? (
                    <div className="text-amber-600 mt-0.5">Not yet in production</div>
                  ) : (
                    <div className="mt-0.5 space-y-0.5">
                      {it.stageQty.map((s) => (
                        <div key={s.stage} className="flex items-baseline gap-1.5 leading-tight">
                          <span className={`w-6 text-right font-bold tabular-nums ${s.stage === 'Ready for Container' ? 'text-emerald-700' : 'text-gray-800'}`}>{s.qty}</span>
                          <span className={s.stage === 'Ready for Container' ? 'text-emerald-700 font-medium' : 'text-gray-600'}>{s.stage}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Screen 2: a file's orders ──
  if (openFile) {
    const fileTotal = (detail?.orders || []).reduce((s, o) => s + o.total, 0);
    const fileReady = (detail?.orders || []).reduce((s, o) => s + o.ready, 0);
    return (
      <div className="space-y-5">
        <button onClick={() => setOpenFile(null)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={14} /> Back to files
        </button>

        <div className="page-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <Folder size={20} strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <h1 className="page-title font-mono truncate">{openFile}</h1>
              <p className="page-subtitle">{detail?.customerName} · <strong className="text-amber-700">{fileTotal - fileReady} pcs left for container</strong> ({fileReady}/{fileTotal} ready)</p>
            </div>
          </div>
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
        ) : (detail?.orders || []).length === 0 ? (
          <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">No orders in this file.</div>
        ) : (
          <div className="space-y-3">
            {detail.orders.map((o) => (
              <div
                key={o.orderId}
                onClick={() => setOpenOrder(o)}
                className="bg-white rounded-xl shadow-sm border border-gray-300 px-4 sm:px-5 py-4 cursor-pointer hover:bg-brand-50 hover:border-brand-300 transition-all"
              >
                <div className="flex items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1 min-w-0">
                    <span className="font-mono font-bold text-brand-800 text-sm">{o.orderNumber}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{o.orderStatus}</span>
                    <span className="text-xs text-gray-400">{formatDate(o.orderDate)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {o.complete ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                        <CheckCircle2 size={13} /> Complete
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">{o.pending} left</span>
                    )}
                    <ChevronRight size={16} className="text-gray-300" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Bar percent={o.percent} complete={o.complete} />
                  <span className="text-xs font-semibold text-gray-600 tabular-nums shrink-0">{o.ready}/{o.total} pcs · {o.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Screen 1: files ──
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <ContainerIcon size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="page-title">Container</h1>
            <p className="page-subtitle">Pieces pending vs total to complete each file's container</p>
          </div>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card"><p className="text-sm text-gray-500 mb-1">Files in progress</p><p className="text-2xl font-bold text-gray-900">{totals.files}</p></div>
          <div className="card"><p className="text-sm text-gray-500 mb-1">Containers complete</p><p className="text-2xl font-bold text-emerald-600">{totals.complete}</p></div>
          <div className="card"><p className="text-sm text-gray-500 mb-1">Pieces ready</p><p className="text-2xl font-bold text-gray-900">{totals.ready}</p></div>
          <div className="card"><p className="text-sm text-gray-500 mb-1">Pieces pending</p><p className="text-2xl font-bold text-amber-600">{totals.items - totals.ready}</p></div>
        </div>
      )}

      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search file or customer…" className="input pl-9 w-full" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
      ) : files.length === 0 ? (
        <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">No files in progress. Create an order to see its file here.</div>
      ) : (
        <div className="space-y-3">
          {files.map((f) => (
            <div
              key={f.fileNumber}
              onClick={() => openFileDetail(f.fileNumber)}
              className="bg-white rounded-xl shadow-sm border border-gray-300 px-4 sm:px-5 py-4 cursor-pointer hover:bg-brand-50 hover:border-brand-300 transition-all"
            >
              {/* Stacks on phones so the status pill never squeezes the file/customer line */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 min-w-0">
                  <Folder size={20} className="text-brand-500 shrink-0" />
                  <span className="font-mono font-bold text-brand-800 text-sm">{f.fileNumber}</span>
                  <span className="text-gray-500 text-sm truncate">{f.customerName}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">{f.orders} order{f.orders === 1 ? '' : 's'}</span>
                </div>
                {f.complete ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full shrink-0 self-start sm:self-auto">
                    <CheckCircle2 size={13} /> Container complete
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full shrink-0 self-start sm:self-auto">{f.pending} left for container</span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Bar percent={f.percent} complete={f.complete} />
                <span className="text-xs font-semibold text-gray-600 tabular-nums shrink-0">{f.ready}/{f.total} pcs ready · {f.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
