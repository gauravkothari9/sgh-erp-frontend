import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Image as ImageIcon, Maximize2,
  Download, FileArchive, Trash2, Star, CheckSquare, Square, X,
} from 'lucide-react';
import { orderAPI } from '../utils/api';
import { PageLoader } from '../components/common/LoadingSpinner';
import ImageLightbox from '../components/common/ImageLightbox';
import { resolveMediaSrc, imgErrorFallback } from '../utils/formatters';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';

export default function OrderGallery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mediaGroups, setMediaGroups] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [selectedUrls, setSelectedUrls] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const fetchOrder = async () => {
    try {
      const res = await orderAPI.getById(id);
      const orderData = res.data.data.order;
      setOrder(orderData);
      processMedia(orderData);
    } catch (err) {
      toast.error('Failed to load gallery');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const processMedia = (data) => {
    const groups = [];

    // 1. Items Images & Barcodes — collapsed by SKU so a product ordered
    //    multiple times shows up as a single gallery card. Without this,
    //    re-ordering "SKU-123" twice would render its 2 photos as 4.
    //    Each unique image URL within a group is still added only once via
    //    the `seen` set, in case the same picture is attached to several
    //    of the duplicate item rows.
    const skuGroups = new Map();
    data.items?.forEach((item, itemIdx) => {
      const skuRaw = item.companySKU || item.buyerSKU || `Item-${itemIdx + 1}`;
      // Group key is case-insensitive so "ABC" and "abc" collapse into one
      // card — older orders may have lowercase SKUs that handleSKUChange
      // would now uppercase on edit.
      const key = String(skuRaw).trim().toUpperCase();
      if (!skuGroups.has(key)) {
        skuGroups.set(key, { sku: skuRaw, firstItem: item, items: [] });
      }
      skuGroups.get(key).items.push(item);
    });

    for (const { sku, firstItem, items } of skuGroups.values()) {
      const itemMedia = [];
      const seen = new Set();

      const pushUnique = (url, build) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        itemMedia.push(build());
      };

      items.forEach((it) => {
        // Product images — preserve primary-flag detection by checking the
        // primaryImage of the row that actually owns this picture.
        (it.images || []).forEach((url) => {
          pushUnique(url, () => {
            const filename = url.split('/').pop().split('.')[0];
            const dbUrl = url.startsWith('/') ? url : `/${url}`;
            const isPrimary = it.primaryImage === dbUrl || it.primaryImage === url;
            return {
              url,
              label: filename,
              type: 'product',
              originalUrl: url,
              itemId: it._id,
              isPrimary,
            };
          });
        });

        // Barcode
        if (it.barcode?.image) {
          pushUnique(it.barcode.image, () => {
            const filename = it.barcode.image.split('/').pop().split('.')[0];
            return {
              url: it.barcode.image,
              label: filename,
              type: 'barcode',
              originalUrl: it.barcode.image,
            };
          });
        }

        // Item Comments Images
        (it.comments || []).forEach((comment) => {
          (comment.images || []).forEach((url) => {
            pushUnique(url, () => {
              const filename = url.split('/').pop().split('.')[0];
              return {
                url,
                label: filename,
                type: 'comment',
                originalUrl: url,
              };
            });
          });
        });
      });

      if (itemMedia.length > 0) {
        groups.push({
          title: `Item: ${sku}`,
          subtitle: firstItem.itemDescription,
          images: itemMedia,
        });
      }
    }

    // 2. Order Level photos
    if (data.orderImages?.length > 0) {
      groups.push({
        title: 'Order Level Photos',
        images: data.orderImages.map((url, idx) => ({
          url,
          label: url.split('/').pop().split('.')[0],
          originalUrl: url
        }))
      });
    }

    // 3. Order Level Comments Images
    data.comments?.forEach((comment, idx) => {
      if (comment.images?.length > 0) {
        groups.push({
          title: `Comment: ${comment.createdByName || 'User'}`,
          images: comment.images.map((url, iIdx) => ({
            url,
            label: url.split('/').pop().split('.')[0],
            originalUrl: url
          }))
        });
      }
    });

    setMediaGroups(groups);
  };

  const zipAndDownload = async (images, zipName) => {
    if (!images.length) {
      toast.error('No images to download');
      return;
    }
    setDownloading(true);
    const zip = new JSZip();
    const folder = zip.folder(zipName);
    try {
      await Promise.all(
        images.map(async (img) => {
          const response = await fetch(img.url);
          const blob = await response.blob();
          const ext = img.url.split('.').pop().split('?')[0] || 'jpg';
          folder.file(`${img.label}.${ext}`, blob);
        })
      );
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${zipName}.zip`);
      toast.success('Download started!');
    } catch (err) {
      toast.error('Failed to create ZIP archive');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadAll = () => {
    const allImages = mediaGroups.flatMap((g) => g.images);
    zipAndDownload(allImages, `${order.orderNumber || 'Order'}_Media`);
  };

  const handleDownloadSelected = () => {
    const allImages = mediaGroups.flatMap((g) => g.images);
    const picked = allImages.filter((img) => selectedUrls.has(img.url));
    zipAndDownload(picked, `${order.orderNumber || 'Order'}_Selected`);
  };

  const toggleSelect = (url) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allUrls = mediaGroups.flatMap((g) => g.images.map((img) => img.url));
    if (selectedUrls.size === allUrls.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(allUrls));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedUrls(new Set());
  };

  const handleSetPrimary = async (itemId, imagePath) => {
    try {
      await orderAPI.setPrimaryImage(id, itemId, { imagePath });
      toast.success('Primary photo selection updated');
      fetchOrder();
    } catch (err) {
      toast.error('Failed to update primary photo');
    }
  };

  const handleDeleteMedia = async (filePath) => {
    if (!window.confirm('Are you sure you want to permanently delete this photo?')) return;
    try {
      await orderAPI.deleteMedia(id, { filePath });
      toast.success('Media deleted');
      if (selectedImage && selectedImage.url === filePath) {
        setSelectedImage(null);
      }
      fetchOrder();
    } catch (err) {
      toast.error('Failed to delete media');
    }
  };

  if (loading) return <PageLoader message="Loading gallery..." />;
  if (!order) return null;

  const totalPhotos = mediaGroups.reduce((acc, g) => acc + g.images.length, 0);

  // Lightbox Navigation
  const allFlattened = mediaGroups.flatMap(g => g.images);
  const navigateLightbox = (dir) => {
    const currentIndex = allFlattened.findIndex(img => img.url === selectedImage.url);
    let nextIndex = currentIndex + dir;
    if (nextIndex < 0) nextIndex = allFlattened.length - 1;
    if (nextIndex >= allFlattened.length) nextIndex = 0;
    setSelectedImage(allFlattened[nextIndex]);
  };

  return (
    <div className="space-y-6 fade-in pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate(-1)} className="btn-ghost btn p-2 flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Order Media Folder</h1>
            <p className="text-sm text-gray-400 mt-0.5 truncate">
              {order.orderNumber} • {totalPhotos} photos found
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {selectMode ? (
            <>
              <span className="text-xs text-gray-500 px-2">
                {selectedUrls.size} selected
              </span>
              <button
                onClick={toggleSelectAll}
                disabled={totalPhotos === 0}
                className="btn-ghost btn"
              >
                {selectedUrls.size === totalPhotos && totalPhotos > 0 ? (
                  <CheckSquare size={16} />
                ) : (
                  <Square size={16} />
                )}
                {selectedUrls.size === totalPhotos && totalPhotos > 0 ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={handleDownloadSelected}
                disabled={downloading || selectedUrls.size === 0}
                className="btn-primary btn"
              >
                {downloading ? <span className="animate-spin mr-2">◌</span> : <Download size={16} />}
                Download Selected ({selectedUrls.size})
              </button>
              <button onClick={exitSelectMode} className="btn-ghost btn">
                <X size={16} /> Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectMode(true)}
                disabled={totalPhotos === 0}
                className="btn-ghost btn"
              >
                <CheckSquare size={16} /> Select
              </button>
              <button
                onClick={handleDownloadAll}
                disabled={downloading || totalPhotos === 0}
                className="btn-primary btn"
              >
                {downloading ? <span className="animate-spin mr-2">◌</span> : <FileArchive size={16} />}
                Download All (ZIP)
              </button>
            </>
          )}
        </div>
      </div>

      {totalPhotos === 0 ? (
        <div className="card py-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <ImageIcon size={32} className="text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-800">No photos found</h3>
          <p className="text-gray-400 max-w-xs mx-auto mt-2">
            This order doesn't have any attached photos yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8 sm:space-y-10">
          {mediaGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-4 sm:space-y-5">
              <div className="flex items-center justify-between gap-2 border-b border-brand-100 pb-2">
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-gray-800 truncate">{group.title}</h2>
                  {group.subtitle && <p className="text-xs text-gray-400 truncate">{group.subtitle}</p>}
                </div>
                <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                  {group.images.length} photos
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6">
                {group.images.map((img, iIdx) => {
                  const isSelected = selectedUrls.has(img.url);
                  return (
                    <div key={iIdx} className="group flex flex-col gap-2">
                      <div
                        className={`relative aspect-square bg-gray-50 rounded-2xl overflow-hidden border cursor-pointer shadow-sm hover:shadow-md transition-all ${isSelected ? 'border-brand-500 ring-2 ring-brand-400' : 'border-brand-100'}`}
                        onClick={() => {
                          if (selectMode) toggleSelect(img.url);
                          else setSelectedImage(img);
                        }}
                      >
                        <img
                          src={resolveMediaSrc(img.url)}
                          alt={img.label}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={imgErrorFallback}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          {selectMode ? null : <Maximize2 size={24} className="text-white drop-shadow-md" />}
                        </div>

                        {selectMode && (
                          <div className="absolute top-2 left-2 z-10">
                            {isSelected ? (
                              <CheckSquare size={22} className="text-brand-600 bg-white rounded shadow" />
                            ) : (
                              <Square size={22} className="text-white drop-shadow-md" />
                            )}
                          </div>
                        )}

                        {!selectMode && (
                          // Touch devices have no hover — keep the actions visible
                          // below md, hover-reveal from md up.
                          <div className="absolute top-2 right-2 flex gap-1 transform md:translate-y-[-10px] group-hover:translate-y-0 transition-transform opacity-100 md:opacity-0 md:group-hover:opacity-100">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMedia(img.url);
                              }}
                              className="p-1.5 bg-white/90 rounded-lg text-red-500 hover:bg-red-50 shadow-sm"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                            <a
                              href={img.url}
                              download={`${img.label}.jpg`}
                              onClick={(e) => e.stopPropagation()}
                              className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white shadow-sm"
                              title="Download"
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        )}

                        {img.isPrimary && !selectMode && (
                          <div className="absolute top-2 left-2 bg-brand-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                            PRIMARY
                          </div>
                        )}
                      </div>

                      <div className="px-1 flex items-start justify-between gap-2">
                        <p
                          className={`text-[11px] font-mono truncate flex-1 min-w-0 ${img.isPrimary ? 'text-brand-700 font-bold' : 'text-gray-500'}`}
                          title={img.label}
                        >
                          {img.label}
                        </p>

                        {img.type === 'product' && img.itemId && !selectMode && (
                          <button
                            onClick={() => handleSetPrimary(img.itemId, img.originalUrl)}
                            className={`p-1 rounded transition-all ${img.isPrimary ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}
                            title={img.isPrimary ? 'Main Primary Photo' : 'Set as Primary'}
                          >
                            <Star size={14} fill={img.isPrimary ? 'currentColor' : 'none'} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Lightbox — white-card popup style */}
      {selectedImage && (
        <ImageLightbox
          images={allFlattened.map(img => resolveMediaSrc(img.url))}
          index={allFlattened.findIndex(img => img.url === selectedImage.url)}
          title={selectedImage.label}
          onClose={() => setSelectedImage(null)}
          onChange={(i) => setSelectedImage(allFlattened[i])}
          footer={
            <>
              <button
                onClick={() => handleDeleteMedia(selectedImage.url)}
                className="btn-danger btn btn-sm"
              >
                <Trash2 size={14} /> Delete
              </button>
              <a
                href={selectedImage.url}
                download={`${selectedImage.label}.jpg`}
                className="btn-secondary btn btn-sm"
              >
                <Download size={14} /> Download
              </a>
            </>
          }
        />
      )}
    </div>
  );
}
