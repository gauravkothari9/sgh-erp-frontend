import { useState, useEffect } from 'react';
import { Search, Plus, Loader2, ChevronRight, FileSpreadsheet } from 'lucide-react';
import Modal from '../common/Modal';
import CreateCustomerModal from '../customers/CreateCustomerModal';
import { customerAPI } from '../../utils/api';
import { useDebounce } from '../../hooks/useDebounce';
import { getCountryFlag } from '../../utils/formatters';

/**
 * Step 1 of the "Existing Orders" import flow.
 *
 * Lets the operator choose which customer an existing order belongs to —
 * using the same search-as-you-type box the order screens use — or create a
 * brand-new customer inline. Once a customer is chosen we hand it back via
 * onPicked(), and the caller opens ImportOrderModal (the Excel + photos step)
 * scoped to that customer's file number.
 */
export default function ExistingOrderCustomerModal({ isOpen, onClose, onPicked }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const debouncedSearch = useDebounce(search, 350);

  // Fetch matching active customers whenever the (debounced) query changes.
  // An empty query lists the most recent active customers so the box is
  // useful before the first keystroke.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await customerAPI.getAll({
          search: debouncedSearch || undefined,
          limit: 10,
          status: 'Active',
          sortBy: 'companyName',
          sortOrder: 'asc',
        });
        if (!cancelled) setResults(res.data.data || []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, isOpen]);

  // Clear transient state each time the modal is dismissed.
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setResults([]);
      setShowCreate(false);
    }
  }, [isOpen]);

  return (
    <>
      {/* Hidden while the create-customer modal is up so the two don't stack. */}
      <Modal
        isOpen={isOpen && !showCreate}
        onClose={onClose}
        title="Existing Order — Choose Customer"
        size="lg"
      >
        <div className="space-y-4">
          {/* Flow hint */}
          <div className="flex items-start gap-2 bg-brand-50/70 border border-brand-100 rounded-lg px-3 py-2.5 text-xs text-gray-600">
            <FileSpreadsheet size={15} className="text-brand-600 shrink-0 mt-0.5" />
            <span>
              Pick the customer this order belongs to (or add a new one). Next
              you'll upload the order Excel and its product photos — all item
              details and images are imported in the standard format.
            </span>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer by name, file #, country…"
              className="input pl-9"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="border border-brand-100 rounded-xl overflow-hidden">
            <div className="max-h-72 overflow-y-auto divide-y divide-brand-50">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                  <Loader2 size={15} className="animate-spin" /> Searching…
                </div>
              ) : results.length > 0 ? (
                results.map((c) => (
                  <button
                    key={c._id}
                    onClick={() => onPicked(c)}
                    className="w-full text-left px-4 py-3 hover:bg-brand-50 transition-colors flex items-center gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-base shrink-0">
                      {getCountryFlag(c.country)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {c.companyName}
                      </p>
                      <p className="text-[13px] text-gray-400">
                        <span className="font-mono text-brand-700">{c.fileNumber}</span>
                        {c.country ? ` · ${c.country}` : ''}
                        {c.currency ? ` · ${c.currency}` : ''}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-brand-500 transition-colors shrink-0"
                    />
                  </button>
                ))
              ) : (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                  {search.trim()
                    ? `No active customers match “${search.trim()}”.`
                    : 'No active customers found.'}
                </p>
              )}
            </div>

            {/* Create-new — always available at the bottom of the list */}
            <button
              onClick={() => setShowCreate(true)}
              className="w-full text-left px-4 py-3 border-t border-brand-100 bg-gray-50/60 hover:bg-brand-50 text-brand-700 font-semibold flex items-center gap-2 transition-colors"
            >
              <Plus size={15} />
              Add new customer
              {search.trim() && (
                <span className="ml-1 text-xs font-normal text-gray-500">
                  named “{search.trim()}”
                </span>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Inline customer creation — on success, jump straight to the Excel
          step for the freshly created customer. */}
      <CreateCustomerModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        prefillCompanyName={search}
        onCreated={(customer) => {
          setShowCreate(false);
          onPicked(customer);
        }}
      />
    </>
  );
}
