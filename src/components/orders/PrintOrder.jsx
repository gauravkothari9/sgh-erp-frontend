import { useRef } from 'react';
import { Printer } from 'lucide-react';
import { formatDate, formatCurrency, formatCBM, getCurrencySymbol } from '../../utils/formatters';

/**
 * PrintOrder — compact print-friendly Order summary (internal copy).
 * Shared CSS scoped to `.po-root` drives both the on-screen preview and the print window.
 */

const PRINT_CSS = `
  .po-root, .po-root * { box-sizing: border-box; }
  .po-root {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 8.5pt;
    color: #1f2937;
    background: #f5f5f5;
    padding: 16px 0;
  }
  .po-container {
    width: 210mm;
    margin: 0 auto;
    padding: 10mm 11mm;
    background: #ffffff;
    box-shadow: 0 2px 14px rgba(0,0,0,0.08);
  }

  /* Header */
  .po-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 6px;
    margin-bottom: 10px;
    border-bottom: 2px solid #a86820;
  }
  .po-brand h1 {
    font-size: 15pt;
    font-weight: 800;
    color: #a86820;
    letter-spacing: -0.3px;
    line-height: 1;
    margin: 0;
  }
  .po-brand .tagline {
    font-size: 6.5pt;
    color: #8b6f4e;
    letter-spacing: 1.2px;
    text-transform: uppercase;
    margin-top: 2px;
  }
  .po-brand .addr {
    font-size: 7pt;
    color: #6b7280;
    line-height: 1.35;
    margin-top: 3px;
  }
  .po-doc { text-align: right; }
  .po-doc .doc-label {
    display: inline-block;
    background: #a86820;
    color: #fff;
    font-size: 8.5pt;
    font-weight: 700;
    letter-spacing: 1.5px;
    padding: 3px 9px;
    border-radius: 2px;
  }
  .po-doc .doc-meta {
    font-size: 7.5pt;
    color: #4b5563;
    margin-top: 4px;
    line-height: 1.4;
  }
  .po-doc .doc-meta strong { color: #1f2937; }

  /* Meta blocks */
  .po-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 10px;
  }
  .po-card {
    background: #fdf8f3;
    padding: 6px 8px;
    border: 1px solid #ead9c2;
    border-left: 3px solid #c4822a;
    border-radius: 2px;
  }
  .po-card h3 {
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #a86820;
    margin: 0 0 3px;
  }
  .po-card .name {
    font-size: 9pt;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 1px;
  }
  .po-card p {
    font-size: 7.5pt;
    color: #374151;
    line-height: 1.35;
    margin: 0;
  }
  .po-card .row {
    display: flex;
    font-size: 7.5pt;
    line-height: 1.4;
  }
  .po-card .row .k {
    color: #8b6f4e;
    min-width: 70px;
    font-weight: 600;
  }
  .po-card .row .v { color: #1f2937; flex: 1; }

  /* Section title */
  .po-section {
    font-size: 7.5pt;
    font-weight: 700;
    color: #ffffff;
    background: #a86820;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 3px 8px;
    margin: 10px 0 0;
    border-radius: 2px 2px 0 0;
  }

  /* Items table */
  .po-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 8px;
    font-size: 7.5pt;
  }
  .po-table thead th {
    background: #f3e7d6;
    color: #5b3a14;
    padding: 4px 5px;
    text-align: left;
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-bottom: 1.5px solid #a86820;
    border-right: 1px solid #ead9c2;
  }
  .po-table thead th:last-child { border-right: none; }
  .po-table tbody td {
    padding: 4px 5px;
    border-bottom: 1px solid #f0e6d6;
    border-right: 1px solid #f0e6d6;
    vertical-align: top;
    color: #1f2937;
    line-height: 1.35;
  }
  .po-table tbody td:last-child { border-right: none; }
  .po-table tbody tr:nth-child(even) td { background: #fdfaf5; }
  .po-table .sku {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 7pt;
    font-weight: 700;
    color: #a86820;
  }
  .po-table .sub { font-size: 6.5pt; color: #8b8580; margin-top: 1px; }
  .po-table .desc-main { font-weight: 600; color: #1f2937; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }

  /* Totals summary */
  .po-totals {
    display: flex;
    justify-content: flex-end;
    margin-top: 2px;
  }
  .po-totals-box {
    min-width: 230px;
    border: 1px solid #ead9c2;
    border-radius: 2px;
    overflow: hidden;
  }
  .po-totals-box .row {
    display: flex;
    justify-content: space-between;
    padding: 3px 10px;
    font-size: 7.5pt;
    color: #374151;
    background: #fdf8f3;
    border-bottom: 1px solid #f0e6d6;
  }
  .po-totals-box .row.grand {
    background: #a86820;
    color: #ffffff;
    font-size: 9pt;
    font-weight: 700;
    border-bottom: none;
    padding: 5px 10px;
  }

  /* Notes */
  .po-notes {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-left: 3px solid #9ca3af;
    padding: 5px 8px;
    margin-top: 6px;
    border-radius: 2px;
    font-size: 7.5pt;
    color: #374151;
    line-height: 1.4;
    white-space: pre-wrap;
  }
  .po-notes.warn {
    background: #fef9f1;
    border-color: #f3e7d6;
    border-left-color: #c4822a;
    color: #5b3a14;
  }
  .po-notes h4 {
    font-size: 6.5pt;
    font-weight: 700;
    color: #6b7280;
    margin: 0 0 2px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .po-notes.warn h4 { color: #a86820; }

  .po-factory-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 12px;
    margin-top: 2px;
    font-size: 7pt;
  }
  .po-factory-grid strong { color: #5b3a14; }

  /* Signature */
  .po-sign {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    margin-top: 18px;
  }
  .po-sign .box {
    border-top: 1px solid #9ca3af;
    padding-top: 3px;
    font-size: 7pt;
    color: #6b7280;
    text-align: center;
  }

  /* Footer */
  .po-footer {
    margin-top: 10px;
    padding-top: 5px;
    border-top: 1px solid #ead9c2;
    text-align: center;
    font-size: 6.5pt;
    color: #8b8580;
    letter-spacing: 0.3px;
  }

  @media print {
    .po-root { background: #ffffff; padding: 0; }
    .po-container {
      box-shadow: none;
      width: 100%;
      padding: 8mm 10mm;
      margin: 0;
    }
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    tr, td, th { page-break-inside: avoid; }
    .po-section, thead { page-break-after: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }
  @page { size: A4 portrait; margin: 8mm; }
`;

export default function PrintOrder({ order }) {
  const printRef = useRef(null);

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const w = window.open('', '_blank');
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order ${order.orderNumber || ''} — ${order.customer?.companyName || ''}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body { background: #ffffff; }
            ${PRINT_CSS}
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  };

  const customer = order.customer || {};
  // Customer model stores arrays — flatten the first entry of each for display.
  const firstAddr  = customer.shippingAddresses?.[0] || customer.billingAddresses?.[0] || {};
  const cityLine   = [firstAddr.city, firstAddr.state, firstAddr.country].filter(Boolean).join(', ') || customer.country || '';
  const firstEmail = customer.emails?.[0]?.email   || customer.email || '';
  const firstPhone = customer.phones?.[0]?.number  || customer.phone || '';
  const contactPerson = customer.contactPersonName || customer.contactPerson || '';

  const symbol = getCurrencySymbol(order.currency);
  const totalQty = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
  const totalAmount = order.items?.reduce((s, i) => s + ((i.quantity || 0) * (i.unitPrice || 0)), 0) || 0;
  const totalCBM = order.items?.reduce((s, i) => s + ((parseFloat(i.cbm) || 0) * (i.quantity || 1)), 0) || 0;
  const lineCount = order.items?.length || 0;

  const fmtDims = (d) => {
    if (!d || (!d.length && !d.width && !d.height)) return '—';
    return `${d.length || 0}×${d.width || 0}×${d.height || 0}${d.unit || 'cm'}`;
  };

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4 no-print">
        <button onClick={handlePrint} className="btn-primary btn">
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      <style>{PRINT_CSS}</style>

      <div ref={printRef}>
        <div className="po-root">
          <div className="po-container">
            {/* Header */}
            <div className="po-header">
              <div className="po-brand">
                <h1>SGH CRAFTS</h1>
                <div className="tagline">Handcrafted Furniture &amp; Décor</div>
                <div className="addr">Jodhpur, Rajasthan, India &nbsp;·&nbsp; www.sghcrafts.com</div>
              </div>
              <div className="po-doc">
                <div className="doc-label">ORDER COPY</div>
                <div className="doc-meta">
                  <div>Order #: <strong>{order.orderNumber || '—'}</strong></div>
                  <div>File #: <strong>{order.fileNumber || '—'}</strong></div>
                  {order.proformaInvoiceNumber && (
                    <div>PI #: <strong>{order.proformaInvoiceNumber}</strong></div>
                  )}
                  <div>Date: <strong>{formatDate(order.orderDate)}</strong></div>
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="po-meta">
              <div className="po-card">
                <h3>Bill To / Customer</h3>
                <div className="name">{customer.companyName || customer.fileNumber || '—'}</div>
                {contactPerson && <p>{contactPerson}{customer.designation ? ` · ${customer.designation}` : ''}</p>}
                {cityLine && <p>{cityLine}</p>}
                {firstEmail && <p>{firstEmail}</p>}
                {firstPhone && <p>{firstPhone}</p>}
              </div>
              <div className="po-card">
                <h3>Order Details</h3>
                <div className="row"><span className="k">Type</span><span className="v">{order.orderType || '—'}</span></div>
                <div className="row"><span className="k">Status</span><span className="v">{order.orderStatus || '—'}</span></div>
                {order.expectedDeliveryDate && (
                  <div className="row"><span className="k">Expected</span><span className="v">{formatDate(order.expectedDeliveryDate)}</span></div>
                )}
                {order.buyerPONumber && (
                  <div className="row"><span className="k">Buyer PO</span><span className="v">{order.buyerPONumber}</span></div>
                )}
                {order.containerSize && (
                  <div className="row"><span className="k">Container</span><span className="v">{order.containerSize}</span></div>
                )}
                <div className="row"><span className="k">Currency</span><span className="v">{order.currency || 'USD'}</span></div>
              </div>
            </div>

            {/* Items */}
            <div className="po-section">Line Items ({lineCount})</div>
            <table className="po-table">
              <thead>
                <tr>
                  <th style={{ width: '20px' }}>#</th>
                  <th style={{ width: '80px' }}>SKU</th>
                  <th>Description</th>
                  <th style={{ width: '95px' }}>Materials / Finish</th>
                  <th style={{ width: '80px' }}>Dimensions</th>
                  <th className="text-right" style={{ width: '42px' }}>CBM</th>
                  <th className="text-right" style={{ width: '32px' }}>Qty</th>
                  <th className="text-right" style={{ width: '60px' }}>Unit</th>
                  <th className="text-right" style={{ width: '70px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <div className="sku">{item.companySKU || '—'}</div>
                      {item.buyerSKU && <div className="sub">{item.buyerSKU}</div>}
                      {item.hsnCode && <div className="sub">HSN: {item.hsnCode}</div>}
                    </td>
                    <td>
                      <div className="desc-main">{item.itemDescription || '—'}</div>
                      {item.collectionName && <div className="sub">Collection: {item.collectionName}</div>}
                      {item.itemCategory && <div className="sub">{item.itemCategory}</div>}
                      {item.itemCondition && <div className="sub">{item.itemCondition}</div>}
                    </td>
                    <td>
                      {item.materials?.length > 0 && <div>{item.materials.join(', ')}</div>}
                      {item.finishes?.length > 0 && <div className="sub">{item.finishes.join(', ')}</div>}
                    </td>
                    <td>{fmtDims(item.dimensions)}</td>
                    <td className="text-right">{item.cbm ? Number(item.cbm).toFixed(3) : '—'}</td>
                    <td className="text-right">{item.quantity || 0}</td>
                    <td className="text-right">{symbol}{Number(item.unitPrice || 0).toFixed(2)}</td>
                    <td className="text-right"><strong>{symbol}{((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals summary */}
            <div className="po-totals">
              <div className="po-totals-box">
                <div className="row"><span>Lines</span><span>{lineCount}</span></div>
                <div className="row"><span>Total Qty</span><span>{totalQty}</span></div>
                <div className="row"><span>Total CBM</span><span>{formatCBM(totalCBM)}</span></div>
                <div className="row grand"><span>GRAND TOTAL</span><span>{formatCurrency(totalAmount, order.currency)}</span></div>
              </div>
            </div>

            {/* Special Instructions */}
            {order.specialInstructions && (
              <div className="po-notes warn">
                <h4>Special Instructions</h4>
                {order.specialInstructions}
              </div>
            )}

            {/* Internal Notes */}
            {order.internalNotes && (
              <div className="po-notes">
                <h4>Internal Notes</h4>
                {order.internalNotes}
              </div>
            )}

            {/* Per-item factory notes */}
            {order.items?.some(i => i.productionNotes || i.qcNotes || i.polishNotes || i.packagingNotes) && (
              <>
                <div className="po-section" style={{ marginTop: '12px' }}>Factory Notes</div>
                <div style={{ marginTop: '4px' }}>
                  {order.items.map((item, idx) => {
                    const has = item.productionNotes || item.qcNotes || item.polishNotes || item.packagingNotes;
                    if (!has) return null;
                    return (
                      <div key={idx} className="po-notes" style={{ marginTop: '4px' }}>
                        <h4>{item.companySKU || `Item ${idx + 1}`} — {item.itemDescription || ''}</h4>
                        <div className="po-factory-grid">
                          {item.productionNotes && <div><strong>Production:</strong> {item.productionNotes}</div>}
                          {item.qcNotes && <div><strong>QC:</strong> {item.qcNotes}</div>}
                          {item.polishNotes && <div><strong>Polish:</strong> {item.polishNotes}</div>}
                          {item.packagingNotes && <div><strong>Packaging:</strong> {item.packagingNotes}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Signature */}
            <div className="po-sign">
              <div className="box">Prepared By</div>
              <div className="box">Authorised Signature</div>
            </div>

            <div className="po-footer">
              Printed on {formatDate(new Date())} &nbsp;·&nbsp; SGH Crafts ERP &nbsp;·&nbsp; Internal Document
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
