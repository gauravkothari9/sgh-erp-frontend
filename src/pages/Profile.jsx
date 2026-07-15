import { useState, useEffect } from 'react';
import {
  User as UserIcon, Mail, Phone, Building2, ShieldCheck, KeyRound, Save, Loader2,
  Check, X, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../utils/api';
import { useAuthStore } from '../store/authStore';

const ACTIONS = ['create', 'read', 'update', 'delete'];

const day = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const Card = ({ title, subtitle, children, footer }) => (
  <div className="bg-white border border-linen-300 rounded-xl shadow-card overflow-hidden">
    <div className="px-5 py-3.5 border-b border-linen-200 bg-linen-50">
      <p className="text-sm font-bold text-espresso-900">{title}</p>
      {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
    </div>
    <div className="p-5">{children}</div>
    {footer && <div className="px-5 py-3 border-t border-linen-200 bg-linen-50 flex justify-end gap-2">{footer}</div>}
  </div>
);

// Your own account: contact details you can change, the role/department you
// can't, the exact permissions you hold, and a password change.
export default function Profile() {
  const { user, isAdmin, updateUser } = useAuthStore();

  const [form, setForm] = useState({ fullName: '', email: '', phone: '', designation: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  const [modules, setModules] = useState([]);

  useEffect(() => {
    setForm({
      fullName: user?.fullName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      designation: user?.designation || '',
    });
  }, [user]);

  // The canonical module list, so the matrix shows every module — not just the
  // ones that happen to be ticked.
  useEffect(() => {
    authAPI
      .getModules()
      .then((res) => setModules(res.data?.data?.modules || []))
      .catch(() => setModules([]));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const saveProfile = async () => {
    if (!form.fullName.trim()) { toast.error('Name is required'); return; }
    setSavingProfile(true);
    try {
      const res = await authAPI.updateMe(form);
      updateUser(res.data.data.user); // keep the navbar/sidebar in sync
      toast.success('Profile updated');
    } catch { /* toasted */ } finally { setSavingProfile(false); }
  };

  const savePassword = async () => {
    if (!pw.currentPassword || !pw.newPassword) { toast.error('Fill both password fields'); return; }
    if (pw.newPassword !== pw.confirm) { toast.error('New passwords do not match'); return; }
    setSavingPw(true);
    try {
      await authAPI.updatePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast.success('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch { /* toasted */ } finally { setSavingPw(false); }
  };

  const admin = isAdmin();
  const perms = user?.permissions || {};

  // Group the matrix by department, the same way the permissions screen does.
  const byDept = modules.reduce((acc, m) => {
    (acc[m.department] = acc[m.department] || []).push(m);
    return acc;
  }, {});

  const granted = modules.filter((m) => admin || perms[m.key]?.read).length;

  return (
    <div className="space-y-5 pb-4">
      {/* Header */}
      <div className="rounded-2xl bg-white border border-linen-300 shadow-card px-6 py-5 flex flex-wrap items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-espresso-100 border border-espresso-200 text-espresso-800 flex items-center justify-center text-xl font-serif font-bold shrink-0">
          {user?.fullName?.[0] || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-serif font-bold text-espresso-900 tracking-tight truncate">{user?.fullName}</h1>
          <p className="text-sm text-gray-500 truncate">
            {user?.designation || user?.role}{user?.department ? ` · ${user.department}` : ''}
            {user?.userId ? ` · ${user.userId}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
            admin ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-linen-100 text-espresso-600 border-linen-300'
          }`}>
            {user?.role}
          </span>
          {user?.lastLogin && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Calendar size={12} /> Last login {day(user.lastLogin)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Contact details */}
        <Card
          title="Your details"
          subtitle="Role, department and permissions are set by an Admin"
          footer={
            <button onClick={saveProfile} disabled={savingProfile} className="btn btn-primary">
              {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save changes
            </button>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label label-required">Full name</label>
              <div className="relative">
                <UserIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.fullName} onChange={set('fullName')} className="input pl-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.email} onChange={set('email')} className="input pl-9" />
                </div>
              </div>
              <div>
                <label className="label">Phone</label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.phone} onChange={set('phone')} className="input pl-9" />
                </div>
              </div>
            </div>
            <div>
              <label className="label">Designation</label>
              <div className="relative">
                <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.designation} onChange={set('designation')} className="input pl-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-linen-200">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-400">Role</p>
                <p className="text-sm font-semibold text-gray-800">{user?.role}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-gray-400">Department</p>
                <p className="text-sm font-semibold text-gray-800">{user?.department || '—'}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Password */}
        <Card
          title="Password"
          subtitle="Change the password you sign in with"
          footer={
            <button onClick={savePassword} disabled={savingPw} className="btn btn-primary">
              {savingPw ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Change password
            </button>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label label-required">Current password</label>
              <input
                type="password"
                value={pw.currentPassword}
                onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
                className="input"
                autoComplete="current-password"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label label-required">New password</label>
                <input
                  type="password"
                  value={pw.newPassword}
                  onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
                  className="input"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label label-required">Confirm</label>
                <input
                  type="password"
                  value={pw.confirm}
                  onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                  className={`input ${pw.confirm && pw.confirm !== pw.newPassword ? 'border-red-400' : ''}`}
                  autoComplete="new-password"
                />
              </div>
            </div>
            {pw.confirm && pw.confirm !== pw.newPassword && (
              <p className="text-[11px] text-red-600">Passwords do not match.</p>
            )}
            <p className="text-[11px] text-gray-400">
              You'll stay signed in on this device after changing it.
            </p>
          </div>
        </Card>
      </div>

      {/* Permissions */}
      <Card
        title="Your access"
        subtitle={admin ? 'Admins hold every module' : `${granted} of ${modules.length} modules granted`}
      >
        {admin && (
          <p className="mb-4 text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <ShieldCheck size={15} /> You are an Admin — full access to every module, regardless of the matrix below.
          </p>
        )}
        {modules.length === 0 ? (
          <p className="text-sm text-gray-400">Could not load the module list.</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(byDept).map(([dept, mods]) => (
              <div key={dept}>
                <p className="text-[11px] uppercase tracking-wider text-gray-400 mb-2">{dept}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                        <th className="text-left font-semibold py-1.5">Module</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="text-center font-semibold py-1.5 w-20">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-linen-200">
                      {mods.map((m) => (
                        <tr key={m.key}>
                          <td className="py-2 text-gray-700">{m.label}</td>
                          {ACTIONS.map((a) => {
                            const on = admin || !!perms[m.key]?.[a];
                            return (
                              <td key={a} className="py-2 text-center">
                                {on ? (
                                  <Check size={15} className="inline text-emerald-600" strokeWidth={2.5} />
                                ) : (
                                  <X size={15} className="inline text-gray-200" strokeWidth={2.5} />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
