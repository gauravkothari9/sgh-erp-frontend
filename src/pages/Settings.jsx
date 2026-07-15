import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Loader2, Building2, Receipt, Bell, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { settingsAPI } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { SHOWROOM_ZONES } from '../utils/showroomZones';

const PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'];

const NOTIFICATION_GROUPS = [
  { key: 'orders',     label: 'Orders',     desc: 'Finalized, status changes, cancellations, container complete' },
  { key: 'production', label: 'Production', desc: 'Order enters production, items advancing between stages' },
  { key: 'showroom',   label: 'Showroom',   desc: 'Product sold out, product added without a local price' },
  { key: 'local',      label: 'Local sales', desc: 'Bills created, payments, balances, returns and refunds' },
  { key: 'admin',      label: 'Admin',      desc: 'New users, permission changes' },
];

const Card = ({ icon: Icon, title, subtitle, children }) => (
  <div className="bg-white border border-linen-300 rounded-xl shadow-card overflow-hidden">
    <div className="px-5 py-3.5 border-b border-linen-200 bg-linen-50 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
        <Icon size={16} />
      </div>
      <div>
        <p className="text-sm font-bold text-espresso-900">{title}</p>
        {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 disabled:opacity-50 ${
      checked ? 'bg-brand-600' : 'bg-gray-300'
    }`}
    style={{ height: '1.375rem' }}
  >
    <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-[1.125rem]' : ''}`} />
  </button>
);

/**
 * Platform settings. Anyone signed in can view (the company block is what prints
 * on bills); saving needs `settings:update`, so the form is read-only otherwise.
 */
export default function Settings() {
  const can = useAuthStore((s) => s.can);
  const canEdit = can('settings', 'update');

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsAPI
      .get()
      .then((res) => setSettings(res.data?.data?.settings || null))
      .catch(() => setSettings(null))
      .finally(() => setLoading(false));
  }, []);

  const setSection = (section, key, value) =>
    setSettings((s) => ({ ...s, [section]: { ...s[section], [key]: value } }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await settingsAPI.update({
        company: settings.company,
        local: settings.local,
        notifications: settings.notifications,
      });
      setSettings(res.data.data.settings);
      toast.success('Settings saved');
    } catch { /* toasted */ } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-gray-400">
        <Loader2 className="animate-spin" size={18} /> Loading settings…
      </div>
    );
  }
  if (!settings) {
    return <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">Settings could not be loaded.</div>;
  }

  const c = settings.company || {};
  const l = settings.local || {};
  const n = settings.notifications || {};

  return (
    <div className="space-y-5 pb-4">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <SettingsIcon size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="page-title">System Settings</h1>
            <p className="page-subtitle">
              {canEdit ? 'Company details, billing defaults and platform notifications' : 'Read-only — you do not have edit rights'}
            </p>
          </div>
        </div>
        {canEdit && (
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save settings
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Company */}
        <Card icon={Building2} title="Company" subtitle="Prints on local bills and invoices">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Trading name</label>
                <input value={c.name || ''} onChange={(e) => setSection('company', 'name', e.target.value)} disabled={!canEdit} className="input" />
              </div>
              <div>
                <label className="label">Legal name</label>
                <input value={c.legalName || ''} onChange={(e) => setSection('company', 'legalName', e.target.value)} disabled={!canEdit} className="input" />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <textarea rows={2} value={c.address || ''} onChange={(e) => setSection('company', 'address', e.target.value)} disabled={!canEdit} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">City</label>
                <input value={c.city || ''} onChange={(e) => setSection('company', 'city', e.target.value)} disabled={!canEdit} className="input" />
              </div>
              <div>
                <label className="label">GSTIN</label>
                <input
                  value={c.gstin || ''}
                  onChange={(e) => setSection('company', 'gstin', e.target.value.toUpperCase())}
                  disabled={!canEdit}
                  className="input uppercase"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Phone</label>
                <input value={c.phone || ''} onChange={(e) => setSection('company', 'phone', e.target.value)} disabled={!canEdit} className="input" />
              </div>
              <div>
                <label className="label">Email</label>
                <input value={c.email || ''} onChange={(e) => setSection('company', 'email', e.target.value)} disabled={!canEdit} className="input" />
              </div>
            </div>
          </div>
        </Card>

        {/* Local billing */}
        <Card icon={Receipt} title="Local billing" subtitle="Defaults for walk-in showroom sales">
          <div className="space-y-3">
            <div>
              <label className="label">Default payment mode</label>
              <select
                value={l.defaultPaymentMode || 'Cash'}
                onChange={(e) => setSection('local', 'defaultPaymentMode', e.target.value)}
                disabled={!canEdit}
                className="input"
              >
                {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bill footer</label>
              <input value={l.billFooter || ''} onChange={(e) => setSection('local', 'billFooter', e.target.value)} disabled={!canEdit} className="input" />
              <p className="text-[10px] text-gray-400 mt-0.5">Printed at the bottom of every local bill.</p>
            </div>
            <div>
              <label className="label">Terms &amp; conditions</label>
              <textarea rows={3} value={l.billTerms || ''} onChange={(e) => setSection('local', 'billTerms', e.target.value)} disabled={!canEdit} className="input" />
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card icon={Bell} title="Notifications" subtitle="Which platform events raise a notification">
          <div className="space-y-3">
            {NOTIFICATION_GROUPS.map((g) => (
              <div key={g.key} className="flex items-start justify-between gap-3 py-1">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{g.label}</p>
                  <p className="text-[11px] text-gray-400">{g.desc}</p>
                </div>
                <Toggle
                  checked={n[g.key] !== false}
                  onChange={(v) => setSection('notifications', g.key, v)}
                  disabled={!canEdit}
                />
              </div>
            ))}
            <p className="text-[11px] text-gray-400 pt-2 border-t border-linen-200">
              Recipients are always the Admins plus the employees who hold the module the event belongs to.
            </p>
          </div>
        </Card>

        {/* Showroom layout — informational */}
        <Card icon={Store} title="Showroom layout" subtitle="Branches and their zones">
          <div className="space-y-3">
            {Object.entries(SHOWROOM_ZONES).map(([branch, zones]) => (
              <div key={branch} className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-800">{branch}</p>
                <div className="flex gap-1.5">
                  {zones.map((z) => (
                    <span key={z} className="text-[11px] px-2 py-0.5 rounded-md bg-linen-100 text-espresso-700 border border-linen-300">
                      Zone {z}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-400 pt-2 border-t border-linen-200">
              Zones are fixed in code (<code>backend/config/showroom.js</code>). Ask a developer to add or rename one.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
