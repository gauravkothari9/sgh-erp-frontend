import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Folder, Play, ShoppingBag, Plus, Image, FileUp, Download,
} from 'lucide-react';
import { orderAPI } from '../utils/api';
import { formatDate, formatCurrency } from '../utils/formatters';
import { StatusBadge, OrderTypeBadge, CountBadge } from '../components/common/Badge';
import { SkeletonRow } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ImportOrderModal, { downloadOrderTemplate } from '../components/orders/ImportOrderModal';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'all', label: 'All Orders', statuses: [] },
  { id: 'new', label: 'New Orders', statuses: ['Finalized'] },
  { id: 'pending', label: 'Pending', statuses: ['Pending'] },
  { id: 'completed', label: 'Completed', statuses: ['Completed'] },
  { id: 'draft', label: 'Drafts', statuses: ['Draft'] },
];

export default function CustomerOrders() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileNumber = searchParams.get('file');
  const customerName = searchParams.get('customer');
  const initialTab = searchParams.get('tab');

  // Seed the active tab from the ?tab= URL param so navigating into a
  // folder from (e.g.) the Pending tab lands on the Pending sub-tab here.
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'all'
  );

  // Keep the URL in sync when the user switches sub-tabs inside the folder,
  // so reloads / back-navigation preserve the filter.
  useEffect(() => {
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const currentTab = TABS.find((t) => t.id === activeTab);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: 200,
        sortBy: 'orderDate',
        sortOrder: 'desc',
        fileNumber: fileNumber || undefined,
      };

      if (currentTab.statuses.length > 0) {
        params.status = currentTab.statuses.join(',');
      }

      const res = await orderAPI.getAll(params);
      const allOrders = res.data.data || [];

      // Filter client-side by matching fileNumber or customerName
      const filtered = allOrders.filter(order => {
        const orderFile = order.fileNumber || order.customer?.fileNumber || '';
        const orderCustomer = order.customer?.companyName || '';
        if (fileNumber) return orderFile === fileNumber;
        return orderCustomer === customerName;
      });

      // Sort newest first
      filtered.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
      setOrders(filtered);
    } catch {}
    finally { setLoading(false); }
  }, [activeTab, fileNumber, customerName]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleStartProcessing = async (orderId, e) => {
    e.stopPropagation();
    try {
      await orderAPI.startProcessing(orderId);
      toast.success('Order moved to Pending — processing started!');
      fetchOrders();
    } catch {}
  };

  const displayTitle = fileNumber || customerName || 'Customer';

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/office/orders')}
            className="btn-ghost btn p-2 flex-shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <Folder size={28} className="text-brand-600 flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 font-mono truncate">{displayTitle}</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {orders.length} order{orders.length !== 1 ? 's' : ''} in this folder
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={downloadOrderTemplate}
            className="btn-ghost btn"
            title="Download Excel import template"
          >
            <Download size={15} /> Template
          </button>
          <button
            onClick={() => setImportOpen(true)}
            disabled={!fileNumber}
            className="btn-secondary btn"
            title={fileNumber ? 'Import an order from Excel + photos' : 'Open a customer folder first'}
          >
            <FileUp size={15} /> Import Order
          </button>
          <button onClick={() => navigate('/office/orders/new')} className="btn-primary btn">
            <Plus size={16} /> Create Order
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-100">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors
                ${activeTab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="table-container rounded-none border-none">
            <table className="sgh-table">
              <thead>
                <tr>
                  <th>Order #</th><th>Type</th><th>Date</th><th>Items</th>
                  <th>Amount</th><th>Container</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}
              </tbody>
            </table>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders found"
            description="No orders match this filter."
            action={
              activeTab === 'all' ? (
                <button onClick={() => navigate('/office/orders/new')} className="btn-primary btn">
                  <Plus size={15} /> Create Order
                </button>
              ) : null
            }
          />
        ) : (
          <>
          {/* Desktop: full table. Phones get the card list below. */}
          <div className="hidden md:block table-container rounded-none border-none overflow-x-auto">
            <table className="sgh-table min-w-[56rem]">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Amount</th>
                  <th>Container</th>
                  <th>Status</th>
                  <th>Images</th>
                  {activeTab === 'new' && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order._id}
                    onClick={() => navigate(`/office/orders/${order._id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-1 rounded">
                        {order.orderNumber}
                      </span>
                    </td>
                    <td><OrderTypeBadge type={order.orderType} /></td>
                    <td className="text-sm font-medium text-gray-600">{formatDate(order.orderDate)}</td>
                    <td><CountBadge count={order.items?.length || 0} /></td>
                    <td className="font-medium text-gray-800">{formatCurrency(order.finalAmount, order.currency)}</td>
                    <td className="text-sm text-gray-500">{order.containerSize || '—'}</td>
                    <td><StatusBadge status={order.orderStatus} /></td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/office/orders/${order._id}/photos`);
                        }}
                        className="p-1.5 hover:bg-brand-50 rounded-lg text-brand-600 transition-colors"
                        title="View all photos related to this order"
                      >
                        <Image size={18} />
                      </button>
                    </td>
                    {activeTab === 'new' && (
                      <td>
                        <button
                          onClick={(e) => handleStartProcessing(order._id, e)}
                          className="btn-primary btn btn-sm"
                        >
                          <Play size={12} /> Start Processing
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per order — same click targets as the table row */}
          <div className="md:hidden space-y-2 p-3 bg-gray-50/60">
            {orders.map((order) => (
              <div
                key={order._id}
                onClick={() => navigate(`/office/orders/${order._id}`)}
                className="bg-white border border-brand-100 rounded-xl p-3 shadow-sm cursor-pointer active:bg-brand-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-1 rounded truncate min-w-0">
                    {order.orderNumber}
                  </span>
                  <StatusBadge status={order.orderStatus} />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <OrderTypeBadge type={order.orderType} />
                  <CountBadge count={order.items?.length || 0} />
                  {order.containerSize && (
                    <span className="text-[11px] text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                      {order.containerSize}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="min-w-0">
                    <p className="text-gray-400">Date</p>
                    <p className="font-medium text-gray-600 truncate">{formatDate(order.orderDate)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-400">Amount</p>
                    <p className="font-semibold text-gray-800 truncate">
                      {formatCurrency(order.finalAmount, order.currency)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/office/orders/${order._id}/photos`);
                    }}
                    className="btn-secondary btn btn-sm"
                    title="View all photos related to this order"
                  >
                    <Image size={14} /> Photos
                  </button>
                  {activeTab === 'new' && (
                    <button
                      onClick={(e) => handleStartProcessing(order._id, e)}
                      className="btn-primary btn btn-sm"
                    >
                      <Play size={12} /> Start Processing
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* Import Order modal */}
      <ImportOrderModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        fileNumber={fileNumber}
        onCreated={(order) => {
          fetchOrders();
          navigate(`/office/orders/${order._id}`);
        }}
      />
    </div>
  );
}
