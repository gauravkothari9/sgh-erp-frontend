import { useState, useMemo } from 'react';
import {
  FileSpreadsheet, Image as ImageIcon, Download, Upload,
  AlertCircle, CheckCircle, X, Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Modal from '../common/Modal';
import PhotoPicker from '../common/PhotoPicker';
import { orderAPI, customerAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { compressImage } from '../../utils/compressImage';

// ── Excel column map — header name → item field ──────────────────────────────
// Lookup is case/space-insensitive. First matching alias with a non-empty
// value wins, so put the canonical/preferred header first and the looser
// fall-backs after it. Aliases cover the many header names buyers use across
// their own order sheets (article numbers, GO/SK codes, INR price columns,
// depth vs width, etc.). Codes the item schema has no home for are folded
// into the closest identifier field so the row still imports.
const COLUMN_ALIASES = {
  companySKU: [
    'company sku', 'company_sku', 'sku', 'internal sku',
    'sk code', 'go code', 'g.o code',
    'art no', 'art. no.', 'art. no', 'article no', 'article number',
  ],
  buyerSKU: [
    'buyer sku', 'buyer_sku', 'buyer s.k.u', 'customer sku',
    'buyer code', 'g.o item #', 'go item #', 'g.o item', 'go item',
    'g.o po #', 'go po #', 'buyer po',
  ],
  itemDescription: [
    'item description', 'description', 'item name',
    'style description', 'style desc', 'style',
  ],
  buyerDescription: ['buyer description', 'buyer desc'],
  itemCategory: ['category', 'item category'],
  collectionName: ['collection', 'collection name', 'collection style'],
  materials: ['materials', 'material'],
  finishes: [
    'finishes', 'finish',
    'color / finish', 'color/finish', 'colour / finish', 'colour/finish',
    'color finish', 'color', 'colour',
  ],
  itemCondition: ['condition', 'item condition'],
  hsnCode: ['hsn', 'hsn code'],
  length: ['length', 'length (cm)', 'length cm', 'l'],
  // Depth is treated as the horizontal dimension when no explicit Width column
  // is present (Width still wins because it is listed first).
  width: ['width', 'width (cm)', 'width cm', 'w', 'depth', 'depth (cm)', 'depth cm', 'd'],
  height: ['height', 'height (cm)', 'height cm', 'h'],
  unit: ['unit', 'dim unit'],
  // Per-piece CBM only. "Total CBM" columns are intentionally excluded — the
  // backend recomputes totalCBM as cbm × quantity, so importing a total here
  // would double-count.
  cbm: ['cbm', 'cbm (m3)', 'cbm (m³)', 'cbm/pcs', 'cbm per pcs', 'per pcs. cbm', 'per pcs cbm', 'cbm/pc'],
  weight: ['weight', 'weight (kg)', 'weight kg', 'wt'],
  quantity: ['quantity', 'qty', 'pcs', 'pieces', 'pcs qty', 'no of pcs'],
  // Prices are stored in the order's currency (the customer's currency). USD /
  // ex-factory / FOB columns are preferred; INR columns are last-resort
  // fall-backs so an INR-only sheet still imports a price. Line-total columns
  // (Total Amount / Total INR) are excluded — totalPrice is computed on save.
  unitPrice: [
    'unit price', 'price', 'rate',
    'rate in usd ex-factory', 'rate in usd ex factory', 'rate in usd',
    'ex-factory', 'ex factory', 'fob price in usd', 'fob price',
    'price in usd', 'unit price usd',
    'unit price inr', 'rate in inr', 'price in inr',
    'price in inr (ex factory)', 'price in inr ex factory',
  ],
  barcode: [
    'barcode', 'barcode text', 'barcode no', 'barcode number',
    'ean', 'ean code', 'ean codes', 'ean/barcode',
    'tan barcode', 'tan',
  ],
  productionNotes: ['production', 'production notes', 'production note'],
  qcNotes: ['qc', 'qc notes', 'qc note'],
  polishNotes: ['polish', 'polish notes', 'polish note'],
  packagingNotes: [
    'packaging', 'packaging notes', 'packaging note',
    'packing', 'packing instruction', 'packing instructions',
    'pack notes', 'packing note', 'pack',
  ],
  comments: ['comments', 'comment', 'remarks', 'notes', 'photo notes', 'photo note'],
  // Not a schema field — an optional column naming the product photo file, so
  // photos can be matched by an explicit filename in addition to by SKU.
  imageRef: ['image', 'images', 'picture', 'photo', 'photos', 'image name', 'photo name'],
};

// Normalize a header cell to a lookup key.
const normKey = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');

// Given an Excel row (keyed by header string), build an order-item object.
const rowToItem = (row) => {
  const lookup = {};
  for (const k of Object.keys(row)) lookup[normKey(k)] = row[k];

  const pick = (field) => {
    for (const alias of COLUMN_ALIASES[field]) {
      if (lookup[alias] !== undefined && lookup[alias] !== '') return lookup[alias];
    }
    return '';
  };

  const splitList = (v) =>
    typeof v === 'string'
      ? v.split(',').map((x) => x.trim()).filter(Boolean)
      : Array.isArray(v)
        ? v
        : [];

  const num = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  // Order schema requires companySKU. If the sheet only has a Buyer SKU
  // (common case — buyers send their own SKU list) we promote it so the
  // row still validates.
  const buyerSku = String(pick('buyerSKU') || '').trim();
  const companySku = String(pick('companySKU') || '').trim() || buyerSku;

  // Comments column: a single-cell free-text becomes one comment record so
  // it round-trips through the Order schema (which expects [{text, ...}]).
  const commentText = String(pick('comments') || '').trim();
  const comments = commentText ? [{ text: commentText }] : [];

  return {
    companySKU: companySku.toUpperCase(),
    buyerSKU: buyerSku,
    itemDescription: String(pick('itemDescription') || '').trim(),
    buyerDescription: String(pick('buyerDescription') || '').trim(),
    itemCategory: String(pick('itemCategory') || '').trim(),
    collectionName: String(pick('collectionName') || '').trim(),
    materials: splitList(pick('materials')),
    finishes: splitList(pick('finishes')),
    itemCondition: String(pick('itemCondition') || '').trim(),
    hsnCode: String(pick('hsnCode') || '').trim(),
    dimensions: {
      length: num(pick('length')),
      width: num(pick('width')),
      height: num(pick('height')),
      unit: String(pick('unit') || 'cm').trim().toLowerCase() === 'inch' ? 'inch' : 'cm',
    },
    cbm: num(pick('cbm')),
    weight: num(pick('weight')),
    quantity: num(pick('quantity')) || 1,
    unitPrice: num(pick('unitPrice')),
    productionNotes: String(pick('productionNotes') || '').trim(),
    qcNotes: String(pick('qcNotes') || '').trim(),
    polishNotes: String(pick('polishNotes') || '').trim(),
    packagingNotes: String(pick('packagingNotes') || '').trim(),
    images: [],
    primaryImage: '',
    barcode: { text: String(pick('barcode') || '').trim(), image: '' },
    comments,
    // Helper only (stripped before the order is created): the photo filename
    // named in an Image/Photo column, used as an extra photo-match key.
    _imageRef: String(pick('imageRef') || '').trim(),
  };
};

// Strip the path + extension from a filename and lowercase it.
const filenameBase = (filename) => {
  const base = filename.replace(/\\/g, '/').split('/').pop() || filename;
  return base.replace(/\.[^.]+$/, '').toLowerCase();
};

const normSku = (sku) => String(sku || '').trim().toLowerCase();

// Check whether a photo filename belongs to the given SKU. Matches:
//   • exact            →  SKU.jpg                          (Wood-1.jpg   ↔ Wood-1)
//   • single variant   →  SKU-01.jpg / SKU_2.jpg / SKU (3).jpg / SKU copy.jpg
//   • chained variants →  SKU - Copy (2).jpg / SKU_copy_3.jpg / SKU-01-copy.jpg
// The exact match runs first so SKUs that legitimately end in `-1`, `_02`
// etc. (like "Wood-1") are never misread as "Wood" + photo-index.
const photoMatchesSku = (filename, sku) => {
  if (!sku) return false;
  const name = filenameBase(filename);
  const key = normSku(sku);
  if (name === key) return true;
  // After the SKU, allow one or more suffix segments. Each segment is a
  // separator (`-`, `_`, space, or nothing) followed by a counter (`1`,
  // `01`, `(2)`) or the literal word "copy". Chains like " - copy (2)"
  // are handled by the `+` quantifier on the whole group.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const variantRe = new RegExp(
    `^${escaped}(?:[\\s_\\-]*(?:\\(\\d+\\)|\\d+|copy))+$`,
    'i'
  );
  return variantRe.test(name);
};

// Compute CBM from dims (fallback when Excel doesn't supply it).
const calcCBM = (dims) => {
  if (!dims?.length || !dims?.width || !dims?.height) return 0;
  let l = parseFloat(dims.length),
    w = parseFloat(dims.width),
    h = parseFloat(dims.height);
  if (isNaN(l) || isNaN(w) || isNaN(h)) return 0;
  if (dims.unit === 'inch') {
    l /= 39.3701; w /= 39.3701; h /= 39.3701;
  } else {
    l /= 100; w /= 100; h /= 100;
  }
  return Math.round(l * w * h * 1000) / 1000;
};

// Build the Excel template workbook and trigger a download.
//
// Headings cover every per-item field the parser recognises. Width hints for
// long-text columns; an example row shows the expected shape for materials
// (comma-separated), conditions (enum), and multi-line notes.
export const downloadOrderTemplate = () => {
  const headers = [
    // Identification
    'Company SKU', 'Buyer SKU',
    // Description
    'Item Description', 'Buyer Description',
    'Category', 'Collection',
    'Materials', 'Finishes',
    'Condition', 'HSN Code',
    // Physical
    'Length', 'Width', 'Height', 'Unit',
    'CBM', 'Weight (kg)',
    // Pricing
    'Quantity', 'Unit Price',
    // Identifiers
    'Barcode',
    // Factory notes
    'Production Notes', 'QC Notes', 'Polish Notes', 'Packaging Notes',
    // Free-form
    'Comments',
  ];
  const example = [
    'SGH-CAB-001', 'BUYER-CAB-A1',
    'Reclaimed Wood Cabinet', '',
    'Cabinet', 'Revive',
    'Reclaimed Wood, Iron', 'Natural, Distressed',
    'Production', '94036090',
    120, 45, 90, 'cm',
    0, 0,
    10, 250,
    '8901234567890',
    '', '', '', '',
    '',
  ];
  // A second helper row that documents what each column accepts. Operators
  // can delete it after they understand the format.
  const hint = [
    'Required',           'Optional — buyer\'s own SKU',
    'Short description', 'Optional — what the buyer calls it',
    'e.g. Cabinet',     'e.g. Revive',
    'Comma-separated',  'Comma-separated',
    'One of Kind | Production', 'e.g. 94036090',
    'Number',           'Number',           'Number', 'cm | inch',
    'Auto if blank',    'kg',
    'Min 1',            'Number',
    'Optional',
    'Free text',        'Free text',        'Free text', 'Free text',
    'Free text — added as one comment per row',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example, hint]);
  // Per-column widths — longer headings get more room; notes/comments wider.
  const widthFor = (h) => {
    const low = h.toLowerCase();
    if (low.includes('description') || low.includes('comment')) return 36;
    if (low.includes('notes')) return 28;
    if (low.includes('material') || low.includes('finishes')) return 22;
    if (low === 'unit' || low === 'qty' || low === 'cbm') return 8;
    if (low === 'length' || low === 'width' || low === 'height' || low === 'weight (kg)' || low === 'quantity') return 10;
    if (low.includes('price')) return 12;
    if (low.includes('sku') || low.includes('barcode') || low.includes('hsn')) return 18;
    return Math.max(h.length + 2, 14);
  };
  ws['!cols'] = headers.map((h) => ({ wch: widthFor(h) }));
  // Make the example/hint rows visually distinct so users don't ship them
  // as data: hint row hidden behind italic notation only — actual styling
  // requires xlsx-js-style; the plain xlsx writer just keeps the text.
  ws['!rows'] = [{ hpt: 22 }, { hpt: 18 }, { hpt: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Order Items');
  XLSX.writeFile(wb, 'SGH_Order_Import_Template.xlsx');
};

export default function ImportOrderModal({ isOpen, onClose, fileNumber, onCreated }) {
  const [excelFile, setExcelFile] = useState(null);
  const [excelRows, setExcelRows] = useState([]); // parsed rows
  const [photoFiles, setPhotoFiles] = useState([]); // File[]
  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState('');

  const resetState = () => {
    setExcelFile(null);
    setExcelRows([]);
    setPhotoFiles([]);
    setImporting(false);
    setParseError('');
  };

  const handleClose = () => {
    if (importing) return;
    resetState();
    onClose();
  };

  const handleExcelPick = async (file) => {
    if (!file) return;
    setExcelFile(file);
    setParseError('');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!raw.length) {
        setParseError('The Excel sheet contains no rows.');
        setExcelRows([]);
        return;
      }
      const items = raw.map(rowToItem).filter(
        (r) => r.buyerSKU || r.companySKU || r.itemDescription
      );
      if (!items.length) {
        setParseError(
          'No usable rows found. Make sure the sheet has a "Buyer SKU" (or Company SKU) column.'
        );
        setExcelRows([]);
        return;
      }
      setExcelRows(items);
    } catch (err) {
      console.error('Excel parse error', err);
      setParseError(`Could not read the Excel file: ${err.message}`);
      setExcelRows([]);
    }
  };

  // Photo → SKU match table (client-side, used for preview + final wiring).
  // For each row we scan every photo and test exact/variant match against
  // both Buyer SKU and (fallback) Company SKU. A photo is claimed by the
  // first row it matches, so two rows with overlapping SKUs never double-up.
  const photoMatches = useMemo(() => {
    const claimed = new Set();
    return excelRows.map((row) => {
      const skus = [row.buyerSKU, row.companySKU].filter(Boolean);
      // An explicit Image/Photo column value lets a photo match by filename
      // even when it isn't named after the SKU.
      const refBase = row._imageRef ? filenameBase(row._imageRef) : '';
      const matched = photoFiles.filter((f) => {
        if (claimed.has(f)) return false;
        const hit =
          skus.some((s) => photoMatchesSku(f.name, s)) ||
          (refBase && filenameBase(f.name) === refBase);
        if (hit) claimed.add(f);
        return hit;
      });
      return { row, matched };
    });
  }, [excelRows, photoFiles]);

  const unmatchedPhotos = useMemo(() => {
    const usedNames = new Set(
      photoMatches.flatMap((m) => m.matched.map((f) => f.name))
    );
    return photoFiles.filter((f) => !usedNames.has(f.name));
  }, [photoMatches, photoFiles]);

  const totalItems = excelRows.length;
  const matchedItems = photoMatches.filter((m) => m.matched.length > 0).length;

  const handleImport = async () => {
    if (excelRows.length === 0) {
      toast.error('Upload an Excel file with at least one row first.');
      return;
    }

    setImporting(true);
    try {
      // 1. Look up the customer by fileNumber so we can stamp the order.
      const custRes = await customerAPI.getByFileNumber(fileNumber);
      const customer = custRes?.data?.data?.customer;
      if (!customer?._id) {
        throw new Error(`Customer not found for file "${fileNumber}".`);
      }

      // 2. Rename files to "<Buyer SKU><ext>" in memory so when the backend
      //    stores them on disk the filename already reflects the SKU.
      //    (The backend auto-rename helper will further normalize later.)
      const uploadList = [];
      photoMatches.forEach(({ row, matched }, rowIdx) => {
        matched.forEach((f, photoIdx) => {
          const ext = (f.name.match(/\.[^.]+$/) || [''])[0];
          const baseName = row.buyerSKU || row.companySKU || `item-${rowIdx + 1}`;
          const newName = matched.length > 1
            ? `${baseName}_${String(photoIdx + 1).padStart(2, '0')}${ext}`
            : `${baseName}${ext}`;
          uploadList.push({ rowIdx, file: new File([f], newName, { type: f.type }) });
        });
      });

      // 3. Upload all photos in one batch call. The backend returns URLs in
      //    the SAME order we posted them, so we can map them back to rows.
      //    Compress each in the browser first so the network leg is cheap.
      let uploadedUrls = [];
      if (uploadList.length > 0) {
        const compressedList = await Promise.all(
          uploadList.map(async ({ file }) => compressImage(file))
        );
        const fd = new FormData();
        compressedList.forEach((file) => fd.append('images', file));
        const up = await orderAPI.uploadMedia(fd);
        uploadedUrls = up?.data?.data?.urls || [];
        if (uploadedUrls.length !== uploadList.length) {
          console.warn(
            'Upload count mismatch',
            uploadedUrls.length,
            'uploaded vs',
            uploadList.length,
            'queued'
          );
        }
      }

      // 4. Attach uploaded URLs back to their row items.
      const items = excelRows.map((row, idx) => {
        const urls = uploadList
          .map((u, i) => (u.rowIdx === idx ? uploadedUrls[i] : null))
          .filter(Boolean);
        const cbm = row.cbm || calcCBM(row.dimensions);
        // Drop the parse-only helper so it never reaches the API.
        const { _imageRef, ...clean } = row;
        return {
          ...clean,
          cbm,
          totalCBM: cbm * (row.quantity || 1),
          totalPrice: (row.quantity || 0) * (row.unitPrice || 0),
          images: urls,
          primaryImage: urls[0] || '',
          sortOrder: idx,
        };
      });

      // 5. Create the order (Draft — user picks the final order type after
      //    import). orderType must match the Order schema enum:
      //    ['Sample Order', 'Regular Order'].
      const payload = {
        customer: customer._id,
        fileNumber: customer.fileNumber,
        orderType: 'Sample Order',
        orderStatus: 'Draft',
        orderDate: new Date().toISOString().split('T')[0],
        currency: customer.currency || 'USD',
        items,
      };

      const createRes = await orderAPI.create(payload);
      const newOrder = createRes?.data?.data?.order;
      if (!newOrder?._id) throw new Error('Order create returned no ID.');

      toast.success(`Order ${newOrder.orderNumber} created from Excel import!`);
      resetState();
      onClose();
      if (onCreated) onCreated(newOrder);
    } catch (err) {
      // The axios interceptor already toasts the detailed message
      // (extracted from response.data.message / errors[]). We only need to
      // log here for debugging — no extra toast or we'd show two.
      console.error('Import order failed', err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Order from Excel"
      size="lg"
      footer={
        <>
          <button
            onClick={handleClose}
            disabled={importing}
            className="btn-secondary btn"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importing || excelRows.length === 0}
            className="btn-primary btn"
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {importing ? 'Creating order…' : `Create Order${totalItems ? ` (${totalItems})` : ''}`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Template download — compact pill */}
        <div className="flex items-center justify-between bg-brand-50/70 border border-brand-100 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <FileSpreadsheet size={14} className="text-brand-600" />
            <span className="text-gray-600">
              First time? Download the Excel template with the supported columns.
            </span>
          </div>
          <button
            onClick={downloadOrderTemplate}
            className="text-xs font-semibold text-brand-700 hover:text-brand-900 flex items-center gap-1"
          >
            <Download size={12} /> Template
          </button>
        </div>

        {/* File pickers — side-by-side, equal heights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Excel picker */}
          <label
            className={`relative flex flex-col items-center justify-center text-center gap-1.5 px-3 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all min-h-[140px] ${
              excelFile
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-300 hover:border-brand-400 hover:bg-brand-50/40'
            }`}
          >
            <FileSpreadsheet size={26} className="text-brand-600" />
            <p className="text-sm font-semibold text-gray-800 truncate max-w-full px-2">
              {excelFile ? excelFile.name : 'Upload Excel sheet'}
            </p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">
              .xlsx or .xls
            </p>
            {excelFile && (
              <span className="text-[10px] font-bold text-brand-600 bg-white border border-brand-200 px-2 py-0.5 rounded-full">
                {excelRows.length} row{excelRows.length !== 1 ? 's' : ''} parsed
              </span>
            )}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importing}
              onChange={(e) => handleExcelPick(e.target.files?.[0])}
            />
          </label>

          {/* Photos picker */}
          <label
            className={`relative flex flex-col items-center justify-center text-center gap-1.5 px-3 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all min-h-[140px] ${
              photoFiles.length > 0
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-300 hover:border-brand-400 hover:bg-brand-50/40'
            }`}
          >
            <ImageIcon size={26} className="text-brand-600" />
            <p className="text-sm font-semibold text-gray-800">
              {photoFiles.length > 0
                ? `${photoFiles.length} photo${photoFiles.length > 1 ? 's' : ''} selected`
                : 'Upload product photos'}
            </p>
            <p className="text-[10px] text-gray-400">
              Filename = Buyer SKU
            </p>
            {photoFiles.length > 0 && (
              <span className="text-[10px] font-bold text-brand-600 bg-white border border-brand-200 px-2 py-0.5 rounded-full">
                Click to add more
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setPhotoFiles((prev) => [...prev, ...files]);
                e.target.value = '';
              }}
            />
          </label>

          {/* The tile above is the gallery path; on a phone you can also shoot
              the product photos straight into the import. */}
          <PhotoPicker
            className="sm:col-span-2"
            multiple
            disabled={importing}
            icon={ImageIcon}
            label="Choose photos"
            onFiles={(files) => setPhotoFiles((prev) => [...prev, ...Array.from(files)])}
          />
        </div>

        {parseError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>{parseError}</div>
          </div>
        )}

        {/* Preview table */}
        {excelRows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Preview ({totalItems} items · {matchedItems} with photo)
              </h3>
              {photoFiles.length > 0 && (
                <button
                  onClick={() => setPhotoFiles([])}
                  className="text-[11px] text-gray-400 hover:text-red-500"
                  disabled={importing}
                >
                  Clear photos
                </button>
              )}
            </div>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-[10px] uppercase font-semibold text-gray-500 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-center">Media</th>
                      <th className="px-2 py-2 text-left">Company SKU</th>
                      <th className="px-2 py-2 text-left">Buyer SKU</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left">Materials</th>
                      <th className="px-2 py-2 text-left">Finishes</th>
                      <th className="px-2 py-2 text-left">HSN</th>
                      <th className="px-2 py-2 text-left">Size</th>
                      <th className="px-2 py-2 text-right">CBM</th>
                      <th className="px-2 py-2 text-right">Wt (kg)</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Unit&nbsp;Price</th>
                      <th className="px-2 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {photoMatches.map(({ row, matched }, idx) => {
                      const d = row.dimensions;
                      const size =
                        d.length || d.width || d.height
                          ? `${d.length || 0}×${d.width || 0}×${d.height || 0}${d.unit}`
                          : '—';
                      const cbm = row.cbm || calcCBM(d);
                      const lineTotal = (row.quantity || 0) * (row.unitPrice || 0);
                      return (
                        <tr key={idx} className="hover:bg-gray-50/60">
                          <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-center">
                              {matched.length > 0 ? (
                                <div className="relative">
                                  <img
                                    src={URL.createObjectURL(matched[0])}
                                    alt={row.buyerSKU || row.companySKU || ''}
                                    className="w-10 h-10 rounded object-cover border border-gray-200"
                                  />
                                  {matched.length > 1 && (
                                    <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-green-600 text-white rounded-full px-1 min-w-[14px] text-center">
                                      {matched.length}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-[10px]">
                                  —
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2 font-mono font-semibold text-gray-800 whitespace-nowrap">
                            {row.companySKU || '—'}
                          </td>
                          <td className="px-2 py-2 font-mono text-gray-600 whitespace-nowrap">
                            {row.buyerSKU || '—'}
                          </td>
                          <td className="px-2 py-2 text-gray-700 truncate max-w-[180px]">
                            {row.itemDescription || '—'}
                          </td>
                          <td className="px-2 py-2 text-gray-600 truncate max-w-[120px]">
                            {row.materials?.length ? row.materials.join(', ') : '—'}
                          </td>
                          <td className="px-2 py-2 text-gray-600 truncate max-w-[120px]">
                            {row.finishes?.length ? row.finishes.join(', ') : '—'}
                          </td>
                          <td className="px-2 py-2 font-mono text-gray-500 whitespace-nowrap">
                            {row.hsnCode || '—'}
                          </td>
                          <td className="px-2 py-2 text-gray-500 whitespace-nowrap">{size}</td>
                          <td className="px-2 py-2 text-right tabular-nums text-gray-600">
                            {cbm ? Number(cbm).toFixed(3) : '—'}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-gray-600">
                            {row.weight ? Number(row.weight).toFixed(2) : '—'}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{row.quantity}</td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {row.unitPrice ? Number(row.unitPrice).toFixed(2) : '—'}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums font-semibold text-gray-800">
                            {lineTotal ? Number(lineTotal).toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals row — quick sanity check for the operator. */}
                  <tfoot className="bg-gray-50 sticky bottom-0 text-[11px] font-semibold text-gray-700">
                    <tr>
                      <td className="px-2 py-2" colSpan={11}>Totals</td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {excelRows.reduce((s, r) => s + (r.quantity || 0), 0)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-400">—</td>
                      <td className="px-2 py-2 text-right tabular-nums text-gray-900">
                        {excelRows.reduce((s, r) => s + (r.quantity || 0) * (r.unitPrice || 0), 0).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {unmatchedPhotos.length > 0 && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">
                    {unmatchedPhotos.length} photo
                    {unmatchedPhotos.length > 1 ? 's' : ''} could not be matched
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {unmatchedPhotos.slice(0, 8).map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 font-mono text-[10px] bg-white/70 border border-amber-300 px-1.5 py-0.5 rounded"
                      >
                        {f.name}
                        <button
                          onClick={() =>
                            setPhotoFiles((prev) => prev.filter((p) => p !== f))
                          }
                          className="hover:text-red-500"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {unmatchedPhotos.length > 8 && (
                      <span className="text-[10px] font-semibold">
                        +{unmatchedPhotos.length - 8} more
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] opacity-80">
                    Rename them to match a Buyer SKU (e.g.{' '}
                    <span className="font-mono">BUYER-CAB-A1.jpg</span>) and re-upload,
                    or import without them.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
