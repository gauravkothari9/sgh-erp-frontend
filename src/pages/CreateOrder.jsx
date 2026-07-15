import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Save, CheckCircle, AlertCircle, Loader2, X, Image,
} from 'lucide-react';
import { orderAPI, customerAPI, showroomAPI } from '../utils/api';
import { formatCurrency, getCurrencySymbol, resolveMediaSrc, imgErrorFallback } from '../utils/formatters';
import { useAuthStore } from '../store/authStore';
import { useCatalogueSelectionStore } from '../store/catalogueSelectionStore';
import { Spinner } from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import CreateCustomerModal from '../components/customers/CreateCustomerModal';
import PhotoPicker from '../components/common/PhotoPicker';
import toast from 'react-hot-toast';
import { compressImages } from '../utils/compressImage';
import { showValidationErrors } from '../utils/validation';

const ITEM_TEMPLATE = {
  companySKU: '',
  buyerSKU: '',
  buyerDescription: '',
  itemDescription: '',
  itemCategory: '',
  collectionName: '',
  materials: [],
  finishes: [],
  itemCondition: '',
  hsnCode: '',
  barcode: { text: '', image: '' },
  dimensions: { length: '', width: '', height: '', unit: 'cm' },
  cbm: '',
  weight: '',
  quantity: '',
  unitPrice: '',
  totalPrice: 0,
  totalCBM: 0,
  images: [],
  comments: [],
  productionNotes: '',
  qcNotes: '',
  polishNotes: '',
  packagingNotes: '',
};

const calcCBM = (dims) => {
  const { length, width, height, unit } = dims;
  if (!length || !width || !height) return '';
  let l = parseFloat(length), w = parseFloat(width), h = parseFloat(height);
  if (isNaN(l) || isNaN(w) || isNaN(h)) return '';
  if (unit === 'inch') { l /= 39.3701; w /= 39.3701; h /= 39.3701; }
  else { l /= 100; w /= 100; h /= 100; }
  return Math.round(l * w * h * 1000) / 1000;
};

/* ── Tag / Chip Input Component ── */
function TagInput({ value = [], onChange, placeholder }) {
  const [inputVal, setInputVal] = useState('');

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputVal('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputVal);
    }
    if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 input min-h-[38px] !py-1.5 cursor-text" onClick={(e) => e.currentTarget.querySelector('input')?.focus()}>
      {value.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 bg-brand-100 text-brand-800 text-xs font-medium px-2 py-0.5 rounded-full">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="hover:text-red-500">
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputVal.trim()) addTag(inputVal); }}
        placeholder={value.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] outline-none border-none bg-transparent text-sm"
      />
    </div>
  );
}

function InputField({ label, name, type = 'text', value, onChange, required, options, placeholder, error, className = '', suffix }) {
  return (
    <div className={className}>
      <label className={`label ${required ? 'label-required' : ''}`}>{label}</label>
      <div className="relative">
        {options ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className={`input ${error ? 'input-error' : ''}`}>
            <option value="">Select...</option>
            {options.map((o) => (
              <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
                {typeof o === 'string' ? o : o.label}
              </option>
            ))}
          </select>
        ) : type === 'textarea' ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} className={`input resize-none ${error ? 'input-error' : ''}`} />
        ) : (
          <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`input ${suffix ? 'pr-16' : ''} ${error ? 'input-error' : ''}`} />
        )}
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function CreateOrder() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const isEdit = !!id;
  const fetchProductsTimeoutRef = useRef(null);
  
  const autofillTimeouts = useRef({});

  // Snapshot of the SKU each item had when its input received focus. On blur
  // we compare against this snapshot — if the user typed a new value while
  // the input was focused, we trigger renameMedia. If they just clicked in
  // and out without changing anything, we stay quiet.
  const skuAtFocus = useRef({});

  // Build a fresh items array with the rename mapping applied to the target
  // item. Returns the new array so the caller can both `setItems(...)` AND
  // pass the same array to a silent save — React state batching means
  // calling setState then handleSave would otherwise persist the stale
  // (pre-rename) URLs.
  const applyMappingToItems = (base, idx, mapping) => {
    if (!mapping || Object.keys(mapping).length === 0) return base;
    const next = [...base];
    const it = { ...next[idx] };
    const swap = (u) => (u && mapping[u] ? mapping[u] : u);

    if (Array.isArray(it.images))            it.images = it.images.map(swap);
    if (it.primaryImage)                     it.primaryImage = swap(it.primaryImage);
    if (it.barcode?.image)                   it.barcode = { ...it.barcode, image: swap(it.barcode.image) };
    if (Array.isArray(it.comments) && it.comments.length > 0) {
      it.comments = it.comments.map((c) => (
        Array.isArray(c?.images) && c.images.length > 0
          ? { ...c, images: c.images.map(swap) }
          : c
      ));
    }

    next[idx] = it;
    return next;
  };

  // Push the given items list straight to the backend for the order being
  // edited. This is how a SKU change (with or without renamed images) lands
  // in the database before the user navigates to the gallery / PI / etc.
  // Silent: only logs warnings on failure, never disrupts typing.
  const persistItemsSilently = async (itemsList) => {
    if (!isEdit || !id || !selectedCustomer) return;
    try {
      const payload = {
        ...header,
        customer: selectedCustomer?._id,
        fileNumber: selectedCustomer?.fileNumber,
        items: itemsList.map((item, i) => ({
          ...item,
          sortOrder: i,
          totalPrice: parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0),
          cbm: item.cbm || calcCBM(item.dimensions) || 0,
          totalCBM: (item.cbm || calcCBM(item.dimensions) || 0) * (parseFloat(item.quantity) || 1),
          dimensions: {
            length: parseFloat(item.dimensions?.length) || 0,
            width: parseFloat(item.dimensions?.width) || 0,
            height: parseFloat(item.dimensions?.height) || 0,
            unit: item.dimensions?.unit || 'cm',
          },
        })),
        changeNote: 'SKU edit',
      };
      await orderAPI.update(id, payload);
    } catch (err) {
      console.warn('Silent save after SKU change failed', err?.message || err);
    }
  };

  // Capture the current SKU when the user clicks into the input, so blur
  // can detect whether they actually changed it.
  const handleSKUFocus = (idx) => {
    skuAtFocus.current[idx] = (items[idx]?.companySKU || '').trim();
  };

  // Triggered when the SKU input loses focus. Steps:
  //   1. Skip if SKU is empty or unchanged from when the input gained focus.
  //   2. If any media is attached, ask the backend to rename those files
  //      under the new SKU prefix and merge the returned URL mapping into
  //      local state.
  //   3. If this is an edit of a saved order, silently push the new items
  //      array (with rebased URLs + new SKU) to the backend so the gallery,
  //      PI, and dedup-by-SKU code see the change immediately — otherwise
  //      the gallery loads the pre-rename URLs from the database and 404s.
  const handleSKUBlur = async (idx) => {
    const item = items[idx];
    if (!item) return;
    const newSku = (item.companySKU || '').trim();
    const oldSku = skuAtFocus.current[idx];
    if (!newSku || oldSku === undefined || newSku === oldSku) return;
    // Avoid re-running for the same value if the user re-focuses without
    // typing again.
    skuAtFocus.current[idx] = newSku;

    const urls = [
      ...(item.images || []),
      ...(item.barcode?.image ? [item.barcode.image] : []),
      ...((item.comments || []).flatMap((c) => c?.images || [])),
    ].filter(Boolean);

    let nextItems = items;
    let renamed = 0;

    if (urls.length > 0) {
      try {
        const res = await orderAPI.renameMedia({ urls, sku: newSku });
        const mapping = res?.data?.data?.mapping || {};
        renamed = res?.data?.data?.renamed || 0;
        if (renamed > 0) {
          nextItems = applyMappingToItems(items, idx, mapping);
          setItems(nextItems);
          toast.success(`Renamed ${renamed} image${renamed > 1 ? 's' : ''} to "${newSku}"`);
        }
      } catch (err) {
        console.warn('Rename media failed', err?.message || err);
        toast.error('Could not rename image files — saved order will still update.');
      }
    }

    // Even when there are no images to rename, push the new SKU through to
    // the DB so the gallery dedup-by-SKU reflects the edit. If no images
    // existed, nextItems is still the pre-blur snapshot which already has
    // the new companySKU (handleSKUChange wrote it via updateItem).
    await persistItemsSilently(nextItems);
  };

  const handleSKUChange = (idx, value) => {
    const sku = value.toUpperCase();
    updateItem(idx, 'companySKU', sku);

    if (autofillTimeouts.current[idx]) {
      clearTimeout(autofillTimeouts.current[idx]);
    }

    const fileNumber = selectedCustomer?.fileNumber || selectedCustomer?.profile?.fileNumber;
    // For editing an order where customer is an object, fileNumber is there.
    if (!fileNumber || sku.length < 2) return;

    autofillTimeouts.current[idx] = setTimeout(async () => {
      try {
        const { buyerCatalogueAPI } = await import('../utils/api');
        const res = await buyerCatalogueAPI.getSkuLookup(fileNumber, sku);
        const prod = res?.data?.data;
        if (prod) {
          setItems(prev => {
            const next = [...prev];
            // If the user already changed the SKU while we were waiting, abort!
            if (next[idx].companySKU !== sku) return prev;
            
            const item = { ...next[idx] };
            
            // Auto fill fields if they are empty, or override them. We'll override physicals to ensure accuracy.
            item.buyerSKU = prod.buyerSKU || item.buyerSKU;
            item.itemDescription = prod.itemDescription || item.itemDescription;
            item.buyerDescription = prod.buyerDescription || item.buyerDescription;
            item.itemCategory = prod.itemCategory || item.itemCategory;
            item.collectionName = prod.collectionName || item.collectionName;
            item.materials = prod.materials || item.materials;
            item.finishes = prod.finishes || item.finishes;
            item.hsnCode = prod.hsnCode || item.hsnCode;
            item.dimensions = prod.dimensions || item.dimensions;
            item.cbm = prod.cbm || item.cbm;
            item.weight = prod.weight || item.weight;
            item.images = prod.images || item.images;
            item.comments = prod.comments || item.comments;
            item.barcode = prod.barcode || item.barcode;
            item.primaryImage = prod.primaryImage || item.primaryImage;
            
            if (!item.unitPrice && prod.currentPrice) {
              item.unitPrice = prod.currentPrice;
            }

            toast.success(`Autofilled details for SKU: ${sku}`);
            next[idx] = item;
            return next;
          });
        }
      } catch (err) {
        console.log('Autofill not found or error', err);
      }
    }, 500);
  };

  const autoSaveRef = useRef(null);

  // Customer selection
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDropdown, setCustomerDropdown] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const customerPickerRef = useRef(null);

  // Close the customer dropdown when the user clicks anywhere outside the
  // picker (input + result list). The Create-Customer modal lives outside
  // this subtree, so closing the dropdown when it opens is fine.
  useEffect(() => {
    if (!customerDropdown) return;
    const onPointerDown = (e) => {
      if (customerPickerRef.current && !customerPickerRef.current.contains(e.target)) {
        setCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [customerDropdown]);

  // Order header
  const [header, setHeader] = useState({
    orderType: '',
    orderStatus: 'Draft',
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    buyerPONumber: '',
    currency: 'USD',
    containerSize: '',
    specialInstructions: '',
    internalNotes: '',
  });

  // Line items
  const [items, setItems] = useState([{ ...ITEM_TEMPLATE }]);
  const [expandedItems, setExpandedItems] = useState({ 0: true });

  // Finalize popup
  const [showFinalizePopup, setShowFinalizePopup] = useState(false);
  const [advanceOption, setAdvanceOption] = useState('no'); // 'no' | 'yes'
  const [advanceAmount, setAdvanceAmount] = useState('');

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Totals
  const totalAmount = items.reduce((s, item) => s + (parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)), 0);
  const totalCBM = items.reduce((s, item) => {
    const cbm = parseFloat(item.cbm) || 0;
    const qty = parseFloat(item.quantity) || 1;
    return s + cbm * qty;
  }, 0);

  // Load existing order for edit
  useEffect(() => {
    const loadData = async () => {
      const customerParam = searchParams.get('customer');
      if (customerParam && !isEdit) {
        try {
          const res = await customerAPI.getById(customerParam);
          const c = res.data.data.customer;
          setSelectedCustomer(c);
          setHeader((h) => ({ ...h, currency: c.currency || 'USD' }));
        } catch {}
      }

      // Pre-filled items from Buyer Catalogue "Create Order with selected"
      const prefilledItems = location.state?.prefilledItems;
      if (!isEdit && Array.isArray(prefilledItems) && prefilledItems.length > 0) {
        setItems(
          prefilledItems.map((p) => {
            const dims = p.dimensions || { ...ITEM_TEMPLATE.dimensions };
            const autoCbm = calcCBM(dims);
            const cbm = autoCbm !== '' ? autoCbm : (p.cbm || 0);
            const qty = p.quantity !== undefined ? p.quantity : 1;
            return {
              ...ITEM_TEMPLATE,
              companySKU: (p.sku || p.companySKU || '').toUpperCase(),
              buyerSKU: p.buyerSKU || '',
              buyerDescription: p.buyerDescription || '',
              itemDescription: p.itemDescription || '',
              itemCategory: p.itemCategory || '',
              collectionName: p.collectionName || '',
              materials: p.materials || [],
              finishes: p.finishes || [],
              itemCondition: p.itemCondition || '',
              hsnCode: p.hsnCode || '',
              barcode: p.barcode || { text: '', image: '' },
              dimensions: dims,
              cbm,
              weight: p.weight || 0,
              images: p.images || [],
              primaryImage: p.primaryImage || '',
              productionNotes: p.productionNotes || '',
              qcNotes: p.qcNotes || '',
              polishNotes: p.polishNotes || '',
              packagingNotes: p.packagingNotes || '',
              comments: p.comments || [],
              quantity: qty,
              unitPrice: p.currentPrice || 0,
              totalPrice: qty * (p.currentPrice || 0),
              totalCBM: (parseFloat(cbm) || 0) * qty,
            };
          })
        );
        // Expand the first few items by default so the user can see them
        setExpandedItems(Object.fromEntries(prefilledItems.slice(0, 5).map((_, i) => [i, true])));
        toast.success(`Pre-filled ${prefilledItems.length} item(s) from catalogue`);
      }

      if (isEdit) {
        setLoading(true);
        try {
          const res = await orderAPI.getById(id);
          const order = res.data.data.order;
          setSelectedCustomer(order.customer);
          setHeader({
            orderType: order.orderType || '',
            orderStatus: order.orderStatus || 'Draft',
            orderDate: order.orderDate ? order.orderDate.split('T')[0] : '',
            expectedDeliveryDate: order.expectedDeliveryDate ? order.expectedDeliveryDate.split('T')[0] : '',
            buyerPONumber: order.buyerPONumber || '',
            currency: order.currency || 'USD',
            containerSize: order.containerSize || '',
            specialInstructions: order.specialInstructions || '',
            internalNotes: order.internalNotes || '',
          });
          setItems(
            order.items?.length > 0
              ? order.items.map((item) => {
                  const dims = item.dimensions || { ...ITEM_TEMPLATE.dimensions };
                  // Always recompute CBM from dimensions on edit load so the
                  // CBM / Total CBM fields stay in sync with the stored L×W×H
                  // (handles legacy orders saved without a CBM value and
                  // self-heals any stale CBM that no longer matches dims).
                  const autoCbm = calcCBM(dims);
                  const cbm = autoCbm !== '' ? autoCbm : (item.cbm || 0);
                  return {
                    ...ITEM_TEMPLATE,
                    ...item,
                    // Backward compat: convert old skuNumber to companySKU
                    companySKU: item.companySKU || item.skuNumber || '',
                    materials: item.materials || (item.material ? [item.material] : []),
                    finishes: item.finishes || (item.finish ? [item.finish] : []),
                    dimensions: dims,
                    cbm,
                    totalCBM: (parseFloat(cbm) || 0) * (parseFloat(item.quantity) || 1),
                    barcode: item.barcode || { text: '', image: '' },
                  };
                })
              : [{ ...ITEM_TEMPLATE }]
          );
        } catch {
          navigate('/office/orders');
        } finally {
          setLoading(false);
        }
      }
    };
    loadData();
  }, [id]);

  // Customer search
  useEffect(() => {
    if (customerSearch.length < 1) { setCustomerResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await customerAPI.getAll({ search: customerSearch, limit: 8, status: 'Active' });
        setCustomerResults(res.data.data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Auto-save draft every 60s
  useEffect(() => {
    if (!selectedCustomer) return;
    autoSaveRef.current = setInterval(() => {
      if (header.orderStatus === 'Draft') {
        handleSave('Draft', true);
      }
    }, 60000);
    return () => clearInterval(autoSaveRef.current);
  }, [selectedCustomer, header, items]);

  // Build a fresh errors map and write it to state. Returns the map so the
  // caller can also toast the actual field-level messages instead of the old
  // vague "please fix errors" copy.
  const validate = () => {
    const e = {};
    if (!selectedCustomer) e.customer = 'Customer is required';
    if (!header.orderType) e.orderType = 'Order Type is required';
    if (!header.orderDate) e.orderDate = 'Order Date is required';
    if (items.length === 0) e.items = 'At least one item is required';
    items.forEach((item, i) => {
      const tag = `Item #${i + 1}`;
      if (!item.companySKU) e[`item_${i}_sku`] = `${tag}: Company SKU is required`;
      if (!item.quantity) e[`item_${i}_qty`] = `${tag}: Quantity is required`;
      if (!item.unitPrice) e[`item_${i}_price`] = `${tag}: Unit Price is required`;
    });
    setErrors(e);
    return e;
  };

  // Items picked in the showrooms deduct their units from showroom stock — but
  // only once the order actually exists, so an abandoned draft form never eats
  // stock. Guarded by a ref: auto-save must not deduct twice.
  const showroomStock = location.state?.showroomStock;
  const showroomConsumed = useRef(false);

  const consumeShowroomStock = async (orderId) => {
    if (showroomConsumed.current || !showroomStock?.length) return;
    showroomConsumed.current = true;
    try {
      await showroomAPI.consume({ items: showroomStock, orderId });
    } catch (err) {
      showroomConsumed.current = false;
      toast.error(err.response?.data?.message || 'Order saved, but showroom stock was not updated');
    }
  };

  const handleSave = async (status = header.orderStatus, silent = false) => {
    if (!silent) {
      const errs = validate();
      if (Object.keys(errs).length > 0) {
        showValidationErrors(errs);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...header,
        orderStatus: status,
        customer: selectedCustomer?._id,
        fileNumber: selectedCustomer?.fileNumber,
        items: items.map((item, i) => ({
          ...item,
          sortOrder: i,
          totalPrice: parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0),
          cbm: item.cbm || calcCBM(item.dimensions) || 0,
          totalCBM: (item.cbm || calcCBM(item.dimensions) || 0) * (parseFloat(item.quantity) || 1),
          dimensions: {
            length: parseFloat(item.dimensions?.length) || 0,
            width: parseFloat(item.dimensions?.width) || 0,
            height: parseFloat(item.dimensions?.height) || 0,
            unit: item.dimensions?.unit || 'cm',
          },
        })),
      };

      if (isEdit) {
        await orderAPI.update(id, { ...payload, changeNote: 'Manual edit' });
        if (!silent) {
          toast.success('Order updated!');
          navigate(`/office/orders/${id}`);
        }
      } else {
        const res = await orderAPI.create(payload);
        await consumeShowroomStock(res.data.data.order._id);
        if (!silent) {
          // Drain the catalogue selection cart now that it's been turned
          // into a real order, so the bar disappears across the app.
          useCatalogueSelectionStore.getState().clear();
          toast.success(status === 'Draft' ? 'Draft saved!' : 'Order created!');
          navigate(`/office/orders/${res.data.data.order._id}`);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save order';
      if (!silent) toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeClick = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      showValidationErrors(errs);
      return;
    }
    setShowFinalizePopup(true);
  };

  const handleFinalizeConfirm = async () => {
    setShowFinalizePopup(false);
    setSaving(true);
    try {
      // First save the order (as Draft if new)
      let orderId = id;
      if (!isEdit) {
        const payload = {
          ...header,
          orderStatus: 'Draft',
          customer: selectedCustomer?._id,
          fileNumber: selectedCustomer?.fileNumber,
          items: items.map((item, i) => ({
            ...item,
            sortOrder: i,
            totalPrice: parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0),
            cbm: item.cbm || calcCBM(item.dimensions) || 0,
            totalCBM: (item.cbm || calcCBM(item.dimensions) || 0) * (parseFloat(item.quantity) || 1),
            dimensions: {
              length: parseFloat(item.dimensions?.length) || 0,
              width: parseFloat(item.dimensions?.width) || 0,
              height: parseFloat(item.dimensions?.height) || 0,
              unit: item.dimensions?.unit || 'cm',
            },
          })),
        };
        const res = await orderAPI.create(payload);
        orderId = res.data.data.order._id;
        await consumeShowroomStock(orderId);
      } else {
        // Save current state first
        await handleSave('Draft', true);
      }

      // Now finalize
      await orderAPI.finalize(orderId, {
        advanceReceived: advanceOption === 'yes',
        advanceAmount: advanceOption === 'yes' ? parseFloat(advanceAmount) || 0 : 0,
      });
      useCatalogueSelectionStore.getState().clear();
      toast.success('Order finalized!');
      navigate(`/office/orders/${orderId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to finalize order');
    } finally {
      setSaving(false);
    }
  };

  // Item helpers
  const addItem = () => {
    const idx = items.length;
    setItems([...items, { ...ITEM_TEMPLATE }]);
    setExpandedItems({ ...expandedItems, [idx]: true });
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) => {
    const updated = [...items];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      updated[idx] = { ...updated[idx], [parent]: { ...updated[idx][parent], [child]: value } };
      if (parent === 'dimensions') {
        const dims = { ...updated[idx].dimensions, [child]: value };
        // Recompute CBM whenever any dimension changes. Zero it out when
        // dimensions are incomplete so the field can't keep a stale value.
        const cbm = calcCBM(dims);
        updated[idx].cbm = cbm === '' ? 0 : cbm;
      }
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }

    // Keep totalCBM in sync with whichever of {cbm, quantity} just changed.
    const cbmNum = parseFloat(updated[idx].cbm) || 0;
    const qtyNum = parseFloat(updated[idx].quantity) || 0;
    updated[idx].totalCBM = cbmNum * qtyNum;

    setItems(updated);
  };

  const toggleItem = (idx) => setExpandedItems({ ...expandedItems, [idx]: !expandedItems[idx] });

  // Rename each file so the stored asset is recognisable straight from the
  // filename:
  //   Product image  →  <SKU>_Pro-N.ext   (always indexed, continues from
  //                                        the count of images already on
  //                                        this item so re-uploads don't
  //                                        clobber earlier ones)
  //   Barcode image  →  <SKU>_Bar.ext     (no index — exactly one per item;
  //                                        re-uploading replaces the asset)
  //   Comment image  →  <SKU>_Cmt-N.ext   (continues from total existing
  //                                        comment images for the item)
  //
  // The backend `uniqueName` helper recognises this `_Pro-N` / `_Bar` /
  // `_Cmt-N` pattern and stores files under that exact name (no timestamp
  // suffix), so what you upload is what you see on GitHub.
  const renameForUpload = (files, { sku, type, startIndex = 1 }) => {
    const arr = Array.from(files || []);
    const safeSku = (sku || '').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    const base = safeSku || 'untitled';
    return arr.map((file, i) => {
      const dot = file.name.lastIndexOf('.');
      const ext = dot > -1 ? file.name.slice(dot) : '';
      const suffix = type === 'Bar' ? 'Bar' : `${type}-${startIndex + i}`;
      const newName = `${base}_${suffix}${ext}`;
      return new File([file], newName, {
        type: file.type,
        lastModified: file.lastModified,
      });
    });
  };

  // `meta` carries the SKU + role + (for indexed types) the starting index
  // so a second upload continues numbering rather than overwriting earlier
  // assets that share the SKU.
  const handleMediaUpload = async (files, meta) => {
    if (!files || files.length === 0) return [];
    const renamed = meta ? renameForUpload(files, meta) : Array.from(files);
    // Compress in the browser before sending — turns a 30 MB upload into ~1 MB.
    const compressed = await compressImages(renamed);
    const formData = new FormData();
    compressed.forEach((f) => formData.append('images', f));
    try {
      const res = await orderAPI.uploadMedia(formData);
      return res.data.data.urls || [];
    } catch (err) {
      toast.error('Failed to upload media');
      return [];
    }
  };

  // Compute the next free `_Pro-N` index for a given item. We scan the
  // existing image URLs, parse out any `_Pro-N` suffix, and start from
  // max(N) + 1 — so removing _Pro-2 from the gallery and uploading a fresh
  // one still gives _Pro-4, not a colliding _Pro-3.
  const nextIndexFor = (urls, type) => {
    const re = new RegExp(`_${type}-(\\d+)(\\.[a-zA-Z0-9]+)?(?:[?#]|$)`);
    let max = 0;
    (urls || []).forEach((u) => {
      const m = typeof u === 'string' ? u.match(re) : null;
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    });
    return max + 1;
  };

  // For comment images we have to look across *all* prior comments on the
  // item, not just the current one, because each upload creates its own
  // comment entry but the SKU-based filename namespace is shared.
  const allCommentImages = (item) =>
    (item?.comments || []).flatMap((c) => (Array.isArray(c?.images) ? c.images : []));

  const currencySymbol = getCurrencySymbol(header.currency);

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/office/orders')} className="btn-ghost btn p-2 flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="page-title">{isEdit ? 'Edit Order' : 'Create New Order'}</h1>
            {selectedCustomer && (
              <p className="page-subtitle truncate">
                For: <span className="font-mono text-brand-700 font-semibold">{selectedCustomer.fileNumber}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {(!isEdit || header.orderStatus === 'Draft') ? (
            <>
              <button onClick={() => handleSave('Draft')} disabled={saving} className="btn-secondary btn">
                {saving ? <Spinner size="sm" /> : <Save size={15} />}
                Save as Draft
              </button>
              <button onClick={handleFinalizeClick} disabled={saving} className="btn-primary btn">
                {saving ? <Spinner size="sm" /> : <CheckCircle size={15} />}
                Finalise Order
              </button>
            </>
          ) : (
            <button onClick={() => handleSave(header.orderStatus)} disabled={saving} className="btn-primary btn">
              {saving ? <Spinner size="sm" /> : <Save size={15} />}
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Step 1: Customer */}
      <div className="card">
        <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center font-bold">1</span>
          Customer
        </h2>
        {selectedCustomer ? (
          <div className="flex items-center justify-between gap-3 bg-brand-50 rounded-lg px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono font-semibold text-brand-700 truncate">{selectedCustomer.fileNumber}</p>
              <p className="text-xs text-gray-500 truncate">{selectedCustomer.country}{selectedCustomer.currency ? ` · ${selectedCustomer.currency}` : ''}</p>
            </div>
            {!isEdit && (
              <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="btn-secondary btn btn-sm flex-shrink-0">Change</button>
            )}
          </div>
        ) : (
          <div className="relative" ref={customerPickerRef}>
            <input
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdown(true); }}
              onFocus={() => setCustomerDropdown(true)}
              onClick={() => setCustomerDropdown(true)}
              placeholder="Click to pick or type to search…"
              className={`input ${errors.customer ? 'input-error' : ''}`}
              autoFocus
            />
            {errors.customer && <p className="text-xs text-red-500 mt-1">{errors.customer}</p>}
            {customerDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-card-hover border border-brand-100 py-1 z-20 max-h-72 overflow-y-auto">
                {customerResults.map((c) => (
                  <button key={c._id} onClick={() => {
                    setSelectedCustomer(c);
                    setCustomerDropdown(false);
                    setCustomerSearch('');
                    setHeader((h) => ({ ...h, currency: c.currency || h.currency }));
                  }} className="w-full text-left px-4 py-3 hover:bg-brand-50 transition-colors">
                    <p className="text-sm font-mono font-semibold text-brand-700">{c.fileNumber}</p>
                    <p className="text-xs text-gray-400">{c.country}</p>
                  </button>
                ))}

                {/* Helpful prompts when the search returns nothing yet — keeps
                    the dropdown useful from the very first keystroke. */}
                {customerSearch.length < 1 && customerResults.length === 0 && (
                  <p className="px-4 py-2 text-xs text-gray-400">
                    Type at least 1 character to search…
                  </p>
                )}
                {customerSearch.length >= 1 && customerResults.length === 0 && (
                  <p className="px-4 py-2 text-xs text-gray-400">
                    No customers match “{customerSearch}”.
                  </p>
                )}

                {/* "+ Create new customer" — always visible at the bottom of
                    the dropdown so the user can spin up a customer without
                    leaving the order draft. */}
                <div className="border-t border-brand-100 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setCustomerDropdown(false);
                      setShowCreateCustomer(true);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-brand-50 text-brand-700 font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Plus size={15} />
                    Create new customer
                    {customerSearch.trim() && (
                      <span className="ml-1 text-xs font-normal text-gray-500">
                        named “{customerSearch.trim()}”
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Order Details */}
      <div className="card">
        <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center font-bold">2</span>
          Order Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField label="Order Type" required value={header.orderType} onChange={(v) => setHeader({ ...header, orderType: v })} options={['Sample Order', 'Regular Order']} error={errors.orderType} />
          <InputField label="Order Date" type="date" required value={header.orderDate} onChange={(v) => setHeader({ ...header, orderDate: v })} error={errors.orderDate} />
          <InputField label="Expected Delivery Date" type="date" value={header.expectedDeliveryDate} onChange={(v) => setHeader({ ...header, expectedDeliveryDate: v })} />
          <InputField label="Buyer PO Number" value={header.buyerPONumber} onChange={(v) => setHeader({ ...header, buyerPONumber: v })} placeholder="Customer's PO reference" />
          <InputField label="Currency" value={header.currency} onChange={(v) => setHeader({ ...header, currency: v })} options={['USD', 'EUR', 'GBP', 'AED', 'INR', 'AUD', 'CAD', 'SGD']} />
          <InputField label="Container Size" value={header.containerSize} onChange={(v) => setHeader({ ...header, containerSize: v })} options={['20ft', '40ft', '40ft HC', 'LCL', 'Air Freight']} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <InputField label="Special Instructions (shown on PI)" type="textarea" value={header.specialInstructions} onChange={(v) => setHeader({ ...header, specialInstructions: v })} placeholder="Any special notes for customer..." />
          <InputField label="Internal Notes (not on PI)" type="textarea" value={header.internalNotes} onChange={(v) => setHeader({ ...header, internalNotes: v })} placeholder="Internal notes for factory/office team..." />
        </div>
      </div>

      {/* Step 3: Line Items */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[11px] flex items-center justify-center font-bold">3</span>
            Line Items ({items.length})
          </h2>
          <button onClick={addItem} className="btn-secondary btn btn-sm"><Plus size={14} /> Add Item</button>
        </div>

        {errors.items && (
          <div className="flex items-center gap-2 text-sm text-red-500 mb-3">
            <AlertCircle size={15} /> {errors.items}
          </div>
        )}

        {/* Edit mode uses the wide spreadsheet grid — desktop only. Phones fall
            through to the stacked card editor below (same state / handlers). */}
        {isEdit && (
          <div className="hidden md:block overflow-x-auto border border-brand-100 rounded-xl">
            <table className="text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-brand-50 text-brand-700">
                <tr>
                  {[
                    { label: '#', w: 40 },
                    { label: 'Images', w: 140 },
                    { label: 'Company SKU *', w: 120 },
                    { label: 'Buyer SKU', w: 120 },
                    { label: 'Description', w: 120 },
                    { label: 'Buyer Description', w: 120 },
                    { label: 'Category', w: 120 },
                    { label: 'Collection', w: 120 },
                    { label: 'Materials', w: 120 },
                    { label: 'Finishes', w: 120 },
                    { label: 'Condition', w: 120 },
                    { label: 'HSN', w: 120 },
                    { label: 'L', w: 70 },
                    { label: 'W', w: 70 },
                    { label: 'H', w: 70 },
                    { label: 'Unit', w: 70 },
                    { label: 'CBM', w: 80 },
                    { label: 'Wt(kg)', w: 80 },
                    { label: 'Qty *', w: 80 },
                    { label: `Price (${currencySymbol}) *`, w: 100 },
                    { label: 'Total CBM', w: 100 },
                    { label: 'Line Total', w: 100 },
                    { label: 'Barcode', w: 120 },
                    { label: 'Production', w: 120 },
                    { label: 'QC', w: 120 },
                    { label: 'Polish', w: 120 },
                    { label: 'Packaging', w: 120 },
                    { label: 'Comments', w: 160 },
                    { label: '', w: 40 },
                  ].map((h, i) => (
                    <th
                      key={i}
                      style={{ width: `${h.w}px`, minWidth: `${h.w}px`, height: '36px' }}
                      className="px-2 py-2 text-left font-semibold border-b border-brand-200 whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const cellCls = 'border border-brand-100 p-0 align-top overflow-hidden';
                  const inputCls =
                    'w-full h-full px-2 py-2 text-xs bg-transparent outline-none focus:bg-brand-50 focus:ring-1 focus:ring-brand-300';
                  return (
                    <tr key={idx} style={{ height: '120px' }} className="hover:bg-brand-50/30">
                      <td className={`${cellCls} text-center text-gray-400`} style={{ height: '120px' }}>{idx + 1}</td>
                      {/* Item images — first column after # */}
                      <td className={cellCls} style={{ height: '120px' }}>
                        <div className="flex items-center gap-1 px-1 py-1 h-full">
                          {(item.images || []).slice(0, 2).map((img, imgIdx) => (
                            <div key={imgIdx} className="relative group flex-shrink-0" style={{ width: '110px', height: '110px' }}>
                              <img
                                src={img}
                                alt="Item"
                                className={`w-full h-full object-cover rounded border-2 ${
                                  item.primaryImage === img ? 'border-brand-500 ring-2 ring-brand-200' : 'border-gray-200'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => updateItem(idx, 'images', item.images.filter((_, i) => i !== imgIdx))}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm"
                                title="Remove"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          {(item.images?.length || 0) > 2 && (
                            <span className="flex items-center justify-center shrink-0 bg-brand-50 border-2 border-brand-200 rounded text-brand-700 font-bold text-sm" style={{ width: '50px', height: '110px' }}>
                              +{item.images.length - 2}
                            </span>
                          )}
                          <label
                            className="flex items-center justify-center border-2 border-dashed border-brand-300 rounded cursor-pointer text-brand-500 hover:bg-brand-50 hover:border-brand-400 transition-colors flex-shrink-0"
                            style={{ width: '110px', height: '110px' }}
                            title="Upload images"
                          >
                            <Plus size={18} />
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={async (e) => {
                                const urls = await handleMediaUpload(e.target.files, { sku: item.companySKU, type: 'Pro', startIndex: nextIndexFor(item.images, 'Pro') });
                                if (urls.length > 0)
                                  updateItem(idx, 'images', [...(item.images || []), ...urls]);
                              }}
                            />
                          </label>
                        </div>
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.companySKU}
                          onChange={(e) => handleSKUChange(idx, e.target.value)}
                          onFocus={() => handleSKUFocus(idx)}
                          onBlur={() => handleSKUBlur(idx)}
                          className={`${inputCls} font-mono uppercase ${errors[`item_${idx}_sku`] ? 'bg-red-50' : ''}`}

                          placeholder="SKU"
                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.buyerSKU || ''}
                          onChange={(e) => updateItem(idx, 'buyerSKU', e.target.value)}
                          className={inputCls}

                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.itemDescription || ''}
                          onChange={(e) => updateItem(idx, 'itemDescription', e.target.value)}
                          className={inputCls}

                          placeholder="Description..."
                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.buyerDescription || ''}
                          onChange={(e) => updateItem(idx, 'buyerDescription', e.target.value)}
                          className={inputCls}

                          placeholder="Buyer description..."
                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.itemCategory || ''}
                          onChange={(e) => updateItem(idx, 'itemCategory', e.target.value)}
                          className={inputCls}

                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.collectionName || ''}
                          onChange={(e) => updateItem(idx, 'collectionName', e.target.value)}
                          className={inputCls}

                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={(item.materials || []).join(', ')}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              'materials',
                              e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                            )
                          }
                          className={inputCls}

                          placeholder="comma separated"
                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={(item.finishes || []).join(', ')}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              'finishes',
                              e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                            )
                          }
                          className={inputCls}

                          placeholder="comma separated"
                        />
                      </td>
                      <td className={cellCls}>
                        <select
                          value={item.itemCondition || ''}
                          onChange={(e) => updateItem(idx, 'itemCondition', e.target.value)}
                          className={inputCls}

                        >
                          <option value="">—</option>
                          <option>One of Kind</option>
                          <option>Production</option>
                        </select>
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.hsnCode || ''}
                          onChange={(e) => updateItem(idx, 'hsnCode', e.target.value)}
                          className={inputCls}

                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          type="number"
                          value={item.dimensions?.length || ''}
                          onChange={(e) => updateItem(idx, 'dimensions.length', e.target.value)}
                          className={inputCls}

                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          type="number"
                          value={item.dimensions?.width || ''}
                          onChange={(e) => updateItem(idx, 'dimensions.width', e.target.value)}
                          className={inputCls}

                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          type="number"
                          value={item.dimensions?.height || ''}
                          onChange={(e) => updateItem(idx, 'dimensions.height', e.target.value)}
                          className={inputCls}

                        />
                      </td>
                      <td className={cellCls}>
                        <select
                          value={item.dimensions?.unit || 'cm'}
                          onChange={(e) => updateItem(idx, 'dimensions.unit', e.target.value)}
                          className={inputCls}

                        >
                          <option value="cm">cm</option>
                          <option value="inch">inch</option>
                        </select>
                      </td>
                      <td className={cellCls}>
                        <input
                          type="number"
                          value={item.cbm || ''}
                          onChange={(e) => updateItem(idx, 'cbm', e.target.value)}
                          className={inputCls}

                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          type="number"
                          value={item.weight || ''}
                          onChange={(e) => updateItem(idx, 'weight', e.target.value)}
                          className={inputCls}

                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          className={`${inputCls} ${errors[`item_${idx}_qty`] ? 'bg-red-50' : ''}`}

                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                          className={`${inputCls} ${errors[`item_${idx}_price`] ? 'bg-red-50' : ''}`}

                        />
                      </td>
                      <td className={`${cellCls} px-2 py-1.5 text-gray-600 whitespace-nowrap`}>
                        {((parseFloat(item.cbm) || 0) * (parseFloat(item.quantity) || 1)).toFixed(3)}
                      </td>
                      <td className={`${cellCls} px-2 py-1.5 font-bold text-brand-700 whitespace-nowrap`}>
                        {currencySymbol}
                        {(parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2)}
                      </td>
                      {/* Barcode (text + image + upload) */}
                      <td className={cellCls} style={{ height: '120px' }}>
                        <div className="flex flex-col gap-1 px-1.5 py-1.5 h-full">
                          <input
                            value={item.barcode?.text || ''}
                            onChange={(e) => updateItem(idx, 'barcode.text', e.target.value)}
                            className={`${inputCls} !h-auto !py-1`}
                            placeholder="Barcode text"
                          />
                          <div className="flex items-center gap-1.5 flex-1">
                            {item.barcode?.image && (
                              <div className="relative group flex-shrink-0" style={{ width: '110px', height: '90px' }}>
                                <img
                                  src={item.barcode.image}
                                  alt="Barcode"
                                  className="w-full h-full object-cover rounded border-2 border-gray-200 bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateItem(idx, 'barcode.image', '')}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm"
                                  title="Remove"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            )}
                            {!item.barcode?.image && (
                              <label
                                className="flex items-center justify-center border-2 border-dashed border-brand-300 rounded cursor-pointer text-brand-500 hover:bg-brand-50 hover:border-brand-400 transition-colors flex-shrink-0"
                                style={{ width: '110px', height: '90px' }}
                                title="Upload barcode image"
                              >
                                <Image size={18} />
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const urls = await handleMediaUpload(e.target.files, { sku: item.companySKU, type: 'Bar' });
                                    if (urls.length > 0) updateItem(idx, 'barcode.image', urls[0]);
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.productionNotes || ''}
                          onChange={(e) => updateItem(idx, 'productionNotes', e.target.value)}
                          className={inputCls}

                          placeholder="Production..."
                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.qcNotes || ''}
                          onChange={(e) => updateItem(idx, 'qcNotes', e.target.value)}
                          className={inputCls}

                          placeholder="QC..."
                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.polishNotes || ''}
                          onChange={(e) => updateItem(idx, 'polishNotes', e.target.value)}
                          className={inputCls}

                          placeholder="Polish..."
                        />
                      </td>
                      <td className={cellCls}>
                        <input
                          value={item.packagingNotes || ''}
                          onChange={(e) => updateItem(idx, 'packagingNotes', e.target.value)}
                          className={inputCls}

                          placeholder="Packaging..."
                        />
                      </td>
                      {/* Inline comments — same layout as barcode: text + image */}
                      <td className={cellCls} style={{ height: '120px' }}>
                        <div className="flex flex-col gap-1 px-1.5 py-1.5 h-full">
                          {/* Text — shows latest text comment, editable to update or add */}
                          <input
                            type="text"
                            value={(() => {
                              const lastText = [...(item.comments || [])].reverse().find((c) => c.text);
                              return lastText?.text || '';
                            })()}
                            onChange={(e) => {
                              const comments = [...(item.comments || [])];
                              const lastTextIdx = comments.map((c, i) => c.text ? i : -1).filter((i) => i >= 0).pop();
                              if (lastTextIdx !== undefined && lastTextIdx >= 0) {
                                comments[lastTextIdx] = { ...comments[lastTextIdx], text: e.target.value };
                              } else {
                                comments.push({ text: e.target.value, images: [], createdByName: user?.fullName || '' });
                              }
                              updateItem(idx, 'comments', comments);
                            }}
                            placeholder="Comment text..."
                            className={`${inputCls} !h-auto !py-1`}
                          />
                          {/* Image area — show latest comment image or upload placeholder */}
                          <div className="flex items-center gap-1.5 flex-1">
                            {(() => {
                              const allImages = (item.comments || []).flatMap((c) => c.images || []);
                              if (allImages.length > 0) {
                                const lastImg = allImages[allImages.length - 1];
                                return (
                                  <div className="relative group flex-shrink-0" style={{ width: '110px', height: '90px' }}>
                                    <img
                                      src={lastImg}
                                      alt="Comment"
                                      className="w-full h-full object-cover rounded border-2 border-gray-200 bg-white"
                                    />
                                    {allImages.length > 1 && (
                                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded font-bold">
                                        +{allImages.length - 1}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Remove the comment that contains this image
                                        const comments = (item.comments || []).filter((c) => !(c.images || []).includes(lastImg));
                                        updateItem(idx, 'comments', comments);
                                      }}
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm"
                                      title="Remove"
                                    >
                                      <X size={10} />
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <label
                                  className="flex items-center justify-center border-2 border-dashed border-brand-300 rounded cursor-pointer text-brand-500 hover:bg-brand-50 hover:border-brand-400 transition-colors flex-shrink-0"
                                  style={{ width: '110px', height: '90px' }}
                                  title="Add image to comment"
                                >
                                  <Image size={18} />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={async (e) => {
                                      const urls = await handleMediaUpload(e.target.files, { sku: item.companySKU, type: 'Cmt', startIndex: nextIndexFor(allCommentImages(item), 'Cmt') });
                                      if (urls.length > 0) {
                                        updateItem(idx, 'comments', [...(item.comments || []), { text: '', images: urls, createdByName: user?.fullName || '' }]);
                                      }
                                    }}
                                  />
                                </label>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className={`${cellCls} text-center`}>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-1 text-red-400 hover:text-red-600"
                          title="Remove row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={29} className="p-2 bg-gray-50">
                    <button
                      type="button"
                      onClick={addItem}
                      className="w-full py-2 text-xs text-brand-600 border border-dashed border-brand-300 rounded hover:bg-brand-50"
                    >
                      <Plus size={13} className="inline mr-1" /> Add Row
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className={`space-y-3 ${isEdit ? 'md:hidden' : ''}`}>
          {items.map((item, idx) => (
            <div key={idx} className="border border-brand-100 rounded-xl overflow-hidden">
              {/* Item header */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 sm:px-4 py-3 bg-brand-50 cursor-pointer" onClick={() => toggleItem(idx)}>
                <span className="text-xs font-bold text-brand-600 bg-white px-2 py-0.5 rounded border border-brand-200">
                  {item.companySKU || `Item ${idx + 1}`}
                </span>
                <span className="text-sm text-gray-600 flex-1 truncate min-w-0">{item.itemDescription || 'No description'}</span>
                {item.cbm && item.quantity && (
                  <span className="text-xs text-gray-400 whitespace-nowrap">Total CBM: {((parseFloat(item.cbm) || 0) * (parseFloat(item.quantity) || 1)).toFixed(3)} m³</span>
                )}
                <span className="text-sm font-semibold text-gray-700 whitespace-nowrap">
                  {item.quantity && item.unitPrice ? `${currencySymbol}${(parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2)}` : '—'}
                </span>
                <button onClick={(e) => { e.stopPropagation(); removeItem(idx); }} className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0" title="Remove item">
                  <Trash2 size={14} />
                </button>
                {expandedItems[idx] ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
              </div>

              {/* Item form */}
              {expandedItems[idx] && (
                <div className="px-3 sm:px-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="label label-required">Company SKU</label>
                      <input value={item.companySKU} onChange={(e) => handleSKUChange(idx, e.target.value)} onFocus={() => handleSKUFocus(idx)} onBlur={() => handleSKUBlur(idx)} placeholder="e.g. SGH-CAB-001" className={`input font-mono uppercase ${errors[`item_${idx}_sku`] ? 'input-error' : ''}`} />
                      {errors[`item_${idx}_sku`] && <p className="text-xs text-red-500 mt-1">{errors[`item_${idx}_sku`]}</p>}
                    </div>
                    <div>
                      <label className="label">Buyer SKU</label>
                      <input value={item.buyerSKU} onChange={(e) => updateItem(idx, 'buyerSKU', e.target.value)} placeholder="Buyer's SKU" className="input" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Item Description</label>
                      <input value={item.itemDescription} onChange={(e) => updateItem(idx, 'itemDescription', e.target.value)} placeholder="e.g. Reclaimed Wood Cabinet" className="input" />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4">
                      <label className="label">Buyer Description</label>
                      <input value={item.buyerDescription} onChange={(e) => updateItem(idx, 'buyerDescription', e.target.value)} placeholder="Buyer's product description..." className="input" />
                    </div>
                    <div>
                      <label className="label">Category</label>
                      <input value={item.itemCategory} onChange={(e) => updateItem(idx, 'itemCategory', e.target.value)} placeholder="e.g. Cabinet" className="input" />
                    </div>
                    <div>
                      <label className="label">Collection</label>
                      <input value={item.collectionName} onChange={(e) => updateItem(idx, 'collectionName', e.target.value)} placeholder="e.g. Revive" className="input" />
                    </div>
                    <div>
                      <label className="label">Materials (type & press Enter)</label>
                      <TagInput value={item.materials || []} onChange={(v) => updateItem(idx, 'materials', v)} placeholder="e.g. Reclaimed Wood, Iron" />
                    </div>
                    <div>
                      <label className="label">Finishes (type & press Enter)</label>
                      <TagInput value={item.finishes || []} onChange={(v) => updateItem(idx, 'finishes', v)} placeholder="e.g. Natural, Distressed" />
                    </div>
                    <div>
                      <label className="label">Item Condition</label>
                      <select value={item.itemCondition} onChange={(e) => updateItem(idx, 'itemCondition', e.target.value)} className="input">
                        <option value="">Select...</option>
                        <option>One of Kind</option>
                        <option>Production</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">HSN Code</label>
                      <input value={item.hsnCode || ''} onChange={(e) => updateItem(idx, 'hsnCode', e.target.value)} placeholder="e.g. 94036090" className="input" />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-2">
                      <label className="label">Barcode</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input value={item.barcode?.text || ''} onChange={(e) => updateItem(idx, 'barcode.text', e.target.value)} placeholder="Text..." className="input flex-1" />
                        <div className="flex items-center gap-2">
                          <PhotoPicker
                            className="flex-shrink-0"
                            icon={Image}
                            label={item.barcode?.image ? 'Change Image' : 'Add Image'}
                            onFiles={async (files) => {
                              const urls = await handleMediaUpload(files, { sku: item.companySKU, type: 'Bar' });
                              if (urls.length > 0) updateItem(idx, 'barcode.image', urls[0]);
                            }}
                          />
                          {item.barcode?.image && (
                            <img src={resolveMediaSrc(item.barcode.image)} alt="Barcode" onError={imgErrorFallback} className="w-10 h-10 object-cover border rounded bg-white p-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dimensions */}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Dimensions (auto-calculates CBM)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <div>
                        <label className="label">Length</label>
                        <input type="number" value={item.dimensions?.length || ''} onChange={(e) => updateItem(idx, 'dimensions.length', e.target.value)} className="input" placeholder="0" />
                      </div>
                      <div>
                        <label className="label">Width</label>
                        <input type="number" value={item.dimensions?.width || ''} onChange={(e) => updateItem(idx, 'dimensions.width', e.target.value)} className="input" placeholder="0" />
                      </div>
                      <div>
                        <label className="label">Height</label>
                        <input type="number" value={item.dimensions?.height || ''} onChange={(e) => updateItem(idx, 'dimensions.height', e.target.value)} className="input" placeholder="0" />
                      </div>
                      <div>
                        <label className="label">Unit</label>
                        <select value={item.dimensions?.unit || 'cm'} onChange={(e) => updateItem(idx, 'dimensions.unit', e.target.value)} className="input">
                          <option value="cm">cm</option>
                          <option value="inch">inch</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">CBM (m³)</label>
                        <input type="number" value={item.cbm || ''} onChange={(e) => updateItem(idx, 'cbm', e.target.value)} className="input" placeholder="auto" />
                      </div>
                    </div>
                  </div>

                  {/* Pricing — with currency shown */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3">
                    <div>
                      <label className="label label-required">Quantity</label>
                      <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className={`input ${errors[`item_${idx}_qty`] ? 'input-error' : ''}`} placeholder="0" />
                    </div>
                    <div>
                      <label className="label label-required">Unit Price ({currencySymbol})</label>
                      <input type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} className={`input ${errors[`item_${idx}_price`] ? 'input-error' : ''}`} placeholder="0.00" />
                    </div>
                    <div>
                      <label className="label">Weight (kg)</label>
                      <input type="number" value={item.weight || ''} onChange={(e) => updateItem(idx, 'weight', e.target.value)} className="input" placeholder="0" />
                    </div>
                    <div>
                      <label className="label">Total CBM</label>
                      <div className="input bg-gray-50 text-gray-700 font-medium">
                        {((parseFloat(item.cbm) || 0) * (parseFloat(item.quantity) || 1)).toFixed(3)} m³
                      </div>
                    </div>
                    <div>
                      <label className="label">Line Total</label>
                      <div className="input bg-brand-50 text-brand-800 font-bold">
                        {currencySymbol}{(parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Item Images */}
                  <div className="mt-4">
                    <label className="label flex justify-between items-end mb-2">
                      <span>Item Images</span>
                      <PhotoPicker
                        multiple
                        label="Add Images"
                        onFiles={async (files) => {
                          const urls = await handleMediaUpload(files, { sku: item.companySKU, type: 'Pro', startIndex: nextIndexFor(item.images, 'Pro') });
                          if (urls.length > 0) updateItem(idx, 'images', [...(item.images || []), ...urls]);
                        }}
                      />
                    </label>
                    {item.images && item.images.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-50 rounded border border-dashed border-gray-200">
                        {item.images.map((img, imgIdx) => (
                          <div key={imgIdx} className="relative group w-16 h-16">
                            <img src={resolveMediaSrc(img)} alt="Item" onError={imgErrorFallback} className="w-full h-full object-cover rounded border border-gray-200" />
                            <button onClick={() => updateItem(idx, 'images', item.images.filter((_, i) => i !== imgIdx))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic mb-2">No images added</p>
                    )}
                  </div>

                  {/* Item Comments */}
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold text-gray-800 mb-2">Item Comments</p>
                    {item.comments && item.comments.length > 0 && (
                      <div className="space-y-2 mb-3 bg-brand-50/50 p-2 rounded">
                        {item.comments.map((comment, cIdx) => (
                          <div key={cIdx} className="text-xs bg-white border border-gray-200 p-2 rounded relative group">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-brand-700">{comment.createdByName || 'You'}</span>
                              <button onClick={() => updateItem(idx, 'comments', item.comments.filter((_, i) => i !== cIdx))} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={12} />
                              </button>
                            </div>
                            {comment.text && <p className="text-gray-700 mb-1">{comment.text}</p>}
                            {comment.images && comment.images.length > 0 && (
                              <div className="flex gap-1 flex-wrap">
                                {comment.images.map((img, imgIdx) => (
                                  <img key={imgIdx} src={resolveMediaSrc(img)} alt="Comment Attachment" onError={imgErrorFallback} className="w-10 h-10 object-cover rounded border border-gray-200" />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-2 rounded border border-dashed border-gray-300">
                      <input type="text" placeholder="Add a comment..." className="input flex-1 text-xs py-1.5" onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                           e.preventDefault();
                           const txt = e.target.value.trim();
                           if(txt) {
                             updateItem(idx, 'comments', [...(item.comments || []), { text: txt, images: [], createdByName: user?.fullName || '' }]);
                             e.target.value = '';
                           }
                        }
                      }} />
                      <PhotoPicker
                        multiple
                        icon={Image}
                        label="Attach Image(s)"
                        onFiles={async (files) => {
                          const urls = await handleMediaUpload(files, { sku: item.companySKU, type: 'Cmt', startIndex: nextIndexFor(allCommentImages(item), 'Cmt') });
                          if (urls.length > 0) {
                            updateItem(idx, 'comments', [...(item.comments || []), { text: 'Attached images', images: urls, createdByName: user?.fullName || '' }]);
                          }
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Press Enter to post a text comment.</p>
                  </div>

                  {/* Factory notes */}
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Factory Notes (Production / QC / Polish / Packaging)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { label: 'Production Notes', field: 'productionNotes' },
                        { label: 'QC Notes', field: 'qcNotes' },
                        { label: 'Polish Notes', field: 'polishNotes' },
                        { label: 'Packaging Notes', field: 'packagingNotes' },
                      ].map(({ label, field }) => (
                        <div key={field}>
                          <label className="label">{label}</label>
                          <textarea value={item[field] || ''} onChange={(e) => updateItem(idx, field, e.target.value)} rows={2} className="input resize-none text-xs" placeholder={`${label}...`} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button onClick={addItem} className="w-full py-3 border-2 border-dashed border-brand-200 rounded-xl text-sm text-brand-500 hover:bg-brand-50 hover:border-brand-400 transition-all font-medium">
            <Plus size={15} className="inline mr-1" /> Add Another Item
          </button>
        </div>
      </div>

      {/* Order Summary */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {' · '}
              {items.reduce((s, i) => s + (parseFloat(i.quantity) || 0), 0)} units
              {' · '}
              Total CBM: {totalCBM.toFixed(3)} m³
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xl font-bold text-brand-700 mt-1">
              {formatCurrency(totalAmount, header.currency)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-3 mt-5 sm:justify-end">
          {(!isEdit || header.orderStatus === 'Draft') ? (
            <>
              <button onClick={() => handleSave('Draft')} disabled={saving} className="btn-secondary btn">
                {saving ? <Spinner size="sm" /> : <Save size={15} />}
                Save as Draft
              </button>
              <button onClick={handleFinalizeClick} disabled={saving} className="btn-primary btn">
                {saving ? <Spinner size="sm" /> : <CheckCircle size={15} />}
                Finalise Order
              </button>
            </>
          ) : (
            <button onClick={() => handleSave(header.orderStatus)} disabled={saving} className="btn-primary btn">
              {saving ? <Spinner size="sm" /> : <Save size={15} />}
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Finalize Popup — Advance Payment */}
      {showFinalizePopup && (
        <Modal
          isOpen={showFinalizePopup}
          onClose={() => setShowFinalizePopup(false)}
          title="Finalize Order — Advance Payment"
          size="md"
          footer={
            <>
              <button onClick={() => setShowFinalizePopup(false)} className="btn-secondary btn">Cancel</button>
              <button onClick={handleFinalizeConfirm} disabled={saving} className="btn-primary btn">
                {saving ? <Spinner size="sm" /> : <CheckCircle size={15} />}
                Confirm & Finalize
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This order will be finalized and cannot be moved back to Draft. Please confirm advance payment status:
            </p>

            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${advanceOption === 'no' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="advance" checked={advanceOption === 'no'} onChange={() => setAdvanceOption('no')} className="w-4 h-4 text-brand-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">No advance received</p>
                  <p className="text-xs text-gray-400">Order will be finalized without advance payment</p>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${advanceOption === 'yes' ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" name="advance" checked={advanceOption === 'yes'} onChange={() => setAdvanceOption('yes')} className="w-4 h-4 text-brand-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Advance received</p>
                  <p className="text-xs text-gray-400 mb-2">Enter the amount received</p>
                  {advanceOption === 'yes' && (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{currencySymbol}</span>
                      <input type="number" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} placeholder="0.00" min={0} step="0.01" className="input pl-8" autoFocus />
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>
        </Modal>
      )}

      {/* Inline "create customer" — lets the user spin up a customer from the
          order draft without leaving the page. On success we auto-select the
          new customer so the rest of the form is ready to fill. */}
      <CreateCustomerModal
        isOpen={showCreateCustomer}
        onClose={() => setShowCreateCustomer(false)}
        prefillCompanyName={customerSearch}
        onCreated={(customer) => {
          setSelectedCustomer(customer);
          setHeader((h) => ({ ...h, currency: customer.currency || h.currency }));
          setShowCreateCustomer(false);
          setCustomerSearch('');
        }}
      />
    </div>
  );
}
