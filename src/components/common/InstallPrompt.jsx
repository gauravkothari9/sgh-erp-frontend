import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISSED_KEY = 'sgh-erp-install-dismissed';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

// "Install app" banner. Chrome/Android/desktop fire `beforeinstallprompt`, which
// we stash and replay on click. iOS Safari has no such event, so it gets the
// Share → Add to Home Screen instructions instead. Dismissal is remembered.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY)) return;

    const onPrompt = (e) => {
      e.preventDefault();       // keep the browser's own mini-infobar away
      setDeferred(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setDeferred(null));

    // iOS never fires the event — offer the manual route after a moment.
    if (isIOS()) {
      const t = setTimeout(() => setShowIOSHelp(true), 3000);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt); };
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDeferred(null);
    setShowIOSHelp(false);
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') setDeferred(null);
    if (outcome === 'dismissed') localStorage.setItem(DISMISSED_KEY, '1');
  };

  if (!deferred && !showIOSHelp) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[min(28rem,calc(100vw-2rem))]">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-linen-300 shadow-card-hover">
        <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
          <Download size={17} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">Install SGH ERP</p>
          <p className="text-[13px] text-gray-500">
            {showIOSHelp
              ? <>Tap <Share size={11} className="inline -mt-0.5" /> then “Add to Home Screen”.</>
              : 'Run it like an app — full screen, works on the shop floor.'}
          </p>
        </div>
        {deferred && (
          <button onClick={install} className="btn btn-primary py-1.5 px-3 text-xs shrink-0">Install</button>
        )}
        <button onClick={dismiss} className="text-gray-300 hover:text-gray-600 shrink-0" title="Not now">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
