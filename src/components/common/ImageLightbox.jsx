import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { imgErrorFallback } from '../../utils/formatters';

/**
 * ImageLightbox — a clean white-card-style image viewer popup.
 *
 * Props:
 *   images    – array of resolved image URLs
 *   index     – currently active image index
 *   title     – optional title shown in the header
 *   onClose   – close callback
 *   onChange  – (newIndex) => void — called when user navigates
 *   footer    – optional React node rendered below the image (e.g. delete/download)
 */
export default function ImageLightbox({
  images = [],
  index = 0,
  title = '',
  onClose,
  onChange,
  footer,
}) {
  const total = images.length;
  const safeIdx = Math.min(Math.max(index, 0), Math.max(total - 1, 0));
  const current = images[safeIdx];

  const next = useCallback(() => {
    if (total <= 1) return;
    onChange?.((safeIdx + 1) % total);
  }, [safeIdx, total, onChange]);

  const prev = useCallback(() => {
    if (total <= 1) return;
    onChange?.((safeIdx - 1 + total) % total);
  }, [safeIdx, total, onChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, next, prev]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (!current) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-brand-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {title && (
              <h2 className="text-sm font-bold text-gray-900 truncate">{title}</h2>
            )}
            {total > 1 && (
              <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
                {safeIdx + 1} / {total}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors ml-auto flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Image Area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center p-5 relative min-h-0">
          {/* Prev button */}
          {total > 1 && (
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 z-10 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors shadow-sm"
              title="Previous (←)"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <img
            src={current}
            alt={title || 'Image preview'}
            className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
            onError={imgErrorFallback}
          />

          {/* Next button */}
          {total > 1 && (
            <button
              type="button"
              onClick={next}
              className="absolute right-3 z-10 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors shadow-sm"
              title="Next (→)"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* Thumbnail Strip */}
        {total > 1 && (
          <div className="flex gap-2 overflow-x-auto px-5 py-3 border-t border-gray-100 flex-shrink-0">
            {images.map((src, i) => (
              <button
                type="button"
                key={src + i}
                onClick={() => onChange?.(i)}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                  i === safeIdx
                    ? 'border-brand-500 ring-2 ring-brand-200 shadow-sm'
                    : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-300'
                }`}
              >
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={imgErrorFallback}
                />
              </button>
            ))}
          </div>
        )}

        {/* Footer (optional — delete/download buttons etc.) */}
        {footer && (
          <div className="flex items-center justify-center gap-3 px-5 py-3 border-t border-gray-100 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
