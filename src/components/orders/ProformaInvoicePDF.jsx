import { useRef } from 'react';
import { formatDate, formatCBM, getCurrencySymbol } from '../../utils/formatters';
import { Printer } from 'lucide-react';

/**
 * ProformaInvoicePDF — print-quality Proforma Invoice with dynamic columns.
 * Renders A4 portrait by default, switches to landscape when many columns are
 * selected so wide sheets don't overflow the page.
 */

// Map column key → { header, align, mono, wide, isPhoto, numeric, weight }
// `weight` is a layout-priority signal used to estimate page fit (higher = wider).
const COLUMN_RENDERERS = {
  srNo:            { header: '#',               align: 'center', weight: 1 },
  skuNo:           { header: 'SKU',             align: 'left',   mono: true,  weight: 2 },
  buyerSKU:        { header: 'Buyer SKU',       align: 'left',   mono: true,  weight: 2 },
  buyerName:       { header: 'Buyer',           align: 'left',   weight: 3 },
  photo:           { header: 'Image',           align: 'center', isPhoto: true, weight: 6 },
  itemName:        { header: 'Description',     align: 'left',   wide: true,  weight: 4 },
  buyerDescription:{ header: 'Buyer Desc.',     align: 'left',   wide: true,  weight: 4 },
  category:        { header: 'Category',        align: 'left',   weight: 2 },
  collection:      { header: 'Collection',      align: 'left',   weight: 2 },
  materials:       { header: 'Materials',       align: 'left',   wide: true,  weight: 3 },
  finishes:        { header: 'Finishes',        align: 'left',   wide: true,  weight: 3 },
  condition:       { header: 'Condition',       align: 'center', weight: 2 },
  hsnCode:         { header: 'HSN Code',        align: 'left',   mono: true,  weight: 2 },
  size:            { header: 'Dimensions',      align: 'left',   weight: 2 },
  unit:            { header: 'Unit',            align: 'center', weight: 1 },
  cbm:             { header: 'CBM',             align: 'center', numeric: true, weight: 1 },
  cbmTotal:        { header: 'Total CBM',       align: 'center', numeric: true, weight: 2 },
  weight:          { header: 'Weight',          align: 'center', numeric: true, weight: 1 },
  qty:             { header: 'Qty',             align: 'center', numeric: true, weight: 1 },
  price:           { header: 'Unit Price',      align: 'right',  numeric: true, weight: 2 },
  total:           { header: 'Total',           align: 'right',  numeric: true, weight: 2 },
  barcode:         { header: 'Barcode',         align: 'left',   mono: true,  weight: 2 },
  productionNotes: { header: 'Production',      align: 'left',   wide: true,  weight: 3 },
  qcNotes:         { header: 'QC Notes',        align: 'left',   wide: true,  weight: 3 },
  polishNotes:     { header: 'Polish',          align: 'left',   wide: true,  weight: 3 },
  packagingNotes:  { header: 'Packaging',       align: 'left',   wide: true,  weight: 3 },
  comments:        { header: 'Comments',        align: 'left',   wide: true,  weight: 4 },
};

// Resolve relative `/uploads/...` URLs to absolute so a popup window can load them.
// Normalises backslashes (Windows-style paths from the backend) and leading-slash
// so the result is always a valid http(s) URL the popup can fetch.
const absUrl = (u) => {
  if (!u || typeof u !== 'string') return '';
  const forward = u.replace(/\\/g, '/').trim();
  if (!forward) return '';
  if (/^(https?:|data:|blob:)/i.test(forward)) return forward;
  const baseUrl = import.meta.env.VITE_UPLOAD_URL
    ? import.meta.env.VITE_UPLOAD_URL.replace(/\/uploads$/, '')
    : window.location.origin;
  return `${baseUrl}${forward.startsWith('/') ? forward : `/${forward}`}`;
};

function getCellValue(key, item, idx) {
  switch (key) {
    case 'srNo':            return idx + 1;
    case 'skuNo':           return item.companySKU || item.skuNumber || '';
    case 'buyerSKU':        return item.buyerSKU || '';
    case 'photo':           return absUrl(item.primaryImage || (item.images?.length > 0 ? item.images[0] : null));
    case 'itemName':        return item.itemDescription || '';
    case 'buyerDescription':return item.buyerDescription || '';
    case 'category':        return item.itemCategory || '';
    case 'collection':      return item.collectionName || '';
    case 'materials':       return (item.materials?.length > 0 ? item.materials : (item.material ? [item.material] : [])).join(', ');
    case 'finishes':        return (item.finishes?.length > 0 ? item.finishes : (item.finish ? [item.finish] : [])).join(', ');
    case 'condition':       return item.itemCondition || '';
    case 'hsnCode':         return item.hsnCode || '';
    case 'size':
      return item.dimensions?.length
        ? `${item.dimensions.length}×${item.dimensions.width}×${item.dimensions.height}`
        : '';
    case 'unit':            return item.dimensions?.unit || 'cm';
    case 'cbm':             return item.cbm ? Number(item.cbm).toFixed(3) : '';
    case 'cbmTotal': {
      const t = item.totalCBM || (item.cbm && item.quantity ? item.cbm * item.quantity : 0);
      return t ? Number(t).toFixed(3) : '';
    }
    case 'weight':          return item.weight ? Number(item.weight).toFixed(2) : '';
    case 'qty':             return item.quantity || 0;
    case 'price':           return Number(item.unitPrice || 0).toFixed(2);
    case 'total':           return Number(item.totalPrice || (item.quantity || 0) * (item.unitPrice || 0)).toFixed(2);
    case 'barcode':         return item.barcode?.text || '';
    case 'productionNotes': return item.productionNotes || '';
    case 'qcNotes':         return item.qcNotes || '';
    case 'polishNotes':     return item.polishNotes || '';
    case 'packagingNotes':  return item.packagingNotes || '';
    case 'comments':        return item.comments?.map((c) => c.text).filter(Boolean).join(' | ') || '';
    default:                return '';
  }
}

export default function ProformaInvoicePDF({ order, selectedColumns }) {
  const printRef = useRef(null);

  // Default column set if the caller didn't pick one.
  const cols = selectedColumns && selectedColumns.length > 0
    ? selectedColumns
    : [
        { key: 'srNo' }, { key: 'photo' }, { key: 'skuNo' }, { key: 'itemName' },
        { key: 'finishes' }, { key: 'size' }, { key: 'cbm' },
        { key: 'qty' }, { key: 'price' }, { key: 'total' },
      ];

  // PI is always rendered on A4 landscape — designed to fit a wide column set
  // within ~283 mm of usable width after margins.
  const pageOrientation = 'landscape';

  // Cached customer-derived display fields (Customer model uses `emails[]`,
  // `phones[]`, and `shippingAddresses[]`, not flat email/phone/city).
  const customer = order.customer || {};
  const firstAddr = customer.shippingAddresses?.[0] || customer.billingAddresses?.[0] || {};
  const addrLine1 = firstAddr.line1 || customer.address || '';
  const addrLine2 = firstAddr.line2 || '';
  const cityLine = [firstAddr.city, firstAddr.state, firstAddr.pincode].filter(Boolean).join(', ');
  const country  = firstAddr.country || customer.country || '';
  const firstEmail = customer.emails?.[0]?.email || customer.email || '';
  const firstPhone = customer.phones?.[0]?.number || customer.phone || '';

  const symbol = getCurrencySymbol(order.currency || 'USD');
  const totalQty = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
  const totalAmount = order.totalAmount || order.items?.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0) || 0;
  const fmtMoney = (n) =>
    Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Wait for every <img> in the popup window to either load or error out, then
  // call print. Without this, popups frequently print before images render.
  const waitForImagesThenPrint = (win) => {
    const imgs = Array.from(win.document.images || []);
    if (imgs.length === 0) {
      win.focus();
      win.print();
      return;
    }
    let remaining = imgs.length;
    const done = () => {
      remaining -= 1;
      if (remaining <= 0) {
        // Give the browser one paint frame so it composes the loaded images.
        setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 100);
      }
    };
    imgs.forEach((img) => {
      if (img.complete) { done(); return; }
      img.addEventListener('load',  done, { once: true });
      img.addEventListener('error', done, { once: true });
    });
    // Hard safety net — print even if a slow image never resolves.
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 5000);
  };

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PI — ${order.orderNumber || ''} — ${customer.companyName || ''}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important; }
            html, body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                         font-size: 8pt; color: #1a1a1a; background: #ffffff; }
            .pi-container { width: 100%; padding: 0; }
            .pi-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
            .logo-block { flex: 1; min-width: 0; }
            .logo-block h1 { font-size: 16pt; font-weight: 800; color: #a86820; letter-spacing: -0.4px; line-height: 1; }
            .logo-block .tag { font-size: 6.5pt; color: #8b6f4e; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
            .logo-block .addr { font-size: 7.25pt; color: #555; margin-top: 4px; line-height: 1.35; }
            .doc-title { text-align: right; flex-shrink: 0; }
            .doc-title .label { display: inline-block; background: #a86820; color: #fff; font-size: 9pt; font-weight: 700; letter-spacing: 1.2px; padding: 3px 10px; border-radius: 2px; }
            .doc-title .meta { font-size: 7.5pt; color: #4b5563; margin-top: 4px; line-height: 1.35; }
            .doc-title .meta strong { color: #1f2937; }
            hr.bar { border: none; border-top: 1.5px solid #c4822a; margin: 5px 0 6px; }
            .info-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; margin-bottom: 6px; }
            .info-block h3 { font-size: 6.75pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #a86820; margin-bottom: 2px; }
            .info-block .name { font-size: 9pt; font-weight: 700; color: #1a1a1a; }
            .info-block p { font-size: 7.5pt; color: #333; margin-top: 1px; line-height: 1.3; }
            .info-block .kv { display: flex; gap: 6px; font-size: 7.5pt; line-height: 1.35; }
            .info-block .kv .k { color: #8b6f4e; min-width: 78px; font-weight: 600; }
            .info-block .kv .v { color: #1a1a1a; font-weight: 600; }
            table.items { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 7.5pt; table-layout: auto; text-align: center; border: 1.25px solid #a86820; }
            table.items thead th { background: #a86820; color: #ffffff; padding: 4px 4px; text-align: center; font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #c4822a; vertical-align: middle; }
            table.items tbody td { padding: 3px 4px; border: 1px solid #d9c2a3; vertical-align: middle; text-align: center; color: #1a1a1a; line-height: 1.3; }
            table.items tbody tr:nth-child(even) td { background: #fdf8f3; }
            table.items tfoot td { border: 1px solid #c4822a; }
            table.items td.num { text-align: center; font-variant-numeric: tabular-nums; white-space: nowrap; }
            table.items td.center { text-align: center; }
            table.items td.mono { font-family: 'Consolas', 'Courier New', monospace; font-size: 7pt; font-weight: 700; color: #a86820; white-space: nowrap; text-align: center; }
            table.items td.wide { max-width: 180px; white-space: normal; line-height: 1.3; text-align: center; }
            table.items td.photo { text-align: center; padding: 6px 8px; background: #fdfaf5; width: 136px; vertical-align: middle; }
            table.items td.photo img { width: 120px; height: 120px; object-fit: cover; border: 1px solid #ead9c2; border-radius: 4px; display: block; margin: 0 auto; padding: 2px; background: #ffffff; }
            table.items td.photo .ph { display: inline-block; width: 120px; height: 120px; background: #f4eadc; border: 1px dashed #ead9c2; border-radius: 4px; }
            table.items tfoot td { padding: 3px 4px; background: #fdf5e8; font-size: 7.75pt; font-weight: 700; color: #5b3a14; border-top: 1.5px solid #a86820; }
            table.items tfoot td.grand { background: #a86820; color: #ffffff; font-size: 9pt; }
            .terms-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 4px 12px; margin-top: 5px; font-size: 7.5pt; line-height: 1.35; }
            .terms-grid .k { font-size: 6.75pt; font-weight: 700; color: #a86820; text-transform: uppercase; letter-spacing: 0.4px; margin-right: 3px; }
            .special-box { margin-top: 5px; padding: 5px 8px; background: #fdf8f3; border-left: 2.5px solid #c4822a; border-radius: 2px; }
            .special-box h4 { font-size: 6.75pt; font-weight: 700; color: #a86820; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 2px; }
            .special-box p { font-size: 7.5pt; color: #333; line-height: 1.3; white-space: pre-wrap; }
            .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 10px; }
            .sign-grid .sig { border-top: 1px solid #999; padding-top: 3px; font-size: 7pt; color: #666; text-align: center; }
            .pi-footer { margin-top: 6px; padding-top: 4px; border-top: 1px solid #e5d8c8; text-align: center; }
            .pi-footer p { font-size: 7pt; color: #888; }
            .pi-footer p.legal { font-size: 6.5pt; color: #aaa; margin-top: 1px; }
            @page { size: A4 ${pageOrientation}; margin: 5mm 5mm 4mm 5mm; }
            @media print {
              html, body { background: #ffffff; }
              tr, td, th { page-break-inside: avoid; }
              thead { display: table-header-group; }
              tfoot { display: table-footer-group; }
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    waitForImagesThenPrint(printWindow);
  };

  // Pre-compute the cell renderer for each selected col so we can render them
  // identically in every row.
  const allColDefs = cols.map((col) => {
    const r = COLUMN_RENDERERS[col.key] || {};
    return { ...col, ...r };
  });

  // Factory notes + barcode are too wide to live inside the items table on
  // landscape A4 — they get pulled out and rendered in a stacked block under
  // the table instead. The items table only renders the "main" columns.
  const BOTTOM_KEYS = ['barcode', 'productionNotes', 'qcNotes', 'polishNotes', 'packagingNotes'];
  const colDefs = allColDefs.filter((c) => !BOTTOM_KEYS.includes(c.key));
  const bottomColDefs = allColDefs.filter((c) => BOTTOM_KEYS.includes(c.key));
  const colCount = colDefs.length;

  // Narrow / shrink-to-fit columns. Setting `width: 1%` + `whiteSpace: nowrap`
  // tells the auto table layout to give these cells their minimum content
  // width only, letting wide text cols (description, comments) absorb the
  // remaining horizontal space instead of getting padded by short numerics.
  const NARROW_KEYS = new Set(['srNo', 'qty', 'unit', 'cbm', 'cbmTotal', 'weight', 'price', 'total', 'condition', 'hsnCode']);
  const isNarrow = (key) => NARROW_KEYS.has(key);

  // The Dimensions ("size") column is rendered as a merged parent header with
  // three sub-columns (L · W · H) underneath. These derived counts/indices let
  // the tfoot rows compute correct colSpans regardless of where `size` sits.
  const hasSizeCol = colDefs.some((c) => c.key === 'size');
  const renderedColCount = colDefs.reduce((n, c) => n + (c.key === 'size' ? 3 : 1), 0);
  const renderedIndexOf = (key) => {
    let r = 0;
    for (const c of colDefs) {
      if (c.key === key) return r;
      r += c.key === 'size' ? 3 : 1;
    }
    return -1;
  };
  const renderedTotalIdx = renderedIndexOf('total');

  // Index of the column we want the grand-total displayed under.
  const totalColIdx = colDefs.findIndex((c) => c.key === 'total');
  const qtyColIdx   = colDefs.findIndex((c) => c.key === 'qty');

  const renderCell = (col, item, idx) => {
    const value = col.key === 'buyerName' ? (customer.companyName || '') : getCellValue(col.key, item, idx);
    const cls = [
      col.numeric ? 'num' : '',
      col.align === 'center' && !col.numeric ? 'center' : '',
      col.mono ? 'mono' : '',
      col.wide ? 'wide' : '',
      col.isPhoto ? 'photo' : '',
    ].filter(Boolean).join(' ');

    if (col.isPhoto) {
      // Inline width/height — the popup window's CSS doesn't apply to the
      // on-screen preview that lives inside the modal.
      const imgStyle = {
        width: 120,
        height: 120,
        objectFit: 'cover',
        border: '1px solid #ead9c2',
        borderRadius: 4,
        display: 'block',
        margin: '0 auto',
        padding: 2,
        background: '#ffffff',
      };
      const phStyle = {
        display: 'inline-block',
        width: 120,
        height: 120,
        background: '#f4eadc',
        border: '1px dashed #ead9c2',
        borderRadius: 4,
      };
      return (
        <td
          key={col.key}
          className={cls}
          style={{
            textAlign: 'center',
            padding: '6px 8px',
            background: '#fdfaf5',
            width: 136,
            verticalAlign: 'middle',
            border: '1px solid #d9c2a3',
          }}
        >
          {value
            ? <img src={value} alt="" style={imgStyle} />
            : <span className="ph" style={phStyle} />}
        </td>
      );
    }

    // Barcode column — render the text *and* the barcode image so the printed
    // PI matches the on-screen order detail (where both are visible side-by-side).
    // Drop the `mono` class on the td since we apply monospace inline only on the
    // text span — letting it inherit would force `white-space: nowrap` on the image row too.
    if (col.key === 'barcode') {
      const text = item.barcode?.text || '';
      const image = absUrl(item.barcode?.image);
      const hasContent = text || image;
      return (
        <td key={col.key} style={{ padding: 3, verticalAlign: 'middle', textAlign: 'center', border: '1px solid #d9c2a3' }}>
          {hasContent ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              {text && (
                <span style={{ fontFamily: "'Consolas', 'Courier New', monospace", fontSize: '7pt', fontWeight: 700, color: '#a86820', whiteSpace: 'nowrap' }}>
                  {text}
                </span>
              )}
              {image && (
                <img
                  src={image}
                  alt="Barcode"
                  style={{ width: 120, height: 60, objectFit: 'contain', border: '1px solid #ead9c2', borderRadius: 3, background: '#fff', padding: 2 }}
                />
              )}
            </div>
          ) : '—'}
        </td>
      );
    }

    // Comments column — show the joined text plus any comment images as a
    // small thumbnail strip. Cap the strip at 4 images with a "+N" hint to
    // keep the row height predictable.
    if (col.key === 'comments') {
      const comments = Array.isArray(item.comments) ? item.comments : [];
      const text = comments.map((c) => c?.text).filter(Boolean).join(' | ');
      // Collect any images attached to comments — capped at 4 in the cell,
      // overflow surfaced as a "+N" badge so row height stays predictable.
      const allImages = comments
        .flatMap((c) => (Array.isArray(c?.images) ? c.images : []))
        .map((u) => absUrl(u))
        .filter(Boolean);
      const shown = allImages.slice(0, 4);
      const extra = Math.max(0, allImages.length - shown.length);
      const hasContent = text || shown.length > 0;
      return (
        <td key={col.key} style={{ padding: 3, verticalAlign: 'middle', textAlign: 'center', maxWidth: 180, border: '1px solid #d9c2a3' }}>
          {hasContent ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              {text && (
                <span style={{ fontSize: '7.25pt', lineHeight: 1.3, whiteSpace: 'normal', color: '#1a1a1a' }}>{text}</span>
              )}
              {shown.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
                  {shown.map((u, i) => (
                    <img
                      key={i}
                      src={u}
                      alt=""
                      style={{ width: 120, height: 120, objectFit: 'cover', border: '1px solid #ead9c2', borderRadius: 4, background: '#fff', padding: 2, display: 'block' }}
                    />
                  ))}
                  {extra > 0 && (
                    <span style={{ fontSize: '6.5pt', fontWeight: 700, color: '#8b6f4e', alignSelf: 'center' }}>
                      +{extra}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : '—'}
        </td>
      );
    }

    const display = col.key === 'price' || col.key === 'total' ? `${symbol}${value}` : value;
    const narrow = isNarrow(col.key);
    const tdStyle = {
      padding: '3px 6px',
      border: '1px solid #d9c2a3',
      verticalAlign: 'middle',
      lineHeight: 1.3,
      textAlign: 'center',
      whiteSpace: narrow || col.numeric ? 'nowrap' : 'normal',
      fontFamily: col.mono ? "'Consolas', 'Courier New', monospace" : undefined,
      fontWeight: col.mono ? 700 : undefined,
      color: col.mono ? '#a86820' : '#1a1a1a',
      fontSize: col.mono ? '7pt' : undefined,
      maxWidth: col.wide ? 180 : undefined,
      fontVariantNumeric: col.numeric ? 'tabular-nums' : undefined,
      width: narrow ? '1%' : undefined,
    };
    return <td key={col.key} className={cls} style={tdStyle}>{display === 0 ? '0' : (display || '—')}</td>;
  };

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <button onClick={handlePrint} className="btn-primary btn">
          <Printer size={15} />
          Print / Save as PDF
        </button>
      </div>

      <div ref={printRef} style={{ background: '#ffffff' }}>
        <div className="pi-container" style={{ padding: '8px 10px', maxWidth: '297mm', margin: '0 auto', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", fontSize: '8pt', color: '#1a1a1a' }}>
          {/* Header */}
          <div className="pi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div className="logo-block" style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: '16pt', fontWeight: 800, color: '#a86820', letterSpacing: '-0.4px', lineHeight: 1, margin: 0 }}>
                SGH CRAFTS
              </h1>
              <div className="tag" style={{ fontSize: '6.5pt', color: '#8b6f4e', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' }}>
                Handcrafted Furniture &amp; Décor
              </div>
              <div className="addr" style={{ fontSize: '7.25pt', color: '#555', marginTop: '4px', lineHeight: 1.35 }}>
                Khasra no.723, Luni Shikarpura Road, Village Kakani, Jodhpur — 342001, India<br />
                Email: Info@sghcrafts.com &nbsp;·&nbsp; Tel: +91 9829024475 &nbsp;·&nbsp; Web: www.sghcrafts.com
              </div>
            </div>
            <div className="doc-title" style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="label" style={{ display: 'inline-block', background: '#a86820', color: '#fff', fontSize: '9pt', fontWeight: 700, letterSpacing: '1.2px', padding: '3px 10px', borderRadius: '2px' }}>
                PROFORMA INVOICE
              </div>
              <div className="meta" style={{ fontSize: '7.5pt', color: '#4b5563', marginTop: '4px', lineHeight: 1.35 }}>
                <div>PI #: <strong style={{ color: '#1f2937' }}>{order.proformaInvoiceNumber || order.orderNumber}</strong></div>
                <div>Date: <strong style={{ color: '#1f2937' }}>{formatDate(order.orderDate || new Date())}</strong></div>
                {order.expectedDeliveryDate && (
                  <div>Expected: <strong style={{ color: '#1f2937' }}>{formatDate(order.expectedDeliveryDate)}</strong></div>
                )}
              </div>
            </div>
          </div>

          <hr className="bar" style={{ border: 'none', borderTop: '1.5px solid #c4822a', margin: '5px 0 6px' }} />

          {/* Buyer + Order Info */}
          <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '6px' }}>
            <div className="info-block">
              <h3 style={{ fontSize: '6.75pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#a86820', marginBottom: '2px' }}>
                Bill To / Ship To
              </h3>
              <div className="name" style={{ fontSize: '9pt', fontWeight: 700, color: '#1a1a1a' }}>
                {customer.companyName || '—'}
              </div>
              {customer.contactPersonName && (
                <p style={{ fontSize: '7.5pt', color: '#333', marginTop: '1px', lineHeight: 1.3 }}>
                  {customer.contactPersonName}{customer.designation ? ` · ${customer.designation}` : ''}
                </p>
              )}
              {(addrLine1 || addrLine2) && (
                <p style={{ fontSize: '7.5pt', color: '#444', marginTop: '1px', lineHeight: 1.3 }}>
                  {[addrLine1, addrLine2].filter(Boolean).join(', ')}
                </p>
              )}
              {(cityLine || country) && (
                <p style={{ fontSize: '7.5pt', color: '#444', lineHeight: 1.3 }}>
                  {cityLine}{cityLine && country ? ', ' : ''}{country}
                </p>
              )}
              {(firstEmail || firstPhone) && (
                <p style={{ fontSize: '7.5pt', color: '#444', marginTop: '1px', lineHeight: 1.3 }}>
                  {firstEmail && <>Email: {firstEmail}</>}
                  {firstEmail && firstPhone ? ' · ' : ''}
                  {firstPhone && <>Tel: {firstPhone}</>}
                </p>
              )}
            </div>

            <div className="info-block">
              <h3 style={{ fontSize: '6.75pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#a86820', marginBottom: '2px' }}>
                Order Reference
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
              {[
                ['SGH Order #', order.orderNumber],
                ['File Number', order.fileNumber],
                ['Buyer PO #', order.buyerPONumber],
                ['Order Type', order.orderType],
                ['Currency', order.currency],
                ['Container', order.containerSize],
              ].map(([label, value]) => value ? (
                <div key={label} className="kv" style={{ display: 'flex', gap: '6px', fontSize: '7.5pt', lineHeight: 1.35 }}>
                  <span className="k" style={{ color: '#8b6f4e', minWidth: '78px', fontWeight: 600 }}>{label}:</span>
                  <span className="v" style={{ color: '#1a1a1a', fontWeight: 600 }}>{value}</span>
                </div>
              ) : null)}
              </div>
            </div>
          </div>

          {/* Items table */}
          <table className="items" style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0', fontSize: '7.5pt', border: '1.25px solid #a86820' }}>
            <thead>
              <tr style={{ background: '#a86820', color: 'white' }}>
                {colDefs.map((col) => {
                  const headerLabel =
                    col.key === 'price' ? `Unit (${order.currency || 'USD'})` :
                    col.key === 'total' ? `Total (${order.currency || 'USD'})` :
                    col.header || col.label || col.key;
                  if (col.key === 'size') {
                    return (
                      <th
                        key="size"
                        colSpan={3}
                        style={{
                          padding: '4px 6px',
                          textAlign: 'center',
                          fontWeight: 700,
                          fontSize: '6.5pt',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          color: '#fff',
                          border: '1px solid #c4822a',
                        }}
                      >
                        Dimensions
                      </th>
                    );
                  }
                  return (
                    <th
                      key={col.key}
                      rowSpan={hasSizeCol ? 2 : 1}
                      style={{
                        padding: '4px 6px',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: '6.5pt',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        color: '#fff',
                        border: '1px solid #c4822a',
                        verticalAlign: 'middle',
                        width: isNarrow(col.key) ? '1%' : undefined,
                        whiteSpace: isNarrow(col.key) ? 'nowrap' : undefined,
                      }}
                    >
                      {headerLabel}
                    </th>
                  );
                })}
              </tr>
              {hasSizeCol && (
                <tr style={{ background: '#a86820', color: 'white' }}>
                  {['L', 'W', 'H'].map((s) => (
                    <th
                      key={`sz-${s}`}
                      style={{
                        padding: '3px 4px',
                        textAlign: 'center',
                        fontWeight: 700,
                        fontSize: '6.25pt',
                        letterSpacing: '0.4px',
                        color: '#fff',
                        border: '1px solid #c4822a',
                        width: '1%',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fdf8f3' }}>
                  {colDefs.flatMap((col) => {
                    if (col.key === 'size') {
                      const d = item.dimensions || {};
                      const unit = d.unit || 'cm';
                      const fmtDim = (v) => {
                        const n = typeof v === 'number' ? v : parseFloat(v);
                        return Number.isFinite(n) && n > 0 ? `${n}${unit === 'inch' ? '"' : ''}` : '—';
                      };
                      const dimCell = {
                        padding: '3px 6px',
                        border: '1px solid #d9c2a3',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                        width: '1%',
                        lineHeight: 1.3,
                      };
                      return [
                        <td key="size_l" style={dimCell}>{fmtDim(d.length)}</td>,
                        <td key="size_w" style={dimCell}>{fmtDim(d.width)}</td>,
                        <td key="size_h" style={dimCell}>{fmtDim(d.height)}</td>,
                      ];
                    }
                    return [renderCell(col, item, idx)];
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* Subtotal row: shows sums under their own columns; rest empty. */}
              <tr style={{ background: '#fdf5e8' }}>
                {colDefs.flatMap((col, i) => {
                  if (col.key === 'size') {
                    const blank = { padding: '4px', width: '1%', border: '1px solid #c4822a' };
                    return [
                      <td key="st_l" style={blank} />,
                      <td key="st_w" style={blank} />,
                      <td key="st_h" style={blank} />,
                    ];
                  }
                  const ftBase = { padding: '4px', border: '1px solid #c4822a', color: '#5b3a14', fontWeight: 700 };
                  if (i === 0) {
                    return [
                      <td key={col.key} style={{ ...ftBase, textAlign: 'center', fontSize: '7.75pt' }}>
                        Subtotal ({totalQty} units)
                      </td>,
                    ];
                  }
                  if (col.key === 'qty')      return [<td key={col.key} style={{ ...ftBase, textAlign: 'center' }}>{totalQty}</td>];
                  if (col.key === 'total')    return [<td key={col.key} style={{ ...ftBase, textAlign: 'center', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{symbol}{fmtMoney(totalAmount)}</td>];
                  if (col.key === 'cbmTotal') return [<td key={col.key} style={{ ...ftBase, textAlign: 'center' }}>{formatCBM(order.totalCBM)}</td>];
                  if (col.key === 'weight')   return [<td key={col.key} style={{ ...ftBase, textAlign: 'center' }}>{order.totalWeight ? `${order.totalWeight} kg` : ''}</td>];
                  return [<td key={col.key} style={{ padding: '4px', border: '1px solid #c4822a' }} />];
                })}
              </tr>

              {/* Discount line — only if positive and we have a `total` column. */}
              {order.discount > 0 && totalColIdx >= 0 && (
                <tr style={{ background: '#fdf5e8' }}>
                  {colDefs.flatMap((col, i) => {
                    if (col.key === 'size') {
                      const blank = { padding: '3px 4px', width: '1%', border: '1px solid #c4822a' };
                      return [
                        <td key="ds_l" style={blank} />,
                        <td key="ds_w" style={blank} />,
                        <td key="ds_h" style={blank} />,
                      ];
                    }
                    const dsBase = { padding: '3px 4px', border: '1px solid #c4822a' };
                    if (i === totalColIdx - 1 || (totalColIdx === 0 && i === 0)) {
                      return [<td key={col.key} style={{ ...dsBase, textAlign: 'center', fontSize: '7.75pt' }}>Discount</td>];
                    }
                    if (col.key === 'total') {
                      return [<td key={col.key} style={{ ...dsBase, textAlign: 'center', color: '#c00', fontWeight: 700, whiteSpace: 'nowrap' }}>-{symbol}{fmtMoney(order.discount)}</td>];
                    }
                    return [<td key={col.key} style={dsBase} />];
                  })}
                </tr>
              )}

              {/* Grand total — full bar across the table. */}
              <tr style={{ background: '#a86820' }}>
                <td
                  colSpan={renderedTotalIdx >= 0 ? Math.max(renderedTotalIdx, 1) : Math.max(renderedColCount - 1, 1)}
                  style={{ padding: '5px 6px', textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: '9pt', letterSpacing: '0.4px', border: '1px solid #c4822a' }}
                >
                  TOTAL {order.currency || 'USD'}
                </td>
                {renderedTotalIdx >= 0 ? (
                  <>
                    <td colSpan={1} style={{ padding: '5px 6px', textAlign: 'center', color: '#fff', fontWeight: 800, fontSize: '10pt', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', border: '1px solid #c4822a' }}>
                      {symbol}{fmtMoney(order.finalAmount || totalAmount)}
                    </td>
                    {/* Fill remaining rendered cells after `total` so the bar spans the row. */}
                    {Array.from({ length: renderedColCount - renderedTotalIdx - 1 }).map((_, i) => (
                      <td key={`gt-fill-${i}`} style={{ background: '#a86820', border: '1px solid #c4822a' }} />
                    ))}
                  </>
                ) : (
                  <td style={{ padding: '5px 6px', textAlign: 'center', color: '#fff', fontWeight: 800, fontSize: '10pt', whiteSpace: 'nowrap', border: '1px solid #c4822a' }}>
                    {symbol}{fmtMoney(order.finalAmount || totalAmount)}
                  </td>
                )}
              </tr>

              {order.totalCBM > 0 && (
                <tr style={{ background: '#fdf5e8' }}>
                  <td colSpan={renderedColCount} style={{ padding: '3px 4px', textAlign: 'center', fontSize: '7.25pt', color: '#5b3a14', border: '1px solid #c4822a' }}>
                    Total CBM: <strong>{order.totalCBM} m³</strong>
                    {order.totalWeight ? <> &nbsp;·&nbsp; Total Weight: <strong>{order.totalWeight} kg</strong></> : null}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>

          {/* Factory Notes & Barcode — bordered table. Sr.no + Company SKU
              stay one cell per item. Production Notes & QC Notes sit at the
              top of their columns; Polish Notes & Packaging Notes are stacked
              underneath them in the same cell, separated by a thin divider.
              Barcode keeps its own column. */}
          {bottomColDefs.length > 0 && (() => {
            const itemHas = (item, key) => {
              if (key === 'barcode') return !!(item.barcode?.text || item.barcode?.image);
              return !!(item[key] && String(item[key]).trim() !== '');
            };

            const hasKey = (key) => bottomColDefs.some((c) => c.key === key);
            const showProd     = hasKey('productionNotes');
            const showPolish   = hasKey('polishNotes');
            const showQc       = hasKey('qcNotes');
            const showPackage  = hasKey('packagingNotes');
            const showProdCol  = showProd || showPolish;
            const showQcCol    = showQc   || showPackage;
            const showBarcode  = hasKey('barcode');

            const noteRows = (order.items || [])
              .map((item, idx) => ({ item, idx }))
              .filter(({ item }) => bottomColDefs.some((c) => itemHas(item, c.key)));

            if (noteRows.length === 0) return null;

            const headerStyle = {
              padding: '4px 6px',
              textAlign: 'center',
              fontWeight: 700,
              fontSize: '6.5pt',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: '#fff',
              background: '#a86820',
              border: '1px solid #c4822a',
              verticalAlign: 'middle',
            };
            const cellBase = {
              padding: '4px 6px',
              border: '1px solid #d9c2a3',
              verticalAlign: 'middle',
              textAlign: 'center',
              lineHeight: 1.35,
              fontSize: '7.25pt',
              color: '#1a1a1a',
            };
            const sublabel = {
              fontSize: '6.25pt',
              fontWeight: 700,
              color: '#a86820',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              display: 'block',
              marginBottom: '1px',
            };
            const subValue = {
              color: '#1a1a1a',
              whiteSpace: 'pre-wrap',
              fontSize: '7.25pt',
              lineHeight: 1.35,
            };

            // Render the stacked Production/Polish or QC/Packaging cell.
            const renderStackedCell = (item, topKey, bottomKey, showTop, showBottom) => {
              const topVal    = item[topKey];
              const bottomVal = item[bottomKey];
              const hasTop    = showTop    && topVal    && String(topVal).trim() !== '';
              const hasBottom = showBottom && bottomVal && String(bottomVal).trim() !== '';
              const labelMap = {
                productionNotes: 'Production',
                polishNotes:     'Polish',
                qcNotes:         'QC',
                packagingNotes:  'Packaging',
              };
              if (!hasTop && !hasBottom) {
                return <td style={cellBase}>—</td>;
              }
              return (
                <td style={{ ...cellBase, padding: 0 }}>
                  {showTop && (
                    <div style={{
                      padding: '4px 6px',
                      borderBottom: showBottom ? '1px solid #d9c2a3' : 'none',
                    }}>
                      <span style={sublabel}>{labelMap[topKey]}</span>
                      <div style={subValue}>
                        {hasTop ? topVal : '—'}
                      </div>
                    </div>
                  )}
                  {showBottom && (
                    <div style={{ padding: '4px 6px' }}>
                      <span style={sublabel}>{labelMap[bottomKey]}</span>
                      <div style={subValue}>
                        {hasBottom ? bottomVal : '—'}
                      </div>
                    </div>
                  )}
                </td>
              );
            };

            return (
              <div style={{ marginTop: '8px', breakInside: 'avoid' }}>
                <div style={{
                  fontSize: '7pt', fontWeight: 700, color: '#fff', background: '#5b3a14',
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                  padding: '3px 8px', borderRadius: '2px 2px 0 0',
                  textAlign: 'center', border: '1px solid #5b3a14', borderBottom: 'none',
                }}>
                  Factory Notes &amp; Barcode
                </div>
                <table style={{
                  width: '100%', borderCollapse: 'collapse', tableLayout: 'auto',
                  fontSize: '7.25pt', border: '1.25px solid #a86820',
                }}>
                  {/* No header row — the section banner above identifies the
                      table and each body cell is self-labelling (number,
                      SKU code, sub-labelled note stack, barcode image). This
                      keeps Production/QC content flush against the banner
                      with no empty bronze strip between them. */}
                  <tbody>
                    {noteRows.map(({ item, idx }, rIdx) => (
                      <tr key={item._id || idx} style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#fdf8f3', breakInside: 'avoid' }}>
                        <td style={{ ...cellBase, width: '1%', whiteSpace: 'nowrap', fontWeight: 700, color: '#5b3a14' }}>
                          {idx + 1}
                        </td>
                        <td style={{
                          ...cellBase,
                          width: '1%',
                          whiteSpace: 'nowrap',
                          fontFamily: "'Consolas', 'Courier New', monospace",
                          fontWeight: 700,
                          color: '#a86820',
                          fontSize: '7pt',
                        }}>
                          {item.companySKU || item.skuNumber || '—'}
                        </td>
                        {showProdCol && renderStackedCell(item, 'productionNotes', 'polishNotes', showProd, showPolish)}
                        {showQcCol   && renderStackedCell(item, 'qcNotes', 'packagingNotes', showQc, showPackage)}
                        {showBarcode && (() => {
                          const text = item.barcode?.text || '';
                          const image = absUrl(item.barcode?.image);
                          return (
                            <td style={cellBase}>
                              {(text || image) ? (
                                <div style={{
                                  display: 'flex', flexDirection: 'column',
                                  alignItems: 'center', gap: '3px',
                                }}>
                                  {text && (
                                    <span style={{
                                      fontFamily: "'Consolas', 'Courier New', monospace",
                                      fontSize: '7pt', fontWeight: 700, color: '#1a1a1a',
                                      whiteSpace: 'nowrap',
                                    }}>{text}</span>
                                  )}
                                  {image && (
                                    <img
                                      src={image}
                                      alt="Barcode"
                                      style={{
                                        width: 120, height: 60, objectFit: 'contain',
                                        border: '1px solid #ead9c2', borderRadius: '3px',
                                        background: '#fff', padding: '2px',
                                      }}
                                    />
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                          );
                        })()}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Terms */}
          {[
            ['Payment Terms', order.paymentTerms],
            ['Shipping Terms', order.shippingTerms],
            ['Port of Loading', order.portOfLoading],
            ['Port of Discharge', order.portOfDischarge],
            ['Container Size', order.containerSize],
            ['Country of Destination', order.countryOfDestination],
          ].filter(([, v]) => v).length > 0 && (
            <div className="terms-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '4px 12px', marginTop: '5px', fontSize: '7.5pt', lineHeight: 1.35 }}>
              {[
                ['Payment Terms', order.paymentTerms],
                ['Shipping Terms', order.shippingTerms],
                ['Port of Loading', order.portOfLoading],
                ['Port of Discharge', order.portOfDischarge],
                ['Container Size', order.containerSize],
                ['Country of Destination', order.countryOfDestination],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label}>
                  <span className="k" style={{ fontSize: '6.75pt', fontWeight: 700, color: '#a86820', textTransform: 'uppercase', letterSpacing: '0.4px', marginRight: '3px' }}>
                    {label}:
                  </span>
                  <span style={{ color: '#1a1a1a' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {order.specialInstructions && (
            <div className="special-box" style={{ marginTop: '5px', padding: '5px 8px', background: '#fdf8f3', borderLeft: '2.5px solid #c4822a', borderRadius: '2px' }}>
              <h4 style={{ fontSize: '6.75pt', fontWeight: 700, color: '#a86820', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                Special Instructions
              </h4>
              <p style={{ fontSize: '7.5pt', color: '#333', lineHeight: 1.3, whiteSpace: 'pre-wrap' }}>{order.specialInstructions}</p>
            </div>
          )}

          <div className="sign-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '10px' }}>
            <div className="sig" style={{ borderTop: '1px solid #999', paddingTop: '3px', fontSize: '7pt', color: '#666', textAlign: 'center' }}>
              Authorized Signatory — SGH Crafts
            </div>
            <div className="sig" style={{ borderTop: '1px solid #999', paddingTop: '3px', fontSize: '7pt', color: '#666', textAlign: 'center' }}>
              Customer Acceptance Signature
            </div>
          </div>

          <div className="pi-footer" style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #e5d8c8', textAlign: 'center' }}>
            <p style={{ fontSize: '7pt', color: '#888', fontStyle: 'italic' }}>
              Thank you for your business — we appreciate your trust in SGH Crafts.
            </p>
            <p className="legal" style={{ fontSize: '6.5pt', color: '#aaa', marginTop: '1px' }}>
              Computer-generated document. For queries: Info@sghcrafts.com &nbsp;·&nbsp; +91 9829024475
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
