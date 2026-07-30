import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Loader2, Package, Search, UserPlus, X, ClipboardList, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { useShowroomSelectionStore, selectShowroomList } from '../../store/showroomSelectionStore';
import { customerAPI } from '../../utils/api';
import { resolveMediaSrc, imgErrorFallback } from '../../utils/formatters';
import { exportShowroomSelection } from '../../utils/showroomExcel';
import { productDimensions, productSizeLabel } from '../../utils/dimensions';
import { totalQtyOf, stockSummary } from '../../utils/showroomZones';
import ImageLightbox from '../../components/common/ImageLightbox';

// The order model requires a SKU. Use the product's own SKU when it has one;
// older showroom items don't, so derive a stable code from branch / zone / id.
const skuFor = (row) => {
  const own = row.product?.sku?.trim();
  if (own) return own.toUpperCase();
  const b = (row.branch || 'X')[0];
  const z = (row.zone || 'X').toUpperCase();
  const tail = String(row.id || '').slice(-5).toUpperCase();
  return `SHW-${b}${z}-${tail}`;
};

const orderQtyOf = (row) => Math.max(parseInt(row.orderQty, 10) || 1, 1);

// Customer typeahead — the order draft needs a customer, and per the showroom
// flow the customer is created/chosen before the walk-through starts.
function CustomerPicker({ customer, onPick }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (search.length < 1) { setResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await customerAPI.getAll({ search, limit: 8, status: 'Active' });
        setResults(res.data.data || []);
      } catch { /* toasted by interceptor */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (customer) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">Customer:</span>
        <span className="font-semibold text-gray-800">{customer.companyName}</span>
        <span className="text-[13px] text-gray-400">{customer.fileNumber}</span>
        <button onClick={() => onPick(null)} className="text-gray-300 hover:text-red-500" title="Change customer">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer…"
            className="input py-1.5 pl-8 text-sm w-56"
          />
        </div>
        <button onClick={() => navigate('/office/customers/new')} className="btn btn-secondary" title="Create a new customer">
          <UserPlus size={14} /> New
        </button>
      </div>
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-72 bg-white border border-linen-300 rounded-xl shadow-card-hover max-h-64 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c._id}
              onClick={() => { onPick(c); setSearch(''); setResults([]); }}
              className="w-full text-left px-3 py-2 hover:bg-linen-50 border-b border-linen-200 last:border-0"
            >
              <p className="text-sm font-semibold text-gray-800">{c.companyName}</p>
              <p className="text-[13px] text-gray-400">{c.fileNumber}{c.contactPerson ? ` · ${c.contactPerson}` : ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Running list of products the user picked while walking the zones. Price and
// Comments are typed here; everything else comes from the product. Persisted
// across zones/branches by the store, so this table is the same list everywhere.
export default function ShowroomSelectionTable() {
  const navigate = useNavigate();
  const rows = useShowroomSelectionStore(selectShowroomList);
  const mode = useShowroomSelectionStore((s) => s.mode);
  const customer = useShowroomSelectionStore((s) => s.customer);
  const setCustomer = useShowroomSelectionStore((s) => s.setCustomer);
  const setField = useShowroomSelectionStore((s) => s.setField);
  const remove = useShowroomSelectionStore((s) => s.remove);
  const clear = useShowroomSelectionStore((s) => s.clear);
  const [exporting, setExporting] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null);

  if (!rows.length) return null;

  const isLocal = mode === 'local';

  // Lightbox browses every selected product that actually has an image.
  const photoRows = rows.filter((r) => r.product?.image);
  const lightboxImages = photoRows.map((r) => resolveMediaSrc(r.product.image));

  const doExport = async () => {
    setExporting(true);
    const toastId = toast.loading('Building Excel workbook…');
    try {
      await exportShowroomSelection(rows, (msg) => toast.loading(msg, { id: toastId }));
      toast.success('Workbook downloaded', { id: toastId });
    } catch (err) {
      console.error('Showroom export failed', err);
      toast.error('Export failed — see console', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  // Hand the selection to CreateOrder as pre-filled line items — the same
  // `prefilledItems` route-state contract the Buyer Catalogue already uses.
  const createDraftOrder = () => {
    if (!customer) { toast.error('Pick a customer first'); return; }

    const overStocked = rows.find((r) => orderQtyOf(r) > totalQtyOf(r.product));
    if (overStocked) {
      toast.error(`"${overStocked.product?.name}" has only ${totalQtyOf(overStocked.product)} unit(s) in the showrooms`);
      return;
    }

    const prefilledItems = rows.map((row) => {
      const p = row.product || {};
      const price = Number(row.price);
      const dims = productDimensions(p);
      return {
        sku: skuFor(row),
        // Dimensions carry over as L/W/H; a legacy free-text size that can't be
        // parsed stays visible in the description so nothing is silently lost.
        itemDescription: [p.name, !dims && p.size ? `Size: ${p.size}` : ''].filter(Boolean).join(' — '),
        dimensions: dims || undefined,
        currentPrice: Number.isFinite(price) ? price : 0,
        quantity: orderQtyOf(row),
        images: p.image ? [p.image] : [],
        primaryImage: p.image || '',
        comments: row.comments ? [{ text: row.comments }] : [],
        productionNotes: `Showroom: ${row.branch} · Zone ${row.zone}`,
      };
    });

    // CreateOrder deducts these from showroom stock once the order is saved —
    // stock must not move while the draft is only half-typed.
    const showroomStock = rows.map((row) => ({
      id: row.id,
      qty: orderQtyOf(row),
      branch: row.branch,
      zone: row.zone,
    }));

    navigate(`/office/orders/new?customer=${customer._id}`, { state: { prefilledItems, showroomStock } });
    clear(); // the items now live in the draft order form
  };

  // Local sale — the walk-in path. Items go to the local order form, which
  // deducts the stock when the bill is saved.
  const sellLocally = () => {
    const overStocked = rows.find((r) => orderQtyOf(r) > totalQtyOf(r.product));
    if (overStocked) {
      toast.error(`"${overStocked.product?.name}" has only ${totalQtyOf(overStocked.product)} unit(s) in the showrooms`);
      return;
    }
    const saleItems = rows.map((row) => {
      const p = row.product || {};
      return {
        product: row.id,
        sku: p.sku || '',
        name: p.name || '',
        size: productSizeLabel(p),
        image: p.image || '',
        comments: row.comments || '',
        branch: row.branch,
        zone: row.zone,
        quantity: orderQtyOf(row),
        // Walk-ins are billed at the product's stored local price; a price typed
        // in the table overrides it for this sale only.
        unitPrice: row.price !== '' && row.price != null ? Number(row.price) || 0 : (p.localPrice || 0),
        stock: totalQtyOf(p),
      };
    });
    navigate('/local/orders/new', { state: { saleItems } });
  };

  const missingPrice = rows.filter((r) => r.price === '' || r.price == null).length;

  return (
    <div className="bg-white border border-linen-300 rounded-xl shadow-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-linen-300 bg-linen-50">
        <div>
          <p className="font-bold text-gray-800 text-sm flex items-center gap-2">
            Selected products
            <span className={`text-[12px] px-2 py-0.5 rounded-full border font-semibold ${
              isLocal
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {isLocal ? 'Local customer' : 'Normal customer'}
            </span>
          </p>
          <p className="text-[13px] text-gray-500">
            {rows.length} item{rows.length === 1 ? '' : 's'} across all zones — {isLocal
              ? 'priced at their local price; adjust if needed, then create the local order'
              : 'quote a price per item, then export or create the draft order'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isLocal && <CustomerPicker customer={customer} onPick={setCustomer} />}
          <button onClick={clear} disabled={exporting} className="btn btn-secondary">Clear all</button>

          {isLocal ? (
            <button onClick={sellLocally} disabled={exporting} className="btn btn-primary">
              <Store size={15} /> Create local order
            </button>
          ) : (
            <>
              <button onClick={doExport} disabled={exporting} className="btn btn-secondary">
                {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
                Export Excel
              </button>
              <button onClick={createDraftOrder} disabled={exporting} className="btn btn-primary">
                <ClipboardList size={15} /> Create draft order
              </button>
            </>
          )}
        </div>
      </div>

      {!isLocal && missingPrice > 0 && (
        <p className="px-4 py-2 text-[13px] text-amber-700 bg-amber-50 border-b border-amber-200">
          {missingPrice} item{missingPrice === 1 ? '' : 's'} still have no price — they will carry ₹0 into the order.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[52rem]">
          <thead className="bg-linen-100 text-[13px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left w-14">Sr. No.</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Size</th>
              <th className="px-3 py-2 text-left w-28">Qty</th>
              <th className="px-3 py-2 text-left w-36">Price (₹)</th>
              <th className="px-3 py-2 text-left w-32">Image</th>
              <th className="px-3 py-2 text-left">Comments</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-linen-200">
            {rows.map((row, idx) => {
              const p = row.product || {};
              const stock = totalQtyOf(p);
              const over = orderQtyOf(row) > stock;
              return (
                <tr key={row.id} className="align-middle">
                  <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    <p className="text-[13px] text-gray-400">
                      {p.sku ? `${p.sku} · ` : ''}{row.branch} · Zone {row.zone}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{productSizeLabel(p) || '—'}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="1"
                      max={stock}
                      value={row.orderQty ?? 1}
                      onChange={(e) => setField(row.id, 'orderQty', e.target.value)}
                      className={`input py-1.5 text-sm ${over ? 'border-red-400 focus:border-red-500' : ''}`}
                    />
                    <p className={`text-[12px] mt-0.5 ${over ? 'text-red-500 font-semibold' : 'text-gray-400'}`} title={stockSummary(p)}>
                      {over ? `Only ${stock} in stock` : `${stock} available`}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      value={row.price}
                      onChange={(e) => setField(row.id, 'price', e.target.value)}
                      placeholder={isLocal && p.localPrice ? String(p.localPrice) : 'Enter price'}
                      className="input py-1.5 text-sm"
                    />
                    <p className="text-[12px] text-gray-400 mt-0.5">
                      {isLocal
                        ? `Local price ₹ ${Number(p.localPrice || 0).toLocaleString('en-IN')}`
                        : `Base ₹ ${Number(p.basePrice || 0).toLocaleString('en-IN')} (ref)`}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    {p.image ? (
                      <button
                        type="button"
                        onClick={() => setLightboxIdx(photoRows.findIndex((r) => r.id === row.id))}
                        title="Click to view full image"
                        className="w-28 h-28 rounded-lg bg-linen-100 border border-linen-300 overflow-hidden hover:border-brand-400 hover:opacity-90 transition-all"
                      >
                        <img src={resolveMediaSrc(p.image)} onError={imgErrorFallback} alt={p.name} className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-28 h-28 rounded-lg bg-linen-100 border border-linen-300 flex items-center justify-center">
                        <Package size={24} className="text-gray-300" />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row.comments}
                      onChange={(e) => setField(row.id, 'comments', e.target.value)}
                      placeholder="Add a comment…"
                      className="input py-1.5 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => remove(row.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove from selection"
                    >
                      <X size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {lightboxIdx !== null && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          index={lightboxIdx}
          title={photoRows[lightboxIdx]?.product?.name || ''}
          onChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}
