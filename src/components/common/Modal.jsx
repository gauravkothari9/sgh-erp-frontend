import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
  showCloseButton = true,
}) {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  };

  // Render through a portal to document.body so the modal escapes any
  // ancestor with a CSS `transform` (e.g. the `.fade-in` wrapper in Layout).
  // Transformed ancestors create a new containing block for fixed-positioned
  // children, which otherwise pulls the modal off-centre.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]}
                    max-h-[92vh] sm:max-h-[90vh] flex flex-col fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-brand-100 flex-shrink-0">
            {title && (
              <h2 className="text-base font-bold text-gray-900">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors ml-auto"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-brand-100 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
