import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { productSizeLabel } from './dimensions';

// Resolve a stored upload path to a fully qualified URL so fetch() can load it
// while we embed it in the workbook.
const toAbsUrl = (u) => {
  if (!u) return '';
  if (/^(https?:|data:|blob:)/i.test(u)) return u;
  const baseUrl = import.meta.env.VITE_UPLOAD_URL
    ? import.meta.env.VITE_UPLOAD_URL.replace(/\/uploads$/, '')
    : window.location.origin;
  return `${baseUrl}${u.startsWith('/') ? u : `/${u}`}`;
};

// ExcelJS only embeds png / jpeg / gif — probe the blob MIME and map to one.
const fetchImageForExcel = async (url) => {
  try {
    const abs = toAbsUrl(url);
    if (!abs) return null;
    const res = await fetch(abs);
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const mime = (blob.type || '').toLowerCase();
    const extension = mime.includes('png') ? 'png' : mime.includes('gif') ? 'gif' : 'jpeg';
    return { buffer, extension };
  } catch (e) {
    console.warn('Image fetch failed for showroom export', url, e);
    return null;
  }
};

/**
 * Build and download an Excel sheet of the selected showroom products.
 * Columns: Sr. No. | Name | Size | Price | Image | Comments
 *
 * @param {Array} rows  [{ id, product, branch, zone, price, comments }]
 * @param {Function} onProgress  optional (message) => void, for toast updates
 */
export async function exportShowroomSelection(rows, onProgress) {
  if (!rows?.length) return;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SGH Crafts ERP';
  wb.created = new Date();
  const ws = wb.addWorksheet('Showroom Selection', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 4 }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const branches = [...new Set(rows.map((r) => r.branch).filter(Boolean))];
  const zones = [...new Set(rows.map((r) => r.zone).filter(Boolean))];

  // ── Title + meta ──────────────────────────────────────────────────────
  ws.mergeCells(1, 1, 1, 7);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = 'SGH CRAFTS — Showroom Selection';
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFA86820' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, 7);
  const metaCell = ws.getCell(2, 1);
  metaCell.value = [
    branches.length ? `Branch: ${branches.join(', ')}` : '',
    zones.length ? `Zones: ${zones.join(', ')}` : '',
    `Products: ${rows.length}`,
    `Exported: ${new Date().toLocaleDateString('en-IN')}`,
  ].filter(Boolean).join('    ·    ');
  metaCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF6B7280' } };
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 6;

  // ── Header row ────────────────────────────────────────────────────────
  const headers = [
    { label: 'Sr. No.',  width: 8 },
    { label: 'Name',     width: 32 },
    { label: 'Size',     width: 24 },
    { label: 'Qty',      width: 8 },
    { label: 'Price',    width: 16 },
    { label: 'Image',    width: 20 },
    { label: 'Comments', width: 44 },
  ];
  ws.columns = headers.map((h) => ({ width: h.width }));
  headers.forEach((h, i) => {
    const cell = ws.getCell(4, i + 1);
    cell.value = h.label;
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA86820' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FFC4822A' } },
      bottom: { style: 'thin', color: { argb: 'FFC4822A' } },
      left:   { style: 'thin', color: { argb: 'FFC4822A' } },
      right:  { style: 'thin', color: { argb: 'FFC4822A' } },
    };
  });
  ws.getRow(4).height = 22;

  // ── Data rows ─────────────────────────────────────────────────────────
  const altRowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF8F3' } };
  const cellBorder = {
    top:    { style: 'hair', color: { argb: 'FFEAD9C2' } },
    bottom: { style: 'hair', color: { argb: 'FFEAD9C2' } },
    left:   { style: 'hair', color: { argb: 'FFEAD9C2' } },
    right:  { style: 'hair', color: { argb: 'FFEAD9C2' } },
  };
  const photoQueue = [];

  rows.forEach((row, idx) => {
    const r = idx + 5;
    const p = row.product || {};
    const priceNum = row.price === '' || row.price == null ? null : Number(row.price);
    const values = [
      idx + 1,
      p.name || '',
      productSizeLabel(p),
      Math.max(parseInt(row.orderQty, 10) || 1, 1),
      Number.isFinite(priceNum) ? priceNum : '',
      '', // image — embedded below
      row.comments || '',
    ];
    values.forEach((v, i) => {
      const cell = ws.getCell(r, i + 1);
      cell.value = v;
      cell.border = cellBorder;
      cell.alignment = {
        vertical: 'middle',
        horizontal: i === 0 || i === 3 ? 'center' : 'left',
        wrapText: i === 1 || i === 6,
      };
      if (idx % 2 === 1) cell.fill = altRowFill;
    });
    ws.getCell(r, 5).numFmt = '"₹" #,##0.00';
    ws.getCell(r, 5).font = { name: 'Segoe UI', size: 10, bold: true };

    if (p.image) photoQueue.push({ url: p.image, row: r });
    ws.getRow(r).height = 80; // taller row → readable embedded image
  });

  ws.autoFilter = `A4:G${4 + rows.length}`;
  ws.pageSetup.printTitlesRow = '4:4';

  // ── Embed images in the Image column (col F, zero-based index 5) ───────
  if (photoQueue.length) {
    onProgress?.(`Embedding ${photoQueue.length} image${photoQueue.length === 1 ? '' : 's'}…`);
  }
  const fetched = await Promise.all(photoQueue.map((q) => fetchImageForExcel(q.url)));
  photoQueue.forEach((q, i) => {
    const meta = fetched[i];
    if (!meta) return;
    const imageId = wb.addImage({ buffer: meta.buffer, extension: meta.extension });
    ws.addImage(imageId, {
      tl: { col: 5.1, row: q.row - 1 + 0.05 },
      br: { col: 6,   row: q.row },
      editAs: 'oneCell',
    });
  });

  const buf = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Showroom_Selection_${stamp}.xlsx`,
  );
}
