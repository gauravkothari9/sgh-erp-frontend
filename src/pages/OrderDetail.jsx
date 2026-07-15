import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, XCircle, FileDown, Printer,
  Package, Paperclip, MessageSquare, ChevronDown,
  AlertTriangle, Check, Image as ImageIcon, Send, Trash2, Star,
  X, ChevronLeft, ChevronRight, ZoomIn,
} from 'lucide-react';
import { orderAPI, productionAPI } from '../utils/api';
import PhotoPicker from '../components/common/PhotoPicker';
import { formatDate, formatCurrency, formatDateTime, formatCBM, formatWeight, timeAgo, getCurrencySymbol, resolveMediaSrc, imgErrorFallback } from '../utils/formatters';
import { StatusBadge, OrderTypeBadge } from '../components/common/Badge';
import { PageLoader } from '../components/common/LoadingSpinner';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Modal from '../components/common/Modal';
import ImageLightbox from '../components/common/ImageLightbox';
import ProformaInvoicePDF from '../components/orders/ProformaInvoicePDF';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const ORDER_STATUSES = [
  'Pending', 'In Production', 'QC', 'Polish',
  'Packaging', 'Ready to Ship', 'Shipped', 'Completed',
];

const DEFAULT_EXCEL_COLUMNS = [
  // ── Identification ──
  { key: 'srNo',            label: 'Sr. no.',            group: 'Identification', selected: true },
  { key: 'skuNo',           label: 'Company SKU',        group: 'Identification', selected: true },
  { key: 'buyerSKU',        label: 'Buyer SKU',          group: 'Identification', selected: true },
  { key: 'buyerName',       label: 'Buyer Name',         group: 'Identification', selected: true },
  // ── Description ──
  { key: 'itemName',        label: 'Item Description',   group: 'Description',    selected: true },
  { key: 'buyerDescription',label: 'Buyer Description',  group: 'Description',    selected: true },
  { key: 'category',        label: 'Category',           group: 'Description',    selected: true },
  { key: 'collection',      label: 'Collection',         group: 'Description',    selected: true },
  { key: 'materials',       label: 'Materials',          group: 'Description',    selected: true },
  { key: 'finishes',        label: 'Finishes',           group: 'Description',    selected: true },
  { key: 'condition',       label: 'Condition',          group: 'Description',    selected: true },
  { key: 'hsnCode',         label: 'HSN Code',           group: 'Description',    selected: true },
  // ── Physical ──
  { key: 'size',            label: 'Size (L × W × H)',   group: 'Physical',       selected: true },
  { key: 'unit',            label: 'Unit',               group: 'Physical',       selected: true },
  { key: 'cbm',             label: 'CBM',                group: 'Physical',       selected: true },
  { key: 'cbmTotal',        label: 'CBM Total',          group: 'Physical',       selected: true },
  { key: 'weight',          label: 'Weight (kg)',        group: 'Physical',       selected: true },
  // ── Pricing ──
  { key: 'qty',             label: 'Qty.',               group: 'Pricing',        selected: true },
  { key: 'price',           label: 'Unit Price',         group: 'Pricing',        selected: true },
  { key: 'total',           label: 'Line Total',         group: 'Pricing',        selected: true },
  // ── Media ──
  { key: 'photo',           label: 'Photo',              group: 'Media',          selected: true },
  { key: 'barcode',         label: 'Barcode',            group: 'Media',          selected: true },
  // ── Factory Notes ──
  { key: 'productionNotes', label: 'Production Notes',   group: 'Factory Notes',  selected: true },
  { key: 'qcNotes',         label: 'QC Notes',           group: 'Factory Notes',  selected: true },
  { key: 'polishNotes',     label: 'Polish Notes',       group: 'Factory Notes',  selected: true },
  { key: 'packagingNotes',  label: 'Packaging Notes',    group: 'Factory Notes',  selected: true },
  { key: 'comments',        label: 'Comments',           group: 'Factory Notes',  selected: true },
];

// Default PI selection: Sr.no · Company SKU · Item Description · Dimensions ·
// Qty · Image · Comments. Other columns remain available in the picker but
// unticked by default so the standard PI sticks to the seven-column layout.
const DEFAULT_PI_COLUMNS = [
  // ── Identification ──
  { key: 'srNo',            label: 'Sr. no.',            group: 'Identification', selected: true },
  { key: 'skuNo',           label: 'Company SKU',        group: 'Identification', selected: true },
  { key: 'buyerSKU',        label: 'Buyer SKU',          group: 'Identification', selected: false },
  { key: 'buyerName',       label: 'Buyer Name',         group: 'Identification', selected: false },
  // ── Description ──
  { key: 'itemName',        label: 'Item Description',   group: 'Description',    selected: true },
  { key: 'buyerDescription',label: 'Buyer Description',  group: 'Description',    selected: false },
  { key: 'category',        label: 'Category',           group: 'Description',    selected: false },
  { key: 'collection',      label: 'Collection',         group: 'Description',    selected: false },
  { key: 'materials',       label: 'Materials',          group: 'Description',    selected: false },
  { key: 'finishes',        label: 'Finishes',           group: 'Description',    selected: false },
  { key: 'condition',       label: 'Condition',          group: 'Description',    selected: false },
  { key: 'hsnCode',         label: 'HSN Code',           group: 'Description',    selected: false },
  // ── Physical ──
  { key: 'size',            label: 'Dimensions',         group: 'Physical',       selected: true },
  { key: 'unit',            label: 'Unit',               group: 'Physical',       selected: false },
  { key: 'cbm',             label: 'CBM',                group: 'Physical',       selected: false },
  { key: 'cbmTotal',        label: 'Total CBM',          group: 'Physical',       selected: false },
  { key: 'weight',          label: 'Weight (kg)',        group: 'Physical',       selected: false },
  // ── Pricing ──
  { key: 'qty',             label: 'Qty.',               group: 'Pricing',        selected: true },
  { key: 'price',           label: 'Unit Price',         group: 'Pricing',        selected: false },
  { key: 'total',           label: 'Line Total',         group: 'Pricing',        selected: false },
  // ── Media ──
  { key: 'photo',           label: 'Image',              group: 'Media',          selected: true },
  { key: 'barcode',         label: 'Barcode',            group: 'Media',          selected: false },
  // ── Factory Notes ──
  { key: 'productionNotes', label: 'Production Notes',   group: 'Factory Notes',  selected: false },
  { key: 'qcNotes',         label: 'QC Notes',           group: 'Factory Notes',  selected: false },
  { key: 'polishNotes',     label: 'Polish Notes',       group: 'Factory Notes',  selected: false },
  { key: 'packagingNotes',  label: 'Packaging Notes',    group: 'Factory Notes',  selected: false },
  { key: 'comments',        label: 'Comments',           group: 'Factory Notes',  selected: true },
];

const InfoRow = ({ label, value, mono }) => (
  value ? (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2.5 border-b border-brand-50 last:border-0">
      <span className="text-xs text-gray-400 sm:w-40 flex-shrink-0">{label}</span>
      <span className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''} flex-1`}>{value}</span>
    </div>
  ) : null
);

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOfficeStaff, isAdmin, can } = useAuthStore();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('items');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPDF, setShowPDF] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [selectedImagesItem, setSelectedImagesItem] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewerImages, setViewerImages] = useState(null); // { images: [], title: '', startIndex: 0 }
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelColumns, setExcelColumns] = useState(DEFAULT_EXCEL_COLUMNS);
  const [showPIPickerModal, setShowPIPickerModal] = useState(false);
  const [piColumns, setPIColumns] = useState(DEFAULT_PI_COLUMNS);
  const statusMenuRef = useRef(null);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await orderAPI.getById(id);
      setOrder(res.data.data.order);
    } catch {
      navigate('/office/orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  useEffect(() => {
    const handleClick = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keyboard navigation is now handled inside the ImageLightbox component.

  const handleStatusChange = async (status) => {
    setShowStatusMenu(false);
    try {
      await orderAPI.updateStatus(id, status);
      toast.success(`Status updated to "${status}"`);
      fetchOrder();
    } catch {}
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }
    setCancelLoading(true);
    try {
      await orderAPI.cancel(id, cancelReason);
      toast.success('Order cancelled');
      setShowCancelDialog(false);
     } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDeleteOrder = async () => {
    if (!window.confirm('Are you sure you want to delete this order permanently? All associated images and records will be removed.')) return;
    try {
      await orderAPI.delete(id);
      toast.success('Order deleted successfully');
      navigate('/office/orders');
    } catch (err) {
      toast.error('Failed to delete order');
    }
  };

  const handleStartProcessing = async () => {
    try {
      await orderAPI.startProcessing(id);
      toast.success('Processing started — moved to Pending');
      fetchOrder();
    } catch {}
  };

  // Photos attached to the comment being written — from the gallery or shot on
  // the spot. The endpoint has always accepted them (`images`, max 10); the UI
  // simply never offered a way in.
  const [commentPhotos, setCommentPhotos] = useState([]);

  const handleAddComment = async () => {
    if (!commentText.trim() && commentPhotos.length === 0) return;
    setCommentSending(true);
    try {
      const formData = new FormData();
      formData.append('text', commentText);
      commentPhotos.slice(0, 10).forEach((f) => formData.append('images', f));
      await orderAPI.addComment(id, formData);
      setCommentText('');
      setCommentPhotos([]);
      toast.success('Comment added');
      fetchOrder();
    } catch {}
    finally { setCommentSending(false); }
  };

  // Mark one of an item's images as its primary photo — this is the image
  // used as the product photo in the Proforma Invoice and the Excel export.
  const [primaryImageSaving, setPrimaryImageSaving] = useState(false);
  const handleSetPrimaryImage = async (itemId, imagePath) => {
    if (!itemId || !imagePath) return;
    setPrimaryImageSaving(true);
    try {
      await orderAPI.setPrimaryImage(id, itemId, { imagePath });
      toast.success('Primary image updated');
      await fetchOrder();
    } catch {}
    finally { setPrimaryImageSaving(false); }
  };

  // ── Column availability ─────────────────────────────────────────────
  // A column is "available" only when at least one order item actually has
  // data for it. Empty fields are hidden from the picker so users don't
  // select columns that would produce blank output.
  // Memoised on `order` so the picker/output recompute when item data changes.
  const hasColumnData = useCallback((key) => {
    const items = order?.items || [];
    if (items.length === 0) return false;
    const any = (fn) => items.some(fn);
    const str = (v) => typeof v === 'string' && v.trim() !== '';
    const num = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
    switch (key) {
      case 'srNo':            return true;
      case 'buyerName':       return str(order?.customer?.companyName) || str(order?.buyerName) || str(order?.buyer?.name);
      case 'skuNo':           return any((i) => str(i.companySKU));
      case 'buyerSKU':        return any((i) => str(i.buyerSKU));
      case 'itemName':        return any((i) => str(i.itemDescription));
      case 'buyerDescription':return any((i) => str(i.buyerDescription));
      case 'category':        return any((i) => str(i.itemCategory));
      case 'collection':      return any((i) => str(i.collectionName));
      case 'materials':       return any((i) => (Array.isArray(i.materials) && i.materials.some(str)) || str(i.material));
      case 'finishes':        return any((i) => (Array.isArray(i.finishes) && i.finishes.some(str)) || str(i.finish));
      case 'condition':       return any((i) => str(i.itemCondition));
      case 'photo':           return any((i) => str(i.primaryImage) || (Array.isArray(i.images) && i.images.some(str)));
      case 'size':            return any((i) => i.dimensions && (num(i.dimensions.length) || num(i.dimensions.width) || num(i.dimensions.height)));
      case 'unit':            return any((i) => i.dimensions && (num(i.dimensions.length) || num(i.dimensions.width) || num(i.dimensions.height)));
      case 'qty':             return any((i) => num(i.quantity));
      case 'price':           return any((i) => num(i.unitPrice));
      case 'total':           return any((i) => num(i.quantity) && num(i.unitPrice));
      case 'cbm':             return any((i) => num(i.cbm));
      case 'cbmTotal':        return any((i) => num(i.totalCBM) || (num(i.cbm) && num(i.quantity)));
      case 'weight':          return any((i) => num(i.weight));
      case 'hsnCode':         return any((i) => str(i.hsnCode));
      case 'barcode':         return any((i) => str(i.barcode?.text) || str(i.barcode?.image));
      case 'addPhotos':       return any((i) => Array.isArray(i.images) && i.images.filter(str).length > 1);
      case 'productionNotes': return any((i) => str(i.productionNotes));
      case 'qcNotes':         return any((i) => str(i.qcNotes));
      case 'polishNotes':     return any((i) => str(i.polishNotes));
      case 'packagingNotes':  return any((i) => str(i.packagingNotes));
      case 'comments':        return any((i) => Array.isArray(i.comments) && i.comments.some(c => str(c?.text) || (Array.isArray(c?.images) && c.images.length > 0)));
      default:                return true;
    }
  }, [order]);

  const availableColumns = useMemo(
    () => excelColumns.filter((c) => hasColumnData(c.key)),
    [excelColumns, hasColumnData]
  );

  const availablePICols = useMemo(
    () => piColumns.filter((c) => hasColumnData(c.key)),
    [piColumns, hasColumnData]
  );

  // ── Shared data builder — used by both Excel export and Print ─────────
  // Returns `{ headers, rows, hasSize, hasPhoto }` derived from the currently
  // selected columns. Photo rows include the full URL so print can render
  // the image; excel writes a shortened filename for the cell text and also
  // stores the URL separately.
  const checkCBMTotal = (item) => {
    const cTotal =
      item.totalCBM || (item.cbm && item.quantity ? item.cbm * item.quantity : 0);
    return cTotal ? parseFloat(cTotal).toFixed(3) : '';
  };

  const buildSheetData = (cols) => {
    const items = order?.items || [];
    const rows = items.map((item, idx) => {
      const row = {};
      cols.forEach((col) => {
        if (col.key === 'srNo') row[col.key] = idx + 1;
        else if (col.key === 'skuNo') row[col.key] = item.companySKU || item.skuNumber || '';
        else if (col.key === 'buyerSKU') row[col.key] = item.buyerSKU || '';
        else if (col.key === 'itemName') row[col.key] = item.itemDescription || '';
        else if (col.key === 'buyerDescription') row[col.key] = item.buyerDescription || '';
        else if (col.key === 'category') row[col.key] = item.itemCategory || '';
        else if (col.key === 'collection') row[col.key] = item.collectionName || '';
        else if (col.key === 'materials') row[col.key] = (item.materials || []).join(', ');
        else if (col.key === 'finishes') row[col.key] = (item.finishes || []).join(', ');
        else if (col.key === 'condition') row[col.key] = item.itemCondition || '';
        else if (col.key === 'buyerName')
          row[col.key] = order.customer?.companyName || order.buyerName || order.buyer?.name || '';
        else if (col.key === 'photo') {
          row[col.key] = item.primaryImage || (item.images?.length > 0 ? item.images[0] : '');
        }
        else if (col.key === 'size') {
          row[col.key] = {
            l: item.dimensions?.length || '',
            w: item.dimensions?.width || '',
            h: item.dimensions?.height || '',
            unit: item.dimensions?.unit || 'cm',
          };
        }
        else if (col.key === 'unit') row[col.key] = item.dimensions?.unit || 'cm';
        else if (col.key === 'qty') row[col.key] = item.quantity || 0;
        else if (col.key === 'price') row[col.key] = item.unitPrice || 0;
        else if (col.key === 'total') row[col.key] = (item.quantity || 0) * (item.unitPrice || 0);
        else if (col.key === 'cbm') row[col.key] = item.cbm || '';
        else if (col.key === 'cbmTotal') row[col.key] = checkCBMTotal(item);
        else if (col.key === 'weight') row[col.key] = item.weight || '';
        else if (col.key === 'hsnCode') row[col.key] = item.hsnCode || '';
        else if (col.key === 'barcode') {
          row[col.key] = item.barcode?.text || item.barcode?.image || '';
        }
        else if (col.key === 'productionNotes') row[col.key] = item.productionNotes || '';
        else if (col.key === 'qcNotes') row[col.key] = item.qcNotes || '';
        else if (col.key === 'polishNotes') row[col.key] = item.polishNotes || '';
        else if (col.key === 'packagingNotes') row[col.key] = item.packagingNotes || '';
        else if (col.key === 'comments')
          row[col.key] = item.comments?.map((c) => c.text).filter(Boolean).join(' | ') || '';
        else if (col.key === 'addPhotos') {
          const primary = item.primaryImage || (item.images?.length > 0 ? item.images[0] : '');
          row[col.key] = (item.images || []).filter((u) => u !== primary);
        }
      });
      return row;
    });
    return { cols, rows };
  };

  // ── Excel export ────────────────────────────────────────────────────
  // Resolve a stored upload path (e.g. /uploads/orders/x.jpg) into a fully
  // qualified URL so `fetch` can pull it for embedding in the workbook.
  const absoluteUploadUrl = (u) => {
    if (!u || typeof u !== 'string') return '';
    // Normalise Windows-style backslash paths so `fetch` gets a valid URL.
    const forward = u.replace(/\\/g, '/').trim();
    if (!forward) return '';
    if (/^(https?:|data:|blob:)/i.test(forward)) return forward;
    const baseUrl = import.meta.env.VITE_UPLOAD_URL
      ? import.meta.env.VITE_UPLOAD_URL.replace(/\/uploads$/, '')
      : window.location.origin;
    return `${baseUrl}${forward.startsWith('/') ? forward : `/${forward}`}`;
  };

  // Fetch an image URL → { buffer, extension } for ExcelJS.addImage.
  // exceljs supports png / jpeg / gif. We probe the blob's MIME type and
  // fall back to jpeg if it's something exotic (heic, webp, etc).
  const fetchImageForExcel = async (url) => {
    try {
      const abs = absoluteUploadUrl(url);
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
      console.warn('Image fetch failed for Excel export', url, e);
      return null;
    }
  };

  const handleExportExcel = async () => {
    if (!order || !order.items) return;

    const selectedCols = excelColumns.filter((c) => c.selected && hasColumnData(c.key));
    if (selectedCols.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    const { rows } = buildSheetData(selectedCols);

    // Flatten size into L/W/H so each visual column is one sheet column.
    const flatCols = [];
    selectedCols.forEach((c) => {
      if (c.key === 'size') {
        flatCols.push(
          { key: 'size_l', label: 'L', parent: c },
          { key: 'size_w', label: 'W', parent: c },
          { key: 'size_h', label: 'H', parent: c },
        );
      } else {
        flatCols.push({ key: c.key, label: c.label, parent: c });
      }
    });
    const totalFlatCols = flatCols.length;
    const widthFor = (key) => {
      switch (key) {
        case 'srNo': return 6;
        case 'skuNo':
        case 'buyerSKU':
        case 'hsnCode': return 14;
        case 'itemName':
        case 'buyerDescription':
        case 'materials':
        case 'finishes':
        case 'productionNotes':
        case 'qcNotes':
        case 'polishNotes':
        case 'packagingNotes': return 30;
        // Image-bearing columns — sized to hold a 120 px image (≈ 18 char units).
        case 'photo':
        case 'addPhotos':
        case 'barcode':
        case 'comments': return 19;
        case 'size_l':
        case 'size_w':
        case 'size_h': return 8;
        case 'qty':
        case 'cbm':
        case 'cbmTotal':
        case 'weight': return 10;
        case 'price':
        case 'total': return 14;
        default: return 15;
      }
    };

    const toastId = toast.loading('Building Excel workbook…');

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'SGH Crafts ERP';
      workbook.created = new Date();
      const ws = workbook.addWorksheet('Order Items', {
        views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }], // freeze under headers
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
      });

      // ── Column widths ─────────────────────────────────────────────
      ws.columns = flatCols.map((c) => ({ width: widthFor(c.key) }));

      // ── Row 1: Title banner ───────────────────────────────────────
      ws.mergeCells(1, 1, 1, totalFlatCols);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = `SGH CRAFTS — Order ${order.orderNumber || ''}`;
      titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFA86820' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      ws.getRow(1).height = 26;

      // ── Row 2: Meta line ──────────────────────────────────────────
      ws.mergeCells(2, 1, 2, totalFlatCols);
      const metaCell = ws.getCell(2, 1);
      metaCell.value = [
        order.customer?.companyName ? `Buyer: ${order.customer.companyName}` : '',
        order.fileNumber ? `File: ${order.fileNumber}` : '',
        order.orderDate ? `Date: ${formatDate(order.orderDate)}` : '',
        order.currency ? `Currency: ${order.currency}` : '',
      ].filter(Boolean).join('    ·    ');
      metaCell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF6B7280' } };
      metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
      ws.getRow(2).height = 18;

      // ── Row 3: Spacer ─────────────────────────────────────────────
      ws.getRow(3).height = 6;

      // ── Rows 4 & 5: Header rows ───────────────────────────────────
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

      flatCols.forEach((c, i) => {
        const colIdx = i + 1;
        if (c.parent.key === 'size') {
          if (c.key === 'size_l') {
            ws.mergeCells(4, colIdx, 4, colIdx + 2);
            const cell = ws.getCell(4, colIdx);
            cell.value = 'Size';
            Object.assign(cell, headerStyle);
            cell.font = headerStyle.font;
            cell.fill = headerStyle.fill;
            cell.alignment = headerStyle.alignment;
            cell.border = headerStyle.border;
          }
          const sub = ws.getCell(5, colIdx);
          sub.value = c.label;
          sub.font = headerStyle.font;
          sub.fill = headerStyle.fill;
          sub.alignment = headerStyle.alignment;
          sub.border = headerStyle.border;
        } else {
          ws.mergeCells(4, colIdx, 5, colIdx);
          const cell = ws.getCell(4, colIdx);
          cell.value = c.label;
          cell.font = headerStyle.font;
          cell.fill = headerStyle.fill;
          cell.alignment = headerStyle.alignment;
          cell.border = headerStyle.border;
        }
      });
      ws.getRow(4).height = 22;
      ws.getRow(5).height = 18;

      // ── Data rows ─────────────────────────────────────────────────
      const firstDataRow = 6;
      const currencyCode = order.currency || 'USD';
      const numFmtFor = (key) => {
        switch (key) {
          case 'price':
          case 'total':    return `"${currencyCode}" #,##0.00`;
          case 'cbm':
          case 'cbmTotal': return '0.000';
          case 'weight':   return '0.00';
          case 'qty':
          case 'srNo':     return '0';
          default:         return null;
        }
      };

      const isPhotoCol = (k) => k === 'photo' || k === 'addPhotos';
      // Track image cells to embed into after rows are written, plus the set
      // of sheet rows that received an image (so they can be made tall enough).
      const photoEmbedQueue = [];
      const rowsWithImages = new Set();

      const altRowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF8F3' } };
      const cellBorder = {
        top:    { style: 'hair', color: { argb: 'FFEAD9C2' } },
        bottom: { style: 'hair', color: { argb: 'FFEAD9C2' } },
        left:   { style: 'hair', color: { argb: 'FFEAD9C2' } },
        right:  { style: 'hair', color: { argb: 'FFEAD9C2' } },
      };
      const mono = { name: 'Consolas', size: 9 };

      rows.forEach((row, rowIdx) => {
        const sheetRow = firstDataRow + rowIdx;
        flatCols.forEach((c, i) => {
          const colIdx = i + 1;
          const key = c.parent.key;
          const cell = ws.getCell(sheetRow, colIdx);
          const v = row[key];

          if (key === 'size') {
            const part = c.key === 'size_l' ? v?.l : c.key === 'size_w' ? v?.w : v?.h;
            cell.value = part === '' || part == null ? '' : Number(part);
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (isPhotoCol(key)) {
            // Leave cell text empty; we embed the image in this slot below.
            cell.value = '';
            // First image only — `addPhotos` is rendered as a comma list elsewhere,
            // but for the embed we use the primary of the additional set.
            if (key === 'photo' && v) {
              photoEmbedQueue.push({ url: v, sheetRow, colIdx, kind: 'photo' });
              rowsWithImages.add(sheetRow);
            } else if (key === 'addPhotos' && Array.isArray(v) && v.length > 0) {
              photoEmbedQueue.push({ url: v[0], sheetRow, colIdx, kind: 'photo' });
              rowsWithImages.add(sheetRow);
            }
          } else if (key === 'barcode') {
            // Prefer the scannable barcode image; fall back to the text code.
            const srcItem = order.items[rowIdx];
            const bcImage = srcItem?.barcode?.image;
            const bcText = srcItem?.barcode?.text || '';
            if (bcImage) {
              cell.value = '';
              photoEmbedQueue.push({ url: bcImage, sheetRow, colIdx, kind: 'barcode' });
              rowsWithImages.add(sheetRow);
            } else {
              cell.value = bcText || null;
              cell.font = mono;
              cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            }
          } else if (key === 'comments') {
            // Show the first comment image if any; otherwise the joined text.
            const srcItem = order.items[rowIdx];
            const cmtImages = (srcItem?.comments || [])
              .flatMap((cm) => (Array.isArray(cm?.images) ? cm.images : []))
              .filter(Boolean);
            if (cmtImages.length > 0) {
              cell.value = '';
              photoEmbedQueue.push({ url: cmtImages[0], sheetRow, colIdx, kind: 'comment' });
              rowsWithImages.add(sheetRow);
            } else {
              cell.value = v === '' || v == null ? null : v;
              cell.alignment = { vertical: 'middle', wrapText: true };
            }
          } else {
            const fmt = numFmtFor(key);
            if (fmt) {
              const n = typeof v === 'number' ? v : parseFloat(v);
              cell.value = isNaN(n) ? null : n;
              cell.numFmt = fmt;
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
              cell.value = v === '' || v == null ? null : v;
              cell.alignment = { vertical: 'middle', wrapText: true };
              if (key === 'skuNo' || key === 'buyerSKU' || key === 'hsnCode') {
                cell.font = mono;
              }
            }
          }

          cell.border = cellBorder;
          if (rowIdx % 2 === 1) cell.fill = altRowFill;
        });
        // Rows holding a 120 px image need ~95 pt of height; plain text rows
        // stay compact.
        ws.getRow(sheetRow).height = rowsWithImages.has(sheetRow) ? 95 : 24;
      });

      const lastDataRow = firstDataRow + rows.length - 1;

      // ── Totals row ────────────────────────────────────────────────
      const totalsRowIdx = lastDataRow + 1;
      const totalsFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF5E8' } };
      flatCols.forEach((c, i) => {
        const colIdx = i + 1;
        const key = c.parent.key;
        const cell = ws.getCell(totalsRowIdx, colIdx);
        if (i === 0) {
          cell.value = 'TOTAL';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (key === 'qty') {
          cell.value = order.items.reduce((s, it) => s + (it.quantity || 0), 0);
          cell.numFmt = '0';
        } else if (key === 'total') {
          cell.value = order.items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);
          cell.numFmt = `"${currencyCode}" #,##0.00`;
        } else if (key === 'cbmTotal') {
          cell.value = order.items.reduce((s, it) => s + (it.cbm || 0) * (it.quantity || 1), 0);
          cell.numFmt = '0.000';
        } else if (key === 'weight') {
          cell.value = order.items.reduce((s, it) => s + (it.weight || 0) * (it.quantity || 1), 0);
          cell.numFmt = '0.00';
        }
        cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF5B3A14' } };
        cell.fill = totalsFill;
        cell.alignment = cell.alignment || { horizontal: 'right', vertical: 'middle' };
        cell.border = {
          top:    { style: 'medium', color: { argb: 'FFA86820' } },
          bottom: { style: 'medium', color: { argb: 'FFA86820' } },
          left:   cellBorder.left,
          right:  cellBorder.right,
        };
      });
      ws.getRow(totalsRowIdx).height = 22;

      // ── Auto-filter on the header row range only (totals excluded) ─
      const lastColLetter = XLSX.utils.encode_col(totalFlatCols - 1);
      ws.autoFilter = `A4:${lastColLetter}${lastDataRow}`;

      // Repeat header rows when printing across multiple pages
      ws.pageSetup.printTitlesRow = '4:5';

      // ── Embed images ──────────────────────────────────────────────
      // Run fetches in parallel — each image is independent.
      toast.loading(`Embedding ${photoEmbedQueue.length} image${photoEmbedQueue.length === 1 ? '' : 's'}…`, { id: toastId });
      const fetched = await Promise.all(
        photoEmbedQueue.map((p) => fetchImageForExcel(p.url))
      );
      photoEmbedQueue.forEach((p, idx) => {
        const meta = fetched[idx];
        if (!meta) return;
        const imageId = workbook.addImage({ buffer: meta.buffer, extension: meta.extension });
        const c0 = p.colIdx - 1;     // 0-indexed column
        const r0 = p.sheetRow - 1;   // 0-indexed row
        // Two-cell anchor: top-left inset inside the cell, bottom-right at the
        // cell edge. Barcode is a short strip so it only spans the upper half
        // of the row; product / comment photos fill the whole cell.
        ws.addImage(imageId, {
          tl: { col: c0 + 0.08, row: r0 + 0.06 },
          br: { col: p.colIdx, row: p.kind === 'barcode' ? r0 + 0.5 : p.sheetRow },
          editAs: 'oneCell',
        });
      });

      const buf = await workbook.xlsx.writeBuffer();
      const filename = `${order.orderNumber || order.fileNumber || 'Order'}_Sheet.xlsx`;
      saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
      toast.success('Workbook downloaded', { id: toastId });
    } catch (err) {
      console.error('Excel export failed', err);
      toast.error('Excel export failed — see console', { id: toastId });
    }

    setShowExcelModal(false);
  };


  // ── Print (uses the SAME selected columns as Excel) ─────────────────
  const handlePrintSheet = () => {
    if (!order || !order.items) return;

    const selectedCols = excelColumns.filter((c) => c.selected && hasColumnData(c.key));
    if (selectedCols.length === 0) {
      toast.error('Please select at least one column');
      return;
    }
    const { rows } = buildSheetData(selectedCols);

    const esc = (s) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const abs = (u) => {
      if (!u) return '';
      if (/^https?:/i.test(u)) return u;
      const baseUrl = import.meta.env.VITE_UPLOAD_URL ? import.meta.env.VITE_UPLOAD_URL.replace(/\/uploads$/, '') : window.location.origin;
      return `${baseUrl}${u.startsWith('/') ? u : `/${u}`}`;
    };

    const isNumericKey = (k) =>
      k === 'qty' || k === 'price' || k === 'total' || k === 'cbm' ||
      k === 'cbmTotal' || k === 'weight' || k === 'srNo';
    const currency = order.currency || 'USD';
    const symbol = getCurrencySymbol(currency);
    const fmtMoney = (n) =>
      (typeof n === 'number' ? n : parseFloat(n) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const fmtNum = (n, digits = 3) => {
      const v = typeof n === 'number' ? n : parseFloat(n);
      return isNaN(v) ? '' : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    };

    // Build table header — double row only for `size` which splits into L/W/H
    const needsSubHeader = selectedCols.some((c) => c.key === 'size');
    const thRow1 = selectedCols
      .map((c) => {
        if (c.key === 'size') return `<th colspan="3">Size</th>`;
        return `<th${needsSubHeader ? ' rowspan="2"' : ''}>${esc(c.label)}</th>`;
      })
      .join('');
    const thRow2 = needsSubHeader
      ? selectedCols
          .map((c) => (c.key === 'size' ? `<th>L</th><th>W</th><th>H</th>` : ''))
          .join('')
      : '';

    // Build table rows
    const tr = rows
      .map((row) => {
        const cells = selectedCols
          .map((c) => {
            const v = row[c.key];
            if (c.key === 'size') {
              return `<td class="num">${esc(v?.l)}</td><td class="num">${esc(v?.w)}</td><td class="num">${esc(v?.h)}</td>`;
            }
            if (c.key === 'photo') {
              return v
                ? `<td class="photo"><img src="${abs(v)}" alt="" /></td>`
                : `<td class="photo">—</td>`;
            }
            if (c.key === 'addPhotos') {
              const imgs = v || [];
              if (!imgs.length) return `<td class="photo">—</td>`;
              return `<td class="photo">${imgs
                .slice(0, 4)
                .map((u) => `<img src="${abs(u)}" alt="" />`)
                .join('')}</td>`;
            }
            if (c.key === 'price' || c.key === 'total') {
              return `<td class="num">${symbol}${fmtMoney(v)}</td>`;
            }
            if (c.key === 'cbm' || c.key === 'cbmTotal') {
              return `<td class="num">${fmtNum(v)}</td>`;
            }
            if (c.key === 'weight') {
              return `<td class="num">${fmtNum(v, 2)}</td>`;
            }
            if (isNumericKey(c.key)) {
              return `<td class="num">${esc(v)}</td>`;
            }
            if (c.key === 'itemName' || c.key === 'buyerDescription' || c.key === 'materials' || c.key === 'finishes' || c.key === 'comments' || c.key === 'productionNotes' || c.key === 'qcNotes' || c.key === 'polishNotes' || c.key === 'packagingNotes') {
              return `<td class="wrap">${esc(v)}</td>`;
            }
            if (c.key === 'skuNo' || c.key === 'buyerSKU' || c.key === 'hsnCode' || c.key === 'barcode') {
              return `<td class="mono">${esc(v)}</td>`;
            }
            return `<td>${esc(v)}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    // tfoot totals row — one cell spanning the non-numeric columns, then
    // each numeric column gets its own summed total.
    const totalsByKey = {
      qty: order.items.reduce((s, i) => s + (i.quantity || 0), 0),
      price: null,
      total: order.items.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0),
      cbm: null,
      // Per-unit values multiplied by line quantity — default qty to 1 so a
      // missing quantity doesn't zero out the contribution.
      cbmTotal: order.items.reduce(
        (s, i) => s + (i.cbm || 0) * (i.quantity || 1),
        0
      ),
      weight: order.items.reduce(
        (s, i) => s + (i.weight || 0) * (i.quantity || 1),
        0
      ),
    };
    // Find the index of the first numeric column so the label spans the
    // non-numeric ones.
    const firstNumericIdx = selectedCols.findIndex((c) =>
      ['qty', 'price', 'total', 'cbm', 'cbmTotal', 'weight'].includes(c.key)
    );
    const totalQtyVal = totalsByKey.qty;
    const totalAmountVal = totalsByKey.total;
    let tfoot = '';
    if (firstNumericIdx > 0) {
      // How many real columns come before the first numeric (taking size's
      // 3 sub-columns into account).
      let leadingCols = 0;
      for (let i = 0; i < firstNumericIdx; i++) {
        leadingCols += selectedCols[i].key === 'size' ? 3 : 1;
      }
      const tailCells = selectedCols
        .slice(firstNumericIdx)
        .map((c) => {
          if (c.key === 'qty') return `<td class="num">${totalsByKey.qty}</td>`;
          if (c.key === 'total')
            return `<td class="num">${symbol}${fmtMoney(totalsByKey.total)}</td>`;
          if (c.key === 'cbmTotal')
            return `<td class="num">${fmtNum(totalsByKey.cbmTotal)}</td>`;
          if (c.key === 'weight')
            return `<td class="num">${fmtNum(totalsByKey.weight, 2)}</td>`;
          if (c.key === 'size') return `<td></td><td></td><td></td>`;
          return `<td></td>`;
        })
        .join('');
      tfoot = `
      <tfoot>
        <tr>
          <td colspan="${leadingCols}" class="tfoot-label">TOTAL</td>
          ${tailCells}
        </tr>
      </tfoot>`;
    }

    // Total visual column count after size splits — used to pick a density.
    const flatColCount = selectedCols.reduce((s, c) => s + (c.key === 'size' ? 3 : 1), 0);
    // Three density tiers: roomy, compact, dense. Larger selections must
    // shrink so they don't overflow A4 landscape.
    const density =
      flatColCount <= 10 ? 'roomy' :
      flatColCount <= 16 ? 'compact' : 'dense';
    const fontSizes = {
      roomy:   { table: '8.5pt', th: '7pt',   td: '8.5pt', cellPad: '7px 6px', photoSize: 64 },
      compact: { table: '7.5pt', th: '6.5pt', td: '7.5pt', cellPad: '5px 4px', photoSize: 52 },
      dense:   { table: '6.5pt', th: '6pt',   td: '6.5pt', cellPad: '3px 3px', photoSize: 44 },
    }[density];

    const w = window.open('', '_blank');
    w.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>Order ${esc(order.orderNumber || '')} — ${esc(order.customer?.companyName || '')}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      /* Force colors and backgrounds to print on every element. Without
         this, most browsers strip background-color and background-image
         from printed output to "save ink" — even when "Background graphics"
         is enabled in the dialog. */
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      font-size: ${fontSizes.table};
      color: #1f2937;
      background: #f5f5f5;
    }
    .sheet {
      width: 297mm;
      min-height: 210mm;
      margin: 0 auto;
      padding: 12mm 12mm;
      background: #ffffff;
      box-shadow: 0 2px 14px rgba(0,0,0,0.08);
    }
    .hdr {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10px;
      margin-bottom: 14px;
      border-bottom: 2px solid #a86820;
    }
    .hdr h1 {
      font-size: 20pt;
      font-weight: 800;
      color: #a86820;
      letter-spacing: -0.3px;
    }
    .hdr .tag {
      font-size: 7.5pt;
      color: #8b6f4e;
      letter-spacing: 1.3px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .hdr .addr {
      font-size: 8pt;
      color: #6b7280;
      margin-top: 4px;
    }
    .doc {
      text-align: right;
    }
    .doc .label {
      display: inline-block;
      background: #a86820;
      color: #fff;
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 1.5px;
      padding: 4px 12px;
      border-radius: 2px;
    }
    .doc .meta {
      font-size: 8pt;
      color: #4b5563;
      margin-top: 6px;
      line-height: 1.5;
    }
    .doc .meta strong { color: #1f2937; }

    .buyer {
      background: #fdf8f3;
      border: 1px solid #ead9c2;
      border-left: 4px solid #c4822a;
      padding: 8px 12px;
      margin-bottom: 12px;
      border-radius: 2px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .buyer .name { font-size: 11pt; font-weight: 700; color: #1f2937; }
    .buyer .sub { font-size: 8pt; color: #6b7280; margin-top: 2px; }

    table.data {
      width: 100%;
      border-collapse: collapse;
      font-size: ${fontSizes.td};
      table-layout: auto;
    }
    table.data thead th {
      background: #a86820;
      color: #ffffff;
      padding: ${fontSizes.cellPad};
      text-align: left;
      font-size: ${fontSizes.th};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-right: 1px solid #c4822a;
      vertical-align: middle;
    }
    table.data thead th:last-child { border-right: none; }
    table.data tbody td {
      padding: ${fontSizes.cellPad};
      border-bottom: 1px solid #f0e6d6;
      border-right: 1px solid #f0e6d6;
      vertical-align: middle;
      color: #1f2937;
      line-height: 1.4;
    }
    table.data tbody td:last-child { border-right: none; }
    table.data tbody tr:nth-child(even) td { background: #fdf8f3; }
    table.data tbody tr:hover td { background: #fef5e8; }
    table.data td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    table.data td.mono {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 8pt;
    }
    table.data td.wrap {
      white-space: normal;
      max-width: ${density === 'dense' ? '140px' : density === 'compact' ? '190px' : '260px'};
      line-height: 1.4;
    }
    table.data td.photo {
      text-align: center;
      padding: 4px;
      white-space: nowrap;
      background: #fdfaf5;
    }
    table.data td.photo img {
      width: ${fontSizes.photoSize}px;
      height: ${fontSizes.photoSize}px;
      object-fit: cover;
      border: 1px solid #ead9c2;
      border-radius: 3px;
      margin: 1px;
      display: inline-block;
    }
    table.data tfoot td {
      padding: 9px 6px;
      background: #fdf5e8;
      font-size: 9pt;
      font-weight: 700;
      color: #5b3a14;
      border-top: 2px solid #a86820;
      border-bottom: 1px solid #a86820;
      border-right: 1px solid #ead9c2;
    }
    table.data tfoot td:last-child { border-right: none; }
    table.data tfoot td.tfoot-label {
      text-align: right;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    table.data tfoot td.num { text-align: right; }

    .totals {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }
    .totals-box {
      min-width: 260px;
      border: 1px solid #ead9c2;
      border-radius: 2px;
      overflow: hidden;
    }
    .totals-box .row {
      display: flex;
      justify-content: space-between;
      padding: 5px 12px;
      font-size: 8.5pt;
      background: #fdf8f3;
      border-bottom: 1px solid #f0e6d6;
      color: #374151;
    }
    .totals-box .row.grand {
      background: #a86820;
      color: #ffffff;
      font-size: 10pt;
      font-weight: 700;
      border-bottom: none;
      padding: 7px 12px;
    }

    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #ead9c2;
      text-align: center;
      font-size: 7.5pt;
      color: #8b8580;
      letter-spacing: 0.3px;
    }

    @media print {
      html, body { background: #ffffff !important; }
      .sheet {
        width: auto;
        min-height: auto;
        box-shadow: none;
        padding: 8mm 10mm;
      }
      /* Re-assert exact color rendering on the elements that matter inside
         the print pipeline — some browsers honor it only when set per-element. */
      .hdr, .hdr h1, .doc .label, .buyer,
      table.data thead th,
      table.data tbody tr:nth-child(even) td,
      table.data td.photo, table.data tfoot td,
      .totals-box .row, .totals-box .row.grand {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      tr, td, th { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }

    @page { size: A4 landscape; margin: 10mm; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hdr">
      <div>
        <h1>SGH CRAFTS</h1>
        <div class="tag">Handcrafted Furniture &amp; Décor</div>
        <div class="addr">Jodhpur, Rajasthan, India &nbsp;·&nbsp; www.sghcrafts.com</div>
      </div>
      <div class="doc">
        <div class="label">ORDER SHEET</div>
        <div class="meta">
          <div>Order #: <strong>${esc(order.orderNumber || '—')}</strong></div>
          <div>File #: <strong>${esc(order.fileNumber || '—')}</strong></div>
          <div>Date: <strong>${esc(formatDate(order.orderDate))}</strong></div>
        </div>
      </div>
    </div>

    <div class="buyer">
      <div>
        <div class="name">${esc(order.customer?.companyName || '—')}</div>
        <div class="sub">${esc(order.customer?.country || '')}${
          order.buyerPONumber ? ` &nbsp;·&nbsp; Buyer PO: ${esc(order.buyerPONumber)}` : ''
        }</div>
      </div>
      <div class="sub">${esc(order.orderType || '')} &nbsp;·&nbsp; ${esc(currency)}</div>
    </div>

    <table class="data">
      <thead>
        <tr>${thRow1}</tr>
        ${needsSubHeader ? `<tr>${thRow2}</tr>` : ''}
      </thead>
      <tbody>${tr}</tbody>
      ${tfoot}
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="row"><span>Lines</span><span>${order.items.length}</span></div>
        <div class="row"><span>Total Qty</span><span>${totalQtyVal}</span></div>
        <div class="row"><span>Total CBM</span><span>${formatCBM(order.totalCBM)}</span></div>
        <div class="row grand"><span>GRAND TOTAL</span><span>${esc(symbol)}${totalAmountVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      </div>
    </div>

    <div class="footer">
      Printed ${esc(formatDate(new Date()))} &nbsp;·&nbsp; SGH Crafts ERP
    </div>
  </div>
</body>
</html>
    `);
    w.document.close();
    w.focus();
    // Give images a moment to load before invoking print
    setTimeout(() => { try { w.print(); } catch {} }, 700);
    setShowExcelModal(false);
  };

  if (loading) return <PageLoader message="Loading order..." />;
  if (!order) return null;

  const isCancelled = order.orderStatus === 'Cancelled';
  const isCompleted = order.orderStatus === 'Completed';
  const isFinalized = order.orderStatus === 'Finalized';
  const totalQty = order.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0;
  const currencySymbol = getCurrencySymbol(order.currency);

  const tabs = [
    { id: 'items', label: `Items (${order.items?.length || 0})`, icon: Package },
    { id: 'comments', label: `Comments (${order.comments?.length || 0})`, icon: MessageSquare },
    { id: 'documents', label: `Docs (${order.attachments?.length || 0})`, icon: Paperclip },
    ...(order.revisionHistory?.length > 0
      ? [{ id: 'revisions', label: `Revisions (${order.revisionHistory.length})`, icon: Edit2 }]
      : []),
  ];

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button onClick={() => navigate('/office/orders')} className="btn-ghost btn p-2 mt-0.5 flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono font-bold text-brand-700 text-sm bg-brand-50 px-2.5 py-1 rounded">
                {order.orderNumber}
              </span>
              <StatusBadge status={order.orderStatus} />
              <OrderTypeBadge type={order.orderType} />
              {order.revisionNumber > 0 && (
                <span className="text-[11px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                  v{order.revisionNumber}
                </span>
              )}
            </div>
            {/* Show File Number — NOT buyer name */}
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 break-words">
              File: <span className="font-mono text-brand-700">{order.fileNumber}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(order.orderDate)}
              {order.proformaInvoiceNumber && (
                <> · PI: <span className="font-mono text-brand-600">{order.proformaInvoiceNumber}</span></>
              )}
            </p>
          </div>
        </div>

        {/* Action row wraps on narrow screens so nothing is pushed off-page */}
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {can('production', 'update') && !isCompleted && order.items?.length > 0 && (() => {
            const orderPriority = order.items.every((it) => it.production?.priority);
            return (
              <button
                onClick={async () => {
                  try { await productionAPI.setOrderFlags(order._id, { priority: !orderPriority }); fetchOrder(); } catch { /* toasted */ }
                }}
                className={`btn text-sm ${orderPriority ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'btn-secondary'}`}
                title="Mark this whole order as priority"
              >
                <Star size={15} className={orderPriority ? 'fill-amber-400 text-amber-500' : ''} />
                {orderPriority ? 'Priority order' : 'Mark priority'}
              </button>
            );
          })()}

          {can('orders', 'delete') && !isCompleted && (
            <button onClick={handleDeleteOrder} className="btn-secondary btn p-2 text-red-600 hover:bg-red-50" title="Delete Order">
              <Trash2 size={16} />
            </button>
          )}

          <button onClick={() => setShowExcelModal(true)} className="btn-secondary btn text-sm">
            <FileDown size={15} /> Export / Print
          </button>

          <button onClick={() => setShowPIPickerModal(true)} className="btn-secondary btn text-sm">
            <FileDown size={15} /> Proforma Invoice
          </button>

          {isFinalized && can('orders', 'update') && (
            <button onClick={handleStartProcessing} className="btn-primary btn text-sm bg-emerald-600 hover:bg-emerald-700">
              Start Processing
            </button>
          )}

          {/* Change Status menu.
              Employees: forward-only, hidden once terminal (Completed/Cancelled).
              Admin: bidirectional at any time, including reversing terminal
              states — backend enforces the same rule server-side. */}
          {can('orders', 'update') && !isCompleted && (isAdmin() || (!isCancelled && !isFinalized)) && (
            <div className="relative" ref={statusMenuRef}>
              <button onClick={() => setShowStatusMenu(!showStatusMenu)} className="btn-secondary btn text-sm">
                Change Status <ChevronDown size={13} />
              </button>
              {showStatusMenu && (() => {
                const currentIdx = ORDER_STATUSES.indexOf(order.orderStatus);
                const forwardStatuses = ORDER_STATUSES.filter((_, i) => i > currentIdx);
                const backwardStatuses = isAdmin()
                  ? ORDER_STATUSES.filter((_, i) => i >= 0 && i < currentIdx)
                  : [];
                return (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-card-hover border border-brand-100 py-1.5 z-20">
                    {forwardStatuses.length > 0 && (
                      <>
                        <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                          Move forward
                        </p>
                        {forwardStatuses.map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            className="w-full text-left flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-brand-50 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </>
                    )}
                    {backwardStatuses.length > 0 && (
                      <>
                        <div className="h-px bg-brand-50 my-1" />
                        <p className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wider text-amber-600 font-semibold">
                          Revert (Admin only)
                        </p>
                        {backwardStatuses.slice().reverse().map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            className="w-full text-left flex items-center justify-between px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </>
                    )}
                    {forwardStatuses.length === 0 && backwardStatuses.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-400">No status changes available</p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {!isCancelled && !isCompleted && can('orders', 'update') && (
            <button onClick={() => navigate(`/office/orders/${id}/edit`)} className="btn-primary btn text-sm">
              <Edit2 size={14} /> Edit
            </button>
          )}

          {!isCancelled && !isCompleted && can('orders', 'update') && (
            <button onClick={() => setShowCancelDialog(true)} className="btn-danger btn text-sm">
              <XCircle size={15} /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: 'Order Date', value: formatDate(order.orderDate) },
          { label: 'Items', value: `${order.items?.length || 0} SKUs` },
          { label: 'Total Qty', value: totalQty },
          { label: 'Total CBM', value: formatCBM(order.totalCBM) },
          { label: 'Final Amount', value: formatCurrency(order.finalAmount, order.currency) },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <p className="text-base sm:text-lg font-bold text-gray-900 break-words">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Advance Payment info */}
      {order.advanceReceived && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-3">
          <Check size={16} className="text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-800">
            <span className="font-semibold">Advance received:</span> {formatCurrency(order.advanceAmount, order.currency)}
            {order.advanceReceivedAt && ` on ${formatDate(order.advanceReceivedAt)}`}
          </p>
        </div>
      )}

      {/* Cancellation notice */}
      {isCancelled && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Order Cancelled</p>
            {order.cancellationReason && <p className="text-sm text-red-600 mt-0.5">Reason: {order.cancellationReason}</p>}
            <p className="text-xs text-red-400 mt-0.5">{formatDateTime(order.cancelledAt)}</p>
          </div>
        </div>
      )}

      {/* Order Info & Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="card">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Order Details</h3>
          <InfoRow label="Order Date" value={formatDate(order.orderDate)} />
          <InfoRow label="Expected Delivery" value={formatDate(order.expectedDeliveryDate)} />
          <InfoRow label="PI Number" value={order.proformaInvoiceNumber} mono />
          <InfoRow label="Buyer PO#" value={order.buyerPONumber} mono />
          <InfoRow label="Currency" value={order.currency} />
          <InfoRow label="Container Size" value={order.containerSize} />
          <InfoRow label="Container #" value={order.containerNumber} mono />
          <InfoRow label="Special Instructions" value={order.specialInstructions} />
        </div>

        <div className="card">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Totals</h3>
          <InfoRow label="Total CBM" value={formatCBM(order.totalCBM)} />
          <InfoRow label="Total Weight" value={formatWeight(order.totalWeight)} />
          <div className="py-2.5 flex items-center justify-between border-t border-brand-100 mt-1">
            <span className="text-sm font-bold text-gray-800">Final Amount</span>
            <span className="text-base font-bold text-brand-700">
              {formatCurrency(order.finalAmount, order.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="space-y-4">
          {/* Tabs */}
          <div className="border-b border-brand-100">
            <div className="flex gap-1 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors
                    ${activeTab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  <t.icon size={13} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Items tab */}
          {activeTab === 'items' && (() => {
            const items = order.items || [];
            const any = (fn) => items.some(fn);

            // Only show columns that have data in at least one item
            const has = {
              media:           any((i) => i.images?.length > 0),
              buyerSKU:        any((i) => i.buyerSKU),
              description:     any((i) => i.itemDescription || i.buyerDescription),
              category:        any((i) => i.itemCategory),
              collection:      any((i) => i.collectionName),
              materials:       any((i) => (i.materials?.length > 0) || i.material),
              finishes:        any((i) => (i.finishes?.length > 0) || i.finish),
              condition:       any((i) => i.itemCondition),
              hsnCode:         any((i) => i.hsnCode),
              dimensions:      any((i) => i.dimensions?.length || i.dimensions?.width || i.dimensions?.height),
              cbm:             any((i) => i.cbm),
              cbmTotal:        any((i) => i.totalCBM || (i.cbm && i.quantity)),
              weight:          any((i) => i.weight),
              barcode:         any((i) => i.barcode?.text || i.barcode?.image),
              productionNotes: any((i) => i.productionNotes),
              qcNotes:         any((i) => i.qcNotes),
              polishNotes:     any((i) => i.polishNotes),
              packagingNotes:  any((i) => i.packagingNotes),
              comments:        any((i) => i.comments?.length > 0),
            };

            // Count leading columns (before Qty) for tfoot colspan
            const leadingCount = 2 // # + Company SKU (always shown)
              + (has.media ? 1 : 0)
              + (has.buyerSKU ? 1 : 0)
              + (has.description ? 1 : 0)
              + (has.category ? 1 : 0)
              + (has.collection ? 1 : 0)
              + (has.materials ? 1 : 0)
              + (has.finishes ? 1 : 0)
              + (has.condition ? 1 : 0)
              + (has.hsnCode ? 1 : 0)
              + (has.dimensions ? 2 : 0) // Dimensions + Unit
              + (has.cbm ? 1 : 0)
              + (has.weight ? 1 : 0);
            const trailingCount = 0
              + (has.cbmTotal ? 1 : 0) // Total CBM shown after Line Total
              + (has.barcode ? 1 : 0)
              + (has.productionNotes ? 1 : 0)
              + (has.qcNotes ? 1 : 0)
              + (has.polishNotes ? 1 : 0)
              + (has.packagingNotes ? 1 : 0)
              + (has.comments ? 1 : 0);

            return (
              <div className="card p-0 overflow-hidden">
                {items.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No items in this order</p>
                ) : (
                  <>
                  {/* Desktop: the full column grid. Phones get the card list below. */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="text-xs border-collapse border border-brand-100" style={{ tableLayout: 'fixed' }}>
                      <thead className="bg-brand-50 text-brand-700">
                        <tr>
                          <th style={{ width: '40px', minWidth: '40px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">#</th>
                          {has.media && <th style={{ width: '140px', minWidth: '140px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Image</th>}
                          <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Company SKU</th>
                          {has.buyerSKU && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Buyer SKU</th>}
                          {has.description && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Item Description</th>}
                          {has.category && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Category</th>}
                          {has.collection && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Collection</th>}
                          {has.materials && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Materials</th>}
                          {has.finishes && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Finishes</th>}
                          {has.condition && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Condition</th>}
                          {has.hsnCode && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">HSN Code</th>}
                          {has.dimensions && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Dimensions</th>}
                          {has.dimensions && <th style={{ width: '70px', minWidth: '70px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Unit</th>}
                          {has.cbm && <th style={{ width: '80px', minWidth: '80px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">CBM</th>}
                          {has.weight && <th style={{ width: '80px', minWidth: '80px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Wt (kg)</th>}
                          <th style={{ width: '80px', minWidth: '80px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Qty</th>
                          <th style={{ width: '100px', minWidth: '100px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Unit Price</th>
                          {has.cbmTotal && <th style={{ width: '100px', minWidth: '100px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Total CBM</th>}
                          <th style={{ width: '100px', minWidth: '100px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Line Total</th>
                          {has.barcode && <th style={{ width: '140px', minWidth: '140px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Barcode</th>}
                          {has.productionNotes && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Production Notes</th>}
                          {has.qcNotes && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">QC Notes</th>}
                          {has.polishNotes && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Polish Notes</th>}
                          {has.packagingNotes && <th style={{ width: '120px', minWidth: '120px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Packaging Notes</th>}
                          {has.comments && <th style={{ width: '160px', minWidth: '160px' }} className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap">Comments</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={item._id} style={{ height: '120px' }} className="hover:bg-brand-50/30">
                            <td className="border border-brand-100 px-2 text-gray-400 text-xs align-top" style={{ height: '120px' }}>{idx + 1}</td>
                            {has.media && (
                              <td className="border border-brand-100 align-top" style={{ height: '120px' }}>
                                <div className="flex items-center gap-1.5 px-1.5 py-1.5 h-full">
                                  {item.images?.slice(0, 2).map((img, imgIdx) => (
                                    <div
                                      key={imgIdx}
                                      className="relative shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                      style={{ width: '110px', height: '110px' }}
                                      onClick={() => {
                                        setViewerImages({ images: item.images, title: `Images — ${item.companySKU || item.skuNumber || ''}`, startIndex: imgIdx, itemId: item._id });
                                        setActiveImageIndex(imgIdx);
                                      }}
                                    >
                                      <img src={resolveMediaSrc(img)} alt="Item" onError={imgErrorFallback} className={`w-full h-full object-cover rounded border-2 ${item.primaryImage === img ? 'border-brand-500 ring-2 ring-brand-200' : 'border-gray-200'}`} />
                                      {item.primaryImage === img && <div className="absolute -top-1 -right-1"><Star size={10} className="text-amber-500 fill-amber-500" /></div>}
                                    </div>
                                  ))}
                                  {item.images?.length > 2 && (
                                    <span
                                      className="flex items-center justify-center shrink-0 bg-brand-50 border-2 border-brand-200 rounded text-brand-700 font-bold text-sm cursor-pointer hover:bg-brand-100 transition-colors"
                                      style={{ width: '50px', height: '110px' }}
                                      onClick={() => {
                                        setViewerImages({ images: item.images, title: `Images — ${item.companySKU || item.skuNumber || ''}`, startIndex: 0, itemId: item._id });
                                        setActiveImageIndex(0);
                                      }}
                                    >
                                      +{item.images.length - 2}
                                    </span>
                                  )}
                                  {(!item.images || item.images.length === 0) && <span className="text-xs text-gray-300">—</span>}
                                </div>
                              </td>
                            )}
                            <td className="border border-brand-100 px-2 align-top" style={{ height: '120px' }}>
                              <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                                {item.companySKU || item.skuNumber}
                              </span>
                            </td>
                            {has.buyerSKU && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-600 font-mono align-top" style={{ height: '120px' }}>{item.buyerSKU || '—'}</td>
                            )}
                            {has.description && (
                              <td className="border border-brand-100 px-2 align-top overflow-hidden" style={{ height: '120px' }}>
                                <p className="font-medium text-gray-800 text-xs">{item.itemDescription || '—'}</p>
                                {item.buyerDescription && <p className="text-[11px] text-gray-400 mt-0.5">{item.buyerDescription}</p>}
                              </td>
                            )}
                            {has.category && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-600 align-top" style={{ height: '120px' }}>{item.itemCategory || '—'}</td>
                            )}
                            {has.collection && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-600 align-top" style={{ height: '120px' }}>{item.collectionName || '—'}</td>
                            )}
                            {has.materials && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-600 align-top" style={{ height: '120px' }}>
                                {(item.materials?.length > 0 ? item.materials : (item.material ? [item.material] : [])).map((m, i) => (
                                  <span key={i} className="inline-block bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] mr-1 mb-0.5">{m}</span>
                                ))}
                                {(!item.materials?.length && !item.material) && '—'}
                              </td>
                            )}
                            {has.finishes && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-600 align-top" style={{ height: '120px' }}>
                                {(item.finishes?.length > 0 ? item.finishes : (item.finish ? [item.finish] : [])).map((f, i) => (
                                  <span key={i} className="inline-block bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] mr-1 mb-0.5">{f}</span>
                                ))}
                                {(!item.finishes?.length && !item.finish) && '—'}
                              </td>
                            )}
                            {has.condition && (
                              <td className="border border-brand-100 px-2 align-top" style={{ height: '120px' }}>
                                {item.itemCondition ? (
                                  <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{item.itemCondition}</span>
                                ) : '—'}
                              </td>
                            )}
                            {has.hsnCode && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-500 font-mono align-top" style={{ height: '120px' }}>{item.hsnCode || '—'}</td>
                            )}
                            {has.dimensions && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-500 align-top" style={{ height: '120px' }}>
                                {item.dimensions?.length ? `${item.dimensions.length}×${item.dimensions.width}×${item.dimensions.height}` : '—'}
                              </td>
                            )}
                            {has.dimensions && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-500 align-top" style={{ height: '120px' }}>{item.dimensions?.unit || 'cm'}</td>
                            )}
                            {has.cbm && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-500 align-top" style={{ height: '120px' }}>
                                {item.cbm ? `${Number(item.cbm).toFixed(3)} m³` : '—'}
                              </td>
                            )}
                            {has.weight && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-500 align-top" style={{ height: '120px' }}>
                                {item.weight ? Number(item.weight).toFixed(2) : '—'}
                              </td>
                            )}
                            <td className="border border-brand-100 px-2 font-semibold text-gray-800 align-top" style={{ height: '120px' }}>{item.quantity}</td>
                            <td className="border border-brand-100 px-2 text-gray-700 align-top" style={{ height: '120px' }}>
                              {currencySymbol}{parseFloat(item.unitPrice || 0).toFixed(2)}
                            </td>
                            {has.cbmTotal && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-500 align-top" style={{ height: '120px' }}>
                                {item.totalCBM ? `${item.totalCBM.toFixed(3)} m³` : ((item.cbm && item.quantity) ? `${(item.cbm * item.quantity).toFixed(3)} m³` : '—')}
                              </td>
                            )}
                            <td className="border border-brand-100 px-2 font-bold text-gray-900 align-top" style={{ height: '120px' }}>
                              {currencySymbol}{parseFloat(item.totalPrice || 0).toFixed(2)}
                            </td>
                            {has.barcode && (
                              <td className="border border-brand-100 align-top" style={{ height: '120px' }}>
                                <div className="flex flex-col gap-1 px-1.5 py-1.5 h-full">
                                  {item.barcode?.text && <span className="font-mono text-gray-600 text-[11px]">{item.barcode.text}</span>}
                                  {item.barcode?.image && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewerImages({ images: [item.barcode.image], title: `Barcode — ${item.companySKU || item.skuNumber || ''}`, startIndex: 0 });
                                        setActiveImageIndex(0);
                                      }}
                                      className="group relative rounded overflow-hidden bg-gray-100 border-2 border-brand-200 hover:border-brand-500 transition-colors shrink-0"
                                      style={{ width: '110px', height: '110px' }}
                                      title="Preview barcode"
                                    >
                                      <img
                                        src={resolveMediaSrc(item.barcode.image)}
                                        alt="Barcode"
                                        className="w-full h-full object-cover"
                                        onError={imgErrorFallback}
                                      />
                                      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <ZoomIn size={18} className="text-white" />
                                      </span>
                                    </button>
                                  )}
                                  {!item.barcode?.text && !item.barcode?.image && <span className="text-xs text-gray-300">—</span>}
                                </div>
                              </td>
                            )}
                            {has.productionNotes && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-600 align-top whitespace-normal overflow-hidden" style={{ height: '120px' }}>{item.productionNotes || '—'}</td>
                            )}
                            {has.qcNotes && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-600 align-top whitespace-normal overflow-hidden" style={{ height: '120px' }}>{item.qcNotes || '—'}</td>
                            )}
                            {has.polishNotes && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-600 align-top whitespace-normal overflow-hidden" style={{ height: '120px' }}>{item.polishNotes || '—'}</td>
                            )}
                            {has.packagingNotes && (
                              <td className="border border-brand-100 px-2 text-xs text-gray-600 align-top whitespace-normal overflow-hidden" style={{ height: '120px' }}>{item.packagingNotes || '—'}</td>
                            )}
                            {has.comments && (
                              <td className="border border-brand-100 align-top" style={{ height: '120px' }}>
                                <div className="flex flex-col gap-1 px-1.5 py-1.5 h-full">
                                  {/* Text — show latest text comment */}
                                  {(() => {
                                    const lastText = [...(item.comments || [])].reverse().find((c) => c.text);
                                    return lastText ? <p className="text-sm font-bold text-gray-800">{lastText.text}</p> : null;
                                  })()}
                                  {/* Image — show latest comment image, click to open viewer */}
                                  {(() => {
                                    const allImages = (item.comments || []).flatMap((c) => c.images || []);
                                    if (allImages.length > 0) {
                                      const lastImg = allImages[allImages.length - 1];
                                      return (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setViewerImages({ images: allImages, title: `Comment images — ${item.companySKU || item.skuNumber || ''}`, startIndex: allImages.length - 1 });
                                            setActiveImageIndex(allImages.length - 1);
                                          }}
                                          className="group relative rounded overflow-hidden bg-gray-100 border-2 border-brand-200 hover:border-brand-500 transition-colors shrink-0"
                                          style={{ width: '110px', height: '110px' }}
                                          title="Preview image"
                                        >
                                          <img
                                            src={resolveMediaSrc(lastImg)}
                                            alt="Comment"
                                            className="w-full h-full object-cover"
                                            onError={imgErrorFallback}
                                          />
                                          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <ZoomIn size={18} className="text-white" />
                                          </span>
                                          {allImages.length > 1 && (
                                            <span className="absolute bottom-1 right-1 text-[10px] font-bold bg-brand-600 text-white px-1.5 py-0.5 rounded">
                                              {allImages.length} pics
                                            </span>
                                          )}
                                        </button>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {(!item.comments || item.comments.length === 0) && <span className="text-xs text-gray-300">—</span>}
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-brand-50">
                          <td colSpan={leadingCount} className="px-4 py-3 text-xs font-semibold text-gray-500 text-right border border-brand-100">TOTALS</td>
                          <td className="px-4 py-3 font-bold text-gray-800 border border-brand-100">{totalQty}</td>
                          <td className="border border-brand-100" />
                          {has.cbmTotal && <td className="px-4 py-3 text-xs font-bold text-gray-600 border border-brand-100">{formatCBM(order.totalCBM)}</td>}
                          <td className="px-4 py-3 font-bold text-brand-700 border border-brand-100">{formatCurrency(order.totalAmount, order.currency)}</td>
                          {trailingCount > 0 && <td colSpan={trailingCount} className="border border-brand-100" />}
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile: one card per item, same image viewer handlers */}
                  <div className="md:hidden space-y-2 p-3 bg-gray-50/60">
                    {items.map((item, idx) => {
                      const commentImages = (item.comments || []).flatMap((c) => c.images || []);
                      const lastComment = [...(item.comments || [])].reverse().find((c) => c.text);
                      return (
                        <div key={item._id} className="bg-white border border-brand-100 rounded-xl p-3 shadow-sm">
                          <div className="flex items-start gap-3">
                            {item.images?.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewerImages({ images: item.images, title: `Images — ${item.companySKU || item.skuNumber || ''}`, startIndex: 0, itemId: item._id });
                                  setActiveImageIndex(0);
                                }}
                                className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-brand-100"
                              >
                                <img
                                  src={resolveMediaSrc(item.primaryImage || item.images[0])}
                                  alt="Item"
                                  onError={imgErrorFallback}
                                  className="w-full h-full object-cover"
                                />
                                {item.images.length > 1 && (
                                  <span className="absolute bottom-0.5 right-0.5 text-[9px] font-bold bg-brand-600 text-white px-1 rounded">
                                    +{item.images.length - 1}
                                  </span>
                                )}
                              </button>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded truncate min-w-0">
                                  {item.companySKU || item.skuNumber}
                                </span>
                                <span className="text-[11px] text-gray-400 flex-shrink-0">#{idx + 1}</span>
                              </div>
                              {item.itemDescription && (
                                <p className="text-xs font-medium text-gray-800 mt-1 break-words">{item.itemDescription}</p>
                              )}
                              {item.buyerSKU && (
                                <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">Buyer SKU: {item.buyerSKU}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                            <div className="min-w-0">
                              <p className="text-gray-400">Qty</p>
                              <p className="font-semibold text-gray-800">{item.quantity}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-gray-400">Unit Price</p>
                              <p className="font-medium text-gray-700 truncate">
                                {currencySymbol}{parseFloat(item.unitPrice || 0).toFixed(2)}
                              </p>
                            </div>
                            {item.dimensions?.length ? (
                              <div className="min-w-0">
                                <p className="text-gray-400">Dimensions</p>
                                <p className="text-gray-600 truncate">
                                  {item.dimensions.length}×{item.dimensions.width}×{item.dimensions.height} {item.dimensions.unit || 'cm'}
                                </p>
                              </div>
                            ) : null}
                            {item.cbm ? (
                              <div className="min-w-0">
                                <p className="text-gray-400">CBM</p>
                                <p className="text-gray-600 truncate">{Number(item.cbm).toFixed(3)} m³</p>
                              </div>
                            ) : null}
                            <div className="min-w-0">
                              <p className="text-gray-400">Line Total</p>
                              <p className="font-bold text-brand-700 truncate">
                                {currencySymbol}{parseFloat(item.totalPrice || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {(lastComment || commentImages.length > 0 || item.barcode?.image) && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-brand-50">
                              {lastComment && (
                                <p className="text-xs text-gray-600 w-full break-words">{lastComment.text}</p>
                              )}
                              {item.barcode?.image && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewerImages({ images: [item.barcode.image], title: `Barcode — ${item.companySKU || item.skuNumber || ''}`, startIndex: 0 });
                                    setActiveImageIndex(0);
                                  }}
                                  className="w-12 h-12 rounded border border-brand-200 overflow-hidden"
                                  title="Preview barcode"
                                >
                                  <img src={resolveMediaSrc(item.barcode.image)} alt="Barcode" onError={imgErrorFallback} className="w-full h-full object-cover" />
                                </button>
                              )}
                              {commentImages.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewerImages({ images: commentImages, title: `Comment images — ${item.companySKU || item.skuNumber || ''}`, startIndex: commentImages.length - 1 });
                                    setActiveImageIndex(commentImages.length - 1);
                                  }}
                                  className="relative w-12 h-12 rounded border border-brand-200 overflow-hidden"
                                  title="Preview image"
                                >
                                  <img src={resolveMediaSrc(commentImages[commentImages.length - 1])} alt="Comment" onError={imgErrorFallback} className="w-full h-full object-cover" />
                                  {commentImages.length > 1 && (
                                    <span className="absolute bottom-0 right-0 text-[9px] font-bold bg-brand-600 text-white px-1 rounded">
                                      {commentImages.length}
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Totals — mirrors the desktop tfoot */}
                    <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-gray-500 uppercase tracking-wide">Totals</span>
                      <span className="text-gray-700">Qty: <strong className="text-gray-900">{totalQty}</strong></span>
                      <span className="text-gray-700">CBM: <strong className="text-gray-900">{formatCBM(order.totalCBM)}</strong></span>
                      <span className="font-bold text-brand-700">{formatCurrency(order.totalAmount, order.currency)}</span>
                    </div>
                  </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Comments tab */}
          {activeTab === 'comments' && (
            <div className="card space-y-4">
              {/* Add comment */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }}
                    placeholder="Write a comment..."
                    className="input flex-1 min-w-0"
                  />
                  <PhotoPicker
                    multiple
                    variant="compact"
                    className="flex-shrink-0"
                    disabled={commentSending}
                    onFiles={(files) => setCommentPhotos((prev) => [...prev, ...Array.from(files)].slice(0, 10))}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={commentSending || (!commentText.trim() && commentPhotos.length === 0)}
                    className="btn-primary btn flex-shrink-0"
                  >
                    <Send size={14} />
                  </button>
                </div>

                {commentPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {commentPhotos.map((f, i) => (
                      <div key={i} className="relative">
                        <img src={URL.createObjectURL(f)} alt="" className="w-16 h-16 rounded object-cover border" />
                        <button
                          onClick={() => setCommentPhotos((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-red-500 flex items-center justify-center"
                          title="Remove"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* List comments */}
              {order.comments?.length === 0 || !order.comments ? (
                <p className="text-sm text-gray-400 text-center py-6">No comments yet</p>
              ) : (
                <div className="space-y-3">
                  {order.comments.map((c, i) => (
                    <div key={i} className="p-3 bg-brand-50 rounded-lg">
                      <p className="text-base font-bold text-gray-800 break-words">{c.text}</p>
                      {c.images?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {c.images.map((img, j) => (
                            <img key={j} src={resolveMediaSrc(img)} alt="" onError={imgErrorFallback} className="w-16 h-16 rounded object-cover border cursor-zoom-in" onClick={() => {
                              setViewerImages({ images: c.images, title: `Comment images`, startIndex: j });
                              setActiveImageIndex(j);
                            }} />
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1">
                        {c.createdByName || 'System'} · {timeAgo(c.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div className="section-divider" />
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Special Instructions (visible on PI)</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.specialInstructions || 'None'}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Internal Notes (not on PI)</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.internalNotes || 'None'}</p>
              </div>
            </div>
          )}

          {/* Documents tab */}
          {activeTab === 'documents' && (
            <div className="card">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Attached Documents</h3>
              {order.attachments?.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No documents attached</p>
              ) : (
                <div className="space-y-2">
                  {order.attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-brand-50 rounded-lg">
                      <Paperclip size={15} className="text-brand-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{att.fileName}</p>
                        <p className="text-[11px] text-gray-400">{formatDate(att.uploadedAt)}</p>
                      </div>
                      <a href={att.filePath} target="_blank" rel="noreferrer" className="btn-secondary btn btn-sm flex-shrink-0">View</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Revisions tab */}
          {activeTab === 'revisions' && (
            <div className="card">
              <h3 className="text-sm font-bold text-gray-800 mb-4">Revision History</h3>
              <div className="space-y-3">
                {order.revisionHistory?.map((rev) => (
                  <div key={rev.revisionNumber} className="p-3 bg-brand-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-brand-700">Revision v{rev.revisionNumber}</span>
                      <span className="text-xs text-gray-400">{timeAgo(rev.editedAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600">{rev.changeNote}</p>
                    <p className="text-xs text-gray-400 mt-1">by {rev.editedBy?.name || 'Unknown'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      {/* Cancel dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        title="Cancel Order"
        confirmLabel="Cancel Order"
        loading={cancelLoading}
      >
        <div className="mt-3">
          <label className="label label-required">Cancellation Reason</label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="input resize-none"
            rows={3}
            placeholder="Please explain why this order is being cancelled..."
          />
        </div>
      </ConfirmDialog>

      {/* PDF Preview */}
      {showPDF && (
        <Modal isOpen={showPDF} onClose={() => setShowPDF(false)} title="Proforma Invoice Preview" size="full">
          <ProformaInvoicePDF order={order} selectedColumns={piColumns.filter((c) => c.selected && hasColumnData(c.key))} />
        </Modal>
      )}

      {/* PI Column Picker Modal */}
      {showPIPickerModal && (() => {
        return (
          <Modal
            isOpen={showPIPickerModal}
            onClose={() => setShowPIPickerModal(false)}
            title="Proforma Invoice — Select Fields"
            size="md"
            footer={
              <>
                <button onClick={() => setShowPIPickerModal(false)} className="btn-secondary btn">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowPIPickerModal(false);
                    setShowPDF(true);
                  }}
                  className="btn-primary btn"
                  disabled={!availablePICols.some((c) => c.selected)}
                >
                  <Printer size={15} /> Generate Proforma Invoice
                </button>
              </>
            }
          >
            <div className="space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Select the fields you want to include in the Proforma Invoice.
                Only fields with data are shown.
              </p>

              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span className="font-semibold uppercase tracking-wider">
                  Columns ({availablePICols.filter((c) => c.selected).length}/{availablePICols.length})
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPIColumns(DEFAULT_PI_COLUMNS)}
                    className="text-brand-700 hover:text-brand-900 font-semibold"
                    title="Reset to default field selection (Sr.no, SKU, Item Description, Dimensions, Qty, Image, Comments)"
                  >
                    Defaults
                  </button>
                  <button
                    onClick={() =>
                      setPIColumns((prev) =>
                        prev.map((c) => (hasColumnData(c.key) ? { ...c, selected: true } : { ...c, selected: false }))
                      )
                    }
                    className="text-brand-600 hover:text-brand-800 font-semibold"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setPIColumns((prev) => prev.map((c) => ({ ...c, selected: false })))}
                    className="text-gray-400 hover:text-gray-600 font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="max-h-[56vh] overflow-y-auto p-4 border border-brand-100 rounded-xl bg-gray-50/50 space-y-4">
                {availablePICols.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">
                    No data available in this order yet.
                  </p>
                ) : (
                  Array.from(new Set(availablePICols.map((c) => c.group))).map((groupName) => {
                    const groupCols = availablePICols.filter((c) => c.group === groupName);
                    const allOn = groupCols.every((c) => c.selected);
                    return (
                      <div key={groupName}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                            {groupName}
                          </p>
                          <button
                            onClick={() =>
                              setPIColumns((prev) =>
                                prev.map((c) =>
                                  c.group === groupName && hasColumnData(c.key)
                                    ? { ...c, selected: !allOn }
                                    : c
                                )
                              )
                            }
                            className="text-[10px] font-semibold text-gray-400 hover:text-brand-600"
                          >
                            {allOn ? 'None' : 'All'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {groupCols.map((col) => {
                            const idx = piColumns.findIndex((c) => c.key === col.key);
                            return (
                              <label
                                key={col.key}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                  col.selected
                                    ? 'bg-brand-50 border-brand-300'
                                    : 'bg-white border-gray-200 hover:border-brand-200'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={col.selected}
                                  onChange={(e) => {
                                    const next = [...piColumns];
                                    next[idx] = { ...col, selected: e.target.checked };
                                    setPIColumns(next);
                                  }}
                                  className="w-4 h-4 text-brand-600 bg-white border-gray-300 rounded focus:ring-brand-500 cursor-pointer"
                                />
                                <span className="text-xs font-medium text-gray-700 select-none">
                                  {col.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Image Viewer (lightbox) — white-card popup style */}
      {(selectedImagesItem || viewerImages) && (() => {
        const rawImgs = viewerImages?.images || selectedImagesItem?.images || [];
        // Keep `imgs` index-aligned with `rawImgs` (no filter) so the active
        // index maps back to the original stored path for set-primary.
        const imgs = rawImgs.map((u) => resolveMediaSrc(u));
        const title =
          viewerImages?.title ||
          `Images — ${selectedImagesItem?.companySKU || selectedImagesItem?.skuNumber || ''}`;
        const startIdx = Math.min(
          (viewerImages?.startIndex ?? 0),
          Math.max(imgs.length - 1, 0),
        );
        const idx = Math.min(activeImageIndex, Math.max(imgs.length - 1, 0));
        const safeIdx = activeImageIndex === 0 && startIdx !== 0 && idx === 0 ? startIdx : idx;

        // Set-primary action — only for an item's own image set (the viewer
        // opened from the item images cell carries `itemId`).
        const itemId = viewerImages?.itemId || selectedImagesItem?._id;
        const viewerItem = itemId ? order?.items?.find((it) => it._id === itemId) : null;
        const currentRaw = rawImgs[safeIdx];
        const isPrimary = !!(viewerItem && currentRaw && viewerItem.primaryImage === currentRaw);
        const footer = viewerItem && currentRaw && can('orders', 'update') ? (
          <button
            type="button"
            onClick={() => handleSetPrimaryImage(itemId, currentRaw)}
            disabled={isPrimary || primaryImageSaving}
            className={isPrimary ? 'btn-secondary btn' : 'btn-primary btn'}
            title={isPrimary
              ? 'This image is the product photo used in the Proforma Invoice & Excel'
              : 'Use this image as the product photo in the Proforma Invoice & Excel'}
          >
            <Star
              size={14}
              className={isPrimary ? 'fill-amber-400 text-amber-400' : ''}
            />
            {isPrimary ? 'Primary Image' : 'Set as Primary Image'}
          </button>
        ) : null;

        return (
          <ImageLightbox
            images={imgs}
            index={safeIdx}
            title={title}
            footer={footer}
            onClose={() => {
              setSelectedImagesItem(null);
              setViewerImages(null);
              setActiveImageIndex(0);
            }}
            onChange={(i) => setActiveImageIndex(i)}
          />
        );
      })()}

      {/* Export / Print Modal */}
      {showExcelModal && (
        <Modal
          isOpen={showExcelModal}
          onClose={() => setShowExcelModal(false)}
          title="Export / Print Order Sheet"
          size="md"
          footer={
            <>
              <button onClick={() => setShowExcelModal(false)} className="btn-secondary btn">
                Cancel
              </button>
              <button
                onClick={handlePrintSheet}
                className="btn-secondary btn"
                disabled={!availableColumns.some((c) => c.selected)}
              >
                <Printer size={15} /> Print
              </button>
              <button
                onClick={handleExportExcel}
                className="btn-primary btn"
                disabled={!availableColumns.some((c) => c.selected)}
              >
                <FileDown size={15} /> Download Excel
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-xs text-gray-500 leading-relaxed">
              Tick the fields you want in the export. Only fields that actually
              contain data are shown. Your selection is used for <strong>both</strong> the
              Excel download and the print output.
            </p>

            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span className="font-semibold uppercase tracking-wider">
                Columns ({availableColumns.filter((c) => c.selected).length}/{availableColumns.length})
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setExcelColumns((prev) =>
                      prev.map((c) => (hasColumnData(c.key) ? { ...c, selected: true } : { ...c, selected: false }))
                    )
                  }
                  className="text-brand-600 hover:text-brand-800 font-semibold"
                >
                  Select all
                </button>
                <button
                  onClick={() =>
                    setExcelColumns((prev) => prev.map((c) => ({ ...c, selected: false })))
                  }
                  className="text-gray-400 hover:text-gray-600 font-semibold"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-[56vh] overflow-y-auto p-4 border border-brand-100 rounded-xl bg-gray-50/50 space-y-4">
              {availableColumns.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-4">
                  No data available in this order yet.
                </p>
              ) : (
                // Group the available columns by their `group` property so
                // users can scan by section (Identification · Description ·
                // Physical · Pricing · Media · Factory Notes).
                Array.from(new Set(availableColumns.map((c) => c.group))).map((groupName) => {
                  const groupCols = availableColumns.filter((c) => c.group === groupName);
                  const allOn = groupCols.every((c) => c.selected);
                  const anyOn = groupCols.some((c) => c.selected);
                  return (
                    <div key={groupName}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                          {groupName}
                        </p>
                        <button
                          onClick={() =>
                            setExcelColumns((prev) =>
                              prev.map((c) =>
                                c.group === groupName && hasColumnData(c.key)
                                  ? { ...c, selected: !allOn }
                                  : c
                              )
                            )
                          }
                          className="text-[10px] font-semibold text-gray-400 hover:text-brand-600"
                        >
                          {allOn ? 'None' : anyOn ? 'All' : 'All'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {groupCols.map((col) => {
                          const idx = excelColumns.findIndex((c) => c.key === col.key);
                          return (
                            <label
                              key={col.key}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                col.selected
                                  ? 'bg-brand-50 border-brand-300'
                                  : 'bg-white border-gray-200 hover:border-brand-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={col.selected}
                                onChange={(e) => {
                                  const next = [...excelColumns];
                                  next[idx] = { ...col, selected: e.target.checked };
                                  setExcelColumns(next);
                                }}
                                className="w-4 h-4 text-brand-600 bg-white border-gray-300 rounded focus:ring-brand-500 cursor-pointer"
                              />
                              <span className="text-xs font-medium text-gray-700 select-none">
                                {col.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
