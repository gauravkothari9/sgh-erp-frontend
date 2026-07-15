import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { customerAPI } from '../utils/api';
import { formatDate, getCountryFlag } from '../utils/formatters';
import { StatusBadge, CountBadge } from '../components/common/Badge';
import { SkeletonRow } from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { useDebounce } from '../hooks/useDebounce';
import { useAuthStore } from '../store/authStore';

export default function Customers() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(search, 400);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customerAPI.getAll({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      setCustomers(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage your customer profiles and file numbers</p>
        </div>
        {can('customers', 'create') && (
          <button onClick={() => navigate('/office/customers/new')} className="btn-primary btn">
            <Plus size={16} />
            New Customer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, file number, agent..."
              className="input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full sm:w-40"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">
            {pagination.total || 0} customers found
          </span>
        </div>

        {/* Desktop table */}
        <div className="table-container rounded-none border-none hidden md:block overflow-x-auto">
          <table className="sgh-table min-w-[56rem]">
            <thead>
              <tr>
                <th>File Number</th>
                <th>Company</th>
                <th>Country</th>
                <th>Agent</th>
                <th>Orders</th>
                <th>Status</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-0">
                    <EmptyState
                      icon={Users}
                      title="No customers found"
                      description="Create your first customer to get started."
                      action={
                        can('customers', 'create') ? (
                          <button onClick={() => navigate('/office/customers/new')} className="btn-primary btn">
                            <Plus size={15} /> New Customer
                          </button>
                        ) : null
                      }
                    />
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => navigate(`/office/customers/${c._id}`)}
                    className="cursor-pointer"
                  >
                    <td>
                      <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-1 rounded">
                        {c.fileNumber}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-800 font-bold text-xs">
                          {c.companyName?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{c.companyName}</p>
                          {c.contactPersonName && (
                            <p className="text-[11px] text-gray-400">{c.contactPersonName}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="flex items-center gap-1.5">
                        <span>{getCountryFlag(c.country)}</span>
                        <span>{c.country}</span>
                      </span>
                    </td>
                    <td className="text-sm text-gray-600">
                      {c.agent || '—'}
                    </td>
                    <td>
                      <CountBadge count={c.totalOrders || 0} />
                    </td>
                    <td>
                      <StatusBadge status={c.status} type="customer" />
                    </td>
                    <td className="text-gray-500 text-xs">
                      {formatDate(c.customerSince || c.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile card list — same data/handlers as the table above */}
        <div className="md:hidden p-3 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />
            ))
          ) : customers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers found"
              description="Create your first customer to get started."
              action={
                can('customers', 'create') ? (
                  <button onClick={() => navigate('/office/customers/new')} className="btn-primary btn">
                    <Plus size={15} /> New Customer
                  </button>
                ) : null
              }
            />
          ) : (
            customers.map((c) => (
              <div
                key={c._id}
                onClick={() => navigate(`/office/customers/${c._id}`)}
                className="border border-brand-100 rounded-lg p-3 active:bg-brand-50/50 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 flex-shrink-0 rounded-full bg-brand-100 flex items-center justify-center text-brand-800 font-bold text-xs">
                      {c.companyName?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{c.companyName}</p>
                      {c.contactPersonName && (
                        <p className="text-[11px] text-gray-400 truncate">{c.contactPersonName}</p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={c.status} type="customer" />
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div className="min-w-0">
                    <p className="text-gray-400">File Number</p>
                    <p className="font-mono font-semibold text-brand-700 truncate">{c.fileNumber}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-400">Country</p>
                    <p className="text-gray-700 truncate">
                      {getCountryFlag(c.country)} {c.country}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-400">Agent</p>
                    <p className="text-gray-700 truncate">{c.agent || '—'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-gray-400">Since</p>
                    <p className="text-gray-700 truncate">{formatDate(c.customerSince || c.createdAt)}</p>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                  <span>Orders</span>
                  <CountBadge count={c.totalOrders || 0} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-t border-brand-50">
            <p className="text-xs text-gray-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => p - 1)} disabled={!pagination.hasPrevPage} className="btn-secondary btn btn-sm">Previous</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={!pagination.hasNextPage} className="btn-secondary btn btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
