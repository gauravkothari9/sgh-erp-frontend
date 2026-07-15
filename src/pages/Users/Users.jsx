import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Pencil,
  ShieldCheck,
  KeyRound,
  Trash2,
  UserCog,
  Search,
  Users as UsersIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import ConfirmDialog from '../../components/common/ConfirmDialog';

export default function Users() {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { type, user }
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authAPI.getUsers();
      setUsers(res.data.data.users || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const departments = useMemo(() => {
    const set = new Set(users.map((u) => u.department).filter(Boolean));
    return Array.from(set);
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const hay = `${u.fullName || ''} ${u.email || ''} ${u.userId || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (deptFilter !== 'all' && u.department !== deptFilter) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      return true;
    });
  }, [users, search, deptFilter, roleFilter, statusFilter]);

  const handleToggleActive = async (user) => {
    try {
      await authAPI.updateUser(user._id, { isActive: !user.isActive });
      toast.success(`${user.fullName} ${user.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch {
      /* handled */
    }
  };

  const handleResetPassword = async () => {
    const newPassword = prompt(
      `Set a new password for ${confirm.user.fullName}:\n(Min 8 chars, 12+ and symbols for Admin)`
    );
    if (!newPassword) {
      setConfirm(null);
      return;
    }
    try {
      await authAPI.resetUserPassword(confirm.user._id, newPassword);
      toast.success('Password reset successfully');
    } catch {
      /* handled */
    }
    setConfirm(null);
  };

  const handleDelete = async () => {
    try {
      await authAPI.deleteUser(confirm.user._id);
      toast.success(`${confirm.user.fullName} deleted`);
      fetchUsers();
    } catch {
      /* handled */
    }
    setConfirm(null);
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users & Permissions</h1>
          <p className="page-subtitle">
            Manage user accounts, designations and module-level access
          </p>
        </div>
        <button
          className="btn-primary btn"
          onClick={() => navigate('/admin/users/create')}
        >
          <Plus size={16} /> Create New User
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-brand-100 p-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[240px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or user ID…"
            className="input pl-9 py-2 text-sm w-full"
          />
        </div>
        <select
          className="input py-2 text-sm w-full sm:w-auto"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="input py-2 text-sm w-[calc(50%-0.25rem)] sm:w-auto"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="all">All Roles</option>
          <option value="Admin">Admin</option>
          <option value="Employee">Employee</option>
        </select>
        <select
          className="input py-2 text-sm w-[calc(50%-0.25rem)] sm:w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-brand-100 overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm min-w-[64rem]">
            <thead className="bg-brand-50 text-gray-600 text-left">
              <tr>
                <th className="px-4 py-3 font-semibold">User ID</th>
                <th className="px-4 py-3 font-semibold">Full Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Designation</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                    <UsersIcon size={28} className="mx-auto mb-2 text-gray-300" />
                    No users match the current filters.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((u) => {
                  const isSelf = u._id === me?._id;
                  return (
                    <tr
                      key={u._id}
                      className="border-t border-brand-50 hover:bg-brand-50/30"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        {u.userId || '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {u.fullName}
                        {isSelf && (
                          <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                            you
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {u.role === 'Admin'
                          ? u.designation || 'Administrator'
                          : u.designation || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {u.department || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            u.role === 'Admin'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {u.role}
                        </span>
                        {u.role === 'Admin' && (
                          <span className="ml-1.5 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">
                            Full Access
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-1">
                        <button
                          onClick={() => navigate(`/admin/users/${u._id}/edit`)}
                          className="btn-ghost btn-sm"
                          title="Edit user"
                        >
                          <Pencil size={15} />
                        </button>
                        {u.role !== 'Admin' && (
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${u._id}/permissions`)
                            }
                            className="btn-ghost btn-sm"
                            title="Edit permissions"
                          >
                            <ShieldCheck size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => setConfirm({ type: 'reset', user: u })}
                          className="btn-ghost btn-sm"
                          title="Reset password"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(u)}
                          className="btn-ghost btn-sm"
                          title={u.isActive ? 'Deactivate' : 'Activate'}
                          disabled={isSelf}
                        >
                          <UserCog size={15} />
                        </button>
                        <button
                          onClick={() => setConfirm({ type: 'delete', user: u })}
                          className="btn-ghost btn-sm text-rose-500"
                          title="Delete user"
                          disabled={isSelf}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Mobile card list — same data/handlers as the table above */}
        <div className="md:hidden p-3 space-y-2">
          {loading && (
            <div className="py-10 text-center text-gray-400">Loading…</div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-12 text-center text-gray-400">
              <UsersIcon size={28} className="mx-auto mb-2 text-gray-300" />
              No users match the current filters.
            </div>
          )}
          {!loading &&
            filtered.map((u) => {
              const isSelf = u._id === me?._id;
              return (
                <div
                  key={u._id}
                  className="border border-brand-100 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        {u.fullName}
                        {isSelf && (
                          <span className="ml-2 text-[10px] bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                            you
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                        u.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        u.role === 'Admin'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {u.role}
                    </span>
                    {u.role === 'Admin' && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold">
                        Full Access
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div className="min-w-0">
                      <p className="text-gray-400">User ID</p>
                      <p className="font-mono text-gray-600 truncate">{u.userId || '—'}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-gray-400">Department</p>
                      <p className="text-gray-600 truncate">{u.department || '—'}</p>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <p className="text-gray-400">Designation</p>
                      <p className="text-gray-600 truncate">
                        {u.role === 'Admin'
                          ? u.designation || 'Administrator'
                          : u.designation || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-brand-50 pt-2">
                    <button
                      onClick={() => navigate(`/admin/users/${u._id}/edit`)}
                      className="btn-ghost btn-sm"
                      title="Edit user"
                    >
                      <Pencil size={15} />
                    </button>
                    {u.role !== 'Admin' && (
                      <button
                        onClick={() => navigate(`/admin/users/${u._id}/permissions`)}
                        className="btn-ghost btn-sm"
                        title="Edit permissions"
                      >
                        <ShieldCheck size={15} />
                      </button>
                    )}
                    <button
                      onClick={() => setConfirm({ type: 'reset', user: u })}
                      className="btn-ghost btn-sm"
                      title="Reset password"
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(u)}
                      className="btn-ghost btn-sm"
                      title={u.isActive ? 'Deactivate' : 'Activate'}
                      disabled={isSelf}
                    >
                      <UserCog size={15} />
                    </button>
                    <button
                      onClick={() => setConfirm({ type: 'delete', user: u })}
                      className="btn-ghost btn-sm text-rose-500"
                      title="Delete user"
                      disabled={isSelf}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.type === 'delete' ? handleDelete : handleResetPassword}
        title={confirm?.type === 'delete' ? 'Delete user' : 'Reset password'}
        message={
          confirm?.type === 'delete'
            ? `Delete ${confirm?.user?.fullName}? This cannot be undone.`
            : `Reset ${confirm?.user?.fullName}'s password?`
        }
        confirmLabel={confirm?.type === 'delete' ? 'Delete' : 'Reset'}
        confirmVariant={confirm?.type === 'delete' ? 'danger' : 'primary'}
      />
    </div>
  );
}
