import { useState, useMemo } from 'react';
import {
  FileSpreadsheet, Image as ImageIcon, Download, Upload,
  AlertCircle, CheckCircle, X, Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
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
    'item code', 'item_code', 'itemcode',
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

// Max files per upload request. Must stay at or below the server's
// `uploadImage.array('images', N)` cap in backend/routes/orderRoutes.js —
// exceeding it makes multer reject the whole request.
const UPLOAD_BATCH = 20;

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

// ── Two-row header support ───────────────────────────────────────────────────
// The SGH template groups the three dimension columns under one merged "Size"
// heading, so the real column names for those live on row 2:
//
//   │ Item Code │ Description │   Size (cm)   │ Qty │ Image │ Comment │  ← row 1
//   │           │             │  L  │  W │ H  │     │       │         │  ← row 2
//
// Buyer sheets use a plain single-row header, so we sniff for the L/W/H
// sub-header and only take the two-row path when it is actually there.
const SUBHEADER_TOKENS = new Set([
  'l', 'w', 'h', 'd',
  'length', 'width', 'height', 'depth',
]);

const looksLikeSubHeader = (row = []) =>
  row.filter((c) => SUBHEADER_TOKENS.has(normKey(c))).length >= 2;

// Flatten a two-row header into one name per column: the sub-header wins where
// present, otherwise the group heading, forward-filled across its merge.
const flattenHeader = (top = [], sub = [], width = 0) => {
  const out = [];
  let carry = '';
  for (let c = 0; c < width; c++) {
    const t = String(top[c] ?? '').trim();
    if (t) carry = t;
    const s = String(sub[c] ?? '').trim();
    out.push(s || carry);
  }
  return out;
};

// Parse a worksheet into header-keyed row objects, handling both layouts.
// Also returns the flattened header list and how many rows it occupied — the
// image extractor needs both to turn a drawing's anchor into a data-row index.
const sheetToRows = (sheet) => {
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1, defval: '', blankrows: false,
  });
  if (!aoa.length) return { rows: [], headers: [], headerRows: 0 };
  // Single-row header — unchanged behaviour for buyer-supplied sheets.
  if (!looksLikeSubHeader(aoa[1])) {
    return {
      rows: XLSX.utils.sheet_to_json(sheet, { defval: '' }),
      headers: aoa[0].map((h) => String(h ?? '').trim()),
      headerRows: 1,
    };
  }
  const width = Math.max(aoa[0].length, aoa[1].length);
  const headers = flattenHeader(aoa[0], aoa[1], width);
  const rows = aoa.slice(2).map((r) => {
    const obj = {};
    headers.forEach((h, c) => {
      if (h) obj[h] = r[c] ?? '';
    });
    return obj;
  });
  return { rows, headers, headerRows: 2 };
};

// Find the column index whose header matches one of a field's aliases.
const columnIndexFor = (headers, field) => {
  const aliases = new Set(COLUMN_ALIASES[field]);
  return headers.findIndex((h) => aliases.has(normKey(h)));
};

// ── Embedded photos ──────────────────────────────────────────────────────────
// Buyers and the office both paste pictures straight into the sheet rather than
// sending a separate photo folder, so the Excel file IS the photo source.
// SheetJS cannot see embedded media at all, but ExcelJS exposes floating
// drawings and their anchors — so we do a second, media-only pass over the same
// buffer and map each drawing to a data row by its top-left anchor.
//
// Routing by the column the drawing sits over:
//   • Comment column  → comment photo
//   • anything else   → product photo (the item gallery)
// The fallback is deliberately greedy: sheets float product pictures over a
// dedicated Image column, over the SKU, or loosely across the row, and in every
// one of those cases the picture is the product.
//
// Degrades to "no embedded images" rather than failing when:
//   • the file is a legacy .xls — ExcelJS reads .xlsx only
//   • pictures were inserted with Excel 365's "Place in Cell", which stores
//     them as rich-value cells instead of drawings, invisible to ExcelJS
const extractEmbeddedImages = async (buf, headerRows, cols) => {
  const byRow = new Map();
  const stats = { drawings: 0, item: 0, comment: 0, failed: false };
  const bucketFor = (row) =>
    byRow.get(row) || { item: [], comment: [] };

  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    if (!ws) return { byRow, stats };

    const drawings = ws.getImages() || [];
    stats.drawings = drawings.length;

    for (const drawing of drawings) {
      const tl = drawing?.range?.tl;
      if (!tl) continue;
      // Anchors are 0-based and fractional (the offset within the cell).
      const dataRow = Math.floor(tl.row) - headerRows;
      if (dataRow < 0) continue;

      const media = wb.getImage(drawing.imageId);
      if (!media?.buffer) continue;

      const kind = Math.floor(tl.col) === cols.comment ? 'comment' : 'item';
      const ext = (media.extension || 'png').toLowerCase();
      const bucket = bucketFor(dataRow);
      const seq = bucket[kind].length + 1;
      const file = new File(
        [media.buffer],
        `${kind}-${dataRow + 1}-${String(seq).padStart(2, '0')}.${ext}`,
        { type: `image/${ext === 'jpg' ? 'jpeg' : ext}` }
      );
      bucket[kind].push(file);
      byRow.set(dataRow, bucket);
      stats[kind] += 1;
    }
  } catch (err) {
    // Cell data still imports — only the embedded photos are lost.
    stats.failed = true;
    console.warn('Embedded images could not be read', err);
  }
  return { byRow, stats };
};

// Build the Excel template workbook and trigger a download.
//
// Deliberately minimal — only the six fields the office actually fills in by
// hand. Everything else the item schema supports (materials, HSN, price,
// barcode, factory notes) is still recognised on import via COLUMN_ALIASES
// when a buyer's own sheet carries it; it just isn't asked for here.
export const downloadOrderTemplate = () => {
  // Row 1 groups L / W / H under one merged "Size" heading; row 2 carries the
  // per-axis sub-headers. Every other column is merged vertically across both
  // rows so it reads as a single cell.
  const top = ['Item Code', 'Description', 'Size (cm)', '', '', 'Qty', 'Image', 'Comment'];
  const sub = ['', '', 'L', 'W', 'H', '', '', ''];
  const example = [
    'SGH-CAB-001',
    'Reclaimed Wood Cabinet',
    120, 45, 90,
    10,
    'SGH-CAB-001.jpg',
    'Natural finish, no wax',
  ];

  const ws = XLSX.utils.aoa_to_sheet([top, sub, example]);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Item Code
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Description
    { s: { r: 0, c: 2 }, e: { r: 0, c: 4 } }, // Size — spans L, W, H
    { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } }, // Qty
    { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } }, // Image
    { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } }, // Comment
  ];
  ws['!cols'] = [
    { wch: 18 }, // Item Code
    { wch: 40 }, // Description
    { wch: 8 }, { wch: 8 }, { wch: 8 }, // L / W / H
    { wch: 8 },  // Qty
    { wch: 24 }, // Image
    { wch: 36 }, // Comment
  ];
  ws['!rows'] = [{ hpt: 22 }, { hpt: 18 }];

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
  // How many pictures we pulled out of the workbook — surfaced so the operator
  // can tell "the sheet had none" from "we couldn't read them".
  const [imageStats, setImageStats] = useState(null);
  // Photo uploads go out in batches; surface which batch we're on so a large
  // import doesn't look frozen.
  const [uploadProgress, setUploadProgress] = useState(null);

  const resetState = () => {
    setExcelFile(null);
    setExcelRows([]);
    setPhotoFiles([]);
    setImporting(false);
    setParseError('');
    setImageStats(null);
    setUploadProgress(null);
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
      const { rows: raw, headers, headerRows } = sheetToRows(sheet);
      if (!raw.length) {
        setParseError('The Excel sheet contains no rows.');
        setExcelRows([]);
        return;
      }
      // Pictures pasted into the sheet, keyed by source-row index. Attach
      // BEFORE filtering, since filtering renumbers the rows.
      const { byRow: embedded, stats } = await extractEmbeddedImages(
        buf, headerRows, { comment: columnIndexFor(headers, 'comments') }
      );
      setImageStats(stats);
      const items = raw
        .map((r, i) => ({
          ...rowToItem(r),
          _embeddedImages: embedded.get(i)?.item || [],
          _commentImages: embedded.get(i)?.comment || [],
        }))
        .filter((r) => r.buyerSKU || r.companySKU || r.itemDescription);
      if (!items.length) {
        setParseError(
          'No usable rows found. Make sure the sheet has an "Item Code" (or Buyer SKU) column.'
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
  // A row counts as "has a photo" whether it came from the workbook or a file.
  const matchedItems = photoMatches.filter(
    (m) => m.matched.length > 0 || (m.row._embeddedImages?.length || 0) > 0
  ).length;
  const commentPhotos = excelRows.reduce(
    (s, r) => s + (r._commentImages?.length || 0), 0
  );
  const embeddedPhotos = excelRows.reduce(
    (s, r) => s + (r._embeddedImages?.length || 0), 0
  );

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
      //    Comment photos embedded in the sheet ride along in the same batch,
      //    tagged `kind: 'comment'` so they land on the comment instead of the
      //    item gallery.
      const uploadList = [];
      photoMatches.forEach(({ row, matched }, rowIdx) => {
        const baseName = row.buyerSKU || row.companySKU || `item-${rowIdx + 1}`;
        // Pictures lifted out of the workbook lead the gallery — they came in
        // with the row, so they are the more authoritative product shot.
        (row._embeddedImages || []).forEach((f, i) => {
          const ext = (f.name.match(/\.[^.]+$/) || [''])[0];
          uploadList.push({
            rowIdx,
            kind: 'item',
            file: new File(
              [f],
              `${baseName}_${String(i + 1).padStart(2, '0')}${ext}`,
              { type: f.type }
            ),
          });
        });
        // Loose files continue the numbering so they never collide with the
        // embedded ones above.
        const embeddedCount = (row._embeddedImages || []).length;
        matched.forEach((f, photoIdx) => {
          const ext = (f.name.match(/\.[^.]+$/) || [''])[0];
          const n = embeddedCount + photoIdx + 1;
          const newName = matched.length + embeddedCount > 1
            ? `${baseName}_${String(n).padStart(2, '0')}${ext}`
            : `${baseName}${ext}`;
          uploadList.push({
            rowIdx, kind: 'item', file: new File([f], newName, { type: f.type }),
          });
        });
        (row._commentImages || []).forEach((f, i) => {
          const ext = (f.name.match(/\.[^.]+$/) || [''])[0];
          uploadList.push({
            rowIdx,
            kind: 'comment',
            file: new File(
              [f],
              `${baseName}_comment_${String(i + 1).padStart(2, '0')}${ext}`,
              { type: f.type }
            ),
          });
        });
      });

      // 3. Upload all photos in one batch call. The backend returns URLs in
      //    the SAME order we posted them, so we can map them back to rows.
      //    Compress each in the browser first so the network leg is cheap.
      //    The endpoint accepts at most UPLOAD_BATCH files per request, so we
      //    post in batches and concatenate — an order can easily carry a photo
      //    per row, well past any single-request cap.
      let uploadedUrls = [];
      if (uploadList.length > 0) {
        const compressedList = await Promise.all(
          uploadList.map(async ({ file }) => compressImage(file))
        );
        for (let i = 0; i < compressedList.length; i += UPLOAD_BATCH) {
          const batch = compressedList.slice(i, i + UPLOAD_BATCH);
          setUploadProgress({ done: i, total: compressedList.length });
          const fd = new FormData();
          batch.forEach((file) => fd.append('images', file));
          const up = await orderAPI.uploadMedia(fd);
          uploadedUrls.push(...(up?.data?.data?.urls || []));
        }
        setUploadProgress(null);
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
        const urlsOfKind = (kind) => uploadList
          .map((u, i) => (u.rowIdx === idx && u.kind === kind ? uploadedUrls[i] : null))
          .filter(Boolean);
        const urls = urlsOfKind('item');
        const commentUrls = urlsOfKind('comment');
        const cbm = row.cbm || calcCBM(row.dimensions);
        // Drop the parse-only helpers so they never reach the API.
        const { _imageRef, _commentImages, _embeddedImages, ...clean } = row;
        // A comment can carry text, photos, or both. When the cell had text we
        // hang the photos on that comment; a photo-only cell still produces a
        // comment record (commentSchema.text is optional).
        const comments = commentUrls.length === 0
          ? clean.comments
          : clean.comments.length
            ? clean.comments.map((c, ci) => (ci === 0 ? { ...c, images: commentUrls } : c))
            : [{ text: '', images: commentUrls }];
        return {
          ...clean,
          comments,
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
            {!importing
              ? `Create Order${totalItems ? ` (${totalItems})` : ''}`
              : uploadProgress
                ? `Uploading photos ${uploadProgress.done}/${uploadProgress.total}…`
                : 'Creating order…'}
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

        {/* The sheet parsed but we found no pictures in it. Almost always one
            of two causes, and the operator can fix both — so name them. */}
        {excelRows.length > 0 && imageStats && imageStats.drawings === 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-lg">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">
                No pictures were found inside this Excel file.
              </p>
              {imageStats.failed ? (
                <p>
                  The file could not be opened for images — this happens with the
                  older <span className="font-mono">.xls</span> format. Re-save it
                  as <span className="font-mono">.xlsx</span> from Excel
                  (File → Save As → Excel Workbook) and upload again.
                </p>
              ) : (
                <p>
                  If the sheet does show pictures, they were most likely added
                  with <strong>Place in Cell</strong>. Right-click a picture and
                  choose <strong>Cut</strong>, then paste it back with plain{' '}
                  <span className="font-mono">Ctrl+V</span> so it floats over the
                  cell — that format can be read.
                </p>
              )}
              <p className="mt-1 opacity-80">
                You can still import now and add photos with the picker on the right.
              </p>
            </div>
          </div>
        )}

        {/* Preview table */}
        {excelRows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Preview ({totalItems} items · {matchedItems} with photo
                {embeddedPhotos > 0 && ` · ${embeddedPhotos} from Excel`}
                {commentPhotos > 0 && ` · ${commentPhotos} comment photo${commentPhotos > 1 ? 's' : ''}`})
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
                      <th className="px-2 py-2 text-left">Comment</th>
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
                      // Workbook pictures lead, then any matched loose files.
                      const gallery = [...(row._embeddedImages || []), ...matched];
                      const fromSheet = (row._embeddedImages?.length || 0) > 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50/60">
                          <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-center">
                              {gallery.length > 0 ? (
                                <div className="relative">
                                  <img
                                    src={URL.createObjectURL(gallery[0])}
                                    alt={row.buyerSKU || row.companySKU || ''}
                                    className={`w-10 h-10 rounded object-cover border ${
                                      fromSheet ? 'border-brand-400' : 'border-gray-200'
                                    }`}
                                    title={fromSheet ? 'From the Excel file' : 'From uploaded photos'}
                                  />
                                  {gallery.length > 1 && (
                                    <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-green-600 text-white rounded-full px-1 min-w-[14px] text-center">
                                      {gallery.length}
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
                          {/* Text and any photo pasted into the same cell. */}
                          <td className="px-2 py-2 text-gray-600 max-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              {row._commentImages?.map((f, i) => (
                                <img
                                  key={i}
                                  src={URL.createObjectURL(f)}
                                  alt=""
                                  className="w-8 h-8 rounded object-cover border border-brand-200 flex-shrink-0"
                                />
                              ))}
                              <span className="truncate">
                                {row.comments?.[0]?.text ||
                                  (row._commentImages?.length ? '' : '—')}
                              </span>
                            </div>
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
                      <td className="px-2 py-2" colSpan={12}>Totals</td>
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
