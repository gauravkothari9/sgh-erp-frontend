import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Phone, Mail, Globe, DollarSign,
  ShoppingBag, Plus, ToggleLeft, ToggleRight, MapPin,
  FileText, Activity, Trash2, UserCheck,
} from 'lucide-react';
import { customerAPI } from '../utils/api';
import { formatDate, formatCurrency, getCountryFlag, timeAgo, resolveMediaSrc, imgErrorFallback } from '../utils/formatters';
import { StatusBadge, CountBadge } from '../components/common/Badge';
import { StatusBadge as OrderStatusBadge } from '../components/common/Badge';
import { PageLoader } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import ConfirmDialog from '../components/common/ConfirmDialog';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';

const InfoRow = ({ label, value, mono }) => {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-2.5 border-b border-brand-50 last:border-0">
      <span className="text-xs text-gray-400 sm:w-40 flex-shrink-0">{label}</span>
      <span className={`text-sm text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOfficeStaff, can } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchCustomer = async () => {
    setLoading(true);
    try {
      const res = await customerAPI.getById(id);
      setData(res.data.data);
    } catch {
      navigate('/office/customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomer(); }, [id]);

  const handleStatusToggle = async () => {
    const newStatus = data.customer.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await customerAPI.updateStatus(id, newStatus);
      toast.success(`Customer ${newStatus === 'Active' ? 'activated' : 'deactivated'}`);
      fetchCustomer();
    } catch {}
  };

  const handleDelete = async () => {
    try {
      await customerAPI.delete(id);
      toast.success('Customer deleted');
      navigate('/office/customers');
    } catch {
      /* handled */
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  if (loading) return <PageLoader message="Loading customer..." />;
  if (!data) return null;

  const { customer, orders, stats } = data;

  const emailList = customer.emails?.length > 0 ? customer.emails : (customer.email ? [{ email: customer.email, label: 'Primary' }] : []);
  const phoneList = customer.phones?.length > 0 ? customer.phones : (customer.phone ? [{ number: customer.phone, label: 'Primary', isWhatsapp: false }] : []);
  const shippingAddressList = customer.shippingAddresses?.length > 0 ? customer.shippingAddresses : (customer.addresses?.length > 0 ? customer.addresses : (customer.address ? [{ label: 'Primary', line1: customer.address, country: customer.country }] : []));
  const billingAddressList = customer.billingAddresses?.length > 0 ? customer.billingAddresses : (customer.addresses?.length > 0 ? customer.addresses : (customer.address ? [{ label: 'Primary', line1: customer.address, country: customer.country }] : []));

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'orders', label: `Orders (${stats.totalOrders})`, icon: ShoppingBag },
  ];

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button onClick={() => navigate('/office/customers')} className="btn-ghost btn p-2 mt-0.5">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2 mb-1">
              <span className="font-mono text-xs bg-brand-100 text-brand-700 px-2 py-1 rounded font-bold">
                {customer.fileNumber}
              </span>
              <StatusBadge status={customer.status} type="customer" />
            </div>
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {customer.photo && (
                <img src={resolveMediaSrc(customer.photo)} alt="Customer" onError={imgErrorFallback} className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-full border border-gray-200 object-cover" />
              )}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2 break-words">
                  {getCountryFlag(customer.country)} {customer.companyName}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5 break-words">
                  {customer.contactPersonName}
                  {customer.designation ? ` · ${customer.designation}` : ''}
                  {customer.agent ? ` · Agent: ${customer.agent}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {can('customers', 'update') && (
            <button onClick={handleStatusToggle} className="btn-secondary btn text-sm" title={customer.status === 'Active' ? 'Deactivate' : 'Activate'}>
              {customer.status === 'Active' ? (
                <><ToggleRight size={16} className="text-green-500" /> Active</>
              ) : (
                <><ToggleLeft size={16} className="text-gray-400" /> Inactive</>
              )}
            </button>
          )}
          {can('orders', 'create') && (
            <button onClick={() => navigate(`/office/orders/new?customer=${customer._id}`)} className="btn-secondary btn text-sm">
              <Plus size={15} /> New Order
            </button>
          )}
          {can('customers', 'update') && (
            <button onClick={() => navigate(`/office/customers/${id}/edit`)} className="btn-primary btn text-sm">
              <Edit2 size={14} /> Edit
            </button>
          )}
          {can('customers', 'delete') && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-secondary btn p-2 text-red-600 hover:bg-red-50"
              title="Delete Customer"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete customer"
        message={`Delete ${customer.companyName}? This cannot be undone and may affect related orders.`}
        confirmLabel="Delete"
        confirmVariant="danger"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag },
          { label: 'Active Orders', value: stats.activeOrders, icon: Activity },
          { label: 'Total Value', value: formatCurrency(stats.totalOrderValue, customer.currency), icon: DollarSign },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            {/* smaller on phones so long currency values don't overflow the tile */}
            <p className="text-base sm:text-2xl font-bold text-gray-900 break-words">{s.value}</p>
            <p className="text-[13px] sm:text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-100 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
                ${activeTab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Contact */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Phone size={15} className="text-brand-500" /> Contact Details
            </h3>
            <div>
              {emailList.length > 0 && emailList.map((e, i) => (
                <InfoRow key={i} label={`Email${e.label ? ` (${e.label})` : ''}`} value={e.email} />
              ))}
              {phoneList.length > 0 && phoneList.map((p, i) => (
                <InfoRow key={i} label={`Phone${p.label ? ` (${p.label})` : ''}${p.isWhatsapp ? ' (WA)' : ''}`} value={p.number} />
              ))}
              <InfoRow label="Country" value={`${getCountryFlag(customer.country)} ${customer.country}`} />
              {customer.agent && <InfoRow label="Agent" value={customer.agent} />}
            </div>
          </div>

          {/* Addresses */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <MapPin size={15} className="text-brand-500" /> Addresses
            </h3>
            
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Shipping Addresses</h4>
            {shippingAddressList.length === 0 ? (
              <p className="text-sm text-gray-400 italic mb-4">No shipping addresses added</p>
            ) : (
              <div className="space-y-3 mb-4">
                {shippingAddressList.map((a, i) => (
                  <div key={i} className="p-3 bg-brand-50 rounded-lg">
                    {a.label && <p className="text-xs font-bold text-brand-600 mb-1">{a.label}</p>}
                    <p className="text-sm text-gray-700">{a.line1}</p>
                    {a.line2 && <p className="text-sm text-gray-700">{a.line2}</p>}
                    <p className="text-sm text-gray-500">
                      {[a.city, a.state, a.country, a.pincode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Billing Addresses</h4>
            {billingAddressList.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No billing addresses added</p>
            ) : (
              <div className="space-y-3">
                {billingAddressList.map((a, i) => (
                  <div key={i} className="p-3 bg-brand-50 rounded-lg">
                    {a.label && <p className="text-xs font-bold text-brand-600 mb-1">{a.label}</p>}
                    <p className="text-sm text-gray-700">{a.line1}</p>
                    {a.line2 && <p className="text-sm text-gray-700">{a.line2}</p>}
                    <p className="text-sm text-gray-500">
                      {[a.city, a.state, a.country, a.pincode].filter(Boolean).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pricing & Commercial */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
              <DollarSign size={15} className="text-brand-500" /> Commercial Terms
            </h3>
            <div>
              <InfoRow label="Currency" value={customer.currency} />
              <InfoRow label="Payment Terms" value={customer.paymentTerms} />
              <InfoRow label="Shipping Terms" value={customer.shippingTerms} />
              <InfoRow label="Tax ID / VAT" value={customer.taxId} mono />
              <InfoRow label="Customer Since" value={formatDate(customer.customerSince)} />
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Logistics</h4>
              <InfoRow label="Port of Loading" value={customer.portOfLoading} />
              <InfoRow label="Port of Discharge" value={customer.portOfDischarge} />
              <InfoRow label="Destination Country" value={customer.countryOfDestination} />
            </div>
          </div>

          {/* Advance Payments */}
          {customer.advancePayments?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <UserCheck size={15} className="text-brand-500" /> Advance Payments
              </h3>
              <div className="space-y-2">
                {customer.advancePayments.map((ap, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="text-sm font-mono text-brand-700">{ap.orderNumber}</p>
                      <p className="text-xs text-gray-400">{formatDate(ap.date)}</p>
                    </div>
                    <p className="font-bold text-green-700">{formatCurrency(ap.amount, customer.currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {customer.notes && (
            <div className="card lg:col-span-2">
              <h3 className="text-sm font-bold text-gray-800 mb-2">Internal Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{customer.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="card p-0 overflow-hidden">
          {orders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No orders yet"
              description="Create the first order for this customer."
              action={
                <button onClick={() => navigate(`/office/orders/new?customer=${customer._id}`)} className="btn-primary btn">
                  <Plus size={15} /> Create Order
                </button>
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="sgh-table min-w-[52rem]">
                  <thead>
                    <tr>
                      <th>Order Number</th>
                      <th>Type</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Value</th>
                      <th>Container</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order._id} className="cursor-pointer" onClick={() => navigate(`/office/orders/${order._id}`)}>
                        <td>
                          <span className="font-mono text-xs font-semibold text-brand-700">{order.orderNumber}</span>
                        </td>
                        <td className="text-sm">{order.orderType}</td>
                        <td className="text-sm text-gray-500">{formatDate(order.orderDate)}</td>
                        <td><CountBadge count={order.items?.length || 0} /></td>
                        <td className="font-medium text-gray-800">{formatCurrency(order.finalAmount, order.currency)}</td>
                        <td className="text-sm text-gray-500">{order.containerSize || '—'}</td>
                        <td><OrderStatusBadge status={order.orderStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list — same data/handlers as the table above */}
              <div className="md:hidden p-3 space-y-2">
                {orders.map((order) => (
                  <div
                    key={order._id}
                    onClick={() => navigate(`/office/orders/${order._id}`)}
                    className="border border-brand-100 rounded-lg p-3 active:bg-brand-50/50 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-sm font-bold text-brand-700 truncate">{order.orderNumber}</p>
                      <OrderStatusBadge status={order.orderStatus} />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-gray-800">
                      {formatCurrency(order.finalAmount, order.currency)}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <div className="min-w-0">
                        <p className="text-gray-400">Type</p>
                        <p className="text-gray-700 truncate">{order.orderType}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-400">Date</p>
                        <p className="text-gray-700 truncate">{formatDate(order.orderDate)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-400">Container</p>
                        <p className="text-gray-700 truncate">{order.containerSize || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-400">Items</p>
                        <CountBadge count={order.items?.length || 0} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
