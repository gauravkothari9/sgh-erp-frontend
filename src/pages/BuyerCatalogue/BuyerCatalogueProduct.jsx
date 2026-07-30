import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft, Image as ImageIcon, Calendar, Package, ShoppingCart, Check,
  Ruler, Box, Tag, Info, Hash, Clock, MessageSquare,
  ZoomIn,
} from 'lucide-react';
import { buyerCatalogueAPI } from '../../utils/api';
import { PageLoader } from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ImageLightbox from '../../components/common/ImageLightbox';
import { formatCurrency, formatDate, getCurrencySymbol, imgErrorFallback } from '../../utils/formatters';
import { useCatalogueSelectionStore } from '../../store/catalogueSelectionStore';
import CatalogueSelectionBar from '../../components/catalogue/CatalogueSelectionBar';

// Same media path normalizer used in the catalogue listing.
const resolveMediaSrc = (p) => {
  if (!p || typeof p !== 'string') return '';
  const forward = p.replace(/\\/g, '/').trim();
  if (!forward) return '';
  if (/^(https?:|data:|blob:)/i.test(forward)) return forward;
  return forward.startsWith('/') ? forward : `/${forward}`;
};

// Tiny presentational helpers — only render a field if it has a value, so
// empty data never shows up in the detail page.
const Field = ({ label, value, mono = false, children }) => {
  const hasChildren = children !== undefined && children !== null && children !== false;
  const hasValue = value !== undefined && value !== null && value !== '';
  if (!hasValue && !hasChildren) return null;
  return (
    <div className="text-center flex flex-col items-center">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </p>
      <div className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}>
        {hasChildren ? children : value}
      </div>
    </div>
  );
};

const Section = ({ title, icon: Icon, children, show = true }) => {
  if (!show) return null;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-center gap-2 mb-4 pb-3 border-b border-gray-100">
        {Icon && <Icon size={16} className="text-brand-600" />}
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 justify-items-center">
        {children}
      </div>
    </div>
  );
};

export default function BuyerCatalogueProduct() {
  const { fileNumber, sku } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [buyer, setBuyer] = useState(location.state?.buyer || null);
  const [activeImage, setActiveImage] = useState('');

  // Cross-folder selection store — lets the user add this product to a cart
  // that survives navigation between Buyer Files.
  const isInSelection = useCatalogueSelectionStore(
    (s) => !!(product?._id && s.items[product._id])
  );
  const toggleSelection = useCatalogueSelectionStore((s) => s.toggle);

  // Lightbox state — `images` is the gallery currently being viewed;
  // `idx` is the active slide. `title` shows in the top bar.
  const [lightbox, setLightbox] = useState(null);
  const openLightbox = (images, idx = 0, title = '') => {
    const cleaned = (images || []).map(resolveMediaSrc).filter(Boolean);
    if (cleaned.length === 0) return;
    setLightbox({ images: cleaned, idx, title });
  };
  const closeLightbox = () => setLightbox(null);
  // Keyboard navigation is now handled inside the ImageLightbox component.

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    try {
      const res = await buyerCatalogueAPI.getSkuLookup(fileNumber, sku);
      const data = res?.data?.data;
      if (!data) {
        setProduct(null);
        return;
      }
      setProduct(data);
      setActiveImage(
        resolveMediaSrc(
          data.primaryImage || (data.images?.length > 0 ? data.images[0] : '')
        )
      );

      // Backfill buyer info from the folder listing if we didn't get it via state.
      if (!buyer) {
        try {
          const folderRes = await buyerCatalogueAPI.getDetail(fileNumber);
          setBuyer(folderRes?.data?.data?.buyer || null);
        } catch {
          /* non-fatal */
        }
      }
    } catch (error) {
      console.error('Failed to fetch product detail', error);
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [fileNumber, sku, buyer]);

  useEffect(() => {
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileNumber, sku]);

  if (loading) return <PageLoader message="Loading product details..." />;
  if (!product) {
    return (
      <EmptyState
        icon={Box}
        title="Product Not Found"
        message={`No product with SKU "${sku}" in folder "${fileNumber}".`}
      />
    );
  }

  const images = (product.images || []).map(resolveMediaSrc).filter(Boolean);
  const primary = resolveMediaSrc(product.primaryImage);
  const dims = product.dimensions;
  const hasDims = dims && (dims.length || dims.width || dims.height);
  const barcodeImg = resolveMediaSrc(product.barcode?.image);
  const sortedHistory = [...(product.priceHistory || [])].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  const hasFactoryNotes =
    product.productionNotes || product.qcNotes || product.polishNotes || product.packagingNotes;

  // Identification section is only worth showing when at least one field
  // beyond the SKU (which is already in the page header) has data.
  const hasIdentificationData =
    product.buyerSKU ||
    product.hsnCode ||
    product.itemCategory ||
    product.collectionName ||
    product.itemCondition;

  return (
    <div className="space-y-6 fade-in pb-10 max-w-6xl mx-auto">
      {/* Cross-folder selection bar */}
      <CatalogueSelectionBar />

      {/* Header — the back button is absolutely positioned, so pad the centered
          block on phones to keep the title clear of it. */}
      <div className="relative flex items-center justify-center px-12 sm:px-0">
        <button
          onClick={() => navigate(`/office/buyer-catalogue/${encodeURIComponent(fileNumber)}`)}
          className="btn-ghost btn p-2 absolute left-0"
          title="Back to catalogue"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="text-center min-w-0">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-mono break-all">{product.sku}</h1>
            {product.itemCondition && (
              <span className="text-[13px] font-bold bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 rounded">
                {product.itemCondition}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">
            {buyer?.companyName && (
              <>
                <span className="text-brand-700 font-bold">{buyer.companyName}</span>
                <span className="mx-2 text-gray-300">•</span>
              </>
            )}
            File #: <span className="font-semibold text-gray-700">{fileNumber}</span>
            <span className="mx-2 text-gray-300">•</span>
            {product.totalTimesOrdered || 0} orders · {product.totalQuantityOrdered || 0} pcs total
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Images + key meta */}
        <div className="space-y-4 lg:col-span-1">
          <div className="card p-4">
            <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-100 relative group">
              {activeImage ? (
                <>
                  <img
                    src={activeImage}
                    alt={product.itemDescription || product.sku}
                    className="w-full h-full object-cover cursor-zoom-in"
                    onClick={() => {
                      // Open lightbox with the full image set, starting at the
                      // currently active thumbnail.
                      const full = [primary, ...images].filter(Boolean);
                      const startIdx = Math.max(0, full.findIndex((u) => u === activeImage));
                      openLightbox(full, startIdx, product.sku);
                    }}
                    onError={imgErrorFallback}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const full = [primary, ...images].filter(Boolean);
                      const startIdx = Math.max(0, full.findIndex((u) => u === activeImage));
                      openLightbox(full, startIdx, product.sku);
                    }}
                    className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-brand-700 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Open full-screen preview"
                  >
                    <ZoomIn size={15} />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={48} className="text-gray-300" />
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex justify-center gap-2 mt-3 flex-wrap">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImage(img)}
                    className={`w-14 h-14 rounded overflow-hidden border-2 transition-all ${
                      activeImage === img
                        ? 'border-brand-500 ring-2 ring-brand-200'
                        : 'border-gray-200 hover:border-brand-300'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    {img === primary && (
                      <span className="absolute text-[10px] font-bold text-amber-500">★</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current price card */}
          <div className="card p-5 bg-gradient-to-br from-brand-50 to-white border-brand-200 text-center">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-brand-600 mb-1">
              Current Price
            </p>
            <p className="text-3xl font-bold text-brand-700">
              {formatCurrency(product.currentPrice)}
            </p>
            {product.firstOrderedAt && (
              <p className="text-xs text-gray-500 mt-2 flex items-center justify-center gap-1">
                <Clock size={12} />
                First ordered {formatDate(product.firstOrderedAt)}
              </p>
            )}
            {product.lastOrderedAt && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center justify-center gap-1">
                <Calendar size={12} />
                Last ordered {formatDate(product.lastOrderedAt)}
              </p>
            )}
          </div>

          {/* Add this product to the cross-folder selection. Toggles so the
              user can drop it back out without leaving the page. */}
          <button
            onClick={() => toggleSelection(product, fileNumber, buyer?.companyName || '')}
            className={`btn w-full ${isInSelection ? 'btn-secondary' : 'btn-primary'}`}
          >
            {isInSelection ? <Check size={16} /> : <ShoppingCart size={16} />}
            {isInSelection ? 'Added to Selection — click to remove' : 'Add to Selection'}
          </button>

          {/* One-click order creation — only this product, customer picked in CreateOrder. */}
          <button
            onClick={() =>
              navigate('/office/orders/new', { state: { prefilledItems: [product] } })
            }
            className="btn-ghost btn w-full text-xs"
          >
            Or create an order with just this product →
          </button>
        </div>

        {/* Right column — all fields */}
        <div className="lg:col-span-2 space-y-6">
          {/* Identification — only shown when at least one secondary
              identifier exists; the SKU itself is already in the page header. */}
          <Section title="Identification" icon={Tag} show={hasIdentificationData}>
            <Field label="Buyer SKU" value={product.buyerSKU} mono />
            <Field label="HSN Code" value={product.hsnCode} mono />
            <Field label="Category" value={product.itemCategory} />
            <Field label="Collection" value={product.collectionName} />
            <Field label="Condition" value={product.itemCondition} />
          </Section>

          {/* Description */}
          {(product.itemDescription || product.buyerDescription) && (
            <Section title="Description" icon={Info}>
              <div className="sm:col-span-2 lg:col-span-3 space-y-3">
                {product.itemDescription && (
                  <Field label="Item Description" value={product.itemDescription} />
                )}
                {product.buyerDescription && (
                  <Field label="Buyer Description" value={product.buyerDescription} />
                )}
              </div>
            </Section>
          )}

          {/* Materials & Finishes */}
          {(product.materials?.length > 0 || product.finishes?.length > 0) && (
            <Section title="Materials & Finishes" icon={Box}>
              {product.materials?.length > 0 && (
                <Field label="Materials">
                  <div className="flex flex-wrap gap-1.5">
                    {product.materials.map((m, i) => (
                      <span
                        key={i}
                        className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </Field>
              )}
              {product.finishes?.length > 0 && (
                <Field label="Finishes">
                  <div className="flex flex-wrap gap-1.5">
                    {product.finishes.map((f, i) => (
                      <span
                        key={i}
                        className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </Field>
              )}
            </Section>
          )}

          {/* Dimensions & physical — each axis is only shown when its own
              value is non-zero, so a partial set (e.g. width-only) doesn't
              render fake "0 cm" placeholders. */}
          <Section
            title="Dimensions & Physical"
            icon={Ruler}
            show={hasDims || product.cbm || product.weight}
          >
            {dims?.length ? (
              <Field label="Length" value={`${dims.length} ${dims.unit || 'cm'}`} />
            ) : null}
            {dims?.width ? (
              <Field label="Width" value={`${dims.width} ${dims.unit || 'cm'}`} />
            ) : null}
            {dims?.height ? (
              <Field label="Height" value={`${dims.height} ${dims.unit || 'cm'}`} />
            ) : null}
            {product.cbm ? (
              <Field label="CBM (m³)" value={Number(product.cbm).toFixed(3)} />
            ) : null}
            {product.weight ? (
              <Field label="Weight (kg)" value={Number(product.weight).toFixed(2)} />
            ) : null}
          </Section>

          {/* Barcode */}
          {(product.barcode?.text || barcodeImg) && (
            <Section title="Barcode" icon={Hash}>
              {product.barcode?.text && (
                <Field label="Barcode Text" value={product.barcode.text} mono />
              )}
              {barcodeImg && (
                <Field label="Barcode Image">
                  <button
                    type="button"
                    onClick={() => openLightbox([barcodeImg], 0, `${product.sku} — Barcode`)}
                    className="group relative aspect-square w-full max-w-xs bg-gray-50 rounded-lg overflow-hidden border border-gray-100 hover:border-brand-300 transition-colors cursor-zoom-in"
                    title="Preview barcode"
                  >
                    <img
                      src={barcodeImg}
                      alt="Barcode"
                      className="w-full h-full object-contain"
                      onError={imgErrorFallback}
                    />
                    <span className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white/90 text-brand-700 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn size={15} />
                    </span>
                  </button>
                </Field>
              )}
            </Section>
          )}

          {/* Comments — only render when at least one comment exists */}
          {Array.isArray(product.comments) && product.comments.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-center gap-2 mb-4 pb-3 border-b border-gray-100">
                <MessageSquare size={16} className="text-brand-600" />
                <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                  Comments ({product.comments.length})
                </h2>
              </div>
              <div className="space-y-2">
                {product.comments.map((c, i) => {
                  const text = typeof c === 'string' ? c : c?.text;
                  const author = typeof c === 'object' ? c?.createdByName : '';
                  const cmtImages = Array.isArray(c?.images) ? c.images : [];
                  if (!text && cmtImages.length === 0) return null;
                  return (
                    <div
                      key={i}
                      className="bg-brand-50/50 border border-brand-100 rounded-lg p-3 text-sm text-center"
                    >
                      {author && (
                        <p className="text-[13px] font-semibold text-brand-700 mb-1">{author}</p>
                      )}
                      {text && <p className="text-gray-700 whitespace-pre-wrap">{text}</p>}
                      {cmtImages.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 justify-items-center">
                          {cmtImages.map((img, j) => (
                            <button
                              type="button"
                              key={j}
                              onClick={() => openLightbox(cmtImages, j, `${product.sku} — Comment image ${j + 1}`)}
                              className="group relative aspect-square w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-100 hover:border-brand-300 transition-colors cursor-zoom-in"
                              title="Preview comment image"
                            >
                              <img
                                src={resolveMediaSrc(img)}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={imgErrorFallback}
                              />
                              <span className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-white/90 text-brand-700 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn size={15} />
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Factory notes */}
          {hasFactoryNotes && (
            <Section title="Factory Notes" icon={Info}>
              {product.productionNotes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Production" value={product.productionNotes} />
                </div>
              )}
              {product.qcNotes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="QC" value={product.qcNotes} />
                </div>
              )}
              {product.polishNotes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Polish" value={product.polishNotes} />
                </div>
              )}
              {product.packagingNotes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Packaging" value={product.packagingNotes} />
                </div>
              )}
            </Section>
          )}

          {/* Price history */}
          <div className="card p-5">
            <div className="flex items-center justify-center gap-2 mb-4 pb-3 border-b border-gray-100">
              <Clock size={16} className="text-brand-600" />
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                Price History ({sortedHistory.length})
              </h2>
            </div>
            {sortedHistory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No history recorded yet.</p>
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="bg-gray-50 grid grid-cols-4 gap-2 sm:gap-3 px-3 sm:px-4 py-2 text-[12px] font-semibold text-gray-500 uppercase tracking-wider text-center">
                  <div>Date</div>
                  <div>Order #</div>
                  <div>Qty</div>
                  <div>Price</div>
                </div>
                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {sortedHistory.map((h, idx) => (
                    <div
                      key={idx}
                      className={`px-3 sm:px-4 py-2.5 grid grid-cols-4 gap-2 sm:gap-3 text-xs sm:text-sm items-center text-center ${
                        idx === 0 ? 'bg-brand-50/40' : 'hover:bg-gray-50/60'
                      }`}
                    >
                      <div className="text-gray-600 flex items-center justify-center gap-1.5 text-xs flex-wrap">
                        <Calendar size={12} className="text-gray-400 shrink-0" />
                        {formatDate(h.date)}
                        {idx === 0 && (
                          <span className="text-[11px] font-bold bg-brand-600 text-white px-1.5 rounded">
                            LATEST
                          </span>
                        )}
                      </div>
                      <div className="flex justify-center min-w-0">
                        <Link
                          to={`/office/orders/${h.orderId}`}
                          className="text-brand-600 hover:text-brand-800 font-medium hover:underline flex items-center gap-1 text-xs min-w-0"
                        >
                          <Package size={12} className="shrink-0" />
                          <span className="truncate">{h.orderNumber}</span>
                        </Link>
                      </div>
                      <div className="text-gray-600 text-xs">{h.quantity} pcs</div>
                      <div className="font-bold text-gray-900">
                        {getCurrencySymbol(h.currency)}
                        {Number(h.price).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox — white-card popup style */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          index={Math.min(lightbox.idx, lightbox.images.length - 1)}
          title={lightbox.title || ''}
          onClose={closeLightbox}
          onChange={(i) => setLightbox((s) => s && { ...s, idx: i })}
        />
      )}
    </div>
  );
}
