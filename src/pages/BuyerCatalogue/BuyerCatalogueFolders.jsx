import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FolderOpen, Search, LayoutGrid, List as ListIcon, 
  ChevronRight, Calendar
} from 'lucide-react';
import { buyerCatalogueAPI } from '../../utils/api';
import { PageLoader } from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';
import CatalogueSelectionBar from '../../components/catalogue/CatalogueSelectionBar';

export default function BuyerCatalogueFolders() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState([]);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('sgh-catalogue-view') || 'grid';
  });

  const debouncedSearch = useDebounce(search, 300);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await buyerCatalogueAPI.getFolders({ search: debouncedSearch, limit: 100 });
      setFolders(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch catalogue folders', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const toggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('sgh-catalogue-view', mode);
  };

  const navigateToDetail = (fileNumber) => {
    navigate(`/office/buyer-catalogue/${encodeURIComponent(fileNumber)}`);
  };

  return (
    <div className="space-y-6 fade-in pb-10">
      {/* Cross-folder selection bar — only renders when items are selected,
          so the user can hop between Buyer Files and roll them into one order. */}
      <CatalogueSelectionBar />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buyer Catalogue</h1>
          <p className="text-gray-500 mt-1">Browse product history and pricing by buyer folder.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search file # or buyer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 input w-full sm:w-64 bg-white"
            />
          </div>

          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0">
            <button
              onClick={() => toggleViewMode('grid')}
              className={`p-1.5 rounded transition-all ${
                viewMode === 'grid' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => toggleViewMode('list')}
              className={`p-1.5 rounded transition-all ${
                viewMode === 'list' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <ListIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <PageLoader message="Loading catalogues..." />
      ) : folders.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No Catalogues Found"
          message={search ? `No folders match "${search}"` : "catalogues are automatically generated when an order is finalized."}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {folders.map((folder) => (
            <div
              key={folder._id}
              onClick={() => navigateToDetail(folder.fileNumber)}
              className="card p-5 cursor-pointer group hover:border-brand-300 hover:shadow-md transition-all flex flex-col gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <FolderOpen size={24} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 truncate" title={folder.fileNumber}>
                    {folder.fileNumber}
                  </h3>
                  <p className="text-sm font-medium text-gray-500 truncate mt-0.5" title={folder.buyerName || 'Unknown Buyer'}>
                    {folder.buyerName || 'Unknown Buyer'}
                  </p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between mt-auto">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">Products</p>
                  <p className="font-bold text-brand-700 text-lg leading-none">{folder.productCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                    <Calendar size={12} /> Updated
                  </p>
                  <p className="text-xs font-semibold text-gray-600 mt-1">
                    {formatDate(folder.lastUpdated)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
        {/* Desktop: table */}
        <div className="card overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm text-left">
              <thead className="bg-gray-50 text-xs uppercase font-semibold text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">File Number</th>
                  <th className="px-6 py-4">Buyer Name</th>
                  <th className="px-6 py-4 text-center">Products</th>
                  <th className="px-6 py-4">Last Updated</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {folders.map((folder) => (
                  <tr 
                    key={folder._id} 
                    className="hover:bg-brand-50/50 cursor-pointer transition-colors"
                    onClick={() => navigateToDetail(folder.fileNumber)}
                  >
                    <td className="px-6 py-4 font-bold text-gray-900">
                      <div className="flex items-center gap-3">
                        <FolderOpen size={16} className="text-brand-500" />
                        {folder.fileNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-600">
                      {folder.buyerName || '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center bg-brand-100 text-brand-700 text-xs font-bold px-2.5 py-1 rounded-full">
                        {folder.productCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {formatDate(folder.lastUpdated)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-brand-600 hover:text-brand-800 p-2">
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Phone: same rows as cards */}
        <div className="md:hidden space-y-2">
          {folders.map((folder) => (
            <div
              key={folder._id}
              onClick={() => navigateToDetail(folder.fileNumber)}
              className="card p-4 cursor-pointer active:bg-brand-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <FolderOpen size={18} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{folder.fileNumber}</p>
                  <p className="text-xs text-gray-500 truncate">{folder.buyerName || '—'}</p>
                </div>
                <span className="shrink-0 inline-flex items-center justify-center bg-brand-100 text-brand-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  {folder.productCount}
                </span>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                <span className="text-gray-400 flex items-center gap-1">
                  <Calendar size={12} /> Last updated
                </span>
                <span className="font-semibold text-gray-600">{formatDate(folder.lastUpdated)}</span>
              </div>
            </div>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
