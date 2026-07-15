import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Store, Shield, Mail, MapPin, Building2 } from 'lucide-react';
import { usersApi, locationsApi } from '../lib/endpoints';
import { MODULES, DEPARTMENTS, ROLES, modulesGrouped } from '../lib/modules';

const blankForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  role: 'EMPLOYEE',
  designation: '',
  department: '',
  modules: {},
  parentLocationId: '',
  assignedLocationId: '',
  isActive: true,
};

export default function UserAdminPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {id...} = edit
  const [search, setSearch] = useState('');

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['v2', 'users'],
    queryFn: () => usersApi.list().then((r) => r.data.data),
  });
  const { data: locData } = useQuery({
    queryKey: ['v2', 'locations'],
    queryFn: () => locationsApi.list().then((r) => r.data.data),
  });

  const parents = useMemo(
    () => (locData?.locations || []).filter((l) => l.type === 'LOCATION'),
    [locData]
  );
  const childrenByParent = useMemo(() => {
    const m = {};
    for (const l of locData?.locations || []) {
      if (l.type === 'SHOWROOM' && l.parentId != null) {
        if (!m[l.parentId]) m[l.parentId] = [];
        m[l.parentId].push(l);
      }
    }
    return m;
  }, [locData]);

  const filtered = useMemo(() => {
    const list = usersData?.users || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.designation || '').toLowerCase().includes(q)
    );
  }, [usersData, search]);

  const deactivate = useMutation({
    mutationFn: (id) => usersApi.remove(id),
    onSuccess: () => {
      toast.success('User deactivated');
      qc.invalidateQueries({ queryKey: ['v2', 'users'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not deactivate'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold text-brand-ink">Users</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/v2/admin/locations"
            className="text-xs flex items-center gap-1 text-brand-inkMuted hover:text-brand-primary"
          >
            <Store size={12} /> Locations
          </Link>
          <button
            onClick={() => setEditing({})}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90"
          >
            <Plus size={14} /> Add user
          </button>
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, email, department…"
        className="w-full px-3 py-2 rounded-lg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 outline-none text-sm"
      />

      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        {isLoading && <div className="p-4 text-sm text-brand-inkMuted">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="p-4 text-sm text-brand-inkMuted">No users found.</div>
        )}
        <ul className="divide-y divide-brand-border">
          {filtered.map((u) => (
            <li key={u.id} className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center font-bold text-sm">
                {(u.fullName || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-brand-ink truncate">{u.fullName}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary font-mono">
                    {u.role}
                  </span>
                  {!u.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-error/10 text-brand-error">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-brand-inkMuted flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="inline-flex items-center gap-1"><Mail size={10} />{u.email}</span>
                  {u.department && (
                    <span className="inline-flex items-center gap-1"><Building2 size={10} />{u.department}</span>
                  )}
                  {u.assignedLocation && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={10} />{u.assignedLocation.name}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(u)}
                  className="p-2 rounded-lg hover:bg-brand-bg text-brand-inkMuted hover:text-brand-ink"
                  title="Edit"
                >
                  <Pencil size={14} />
                </button>
                {u.isActive && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Deactivate ${u.fullName}? They will no longer be able to log in.`)) {
                        deactivate.mutate(u.id);
                      }
                    }}
                    className="p-2 rounded-lg hover:bg-brand-error/10 text-brand-inkMuted hover:text-brand-error"
                    title="Deactivate"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {editing !== null && (
        <UserForm
          initial={editing}
          parents={parents}
          childrenByParent={childrenByParent}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['v2', 'users'] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function UserForm({ initial, parents, childrenByParent, onClose, onSaved }) {
  const isEdit = Boolean(initial?.id);
  const initialParentId = initial?.assignedLocation
    ? initial.assignedLocation.type === 'LOCATION'
      ? initial.assignedLocation.id
      : initial.assignedLocation.parentId
    : '';

  const [form, setForm] = useState({
    ...blankForm,
    fullName: initial?.fullName || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    role: initial?.role || 'EMPLOYEE',
    designation: initial?.designation || '',
    department: initial?.department || '',
    modules: (initial?.permissions?.modules) || {},
    parentLocationId: initialParentId || '',
    assignedLocationId:
      initial?.assignedLocation?.type === 'SHOWROOM' ? initial.assignedLocation.id : '',
    isActive: initial?.isActive ?? true,
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const grouped = useMemo(() => modulesGrouped(), []);
  const subShowrooms = form.parentLocationId ? childrenByParent[form.parentLocationId] || [] : [];

  const needsParent = form.role === 'MANAGER' || form.role === 'SHOWROOM_STAFF';
  const needsChild = form.role === 'SHOWROOM_STAFF';

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const toggleModule = (key) =>
    setForm((f) => ({
      ...f,
      modules: { ...f.modules, [key]: !f.modules[key] },
    }));

  const setAllInGroup = (groupKeys, value) =>
    setForm((f) => {
      const next = { ...f.modules };
      for (const k of groupKeys) next[k] = value;
      return { ...f, modules: next };
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.fullName.trim()) return setError('Full name is required');
    if (!form.email.trim()) return setError('Email is required');
    if (!isEdit && form.password.length < 8) return setError('Password must be at least 8 characters');
    if (isEdit && form.password && form.password.length < 8)
      return setError('New password must be at least 8 characters');

    let assignedLocationId = null;
    if (form.role === 'MANAGER') {
      if (!form.parentLocationId) return setError('Pick a showroom (Jhalamand / Kakani)');
      assignedLocationId = form.parentLocationId;
    } else if (form.role === 'SHOWROOM_STAFF') {
      if (!form.parentLocationId) return setError('Pick a showroom (Jhalamand / Kakani)');
      if (!form.assignedLocationId) return setError('Pick a sub-showroom');
      assignedLocationId = form.assignedLocationId;
    }

    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      role: form.role,
      designation: form.designation.trim() || null,
      department: form.department.trim() || null,
      modules: form.modules,
      assignedLocationId,
      isActive: form.isActive,
    };
    if (form.password) payload.password = form.password;

    setBusy(true);
    try {
      if (isEdit) {
        await usersApi.update(initial.id, payload);
        toast.success('User updated');
      } else {
        await usersApi.create(payload);
        toast.success('User created');
      }
      onSaved();
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not save user';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-brand-surface w-full max-w-2xl rounded-2xl border border-brand-border shadow-xl my-8 max-h-[90vh] flex flex-col"
      >
        <header className="px-5 py-3 border-b border-brand-border flex items-center justify-between">
          <h2 className="font-bold text-brand-ink">{isEdit ? `Edit ${initial.fullName}` : 'Add user'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-inkMuted text-sm hover:text-brand-ink"
          >
            Cancel
          </button>
        </header>

        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Identity */}
          <section className="grid sm:grid-cols-2 gap-3">
            <Field label="Full name" required>
              <input
                value={form.fullName}
                onChange={(e) => setField('fullName', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label={isEdit ? 'New password (leave blank to keep)' : 'Password'} required={!isEdit}>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
          </section>

          {/* Role + Department */}
          <section className="grid sm:grid-cols-2 gap-3">
            <Field label="Role" required>
              <select
                value={form.role}
                onChange={(e) => setField('role', e.target.value)}
                className={inputCls}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <input
                list="dept-options"
                value={form.department}
                onChange={(e) => setField('department', e.target.value)}
                className={inputCls}
                placeholder="e.g. Sales"
              />
              <datalist id="dept-options">
                {DEPARTMENTS.map((d) => (<option key={d} value={d} />))}
              </datalist>
            </Field>
            <Field label="Designation">
              <input
                value={form.designation}
                onChange={(e) => setField('designation', e.target.value)}
                className={inputCls}
                placeholder="e.g. Senior Showroom Staff"
              />
            </Field>
            <Field label="Status">
              <label className="inline-flex items-center gap-2 text-sm mt-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
                Active
              </label>
            </Field>
          </section>

          {/* Showroom assignment */}
          {needsParent && (
            <section className="border border-brand-border rounded-xl p-3 bg-brand-bg/40 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-brand-inkMuted flex items-center gap-1">
                <MapPin size={12} /> Showroom assignment
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Showroom" required hint="Jhalamand or Kakani">
                  <select
                    value={form.parentLocationId}
                    onChange={(e) => {
                      setField('parentLocationId', e.target.value);
                      setField('assignedLocationId', '');
                    }}
                    className={inputCls}
                  >
                    <option value="">— Select —</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </Field>
                {needsChild && (
                  <Field label="Sub-showroom" required>
                    <select
                      value={form.assignedLocationId}
                      onChange={(e) => setField('assignedLocationId', e.target.value)}
                      className={inputCls}
                      disabled={!form.parentLocationId}
                    >
                      <option value="">
                        {form.parentLocationId ? '— Select —' : 'Pick a showroom first'}
                      </option>
                      {subShowrooms.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              {needsChild && form.parentLocationId && subShowrooms.length === 0 && (
                <p className="text-xs text-brand-error">
                  This showroom has no sub-showrooms yet. Create one in Locations first.
                </p>
              )}
            </section>
          )}

          {/* Module access */}
          <section className="border border-brand-border rounded-xl p-3 bg-brand-bg/40 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-brand-inkMuted flex items-center gap-1">
                <Shield size={12} /> Module access
              </h3>
              {form.role === 'ADMIN' && (
                <span className="text-[10px] text-brand-inkMuted">Admins have access to everything</span>
              )}
            </div>
            <div className="space-y-3">
              {Object.entries(grouped).map(([group, items]) => {
                const keys = items.map((m) => m.key);
                const allOn = keys.every((k) => form.modules[k]);
                return (
                  <div key={group}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold text-brand-ink">{group}</p>
                      <button
                        type="button"
                        onClick={() => setAllInGroup(keys, !allOn)}
                        disabled={form.role === 'ADMIN'}
                        className="text-[10px] text-brand-primary hover:underline disabled:opacity-50"
                      >
                        {allOn ? 'Clear all' : 'Select all'}
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {items.map((m) => (
                        <label
                          key={m.key}
                          className={`inline-flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer hover:bg-brand-surface ${form.role === 'ADMIN' ? 'opacity-60' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={form.role === 'ADMIN' ? true : !!form.modules[m.key]}
                            disabled={form.role === 'ADMIN'}
                            onChange={() => toggleModule(m.key)}
                          />
                          {m.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {error && (
            <p className="text-sm text-brand-error bg-brand-error/10 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-brand-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-brand-inkMuted hover:bg-brand-bg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90 disabled:opacity-60"
          >
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
          </button>
        </footer>
      </form>
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 outline-none text-sm';

function Field({ label, required, hint, children }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-brand-ink">
        {label}
        {required && <span className="text-brand-error"> *</span>}
        {hint && <span className="font-normal text-brand-inkMuted ml-1">({hint})</span>}
      </span>
      {children}
    </label>
  );
}
