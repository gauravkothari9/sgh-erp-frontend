import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, ShieldCheck, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../utils/api';

const CRUD = ['create', 'read', 'update', 'delete'];

export default function UserPermissions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [modules, setModules] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [perms, setPerms] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [userRes, modulesRes] = await Promise.all([
          authAPI.getUser(id),
          authAPI.getModules(),
        ]);
        if (cancelled) return;
        const fetchedUser = userRes.data.data.user;
        const fetchedModules = modulesRes.data.data.modules || [];
        const fetchedDepartments = modulesRes.data.data.departments || [];
        setUser(fetchedUser);
        setModules(fetchedModules);
        setDepartments(fetchedDepartments);

        const seeded = {};
        for (const m of fetchedModules) {
          const row = fetchedUser.permissions?.[m.key] || {};
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
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isAdminTarget = user?.role === 'Admin';

  const modulesByDept = useMemo(() => {
    const map = {};
    for (const m of modules) {
      if (!map[m.department]) map[m.department] = [];
      map[m.department].push(m);
    }
    return map;
  }, [modules]);

  const stats = useMemo(() => {
    let granted = 0;
    let total = 0;
    for (const m of modules) {
      for (const a of CRUD) {
        total += 1;
        if (perms[m.key]?.[a]) granted += 1;
      }
    }
    return { granted, total };
  }, [perms, modules]);

  const toggleAction = (key, action) => {
    setPerms((prev) => {
      const row = { ...(prev[key] || { create: false, read: false, update: false, delete: false }) };
      row[action] = !row[action];
      if (row[action] && action !== 'read') row.read = true;
      return { ...prev, [key]: row };
    });
  };

  const toggleAllForModule = (key) => {
    setPerms((prev) => {
      const row = prev[key] || { create: false, read: false, update: false, delete: false };
      const allOn = CRUD.every((a) => row[a]);
      const nextRow = { create: !allOn, read: !allOn, update: !allOn, delete: !allOn };
      return { ...prev, [key]: nextRow };
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

  const save = async () => {
    setSaving(true);
    try {
      await authAPI.updateUserPermissions(id, perms);
      toast.success('Permissions updated');
      navigate('/admin/users');
    } catch {
      /* handled */
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading…</div>;
  if (!user)
    return <div className="text-center py-12 text-gray-400">User not found</div>;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <button
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1"
          >
            <ArrowLeft size={14} /> Back to users
          </button>
          <h1 className="page-title break-words">{user.fullName}</h1>
          <p className="page-subtitle break-words">
            {user.email} · {user.role === 'Admin' ? 'Administrator' : user.designation || user.role}
          </p>
        </div>
        {!isAdminTarget && (
          <button className="btn-primary btn" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        )}
      </div>

      {isAdminTarget && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-4 rounded-xl flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Administrator — Full Access</p>
            <p className="text-xs mt-0.5 text-blue-700">
              Admin permissions are not editable. They always have access to every
              module and every action.
            </p>
          </div>
        </div>
      )}

      {!isAdminTarget && (
        <>
          <div className="bg-white border border-brand-100 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Quick presets:
            </span>
            <button className="btn-ghost btn-sm" onClick={() => applyPreset('full')}>
              Full Access
            </button>
            <button className="btn-ghost btn-sm" onClick={() => applyPreset('readonly')}>
              Read Only
            </button>
            <button className="btn-ghost btn-sm" onClick={() => applyPreset('none')}>
              No Access
            </button>
            <span className="w-full sm:w-auto sm:ml-auto text-xs text-gray-500 flex items-center gap-1">
              <Info size={12} />
              {stats.granted} / {stats.total} permissions granted
            </span>
          </div>

          <div className="space-y-5">
            {departments.map((dept) => {
              const deptMods = modulesByDept[dept] || [];
              if (deptMods.length === 0) return null;
              return (
                <div key={dept} className="space-y-3">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                    {dept}
                  </h2>
                  {deptMods.map((m) => {
                    const row = perms[m.key] || {
                      create: false,
                      read: false,
                      update: false,
                      delete: false,
                    };
                    const allOn = CRUD.every((a) => row[a]);
                    return (
                      <div
                        key={m.key}
                        className="bg-white border border-brand-100 rounded-xl p-4 sm:p-5"
                      >
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <h3 className="text-sm font-bold text-gray-800 truncate">
                            {m.label}
                          </h3>
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

          <p className="text-xs text-gray-400">
            Changes take effect within ~60 seconds on the user's next page interaction,
            or immediately on their next login.
          </p>
        </>
      )}
    </div>
  );
}
