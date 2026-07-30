import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Info,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';

// ─── Password strength utility ───────────────────────────────────────────────
const scorePassword = (pw, isAdmin) => {
  if (!pw) return { level: 'none', label: '', pct: 0 };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const needed = isAdmin ? 5 : 3;
  if (score < needed - 1) return { level: 'weak', label: 'Weak', pct: 33 };
  if (score < needed) return { level: 'medium', label: 'Medium', pct: 66 };
  return { level: 'strong', label: 'Strong', pct: 100 };
};

// ─── Step indicator ──────────────────────────────────────────────────────────
const StepIndicator = ({ step, isAdmin }) => {
  const steps = [
    { n: 1, label: 'User Details' },
    { n: 2, label: 'Permissions' },
    { n: 3, label: 'Review & Confirm' },
  ];
  return (
    <div className="bg-white border border-brand-100 rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {steps.map((s, idx) => {
          const disabled = isAdmin && s.n === 2;
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} className="flex items-center flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    disabled
                      ? 'bg-gray-50 border-gray-200 text-gray-300'
                      : done
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : active
                      ? 'bg-brand-100 border-brand-600 text-brand-700'
                      : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  {done ? <Check size={15} /> : s.n}
                </div>
                <div className="min-w-0">
                  {/* "Step N" is redundant next to the numbered circle on phones */}
                  <p
                    className={`hidden sm:block text-xs font-semibold ${
                      disabled
                        ? 'text-gray-300'
                        : active
                        ? 'text-gray-900'
                        : 'text-gray-500'
                    }`}
                  >
                    Step {s.n}
                  </p>
                  <p
                    className={`text-[13px] sm:text-xs truncate ${
                      disabled
                        ? 'text-gray-300'
                        : active
                        ? 'text-brand-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {s.label}
                  </p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`hidden sm:block flex-1 h-0.5 mx-3 ${
                    step > s.n ? 'bg-brand-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function CreateUser() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    getValues,
    formState: { errors },
  } = useForm({
    mode: 'onBlur',
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'Employee',
      designation: '',
      factory: 'jhalamand',
    },
  });

  const [step, setStep] = useState(1);
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [saving, setSaving] = useState(false);

  // Module list + per-department expansion
  const [modules, setModules] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [selectedModules, setSelectedModules] = useState({});
  const [permissions, setPermissions] = useState({});

  const role = watch('role');
  const password = watch('password');
  const isAdmin = role === 'Admin';

  // Fetch modules + departments from backend on mount.
  useEffect(() => {
    (async () => {
      try {
        const res = await authAPI.getModules();
        const mods = res.data.data.modules || [];
        const depts = res.data.data.departments || [];
        setModules(mods);
        setDepartments(depts);
        // Expand all departments by default for discoverability.
        const exp = {};
        for (const d of depts) exp[d] = true;
        setExpanded(exp);
      } catch {
        /* handled by interceptor */
      }
    })();
  }, []);

  const modulesByDept = useMemo(() => {
    const map = {};
    for (const m of modules) {
      if (!map[m.department]) map[m.department] = [];
      map[m.department].push(m);
    }
    return map;
  }, [modules]);

  const pwStrength = scorePassword(password, isAdmin);

  const selectedModuleKeys = useMemo(
    () => Object.keys(selectedModules).filter((k) => selectedModules[k]),
    [selectedModules]
  );

  // ─── Step navigation ──────────────────────────────────────────────────────
  const goNextFromStep1 = async () => {
    const ok = await trigger([
      'fullName',
      'email',
      'password',
      'confirmPassword',
      'role',
      'designation',
      'factory',
    ]);
    if (!ok) return;

    if (!isAdmin) {
      if (selectedModuleKeys.length === 0) {
        toast.error('Select at least one module for the employee.');
        return;
      }
      // Seed permissions for newly selected modules with `read` on by default.
      const next = { ...permissions };
      for (const key of selectedModuleKeys) {
        if (!next[key]) {
          next[key] = { create: false, read: true, update: false, delete: false };
        }
      }
      // Drop permissions for modules that were deselected.
      for (const key of Object.keys(next)) {
        if (!selectedModules[key]) delete next[key];
      }
      setPermissions(next);
      setStep(2);
    } else {
      // Admin skips the permission step.
      setStep(3);
    }
  };

  const goNextFromStep2 = () => {
    // Validate that each selected module at least has `read` checked.
    for (const key of selectedModuleKeys) {
      if (!permissions[key]?.read) {
        toast.error('Each selected module must at least have Read access.');
        return;
      }
    }
    setStep(3);
  };

  const goBackFromStep3 = () => setStep(isAdmin ? 1 : 2);

  // ─── Permission editing helpers ──────────────────────────────────────────
  const toggleModuleSelection = (key) => {
    setSelectedModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDeptAll = (dept) => {
    const deptMods = modulesByDept[dept] || [];
    const allOn = deptMods.every((m) => selectedModules[m.key]);
    setSelectedModules((prev) => {
      const next = { ...prev };
      for (const m of deptMods) next[m.key] = !allOn;
      return next;
    });
  };

  const toggleAction = (moduleKey, action) => {
    setPermissions((prev) => {
      const row = { ...(prev[moduleKey] || { create: false, read: false, update: false, delete: false }) };
      row[action] = !row[action];
      // Auto-enable read when any non-read action is turned on.
      if (row[action] && action !== 'read') {
        row.read = true;
      }
      return { ...prev, [moduleKey]: row };
    });
  };

  const toggleAllForModule = (moduleKey) => {
    setPermissions((prev) => {
      const row = prev[moduleKey] || { create: false, read: false, update: false, delete: false };
      const allOn = row.create && row.read && row.update && row.delete;
      const nextRow = {
        create: !allOn,
        read: !allOn,
        update: !allOn,
        delete: !allOn,
      };
      return { ...prev, [moduleKey]: nextRow };
    });
  };

  const applyPreset = (preset) => {
    setPermissions((prev) => {
      const next = { ...prev };
      for (const key of selectedModuleKeys) {
        if (preset === 'all') {
          next[key] = { create: true, read: true, update: true, delete: true };
        } else if (preset === 'read') {
          next[key] = { create: false, read: true, update: false, delete: false };
        } else {
          next[key] = { create: false, read: true, update: false, delete: false };
        }
      }
      return next;
    });
    if (preset === 'clear') {
      // keep read on per validation rule, but this is basically a reset.
    }
  };

  // ─── Stats for step 2 footer ──────────────────────────────────────────────
  const grantedCount = useMemo(() => {
    let granted = 0;
    for (const key of selectedModuleKeys) {
      const row = permissions[key] || {};
      if (row.create) granted += 1;
      if (row.read) granted += 1;
      if (row.update) granted += 1;
      if (row.delete) granted += 1;
    }
    return granted;
  }, [permissions, selectedModuleKeys]);
  const totalCount = selectedModuleKeys.length * 4;

  // ─── Final submit ────────────────────────────────────────────────────────
  const onSubmit = async () => {
    const values = getValues();
    setSaving(true);
    try {
      const payload = {
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
        role: values.role,
        designation: values.designation,
      };

      if (isAdmin) {
        payload.designation = values.designation || 'Administrator';
        payload.department = 'Admin';
        payload.factory = 'all';
      } else {
        // Infer department from the first selected module's department.
        const firstKey = selectedModuleKeys[0];
        const firstMod = modules.find((m) => m.key === firstKey);
        payload.department = firstMod?.department || 'Office';
        payload.permissions = permissions;
        payload.factory = values.factory;
      }

      await authAPI.createUser(payload);
      toast.success('User created successfully');
      navigate('/admin/users');
    } catch {
      /* handled by interceptor */
    } finally {
      setSaving(false);
    }
  };

  const moduleLabel = (key) => modules.find((m) => m.key === key)?.label || key;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="page-header">
        <div>
          <button
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1"
          >
            <ArrowLeft size={14} /> Back to users
          </button>
          <h1 className="page-title flex items-center gap-2">
            <UserPlus size={20} className="text-brand-600" /> Create New User
          </h1>
          <p className="page-subtitle">
            Set up a new account and configure module access
          </p>
        </div>
      </div>

      <StepIndicator step={step} isAdmin={isAdmin} />

      {/* ─── STEP 1 — User Details ───────────────────────────────────── */}
      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            goNextFromStep1();
          }}
          className="space-y-5"
        >
          <div className="bg-white border border-brand-100 rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-800">User Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">User ID</label>
                <input
                  type="text"
                  value="Will be auto-generated (SGH-U-XXXX)"
                  readOnly
                  className="input bg-gray-50 text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="label">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  className="input"
                  {...register('fullName', { required: 'Full name is required' })}
                />
                {errors.fullName && (
                  <p className="text-xs text-rose-500 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="label">
                  Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  className="input"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^\S+@\S+\.\S+$/,
                      message: 'Invalid email format',
                    },
                  })}
                />
                {errors.email && (
                  <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="label">Phone No.</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  className="input"
                  {...register('phone')}
                />
              </div>

              <div>
                <label className="label">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Enter password"
                    className="input pr-10"
                    {...register('password', {
                      required: 'Password is required',
                      validate: (val) => {
                        if (isAdmin) {
                          if (val.length < 12) return 'Admin password needs at least 12 chars';
                          if (!/[A-Z]/.test(val)) return 'Add an uppercase letter';
                          if (!/[a-z]/.test(val)) return 'Add a lowercase letter';
                          if (!/[0-9]/.test(val)) return 'Add a digit';
                          if (!/[^A-Za-z0-9]/.test(val)) return 'Add a symbol';
                        } else {
                          if (val.length < 8) return 'Minimum 8 characters';
                          if (!/[A-Za-z]/.test(val) || !/[0-9]/.test(val))
                            return 'Must include letters and digits';
                        }
                        return true;
                      },
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <div className="mt-1.5 space-y-1">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          pwStrength.level === 'weak'
                            ? 'bg-rose-500'
                            : pwStrength.level === 'medium'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pwStrength.pct}%` }}
                      />
                    </div>
                    <p className="text-[13px] text-gray-500">
                      Strength: <span className="font-semibold">{pwStrength.label}</span>
                    </p>
                  </div>
                )}
                {errors.password && (
                  <p className="text-xs text-rose-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="label">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPw2 ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    className="input pr-10"
                    {...register('confirmPassword', {
                      required: 'Please confirm the password',
                      validate: (val) =>
                        val === getValues('password') || 'Passwords do not match',
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-rose-500 mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div>
                <label className="label">
                  Role <span className="text-rose-500">*</span>
                </label>
                <select className="input" {...register('role')}>
                  <option value="Employee">Employee</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="label">
                  Designation <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sales Executive, Export Manager"
                  className="input"
                  {...register('designation', {
                    required: 'Designation is required',
                  })}
                />
                {errors.designation && (
                  <p className="text-xs text-rose-500 mt-1">{errors.designation.message}</p>
                )}
              </div>

              {!isAdmin && (
                <div>
                  <label className="label">
                    Assigned Factory <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="input bg-white cursor-pointer"
                    {...register('factory', {
                      required: 'Factory assignment is required',
                    })}
                  >
                    <option value="jhalamand">🏭 Jhalamand Factory / Showroom</option>
                    <option value="kakani">🏭 Kakani Factory / Inventory</option>
                  </select>
                  {errors.factory && (
                    <p className="text-xs text-rose-500 mt-1">{errors.factory.message}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Department / Module Access */}
          {!isAdmin && (
            <div className="bg-white border border-brand-100 rounded-xl p-4 sm:p-6 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-800">
                    Department & Module Access
                  </h2>
                  <p className="text-xs text-gray-500">
                    Choose which modules this employee should be able to work in.
                    Fine-grained CRUD permissions are set in the next step.
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-brand-700 bg-brand-50 px-2 py-1 rounded font-semibold">
                  {selectedModuleKeys.length} selected
                </span>
              </div>

              <div className="space-y-2 pt-2">
                {departments.map((dept) => {
                  const deptMods = modulesByDept[dept] || [];
                  if (deptMods.length === 0) return null;
                  const allOn = deptMods.every((m) => selectedModules[m.key]);
                  const anyOn = deptMods.some((m) => selectedModules[m.key]);
                  return (
                    <div
                      key={dept}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-gray-50 cursor-pointer"
                        onClick={() => setExpanded((p) => ({ ...p, [dept]: !p[dept] }))}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {expanded[dept] ? (
                            <ChevronDown size={16} className="text-gray-500 shrink-0" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-500 shrink-0" />
                          )}
                          <span className="text-sm font-semibold text-gray-800 truncate">
                            {dept}
                          </span>
                          <span className="text-[12px] text-gray-400 whitespace-nowrap">
                            {deptMods.length} module{deptMods.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        <label
                          className="flex shrink-0 items-center gap-1.5 text-xs text-gray-600 cursor-pointer whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand-600"
                            checked={allOn}
                            ref={(el) => {
                              if (el) el.indeterminate = !allOn && anyOn;
                            }}
                            onChange={() => toggleDeptAll(dept)}
                          />
                          Select all
                        </label>
                      </div>
                      {expanded[dept] && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-3 sm:px-4 py-3">
                          {deptMods.map((m) => (
                            <label
                              key={m.key}
                              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-brand-50/40 rounded px-2 py-1"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-brand-600"
                                checked={!!selectedModules[m.key]}
                                onChange={() => toggleModuleSelection(m.key)}
                              />
                              {m.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin info banner */}
          {isAdmin && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-4 rounded-xl flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Administrators have full access</p>
                <p className="text-xs mt-0.5 text-blue-700">
                  Admin accounts bypass the permission system — they can access every
                  module and perform every action. No further configuration is needed.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <button
              type="button"
              className="btn-ghost btn"
              onClick={() => navigate('/admin/users')}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary btn">
              {isAdmin ? 'Next: Review' : 'Next: Permissions'}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}

      {/* ─── STEP 2 — Permissions (Employee only) ───────────────────────── */}
      {step === 2 && !isAdmin && (
        <div className="space-y-5">
          <div className="bg-white border border-brand-100 rounded-xl p-5 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quick presets:
            </span>
            <button className="btn-ghost btn-sm" onClick={() => applyPreset('all')}>
              Grant All
            </button>
            <button className="btn-ghost btn-sm" onClick={() => applyPreset('read')}>
              Read Only
            </button>
            <button className="btn-ghost btn-sm" onClick={() => applyPreset('clear')}>
              Clear All
            </button>
            <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
              <Info size={12} />
              Read access is auto-enabled when you grant other actions.
            </span>
          </div>

          <div className="space-y-3">
            {selectedModuleKeys.map((key) => {
              const row = permissions[key] || {
                create: false,
                read: false,
                update: false,
                delete: false,
              };
              const allOn = row.create && row.read && row.update && row.delete;
              return (
                <div
                  key={key}
                  className="bg-white border border-brand-100 rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-800">
                      {moduleLabel(key)}
                    </h3>
                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-brand-600"
                        checked={allOn}
                        onChange={() => toggleAllForModule(key)}
                      />
                      Select All
                    </label>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['create', 'read', 'update', 'delete'].map((a) => (
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
                          onChange={() => toggleAction(key, a)}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-gray-500">
              <strong className="text-gray-800">{grantedCount}</strong> of{' '}
              <strong className="text-gray-800">{totalCount}</strong> permissions granted
              across <strong className="text-gray-800">{selectedModuleKeys.length}</strong>{' '}
              modules
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost btn" onClick={() => setStep(1)}>
                <ArrowLeft size={16} /> Back
              </button>
              <button className="btn-primary btn" onClick={goNextFromStep2}>
                Next: Review <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STEP 3 — Review & Confirm ───────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Card 1 — User Information */}
            <div className="bg-white border border-brand-100 rounded-xl p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-3">User Information</h2>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">User ID</dt>
                  <dd className="font-mono text-gray-800 text-xs">
                    Will be auto-generated
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Full Name</dt>
                  <dd className="text-gray-800 font-medium">{getValues('fullName')}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 shrink-0">Email</dt>
                  <dd className="text-gray-800 min-w-0 break-all text-right">{getValues('email')}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="text-gray-800">{getValues('phone') || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Role</dt>
                  <dd>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        isAdmin
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {getValues('role')}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Designation</dt>
                  <dd className="text-gray-800">
                    {getValues('designation') || (isAdmin ? 'Administrator' : '—')}
                  </dd>
                </div>
                {!isAdmin && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Department</dt>
                    <dd className="text-gray-800">
                      {(() => {
                        const firstKey = selectedModuleKeys[0];
                        return (
                          modules.find((m) => m.key === firstKey)?.department || 'Office'
                        );
                      })()}
                    </dd>
                  </div>
                )}
                {isAdmin && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Department</dt>
                    <dd className="text-gray-800">Admin</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Card 2 — Access Summary */}
            <div className="bg-white border border-brand-100 rounded-xl p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-3">Access Summary</h2>
              {isAdmin ? (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-4 rounded-lg flex items-start gap-3">
                  <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Full system access</p>
                    <p className="text-xs mt-0.5 text-blue-700">
                      All modules, all actions.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold">Module</th>
                        <th className="px-2 py-2 text-center font-semibold">Create</th>
                        <th className="px-2 py-2 text-center font-semibold">Read</th>
                        <th className="px-2 py-2 text-center font-semibold">Update</th>
                        <th className="px-2 py-2 text-center font-semibold">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedModuleKeys.map((key) => {
                        const row = permissions[key] || {};
                        return (
                          <tr key={key} className="border-t border-gray-100">
                            <td className="px-2 py-2 text-gray-800">
                              {moduleLabel(key)}
                            </td>
                            {['create', 'read', 'update', 'delete'].map((a) => (
                              <td key={a} className="px-2 py-2 text-center">
                                {row[a] ? (
                                  <span className="text-emerald-600 font-bold">✓</span>
                                ) : (
                                  <span className="text-rose-400">✗</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <button className="btn-ghost btn" onClick={goBackFromStep3}>
              <ArrowLeft size={16} /> Back
            </button>
            <button
              className="btn-primary btn"
              onClick={handleSubmit(onSubmit)}
              disabled={saving}
            >
              <Check size={16} />
              {saving ? 'Creating…' : 'Confirm & Create User'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
