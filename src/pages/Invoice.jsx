import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ProformaInvoicePDF from '../components/orders/ProformaInvoicePDF';
import { orderAPI } from '../utils/api';
import { PageLoader } from '../components/common/LoadingSpinner';
import './Invoice.css';
// Simple button component (Tailwind styled) since Button may not exist.
function SimpleButton({ children, onClick, className }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 bg-espresso-600 text-white rounded hover:bg-espresso-700 transition ${className}`}
    >
      {children}
    </button>
  );
}

// Column config – reuse the same structure as DEFAULT_PI_COLUMNS from OrderDetail.
const DEFAULT_PI_COLUMNS = [
  { key: 'srNo', label: '#', group: 'Identification' },
  { key: 'skuNo', label: 'Company SKU', group: 'Identification' },
  { key: 'buyerSKU', label: 'Buyer SKU', group: 'Identification' },
  { key: 'buyerName', label: 'Buyer Name', group: 'Identification' },
  { key: 'itemName', label: 'Item Description', group: 'Description' },
  { key: 'buyerDescription', label: 'Buyer Description', group: 'Description' },
  { key: 'category', label: 'Category', group: 'Description' },
  { key: 'collection', label: 'Collection', group: 'Description' },
  { key: 'materials', label: 'Materials', group: 'Description' },
  { key: 'finishes', label: 'Finishes', group: 'Description' },
  { key: 'condition', label: 'Condition', group: 'Description' },
  { key: 'hsnCode', label: 'HSN Code', group: 'Description' },
  { key: 'size', label: 'Dimensions', group: 'Physical' },
  { key: 'unit', label: 'Unit', group: 'Physical' },
  { key: 'cbm', label: 'CBM', group: 'Physical' },
  { key: 'cbmTotal', label: 'Total CBM', group: 'Physical' },
  { key: 'weight', label: 'Weight (kg)', group: 'Physical' },
  { key: 'qty', label: 'Qty.', group: 'Pricing' },
  { key: 'price', label: 'Unit Price', group: 'Pricing' },
  { key: 'total', label: 'Line Total', group: 'Pricing' },
  { key: 'photo', label: 'Photo', group: 'Media' },
  { key: 'barcode', label: 'Barcode', group: 'Media' },
  { key: 'productionNotes', label: 'Production Notes', group: 'Factory Notes' },
  { key: 'qcNotes', label: 'QC Notes', group: 'Factory Notes' },
  { key: 'polishNotes', label: 'Polish Notes', group: 'Factory Notes' },
  { key: 'packagingNotes', label: 'Packaging Notes', group: 'Factory Notes' },
  { key: 'comments', label: 'Comments', group: 'Factory Notes' },
];

export default function Invoice() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await orderAPI.getById(id);
        setOrder(res.data.data.order);
      } catch {
        // silently fail – parent will handle navigation
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const hasColumnData = (key) => {
    if (!order || !order.items) return false;
    const items = order.items;
    const any = (fn) => items.some(fn);
    switch (key) {
      case 'srNo':
        return items.length > 0;
      case 'buyerName':
        return !!(order.customer?.companyName || order.buyerName || order.buyer?.name);
      case 'skuNo':
        return any((i) => i.companySKU && typeof i.companySKU === 'string' && i.companySKU.trim() !== '');
      case 'buyerSKU':        return any((i) => i.buyerSKU && typeof i.buyerSKU === 'string' && i.buyerSKU.trim() !== '');
      case 'itemName':        return any((i) => i.itemDescription && typeof i.itemDescription === 'string' && i.itemDescription.trim() !== '');
      case 'buyerDescription':return any((i) => i.buyerDescription && typeof i.buyerDescription === 'string' && i.buyerDescription.trim() !== '');
      case 'category':        return any((i) => i.itemCategory && typeof i.itemCategory === 'string' && i.itemCategory.trim() !== '');
      case 'collection':      return any((i) => i.collectionName && typeof i.collectionName === 'string' && i.collectionName.trim() !== '');
      case 'materials':       return any((i) => (Array.isArray(i.materials) && i.materials.some(m => m && typeof m === 'string' && m.trim() !== '')) || (i.material && typeof i.material === 'string' && i.material.trim() !== ''));
      case 'finishes':        return any((i) => (Array.isArray(i.finishes) && i.finishes.some(f => f && typeof f === 'string' && f.trim() !== '')) || (i.finish && typeof i.finish === 'string' && i.finish.trim() !== ''));
      case 'condition':       return any((i) => i.itemCondition && typeof i.itemCondition === 'string' && i.itemCondition.trim() !== '');
      case 'photo':           return any((i) => (i.primaryImage && i.primaryImage.trim() !== '') || (Array.isArray(i.images) && i.images.some(img => img && img.trim() !== '')));
      case 'size':            return any((i) => i.dimensions && ((typeof i.dimensions.length === 'number' && i.dimensions.length > 0) || (typeof i.dimensions.width === 'number' && i.dimensions.width > 0) || (typeof i.dimensions.height === 'number' && i.dimensions.height > 0)));
      case 'qty':             return any((i) => typeof i.quantity === 'number' && i.quantity > 0);
      case 'price':           return any((i) => typeof i.unitPrice === 'number' && i.unitPrice > 0);
      case 'total':           return any((i) => typeof i.quantity === 'number' && i.quantity > 0 && typeof i.unitPrice === 'number' && i.unitPrice > 0);
      case 'cbm':             return any((i) => typeof i.cbm === 'number' && i.cbm > 0);
      case 'cbmTotal':        return any((i) => (i.totalCBM || (typeof i.cbm === 'number' && typeof i.quantity === 'number' ? i.cbm * i.quantity : 0)) > 0);
      case 'weight':          return any((i) => typeof i.weight === 'number' && i.weight > 0);
      case 'hsnCode':         return any((i) => i.hsnCode && typeof i.hsnCode === 'string' && i.hsnCode.trim() !== '');
      case 'barcode':         return any((i) => (i.barcode?.text && i.barcode.text.trim() !== '') || (i.barcode?.image && i.barcode.image.trim() !== ''));
      case 'unit':            return any((i) => i.dimensions && ((typeof i.dimensions.length === 'number' && i.dimensions.length > 0) || (typeof i.dimensions.width === 'number' && i.dimensions.width > 0) || (typeof i.dimensions.height === 'number' && i.dimensions.height > 0)));
      case 'productionNotes': return any((i) => i.productionNotes && typeof i.productionNotes === 'string' && i.productionNotes.trim() !== '');
      case 'qcNotes':         return any((i) => i.qcNotes && typeof i.qcNotes === 'string' && i.qcNotes.trim() !== '');
      case 'polishNotes':     return any((i) => i.polishNotes && typeof i.polishNotes === 'string' && i.polishNotes.trim() !== '');
      case 'packagingNotes':  return any((i) => i.packagingNotes && typeof i.packagingNotes === 'string' && i.packagingNotes.trim() !== '');
      case 'comments':        return any((i) => Array.isArray(i.comments) && i.comments.some(c => (c.text && c.text.trim() !== '') || (Array.isArray(c.images) && c.images.length > 0)));
      default:                return true;
    }
  };

  const availableColumns = DEFAULT_PI_COLUMNS.filter((c) => hasColumnData(c.key));

  // Initialise selected columns to all available ones after order loads.
  useEffect(() => {
    if (order) {
      setSelected(availableColumns.map((c) => c.key));
    }
  }, [order]);

  const toggleColumn = (key) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  if (loading) return <PageLoader message="Loading invoice..." />;

  return (
    <div className="p-6 bg-linen-50 min-h-screen text-espresso-900">
      <h1 className="text-2xl font-bold mb-4">Proforma Invoice</h1>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Select fields to display</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {availableColumns.map((col) => (
            <label key={col.key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selected.includes(col.key)}
                onChange={() => toggleColumn(col.key)}
                className="form-checkbox h-4 w-4 text-espresso-600"
              />
              <span className="text-sm">{col.label}</span>
            </label>
          ))}
        </div>
      </div>
      <SimpleButton onClick={() => {}} className="mb-4">
        {/* No extra action needed – the PDF view updates automatically */}
        Refresh Preview
      </SimpleButton>
      <ProformaInvoicePDF order={order} selectedColumns={selected} />
    </div>
  );
}
