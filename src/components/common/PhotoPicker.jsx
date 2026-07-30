import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImageIcon, Plus, X } from 'lucide-react';
import CameraCapture, { cameraSupported } from './CameraCapture';

/**
 * PhotoPicker — one click target for every image field in the app.
 *
 * What a tap does depends on the device:
 *   • PC / laptop  → opens the file dialog straight away. No sheet: a desktop
 *                    has no camera worth routing to, and `capture` is ignored.
 *   • Phone/tablet → opens a bottom sheet first: Take Photo / Browse Photo /
 *                    Cancel — so Android's Photo Picker never appears unbidden.
 *
 * Take Photo prefers an in-app viewfinder (getUserMedia, see CameraCapture),
 * because a `capture` file input on Android still hands off to the OS, which may
 * show a chooser (Google Photos / Drive / Files) instead of the camera. Where
 * getUserMedia isn't available — no camera API, or a non-HTTPS origin — it falls
 * back to a `capture="environment"` input.
 *
 * Browse Photo is the plain gallery input, unchanged.
 *
 * Every path hands files to `onFiles` exactly as before, so the upload API,
 * FormData, validation and storage are untouched.
 */

// Phones and tablets only.
//
// `(pointer: coarse) and (hover: none)` — a finger, and no mouse hover. True on
// phones and tablets (incl. iPadOS, which lies about its user agent); false on a
// touchscreen laptop, which also has a trackpad and so reports a fine pointer
// and hover. The UA check is a fallback for browsers without matchMedia.
const isHandheld = () => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia) {
    return window.matchMedia('(pointer: coarse) and (hover: none)').matches;
  }
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
};

// Bottom sheet — slides up from the bottom edge on a phone, centred card on a
// tablet. Same linen/espresso palette and rounded-2xl chrome as Modal.jsx.
function SourceSheet({ onCamera, onBrowse, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:w-80 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden fade-in">
        {/* Grab handle — the affordance people expect on a sheet */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1 rounded-full bg-linen-300" />
        </div>

        <div className="px-5 py-3 border-b border-linen-200">
          <p className="text-sm font-bold text-espresso-900">Add photo</p>
        </div>

        <button
          onClick={onCamera}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-linen-50 active:bg-linen-100 transition-colors border-b border-linen-100"
        >
          <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
            <Camera size={17} />
          </span>
          <span className="text-sm font-semibold text-gray-800">Take Photo</span>
        </button>

        <button
          onClick={onBrowse}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-linen-50 active:bg-linen-100 transition-colors border-b border-linen-100"
        >
          <span className="w-9 h-9 rounded-lg bg-linen-100 text-espresso-700 flex items-center justify-center shrink-0">
            <ImageIcon size={17} />
          </span>
          <span className="text-sm font-semibold text-gray-800">Browse Photo</span>
        </button>

        <button
          onClick={onClose}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-linen-50 active:bg-linen-100 transition-colors"
        >
          <span className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
            <X size={17} />
          </span>
          <span className="text-sm font-semibold text-gray-500">Cancel</span>
        </button>

        <div className="h-[env(safe-area-inset-bottom)] sm:hidden" />
      </div>
    </div>,
    document.body
  );
}

export default function PhotoPicker({
  onFiles,
  multiple = false,
  disabled = false,
  label = 'Add photo',
  hint = '',
  icon: Icon = Plus,
  variant = 'button',      // 'button' | 'compact' | 'tile'
  className = '',
  accept = 'image/*',
}) {
  const galleryRef = useRef(null);
  const captureRef = useRef(null);   // fallback camera input, only used when getUserMedia is unavailable
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const handle = (e) => {
    const { files } = e.target;
    if (files?.length) onFiles(files);
    e.target.value = ''; // let the same file be picked twice in a row
  };

  const openBrowse = () => { setSheetOpen(false); galleryRef.current?.click(); };

  const openCamera = () => {
    setSheetOpen(false);
    if (cameraSupported()) setCameraOpen(true);
    else captureRef.current?.click(); // no getUserMedia (or plain HTTP) → let the OS camera handle it
  };

  // A tap: sheet on handhelds, straight to the file dialog on a PC.
  const activate = () => {
    if (disabled) return;
    if (isHandheld()) setSheetOpen(true);
    else galleryRef.current?.click();
  };

  const inputs = (
    <>
      <input
        ref={galleryRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handle}
      />
      <input
        ref={captureRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={handle}
      />
    </>
  );

  const overlays = (
    <>
      {sheetOpen && (
        <SourceSheet
          onCamera={openCamera}
          onBrowse={openBrowse}
          onClose={() => setSheetOpen(false)}
        />
      )}
      {cameraOpen && (
        <CameraCapture
          multiple={multiple}
          onCapture={(files) => onFiles(files)}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </>
  );

  // A big dashed drop-tile — the whole box is the click target.
  if (variant === 'tile') {
    return (
      <>
        {inputs}
        <button
          type="button"
          onClick={activate}
          disabled={disabled}
          className={`w-full flex flex-col items-center justify-center gap-1.5 px-3 py-5 rounded-xl border-2 border-dashed
                      border-gray-300 hover:border-brand-400 hover:bg-brand-50/40 transition-all min-h-[150px]
                      disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        >
          <Icon size={26} className="text-brand-600" />
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          {hint && <p className="text-[12px] text-gray-400 uppercase tracking-wider">{hint}</p>}
        </button>
        {overlays}
      </>
    );
  }

  // A single icon button — for tight rows (thumbnail strips, toolbars).
  if (variant === 'compact') {
    return (
      <>
        {inputs}
        <button
          type="button"
          onClick={activate}
          disabled={disabled}
          title={label}
          className={`btn btn-secondary px-2.5 py-2 ${className}`}
        >
          <ImageIcon size={15} />
        </button>
        {overlays}
      </>
    );
  }

  // Default: a single labelled button.
  return (
    <>
      {inputs}
      <button
        type="button"
        onClick={activate}
        disabled={disabled}
        className={`btn btn-secondary btn-sm ${className}`}
      >
        <Icon size={14} /> {label}
      </button>
      {overlays}
    </>
  );
}
