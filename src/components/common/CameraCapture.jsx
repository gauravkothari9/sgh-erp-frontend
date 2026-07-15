import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, RotateCcw, Check, SwitchCamera, Loader2 } from 'lucide-react';

// A live camera exists only where getUserMedia is available AND the page is on a
// secure origin (HTTPS or localhost). Anywhere else the caller falls back to a
// `capture="environment"` file input.
export const cameraSupported = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  (window.isSecureContext ?? false);

/**
 * CameraCapture — a full-screen viewfinder rendered inside the app.
 *
 * Why not just `<input capture>`: on Android that hands off to the OS, which
 * may show a chooser (Google Photos / Drive / Files) instead of the camera.
 * getUserMedia gives us the stream directly — shutter, review, retake, done.
 *
 * Emits real JPEG `File` objects through `onCapture`, so the caller feeds them
 * into exactly the same upload pipeline it uses for gallery picks. Nothing about
 * the API, FormData or backend changes.
 */
export default function CameraCapture({ onCapture, onClose, multiple = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState('environment'); // rear camera by default
  const [shot, setShot] = useState(null);              // pending review { url, file }
  const [shots, setShots] = useState([]);              // kept when `multiple`
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async (mode) => {
    stop();
    setStarting(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser settings, or use Browse Photo instead.'
          : 'Could not open the camera on this device. Use Browse Photo instead.'
      );
    } finally {
      setStarting(false);
    }
  }, [stop]);

  useEffect(() => {
    start(facing);
    return stop;
  }, [facing, start, stop]);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setShot({ url: URL.createObjectURL(blob), file });
      },
      'image/jpeg',
      0.92
    );
  };

  const keep = () => {
    if (!shot) return;
    if (multiple) {
      setShots((prev) => [...prev, shot]);
      setShot(null); // back to the viewfinder for the next one
    } else {
      stop();
      onCapture([shot.file]);
      onClose();
    }
  };

  const done = () => {
    const all = shot ? [...shots, shot] : shots;
    stop();
    if (all.length) onCapture(all.map((s) => s.file));
    onClose();
  };

  const cancel = () => { stop(); onClose(); };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <button onClick={cancel} className="p-2 -ml-2" title="Cancel">
          <X size={22} />
        </button>
        <p className="text-sm font-semibold">
          {shot ? 'Use this photo?' : 'Take photo'}
          {multiple && shots.length > 0 && !shot && ` · ${shots.length} taken`}
        </p>
        {!shot && !error ? (
          <button
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            className="p-2 -mr-2"
            title="Switch camera"
          >
            <SwitchCamera size={20} />
          </button>
        ) : (
          <span className="w-8" />
        )}
      </div>

      {/* Viewfinder / review */}
      <div className="flex-1 relative min-h-0 flex items-center justify-center">
        {error ? (
          <div className="px-6 text-center">
            <Camera size={32} className="mx-auto text-white/40 mb-3" />
            <p className="text-sm text-white/80">{error}</p>
          </div>
        ) : shot ? (
          <img src={shot.url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted autoPlay className="max-h-full max-w-full object-contain" />
            {starting && (
              <div className="absolute inset-0 flex items-center justify-center text-white/70 gap-2">
                <Loader2 className="animate-spin" size={18} /> Starting camera…
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 px-6 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-8">
        {error ? (
          <button onClick={cancel} className="btn btn-secondary">Close</button>
        ) : shot ? (
          <>
            <button onClick={() => setShot(null)} className="flex flex-col items-center gap-1 text-white/80">
              <span className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center">
                <RotateCcw size={20} />
              </span>
              <span className="text-[11px]">Retake</span>
            </button>
            <button onClick={keep} className="flex flex-col items-center gap-1 text-white">
              <span className="w-16 h-16 rounded-full bg-white text-espresso-900 flex items-center justify-center">
                <Check size={26} strokeWidth={2.5} />
              </span>
              <span className="text-[11px]">{multiple ? 'Keep & shoot more' : 'Use photo'}</span>
            </button>
            {multiple && (
              <button onClick={done} className="flex flex-col items-center gap-1 text-white/80">
                <span className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center text-sm font-bold">
                  {shots.length + 1}
                </span>
                <span className="text-[11px]">Done</span>
              </button>
            )}
          </>
        ) : (
          <>
            {multiple && shots.length > 0 && <span className="w-12" />}
            <button
              onClick={shoot}
              disabled={starting}
              className="rounded-full bg-white/20 p-1.5 disabled:opacity-40"
              style={{ width: '4.5rem', height: '4.5rem' }}
              title="Shutter"
            >
              <span className="block w-full h-full rounded-full bg-white" />
            </button>
            {multiple && shots.length > 0 && (
              <button onClick={done} className="flex flex-col items-center gap-1 text-white/80">
                <span className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center text-sm font-bold">
                  {shots.length}
                </span>
                <span className="text-[11px]">Done</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
