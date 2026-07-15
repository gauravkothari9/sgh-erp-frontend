import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, MapPin, ChevronRight, AlertTriangle } from 'lucide-react';
import { showroomAPI } from '../../utils/api';

// Showroom branch landing — lists the branch's zones; click a zone to open it.
export default function ShowroomBranch({ branch, zones }) {
  const navigate = useNavigate();
  const slug = branch.toLowerCase();

  // How many items in THIS branch (any zone) still have no walk-in price.
  const [unpriced, setUnpriced] = useState(0);
  useEffect(() => {
    let alive = true;
    showroomAPI
      .getCollections({ branch })
      .then((res) => { if (alive) setUnpriced(res.data?.data?.missingLocalPrice || 0); })
      .catch(() => {});
    return () => { alive = false; };
  }, [branch]);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <Store size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="page-title">{branch} Showroom</h1>
            <p className="page-subtitle">Select a zone to view its inventory</p>
          </div>
        </div>
      </div>

      {unpriced > 0 && (
        <button
          onClick={() => navigate(`/showroom/collections?branch=${branch}&missing=1`)}
          className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-left hover:border-red-400 transition-colors"
        >
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span className="text-sm text-red-700">
            <strong>{unpriced}</strong> product{unpriced === 1 ? '' : 's'} in {branch} — across all zones — have no local price.
            They would bill at ₹0 on a local order. Click to review and fix.
          </span>
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {zones.map((z) => (
          <button
            key={z}
            onClick={() => navigate(`/showroom/${slug}/zone-${z.toLowerCase()}`)}
            className="group text-left card bg-white border border-linen-300 shadow-card hover:shadow-card-hover hover:border-brand-300 transition-all flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              <MapPin size={20} strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-800">Zone {z}</p>
              <p className="text-[11px] text-gray-400">{branch} showroom</p>
            </div>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-brand-600 transition-colors shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
