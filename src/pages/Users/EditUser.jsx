import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  Save,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';

const CRUD = ['create', 'read', 'update', 'delete'];

export default function EditUser() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [modules, setModules] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [perms, setPerms] = useState({});

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      email: '',
      fullName: '',
      phone: '',
      designation: '',
      department: '',
      role: 'Employee',
      isActive: true,
      password: '',
      factory: 'jhalamand',
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [userRes, modulesRes] = await Promise.all([
          authAPI.getUser(id),
          authAPI.getModules(),
        ]);
        if (cancelled) return;

        const fetched = userRes.data.data.user;
        const fetchedModules = modulesRes.data.data.modules || [];
        const fetchedDepts = modulesRes.data.data.departments || [];

        setUser(fetched);
        setModules(fetchedModules);
        setDepartments(fetchedDepts);

        reset({
          email: fetched.email || '',
          fullName: fetched.fullName || '',
          phone: fetched.phone || '',
          designation: fetched.designation || '',
          department: fetched.department || '',
          role: fetched.role || 'Employee',
          isActive: fetched.isActive,
          password: '',
          factory: fetched.factory || 'jhalamand',
        });

        // Seed permissions from fetched user
        const seeded = {};
        for (const m of fetchedModules) {
          const row = fetched.permissions?.[m.key] || {};
          seeded[m.key] = {
            create: !!row.create,
            read: !!row.read,
            update: !!row.update,
            delete: !!row.delete,
          };
        }
        setPerms(seeded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, reset]);

  const role = watch('role');
  const roleChangingToAdmin = user && user.role === 'Employee' && role === 'Admin';
  const isEmployee = role === 'Employee';

  // ─── Permission helpers ───────────────────────────────────────────────────
  const toggleAction = (key, action) => {
    setPerms((prev) => {
      const row = { ...(prev[key] || { create: false, read: false, update: false, delete: false }) };
      row[action] = !row[action];
      // Granting any write implies read
      if (row[action] && action !== 'read') row.read = true;
      return { ...prev, [key]: row };
    });
  };

  const toggleAllForModule = (key) => {
    setPerms((prev) => {
      const row = prev[key] || { create: false, read: false, update: false, delete: false };
      const allOn = CRUD.every((a) => row[a]);
      return { ...prev, [key]: { create: !allOn, read: !allOn, update: !allOn, delete: !allOn } };
    });
  };

  const applyPreset = (preset) => {
    const next = {};
    for (const m of modules) {
      if (preset === 'full') {
        next[m.key] = { create: true, read: true, update: true, delete: true };
      } else if (preset === 'readonly') {
        next[m.key] = { create: false, read: true, update: false, delete: false };
      } else {
        next[m.key] = { create: false, read: false, update: false, delete: false };
      }
    }
    setPerms(next);
  };

  const modulesByDept = useMemo(() => {
    const map = {};
    for (const m of modules) {
      if (!map[m.department]) map[m.department] = [];
      map[m.department].push(m);
    }
    return map;
  }, [modules]);

  const stats = useMemo(() => {
    let granted = 0, total = 0;
    for (const m of modules) {
      for (const a of CRUD) {
        total++;
        if (perms[m.key]?.[a]) granted++;
      }
    }
    return { granted, total };
  }, [perms, modules]);

  // ─── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (values) => {
    setSaving(true);
    try {
      const payload = {
        email: values.email,
        fullName: values.fullName,
        phone: values.phone,
        designation: values.designation,
        department: values.department,
        role: values.role,
        isActive: values.isActive,
        factory: values.role === 'Admin' ? 'all' : values.factory,
      };
      await authAPI.updateUser(id, payload);

      if (values.password) {
        await authAPI.resetUserPassword(id, values.password);
      }

      // Save permissions in the same operation for Employees
      if (values.role === 'Employee') {
        await authAPI.updateUserPermissions(id, perms);
      }

      toast.success('User updated successfully');
      navigate('/admin/users');
    } catch {
      /* errors handled by the API interceptor with toast */
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading / Not found ──────────────────────────────────────────────────
  if (loading) return <div className="text-center py-12 text-gray-400">Loading…</div>;
  if (!user) return <div className="text-center py-12 text-gray-400">User not found</div>;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <button
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1"
          >
            <ArrowLeft size={14} /> Back to users
          </button>
          <h1 className="page-title">Edit User</h1>
          <p className="page-subtitle font-mono text-xs">{user.userId}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ── Profile Information ─────────────────────────────────────── */}
        <div className="bg-white border border-brand-100 rounded-xl p-4 sm:p-6 space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest pb-3 border-b border-linen-200">
            Profile Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* User ID — always read-only */}
            <div>
              <label className="label">User ID</label>
              <input
                type="text"
                value={user.userId || ''}
                readOnly
                className="input bg-gray-50 text-gray-500 font-mono cursor-not-allowed"
              />
            </div>

            {/* Email — now editable */}
            <div>
              <label className="label">
                Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                className="input"
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email address' },
                })}
              />
              {errors.email && (
                <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Full Name */}
            <div>
              <label className="label">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                className="input"
                {...register('fullName', { required: 'Full name is required' })}
              />
              {errors.fullName && (
                <p className="text-xs text-rose-500 mt-1">{errors.fullName.message}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="label">Phone</label>
              <input type="text" className="input" {...register('phone')} />
            </div>

            {/* Designation */}
            <div>
              <label className="label">
                Designation <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                className="input"
                {...register('designation', { required: 'Designation is required' })}
              />
              {errors.designation && (
                <p className="text-xs text-rose-500 mt-1">{errors.designation.message}</p>
              )}
            </div>

            {/* Department */}
            <div>
              <label className="label">
                Department <span className="text-rose-500">*</span>
              </label>
              <select
                className="input bg-white cursor-pointer"
                {...register('department', { required: 'Department is required' })}
              >
                <option value="">— Select Department —</option>
                <option value="Showroom">Showroom</option>
                <option value="Office">Office</option>
                <option value="Admin">Admin</option>
              </select>
              {errors.department && (
                <p className="text-xs text-rose-500 mt-1">{errors.department.message}</p>
              )}
            </div>

            {/* Role */}
            <div>
              <label className="label">Role</label>
              <select className="input" {...register('role')}>
                <option value="Employee">Employee</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                {...register('isActive', {
                  setValueAs: (v) => v === true || v === 'true',
                })}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            {/* Factory — only for Employees */}
            {isEmployee && (
              <div>
                <label className="label">
                  Assigned Factory <span className="text-rose-500">*</span>
                </label>
                <select
                  className="input bg-white cursor-pointer"
                  {...register('factory', { required: 'Factory assignment is required' })}
                >
                  <option value="jhalamand">🏭 Jhalamand Factory / Showroom</option>
                  <option value="kakani">🏭 Kakani Factory / Inventory</option>
                </select>
                {errors.factory && (
                  <p className="text-xs text-rose-500 mt-1">{errors.factory.message}</p>
                )}
              </div>
            )}

            {/* Password reset */}
            <div className="md:col-span-2">
              <label className="label">New Password (optional)</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Leave blank to keep current password"
                  className="input pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Role change warnings ────────────────────────────────────── */}
        {roleChangingToAdmin && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Promoting to Administrator</p>
              <p className="text-xs mt-0.5 text-amber-700">
                All granular permissions will be removed. Admins have full access to every module.
              </p>
            </div>
          </div>
        )}

        {/* ── Module Permissions (Employees only) ─────────────────────── */}
        {isEmployee && !roleChangingToAdmin && (
          <div className="space-y-4">
            {/* Section header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Module Permissions
                </h2>
                <p className="text-xs text-gray-400 mt-0.5 font-sans">
                  Grant or revoke access to specific modules and actions
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-linen-100 border border-linen-300 px-3 py-1.5 rounded-lg">
                <Info size={12} />
                {stats.granted} / {stats.total} permissions granted
              </span>
            </div>

            {/* Quick presets */}
            <div className="bg-white border border-brand-100 rounded-xl p-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quick presets:
              </span>
              <button type="button" className="btn-ghost btn-sm" onClick={() => applyPreset('full')}>
                Full Access
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => applyPreset('readonly')}>
                Read Only
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => applyPreset('none')}>
                No Access
              </button>
            </div>

            {/* Permission matrix */}
            <div className="space-y-5">
              {departments.map((dept) => {
                const deptMods = modulesByDept[dept] || [];
                if (deptMods.length === 0) return null;
                return (
                  <div key={dept} className="space-y-3">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                      {dept}
                    </h3>
                    {deptMods.map((m) => {
                      const row = perms[m.key] || {
                        create: false, read: false, update: false, delete: false,
                      };
                      const allOn = CRUD.every((a) => row[a]);
                      return (
                        <div key={m.key} className="bg-white border border-brand-100 rounded-xl p-4 sm:p-5">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <h4 className="text-sm font-bold text-gray-800 truncate">{m.label}</h4>
                            <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-brand-600"
                                checked={allOn}
                                onChange={() => toggleAllForModule(m.key)}
                              />
                              Select All
                            </label>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {CRUD.map((a) => (
                              <label
                                key={a}
                                className={`flex items-center gap-2 text-sm capitalize px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                  row[a]
                                    ? 'bg-brand-50 border-brand-300 text-brand-800'
                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-brand-600"
                                  checked={!!row[a]}
                                  onChange={() => toggleAction(m.key, a)}
                                />
                                {a}
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-gray-400 font-sans">
              Changes take effect within ~60 seconds on the user's next page interaction, or immediately on their next login.
            </p>
          </div>
        )}

        {/* ── Admin info notice ───────────────────────────────────────── */}
        {!isEmployee && !roleChangingToAdmin && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-4 rounded-xl flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Administrator — Full Access</p>
              <p className="text-xs mt-0.5 text-blue-700">
                Admin permissions are not editable. They always have access to every module and every action.
              </p>
            </div>
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap justify-between gap-2">
          <button
            type="button"
            className="btn-ghost btn"
            onClick={() => navigate('/admin/users')}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary btn" disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save All Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
