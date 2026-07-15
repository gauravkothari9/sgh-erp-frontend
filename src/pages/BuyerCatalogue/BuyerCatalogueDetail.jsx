import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Search, Image as ImageIcon,
  Info, Calendar, Box, Package, FileDown,
  LayoutGrid, List as ListIcon, CheckSquare, Square,
  ZoomIn,
} from 'lucide-react';
import { buyerCatalogueAPI } from '../../utils/api';
import { PageLoader } from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ImageLightbox from '../../components/common/ImageLightbox';
import Modal from '../../components/common/Modal';
import { useDebounce } from '../../hooks/useDebounce';
import { formatCurrency, formatDate, getCurrencySymbol, imgErrorFallback } from '../../utils/formatters';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import { useCatalogueSelectionStore } from '../../store/catalogueSelectionStore';
import CatalogueSelectionBar from '../../components/catalogue/CatalogueSelectionBar';

// Normalize a stored media path so legacy catalogue rows (missing leading
// slash, Windows backslashes, etc.) still render from the dev proxy / origin.
const resolveMediaSrc = (p) => {
  if (!p || typeof p !== 'string') return '';
  const forward = p.replace(/\\/g, '/').trim();
  if (!forward) return '';
  if (/^(https?:|data:|blob:)/i.test(forward)) return forward;
  return forward.startsWith('/') ? forward : `/${forward}`;
};

export default function BuyerCatalogueDetail() {
  const { fileNumber } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [catalogue, setCatalogue] = useState(null);
  const [search, setSearch] = useState('');

  // View mode (list | grid), persisted per user preference
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('sgh-catalogue-detail-view') || 'list'
  );
  const toggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('sgh-catalogue-detail-view', mode);
  };

  // Cross-folder product selection is owned by a Zustand store so it survives
  // navigation between Buyer Files. Local helpers below adapt the store to the
  // existing call sites (toggleSelect / "is selected for *this* product").
  const selectedItems = useCatalogueSelectionStore((s) => s.items);
  const toggleInStore = useCatalogueSelectionStore((s) => s.toggle);
  const addInStore = useCatalogueSelectionStore((s) => s.add);
  const removeInStore = useCatalogueSelectionStore((s) => s.remove);
  const clearStore = useCatalogueSelectionStore((s) => s.clear);

  const isSelected = (id) => !!selectedItems[id];
  const toggleSelect = (product) => {
    toggleInStore(product, fileNumber, catalogue?.buyer?.companyName || '');
  };
  const clearSelection = () => clearStore();

  // Modal states
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Image viewer (lightbox) — opens with a product so it can step through
  // primaryImage + images[] without re-fetching.
  const [viewerProduct, setViewerProduct] = useState(null);
  const [viewerIdx, setViewerIdx] = useState(0);
  const openViewer = (product, startIdx = 0) => {
    setViewerProduct(product);
    setViewerIdx(startIdx);
  };
  const closeViewer = () => setViewerProduct(null);
  // Build the deduped, ordered image list for a product — primaryImage first,
  // then any additional images that aren't already in the list.
  const galleryFor = (p) => {
    if (!p) return [];
    const seen = new Set();
    const out = [];
    const push = (src) => {
      const r = resolveMediaSrc(src);
      if (r && !seen.has(r)) { seen.add(r); out.push(r); }
    };
    push(p.primaryImage);
    (p.images || []).forEach(push);
    return out;
  };
  // Keyboard nav is handled inside the ImageLightbox component.

  const debouncedSearch = useDebounce(search, 300);

  const fetchCatalogue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await buyerCatalogueAPI.getDetail(fileNumber, { search: debouncedSearch });
      setCatalogue(res.data.data);
    } catch (error) {
      console.error('Failed to fetch catalogue detail', error);
      if (error.response?.status === 404) {
        navigate('/office/buyer-catalogue');
      }
    } finally {
      setLoading(false);
    }
  }, [fileNumber, debouncedSearch, navigate]);

  useEffect(() => {
    fetchCatalogue();
  }, [fetchCatalogue]);

  // Resolve a stored upload path to a fully qualified URL so fetch() can
  // load it when we're embedding it in the workbook.
  const toAbsUrl = (u) => {
    if (!u) return '';
    if (/^(https?:|data:|blob:)/i.test(u)) return u;
    const baseUrl = import.meta.env.VITE_UPLOAD_URL
      ? import.meta.env.VITE_UPLOAD_URL.replace(/\/uploads$/, '')
      : window.location.origin;
    return `${baseUrl}${u.startsWith('/') ? u : `/${u}`}`;
  };

  // Pull the image as an array buffer for ExcelJS — exceljs supports png/jpeg/gif.
  const fetchImageForExcel = async (url) => {
    try {
      const abs = toAbsUrl(url);
      if (!abs) return null;
      const res = await fetch(abs);
      if (!res.ok) return null;
      const blob = await res.blob();
      const buffer = await blob.arrayBuffer();
      const mime = (blob.type || '').toLowerCase();
      const extension =
        mime.includes('png') ? 'png' :
        mime.includes('gif') ? 'gif' :
        'jpeg';
      return { buffer, extension };
    } catch (e) {
      console.warn('Image fetch failed for catalogue export', url, e);
      return null;
    }
  };

  const exportExcel = async () => {
    if (!catalogue?.products?.length) return;

    const buyerName = catalogue.buyer?.companyName || '';
    const toastId = toast.loading('Building Excel workbook…');

    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'SGH Crafts ERP';
      wb.created = new Date();
      const ws = wb.addWorksheet('Catalogue', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
      });

      // ── Title + meta rows ───────────────────────────────────────────
      ws.mergeCells(1, 1, 1, 11);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = `SGH CRAFTS — Buyer Catalogue · ${fileNumber}`;
      titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFA86820' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      ws.getRow(1).height = 24;

      ws.mergeCells(2, 1, 2, 11);
      const metaCell = ws.getCell(2, 1);
      metaCell.value = [
        buyerName ? `Buyer: ${buyerName}` : '',
        `Products: ${catalogue.products.length}`,
        `Exported: ${formatDate(new Date())}`,
      ].filter(Boolean).join('    ·    ');
      metaCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF6B7280' } };
      ws.getRow(2).height = 18;
      ws.getRow(3).height = 6;

      // ── Header row ──────────────────────────────────────────────────
      const headers = [
        { key: 'photo',         label: 'Photo',         width: 18 },
        { key: 'sku',           label: 'Company SKU',   width: 18 },
        { key: 'buyerSKU',      label: 'Buyer SKU',     width: 18 },
        { key: 'description',   label: 'Description',   width: 36 },
        { key: 'category',      label: 'Category',      width: 18 },
        { key: 'materials',     label: 'Materials',     width: 22 },
        { key: 'finishes',      label: 'Finishes',      width: 22 },
        { key: 'totalOrders',   label: 'Total Orders',  width: 12 },
        { key: 'totalQty',      label: 'Total Qty',     width: 12 },
        { key: 'lastOrdered',   label: 'Last Ordered',  width: 14 },
        { key: 'currentPrice',  label: 'Current Price', width: 16 },
      ];
      const headerStyle = {
        font: { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA86820' } },
        alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
        border: {
          top:    { style: 'thin', color: { argb: 'FFC4822A' } },
          bottom: { style: 'thin', color: { argb: 'FFC4822A' } },
          left:   { style: 'thin', color: { argb: 'FFC4822A' } },
          right:  { style: 'thin', color: { argb: 'FFC4822A' } },
        },
      };
      ws.columns = headers.map((h) => ({ width: h.width }));
      headers.forEach((h, i) => {
        const cell = ws.getCell(4, i + 1);
        cell.value = h.label;
        cell.font = headerStyle.font;
        cell.fill = headerStyle.fill;
        cell.alignment = headerStyle.alignment;
        cell.border = headerStyle.border;
      });
      ws.getRow(4).height = 22;

      // ── Data rows ───────────────────────────────────────────────────
      const altRowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF8F3' } };
      const cellBorder = {
        top:    { style: 'hair', color: { argb: 'FFEAD9C2' } },
        bottom: { style: 'hair', color: { argb: 'FFEAD9C2' } },
        left:   { style: 'hair', color: { argb: 'FFEAD9C2' } },
        right:  { style: 'hair', color: { argb: 'FFEAD9C2' } },
      };
      const photoEmbedQueue = [];

      catalogue.products.forEach((p, idx) => {
        const r = idx + 5;
        const cells = [
          '', // photo — embedded below
          p.sku || '',
          p.buyerSKU || '',
          p.itemDescription || '',
          p.itemCategory || '',
          (p.materials || []).join(', '),
          (p.finishes || []).join(', '),
          p.totalTimesOrdered || 0,
          p.totalQuantityOrdered || 0,
          p.lastOrderedAt ? new Date(p.lastOrderedAt) : null,
          p.currentPrice || 0,
        ];
        cells.forEach((v, i) => {
          const cell = ws.getCell(r, i + 1);
          cell.value = v;
          cell.border = cellBorder;
          cell.alignment = { vertical: 'middle', wrapText: i === 3 };
          if (idx % 2 === 1) cell.fill = altRowFill;
        });
        // Number formats — currency, totals, date.
        ws.getCell(r, 8).numFmt = '0';
        ws.getCell(r, 9).numFmt = '0';
        ws.getCell(r, 10).numFmt = 'dd-mmm-yyyy';
        ws.getCell(r, 11).numFmt = `"${getCurrencySymbol('USD')}" #,##0.00`;
        ws.getCell(r, 11).font = { name: 'Segoe UI', size: 10, bold: true };

        const imgUrl = p.primaryImage || (p.images?.length > 0 ? p.images[0] : '');
        if (imgUrl) photoEmbedQueue.push({ url: imgUrl, row: r });
        ws.getRow(r).height = 80; // taller row → readable embedded image
      });

      // ── Auto-filter ─────────────────────────────────────────────────
      ws.autoFilter = `A4:K${4 + catalogue.products.length}`;
      ws.pageSetup.printTitlesRow = '4:4';

      // ── Embed product images in the Photo column ────────────────────
      toast.loading(`Embedding ${photoEmbedQueue.length} image${photoEmbedQueue.length === 1 ? '' : 's'}…`, { id: toastId });
      const fetched = await Promise.all(photoEmbedQueue.map((p) => fetchImageForExcel(p.url)));
      photoEmbedQueue.forEach((p, i) => {
        const meta = fetched[i];
        if (!meta) return;
        const imageId = wb.addImage({ buffer: meta.buffer, extension: meta.extension });
        ws.addImage(imageId, {
          tl: { col: 0.1, row: p.row - 1 + 0.05 },
          br: { col: 1,   row: p.row },
          editAs: 'oneCell',
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      saveAs(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `Buyer_Catalogue_${fileNumber}.xlsx`,
      );
      toast.success('Workbook downloaded', { id: toastId });
    } catch (err) {
      console.error('Catalogue export failed', err);
      toast.error('Catalogue export failed — see console', { id: toastId });
    }
  };

  if (loading && !catalogue) return <PageLoader message="Loading catalogue details..." />;
  if (!catalogue) return <EmptyState title="Not Found" message="Catalogue could not be loaded." />;

  const products = catalogue.products || [];

  // ── Dynamic column visibility ─────────────────────────────────────────
  // A column is shown only if at least one product has a non-empty value
  // for it. This drops empty fields entirely from the rendered table.
  const has = (fn) => products.some(fn);
  const hasDims = has(
    (p) => p.dimensions && (p.dimensions.length || p.dimensions.width || p.dimensions.height)
  );
  const cols = {
    photo: has((p) => p.primaryImage || (p.images && p.images.length)),
    buyerSKU: has((p) => p.buyerSKU),
    description: has((p) => p.itemDescription),
    buyerDescription: has((p) => p.buyerDescription),
    category: has((p) => p.itemCategory),
    collection: has((p) => p.collectionName),
    materials: has((p) => p.materials && p.materials.length),
    finishes: has((p) => p.finishes && p.finishes.length),
    condition: has((p) => p.itemCondition),
    hsn: has((p) => p.hsnCode),
    dimensions: hasDims,
    cbm: has((p) => p.cbm),
    weight: has((p) => p.weight),
    barcode: has((p) => p.barcode && (p.barcode.text || p.barcode.image)),
    production: has((p) => p.productionNotes),
    qc: has((p) => p.qcNotes),
    polish: has((p) => p.polishNotes),
    packaging: has((p) => p.packagingNotes),
  };

  return (
    <div className="space-y-6 fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/office/buyer-catalogue')} className="btn-ghost btn p-2 shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{fileNumber} Catalogue</h1>
            <p className="text-sm text-gray-500 mt-0.5 font-medium truncate">
              Customer: <span className="text-brand-700 font-bold">{catalogue.buyer?.companyName || 'Unknown'}</span>
              <span className="mx-2 text-gray-300">•</span>
              {products.length} Products
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search SKU or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 input w-full sm:w-64 bg-white"
            />
          </div>

          {/* View mode switcher */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0">
            <button
              onClick={() => toggleViewMode('list')}
              className={`p-1.5 rounded transition-all ${
                viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="List view"
            >
              <ListIcon size={16} />
            </button>
            <button
              onClick={() => toggleViewMode('grid')}
              className={`p-1.5 rounded transition-all ${
                viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <button
            onClick={exportExcel}
            disabled={products.length === 0}
            className="btn-secondary btn px-3 py-2 whitespace-nowrap shrink-0"
          >
            <FileDown size={16} /> Export
          </button>
        </div>
      </div>

      {/* Cross-folder selection bar — visible whenever any product is selected,
          in this folder or any other. Lets the user combine products from
          multiple Buyer Files into a single new order draft. */}
      <CatalogueSelectionBar />

      {/* Main Table / Grid */}
      {products.length === 0 ? (
        <EmptyState
          icon={Box}
          title="No Products Found"
          message={search ? `No products match "${search}"` : "This buyer folder has no products yet."}
        />
      ) : viewMode === 'list' ? (
        <>
        {/* Desktop: the full dynamic-column table */}
        <div className="card overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-xs text-left border-collapse border border-brand-100">
              <thead className="bg-brand-50 text-brand-700">
                <tr>
                  <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap w-8">
                    <input
                      type="checkbox"
                      checked={products.length > 0 && products.every((p) => isSelected(p._id))}
                      onChange={(e) => {
                        // "Select all" only touches the current folder's products
                        // so it never wipes out items already selected from other
                        // Buyer Files.
                        const buyerName = catalogue?.buyer?.companyName || '';
                        if (e.target.checked) {
                          products.forEach((p) => addInStore(p, fileNumber, buyerName));
                        } else {
                          products.forEach((p) => removeInStore(p._id));
                        }
                      }}
                      className="cursor-pointer"
                      title="Select all (in this folder)"
                    />
                  </th>
                  {cols.photo && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap w-16">Photo</th>}
                  <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">Company SKU</th>
                  {cols.buyerSKU && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">Buyer SKU</th>}
                  {cols.description && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap min-w-[180px]">Description</th>}
                  {cols.buyerDescription && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap min-w-[160px]">Buyer Description</th>}
                  {cols.category && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">Category</th>}
                  {cols.collection && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">Collection</th>}
                  {cols.materials && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">Materials</th>}
                  {cols.finishes && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">Finishes</th>}
                  {cols.condition && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">Condition</th>}
                  {cols.hsn && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">HSN</th>}
                  {cols.dimensions && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">Dimensions</th>}
                  {cols.cbm && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap text-right">CBM</th>}
                  {cols.weight && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap text-right">Wt(kg)</th>}
                  {cols.barcode && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap">Barcode</th>}
                  {cols.production && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap min-w-[140px]">Production</th>}
                  {cols.qc && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap min-w-[140px]">QC</th>}
                  {cols.polish && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap min-w-[140px]">Polish</th>}
                  {cols.packaging && <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap min-w-[140px]">Packaging</th>}
                  <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap text-center">Historical</th>
                  <th className="border-b border-brand-200 px-2 py-2 font-semibold whitespace-nowrap text-right">Last Price</th>
                </tr>
              </thead>
              <tbody>
                {products.map((item) => {
                  const imgSrc = resolveMediaSrc(
                    item.primaryImage || (item.images?.length > 0 ? item.images[0] : '')
                  );
                  const barcodeImg = resolveMediaSrc(item.barcode?.image);
                  const dash = <span className="text-gray-300">—</span>;
                  const isSel = isSelected(item._id);
                  return (
                    <tr
                      key={item._id}
                      style={{ height: '120px' }}
                      className={`hover:bg-brand-50/30 transition-colors ${isSel ? 'bg-brand-50/60' : ''}`}
                    >
                      <td className="border border-brand-100 px-2 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelect(item)}
                          className="cursor-pointer"
                        />
                      </td>
                      {cols.photo && (
                        <td className="border border-brand-100 px-2 py-2 align-top">
                          {imgSrc ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openViewer(item, 0); }}
                              className="group relative rounded overflow-hidden bg-gray-100 border-2 border-brand-200 hover:border-brand-500 transition-colors"
                              style={{ width: '110px', height: '110px' }}
                              title="Click to preview image"
                            >
                              <img
                                src={imgSrc}
                                alt="Product"
                                className="w-full h-full object-cover"
                                onError={imgErrorFallback}
                              />
                              <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn size={18} className="text-white" />
                              </span>
                              {item.images?.length > 1 && (
                                <span className="absolute bottom-1 right-1 text-[10px] font-bold bg-brand-600 text-white px-1.5 py-0.5 rounded">
                                  {item.images.length} pics
                                </span>
                              )}
                            </button>
                          ) : (
                            <div className="rounded overflow-hidden bg-gray-100 border border-brand-100 flex items-center justify-center" style={{ width: '110px', height: '110px' }}>
                              <ImageIcon size={28} className="text-gray-300" />
                            </div>
                          )}
                        </td>
                      )}
                      <td className="border border-brand-100 px-2 py-2 align-top">
                        <Link
                          to={`/office/buyer-catalogue/${encodeURIComponent(fileNumber)}/product/${encodeURIComponent(item.sku)}`}
                          state={{ buyer: catalogue.buyer }}
                          className="font-bold text-brand-700 bg-gray-50 hover:bg-brand-50 border border-gray-200 hover:border-brand-300 px-2 py-1 rounded font-mono text-[11px] transition-colors"
                        >
                          {item.sku}
                        </Link>
                      </td>
                      {cols.buyerSKU && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600">{item.buyerSKU || dash}</td>
                      )}
                      {cols.description && (
                        <td className="border border-brand-100 px-2 py-2 align-top">
                          <p
                            className="text-gray-800 font-medium max-w-xs whitespace-normal"
                            title={item.itemDescription}
                          >
                            {item.itemDescription || dash}
                          </p>
                        </td>
                      )}
                      {cols.buyerDescription && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-700 max-w-xs whitespace-normal">
                          {item.buyerDescription || dash}
                        </td>
                      )}
                      {cols.category && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600">{item.itemCategory || dash}</td>
                      )}
                      {cols.collection && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600">{item.collectionName || dash}</td>
                      )}
                      {cols.materials && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600">
                          {item.materials?.length > 0 ? item.materials.join(', ') : dash}
                        </td>
                      )}
                      {cols.finishes && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600">
                          {item.finishes?.length > 0 ? item.finishes.join(', ') : dash}
                        </td>
                      )}
                      {cols.condition && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600">{item.itemCondition || dash}</td>
                      )}
                      {cols.hsn && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600 font-mono text-[11px]">
                          {item.hsnCode || dash}
                        </td>
                      )}
                      {cols.dimensions && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600 text-[11px]">
                          {item.dimensions && (item.dimensions.length || item.dimensions.width || item.dimensions.height)
                            ? `${item.dimensions.length || 0} × ${item.dimensions.width || 0} × ${item.dimensions.height || 0} ${item.dimensions.unit || 'cm'}`
                            : dash}
                        </td>
                      )}
                      {cols.cbm && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-right text-gray-600">
                          {item.cbm ? Number(item.cbm).toFixed(3) : dash}
                        </td>
                      )}
                      {cols.weight && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-right text-gray-600">
                          {item.weight ? Number(item.weight).toFixed(2) : dash}
                        </td>
                      )}
                      {cols.barcode && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600">
                          <div className="flex flex-col gap-1.5">
                            {item.barcode?.text && (
                              <span className="font-mono text-[11px]">
                                {item.barcode.text}
                              </span>
                            )}
                            {barcodeImg && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openViewer(
                                    {
                                      sku: item.sku,
                                      itemDescription: 'Barcode',
                                      primaryImage: item.barcode.image,
                                      images: [],
                                    },
                                    0,
                                  );
                                }}
                                className="group relative rounded overflow-hidden bg-gray-100 border-2 border-brand-200 hover:border-brand-500 transition-colors shrink-0"
                                style={{ width: '110px', height: '110px' }}
                                title="Preview barcode"
                              >
                                <img
                                  src={barcodeImg}
                                  alt="Barcode"
                                  className="w-full h-full object-cover"
                                  onError={imgErrorFallback}
                                />
                                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn size={18} className="text-white" />
                                </span>
                              </button>
                            )}
                            {!item.barcode?.text && !barcodeImg && dash}
                          </div>
                        </td>
                      )}
                      {cols.production && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600 whitespace-normal max-w-[220px]">
                          {item.productionNotes || dash}
                        </td>
                      )}
                      {cols.qc && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600 whitespace-normal max-w-[220px]">
                          {item.qcNotes || dash}
                        </td>
                      )}
                      {cols.polish && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600 whitespace-normal max-w-[220px]">
                          {item.polishNotes || dash}
                        </td>
                      )}
                      {cols.packaging && (
                        <td className="border border-brand-100 px-2 py-2 align-top text-gray-600 whitespace-normal max-w-[220px]">
                          {item.packagingNotes || dash}
                        </td>
                      )}
                      <td className="border border-brand-100 px-2 py-2 align-top">
                        <div className="flex flex-col items-center">
                          <span className="bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded border border-brand-200">
                            {item.totalTimesOrdered} orders
                          </span>
                          <span className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">
                            {item.totalQuantityOrdered} pcs total
                          </span>
                        </div>
                      </td>
                      <td className="border border-brand-100 px-2 py-2 align-top font-bold text-gray-900 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {formatCurrency(item.currentPrice)}
                          <button
                            onClick={() => setSelectedProduct(item)}
                            className="text-brand-500 hover:text-brand-700 p-1.5 hover:bg-brand-50 rounded transition-colors"
                            title="View Price History"
                          >
                            <Info size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phone: each row as a card. Photo + SKU + description + price always
            show; every other column only appears when this item has a value. */}
        <div className="md:hidden space-y-2">
          <label className="flex items-center gap-2 px-1 text-xs font-semibold text-gray-500">
            <input
              type="checkbox"
              checked={products.length > 0 && products.every((p) => isSelected(p._id))}
              onChange={(e) => {
                const buyerName = catalogue?.buyer?.companyName || '';
                if (e.target.checked) {
                  products.forEach((p) => addInStore(p, fileNumber, buyerName));
                } else {
                  products.forEach((p) => removeInStore(p._id));
                }
              }}
              className="cursor-pointer"
            />
            Select all (in this folder)
          </label>

          {products.map((item) => {
            const imgSrc = resolveMediaSrc(
              item.primaryImage || (item.images?.length > 0 ? item.images[0] : '')
            );
            const isSel = isSelected(item._id);
            const d = item.dimensions;
            const lines = [
              ['Buyer SKU', item.buyerSKU],
              ['Buyer Description', item.buyerDescription],
              ['Category', item.itemCategory],
              ['Collection', item.collectionName],
              ['Materials', item.materials?.length ? item.materials.join(', ') : ''],
              ['Finishes', item.finishes?.length ? item.finishes.join(', ') : ''],
              ['Condition', item.itemCondition],
              ['HSN', item.hsnCode],
              ['Dimensions', d && (d.length || d.width || d.height)
                ? `${d.length || 0} × ${d.width || 0} × ${d.height || 0} ${d.unit || 'cm'}`
                : ''],
              ['CBM', item.cbm ? Number(item.cbm).toFixed(3) : ''],
              ['Weight (kg)', item.weight ? Number(item.weight).toFixed(2) : ''],
              ['Barcode', item.barcode?.text],
              ['Production', item.productionNotes],
              ['QC', item.qcNotes],
              ['Polish', item.polishNotes],
              ['Packaging', item.packagingNotes],
              ['Historical', `${item.totalTimesOrdered} orders · ${item.totalQuantityOrdered} pcs`],
            ].filter(([, v]) => v !== undefined && v !== null && v !== '');

            return (
              <div
                key={item._id}
                className={`card p-3 ${isSel ? 'ring-2 ring-brand-500 border-brand-400' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelect(item)}
                    className="cursor-pointer mt-1 shrink-0"
                  />

                  <button
                    type="button"
                    onClick={() => imgSrc && openViewer(item, 0)}
                    className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-brand-100 flex items-center justify-center"
                    title={imgSrc ? 'Preview image' : 'No image'}
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt="" className="w-full h-full object-cover" onError={imgErrorFallback} />
                    ) : (
                      <ImageIcon size={24} className="text-gray-300" />
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/office/buyer-catalogue/${encodeURIComponent(fileNumber)}/product/${encodeURIComponent(item.sku)}`}
                      state={{ buyer: catalogue.buyer }}
                      className="font-mono font-bold text-brand-700 text-xs"
                    >
                      {item.sku}
                    </Link>
                    <p className="text-xs text-gray-800 font-medium mt-0.5 line-clamp-3">
                      {item.itemDescription || '—'}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(item.currentPrice)}
                      </span>
                      <button
                        onClick={() => setSelectedProduct(item)}
                        className="text-brand-500 p-1"
                        title="View Price History"
                      >
                        <Info size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {lines.length > 0 && (
                  <dl className="mt-2 pt-2 border-t border-gray-100 space-y-1 text-[11px]">
                    {lines.map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <dt className="text-gray-400 shrink-0 w-28">{label}</dt>
                        <dd className="text-gray-700 min-w-0 flex-1 break-words">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
        </>
      ) : (
        /* Grid view — product cards with photo, buyer SKU, description, size */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {products.map((item) => {
            const imgSrc = resolveMediaSrc(
              item.primaryImage || (item.images?.length > 0 ? item.images[0] : '')
            );
            const isSel = isSelected(item._id);
            const dims = item.dimensions;
            const hasDims = dims && (dims.length || dims.width || dims.height);
            return (
              <div
                key={item._id}
                onClick={() =>
                  navigate(
                    `/office/buyer-catalogue/${encodeURIComponent(fileNumber)}/product/${encodeURIComponent(item.sku)}`,
                    { state: { buyer: catalogue.buyer } }
                  )
                }
                className={`group relative card p-0 overflow-hidden cursor-pointer transition-all ${
                  isSel
                    ? 'ring-2 ring-brand-500 border-brand-400 shadow-md'
                    : 'hover:border-brand-300 hover:shadow-md'
                }`}
              >
                {/* Select indicator — clicking here toggles selection without
                    navigating to the product page */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(item);
                  }}
                  className="absolute top-2 left-2 z-10"
                  title={isSel ? 'Deselect' : 'Select'}
                >
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center shadow-sm transition-colors ${
                      isSel ? 'bg-brand-600 text-white' : 'bg-white/90 text-gray-400 border border-gray-200 hover:text-brand-600'
                    }`}
                  >
                    {isSel ? <CheckSquare size={14} /> : <Square size={14} />}
                  </div>
                </button>

                {/* Price history button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProduct(item);
                  }}
                  className="absolute top-2 right-2 z-10 w-6 h-6 rounded bg-white/90 text-brand-600 hover:bg-brand-50 flex items-center justify-center shadow-sm border border-gray-200"
                  title="View price history"
                >
                  <Info size={12} />
                </button>

                {/* Image */}
                <div className="aspect-square bg-gray-50 border-b border-gray-100 overflow-hidden relative">
                  {imgSrc ? (
                    <>
                      <img
                        src={imgSrc}
                        alt={item.itemDescription || item.sku}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                        onError={imgErrorFallback}
                      />
                      {/* Preview button — bottom-right; clicking opens the
                          lightbox without navigating to the product page. */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openViewer(item, 0); }}
                        className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-brand-700 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Preview image"
                      >
                        <ZoomIn size={13} />
                      </button>
                      {item.images?.length > 1 && (
                        <span className="absolute bottom-2 left-2 text-[10px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">
                          {item.images.length} photos
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon size={32} className="text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-3 space-y-1">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="font-mono font-bold text-brand-700 bg-brand-50 border border-brand-200 px-1.5 py-0.5 rounded">
                      {item.sku}
                    </span>
                    {item.buyerSKU && (
                      <span className="font-mono text-gray-500 truncate" title={item.buyerSKU}>
                        / {item.buyerSKU}
                      </span>
                    )}
                  </div>
                  <p
                    className="text-xs font-semibold text-gray-800 line-clamp-2 min-h-[2rem]"
                    title={item.itemDescription}
                  >
                    {item.itemDescription || '—'}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {hasDims
                      ? `${dims.length || 0} × ${dims.width || 0} × ${dims.height || 0} ${dims.unit || 'cm'}`
                      : 'No size'}
                  </p>
                  <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400">
                      {item.totalTimesOrdered} orders
                    </span>
                    <span className="text-xs font-bold text-brand-700">
                      {formatCurrency(item.currentPrice)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Viewer — uses the shared white-card ImageLightbox component */}
      {viewerProduct && (() => {
        const imgs = galleryFor(viewerProduct);
        const sku = viewerProduct.sku || '';
        const desc = viewerProduct.itemDescription || '';
        const title = desc ? `${sku} — ${desc}` : sku;
        return (
          <ImageLightbox
            images={imgs}
            index={Math.min(viewerIdx, Math.max(imgs.length - 1, 0))}
            title={title}
            onClose={closeViewer}
            onChange={(i) => setViewerIdx(i)}
          />
        );
      })()}

      {/* Price History Modal */}
      {selectedProduct && (
        <Modal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          title={`Price History - ${selectedProduct.sku}`}
        >
          <div className="space-y-4">
            <div className="bg-brand-50 border border-brand-100 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">{selectedProduct.itemDescription || 'Unknown Product'}</p>
                <p className="text-xs text-gray-500 mt-0.5">First ordered: {selectedProduct.firstOrderedAt ? formatDate(selectedProduct.firstOrderedAt) : '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Current Price</p>
                <p className="text-lg font-bold text-brand-700">{formatCurrency(selectedProduct.currentPrice)}</p>
              </div>
            </div>

            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="bg-gray-50 p-3 grid grid-cols-4 gap-2 sm:gap-4 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase">
                <div>Date</div>
                <div>Order #</div>
                <div className="text-right">Avg. Qty</div>
                <div className="text-right">Price</div>
              </div>
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {selectedProduct.priceHistory?.sort((a, b) => new Date(b.date) - new Date(a.date)).map((hist, idx) => (
                  <div key={idx} className="p-3 grid grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm hover:bg-gray-50/50">
                    <div className="text-gray-600 flex items-center gap-1.5 min-w-0">
                      <Calendar size={13} className="text-gray-400 shrink-0" />
                      <span className="truncate">{formatDate(hist.date)}</span>
                    </div>
                    <div className="min-w-0">
                      <Link
                        to={`/office/orders/${hist.orderId}`}
                        className="text-brand-600 hover:text-brand-800 font-medium hover:underline flex items-center gap-1 min-w-0"
                      >
                        <Package size={13} className="shrink-0" />
                        <span className="truncate">{hist.orderNumber}</span>
                      </Link>
                    </div>
                    <div className="text-right text-gray-600">{hist.quantity} pcs</div>
                    <div className="text-right font-bold text-gray-900">
                      {getCurrencySymbol(hist.currency)}{Number(hist.price).toFixed(2)}
                    </div>
                  </div>
                ))}
                {(!selectedProduct.priceHistory || selectedProduct.priceHistory.length === 0) && (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    No history recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
