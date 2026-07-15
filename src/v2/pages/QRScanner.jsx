import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import toast from 'react-hot-toast';
import { ScanLine, Keyboard } from 'lucide-react';
import { instancesApi } from '../lib/endpoints';

export default function QRScannerPage() {
  const navigate = useNavigate();
  const elRef = useRef(null);
  const scannerRef = useRef(null);
  const [manual, setManual] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const id = 'v2-qr-region';
    if (!elRef.current) return;
    elRef.current.id = id;

    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decodedText) => {
          if (!mounted) return;
          await scanner.stop();
          handleCode(decodedText);
        },
        () => {}
      )
      .catch((e) => setError(e?.message || 'Camera unavailable'));

    return () => {
      mounted = false;
      scanner.stop().catch(() => {}).finally(() => scanner.clear().catch(() => {}));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCode = async (code) => {
    try {
      const res = await instancesApi.byCode(code);
      const inst = res.data.data.instance;
      navigate(`/v2/pieces/${inst.id}`);
    } catch {
      toast.error(`No piece found for "${code}"`);
    }
  };

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <div>
        <h1 className="text-xl font-bold text-brand-ink flex items-center gap-2"><ScanLine size={18} /> Scan QR</h1>
        <p className="text-xs text-brand-inkMuted">Point your camera at a piece tag.</p>
      </div>

      {error ? (
        <div className="bg-brand-error/10 text-brand-error text-sm p-3 rounded-md">{error}</div>
      ) : (
        <div ref={elRef} className="rounded-xl overflow-hidden bg-black aspect-square" />
      )}

      <div className="bg-brand-surface border border-brand-border rounded-xl p-3 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-inkMuted flex items-center gap-1">
          <Keyboard size={12} /> Manual entry
        </p>
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="INS-2026-00001"
            className="flex-1 px-3 py-2 text-sm font-mono rounded-lg border border-brand-border focus:border-brand-primary outline-none"
          />
          <button
            onClick={() => manual && handleCode(manual.trim())}
            className="px-4 py-2 text-sm font-semibold bg-brand-primary text-white rounded-lg"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
