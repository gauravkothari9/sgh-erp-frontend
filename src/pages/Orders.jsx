import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, ShoppingBag, Folder, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { orderAPI } from '../utils/api';
import { SkeletonRow } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { useDebounce } from '../hooks/useDebounce';
import { useAuthStore } from '../store/authStore';
import ExistingOrderCustomerModal from '../components/orders/ExistingOrderCustomerModal';
import ImportOrderModal from '../components/orders/ImportOrderModal';

// Tab → order-status filter mapping. `statuses: []` means "no filter".
// Non-"all" tabs render a flat order list; "all" groups into customer folders.
const TABS = [
  { id: 'all',       label: 'All Orders', statuses: [] },
  { id: 'new',       label: 'New Orders', statuses: ['Finalized'] },
  { id: 'pending',   label: 'Pending',    statuses: ['Pending'] },
  { id: 'completed', label: 'Completed',  statuses: ['Completed'] },
  { id: 'draft',     label: 'Drafts',     statuses: ['Draft'] },
];

export default function Orders() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState('');
  const [containerFilter, setContainerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  // "Existing Orders" import flow: pick a customer, then upload the order
  // Excel + photos for that customer.
  const [existingPickOpen, setExistingPickOpen] = useState(false);
  const [importCustomer, setImportCustomer] = useState(null);

  const currentTab = useMemo(
    () => TABS.find((t) => t.id === activeTab) || TABS[0],
    [activeTab]
  );

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 200,
        sortBy: 'orderDate',
        sortOrder: 'desc',
        search: debouncedSearch || undefined,
        containerSize: containerFilter || undefined,
        orderType: typeFilter || undefined,
      };

      if (currentTab.statuses.length > 0) {
        params.status = currentTab.statuses.join(',');
      }

      const res = await orderAPI.getAll(params);
      setOrders(res.data.data || []);
      setPagination(res.data.pagination || {});
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, containerFilter, typeFilter, currentTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, containerFilter, typeFilter, activeTab]);

  // Folder grouping — used by every tab. The fetched order list is
  // already scoped to the active tab's status filter, so each folder only
  // counts orders matching that tab.
  const groupedOrders = useMemo(() => {
    const groups = {};
    orders.forEach((order) => {
      const customerName = order.customer?.companyName || 'Unknown Customer';
      const fileNum = order.fileNumber || order.customer?.fileNumber || '';
      const key = `${customerName}_${fileNum}`;
      if (!groups[key]) {
        groups[key] = { key, customerName, fileNumber: fileNum, orders: [] };
      }
      groups[key].orders.push(order);
    });
    return Object.values(groups).sort((a, b) =>
      a.customerName.localeCompare(b.customerName)
    );
  }, [orders]);

  const navigateToFolder = (group) => {
    const params = new URLSearchParams();
    if (group.fileNumber) params.set('file', group.fileNumber);
    else params.set('customer', group.customerName);
    // Carry the active tab into the folder so the detail view opens
    // pre-filtered to the same status (e.g. clicking a folder from the
    // Pending tab lands on the Pending sub-tab).
    params.set('tab', activeTab);
    navigate(`/office/orders/folder?${params.toString()}`);
  };

  const emptyCopy = {
    all: 'Create your first order to get started.',
    new: 'No finalized orders waiting to be processed.',
    pending: 'No orders are currently in progress.',
    completed: 'No completed orders yet.',
    draft: 'No draft orders. Start a new order to create one.',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Order Management</h1>
          <p className="page-subtitle">Manage export orders for all customers</p>
        </div>
        {can('orders', 'create') && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setExistingPickOpen(true)}
              className="btn-secondary btn"
            >
              <FileSpreadsheet size={16} /> Existing Orders
            </button>
            <button onClick={() => navigate('/office/orders/new')} className="btn-primary btn">
              <Plus size={16} /> Create Order
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-100 -mb-5">
        {/* Tab strip scrolls sideways on phones instead of wrapping/squeezing */}
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-5 space-y-4">
        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, file #, SKU, buyer PO..."
                className="input pl-9"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input w-full sm:w-44"
            >
              <option value="">All Types</option>
              {['Sample Order', 'Regular Order'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              value={containerFilter}
              onChange={(e) => setContainerFilter(e.target.value)}
              className="input w-full sm:w-40"
            >
              <option value="">All Containers</option>
              {['20ft', '40ft', '40ft HC', 'LCL', 'Air Freight'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Orders — folder view (one card per customer file) */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">
              {`${groupedOrders.length} customer${
                groupedOrders.length === 1 ? '' : 's'
              } · ${pagination.total || orders.length} ${currentTab.label.toLowerCase()}`}
            </span>
          </div>

          {loading ? (
            <div className="table-container rounded-none border-none">
              <table className="sgh-table">
                <thead>
                  <tr>
                    <th>File #</th>
                    <th>Customer</th>
                    <th>Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonRow key={i} cols={3} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No orders found"
              description={emptyCopy[activeTab]}
              action={
                (activeTab === 'all' || activeTab === 'draft') && can('orders', 'create') ? (
                  <button
                    onClick={() => navigate('/office/orders/new')}
                    className="btn-primary btn"
                  >
                    <Plus size={15} /> Create Order
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="space-y-3 p-3 sm:p-4 bg-gray-50/60">
              {groupedOrders.map((group) => (
                <div
                  key={group.key}
                  className="bg-white rounded-xl shadow-sm border border-brand-100 px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-brand-50 hover:border-brand-300 transition-all group"
                  onClick={() => navigateToFolder(group)}
                >
                  {/* min-w-0 lets the long customer name truncate instead of
                      pushing the chevron off-screen on phones */}
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                    <Folder
                      size={20}
                      className="text-brand-500 group-hover:text-brand-700 transition-colors flex-shrink-0"
                    />
                    <span className="font-mono font-bold text-brand-800 text-sm group-hover:text-brand-900">
                      {group.fileNumber || group.customerName}
                    </span>
                    <span className="text-gray-500 text-sm truncate min-w-0">{group.customerName}</span>
                    <span className="bg-gray-100 border border-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                      {group.orders.length}{' '}
                      {group.orders.length === 1 ? 'order' : 'orders'}
                    </span>
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-brand-50">
              <p className="text-xs text-gray-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="btn-secondary btn btn-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasNextPage}
                  className="btn-secondary btn btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Existing Orders — Step 1: choose (or add) the customer */}
      <ExistingOrderCustomerModal
        isOpen={existingPickOpen}
        onClose={() => setExistingPickOpen(false)}
        onPicked={(customer) => {
          setExistingPickOpen(false);
          setImportCustomer(customer);
        }}
      />

      {/* Existing Orders — Step 2: upload the order Excel + photos */}
      <ImportOrderModal
        isOpen={!!importCustomer}
        fileNumber={importCustomer?.fileNumber}
        onClose={() => setImportCustomer(null)}
        onCreated={(order) => {
          setImportCustomer(null);
          if (order?._id) navigate(`/office/orders/${order._id}`);
          else fetchOrders();
        }}
      />
    </div>
  );
}
