import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, Loader2, Pencil, Trash2, Phone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { localCustomerAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const EMPTY = {
  name: '', phone: '', altPhone: '', email: '',
  address: '', city: '',
  companyName: '', gstin: '',
  notes: '', tags: '',
};

// Create / edit a walk-in customer.
export function LocalCustomerModal({ isOpen, onClose, customer, onSaved }) {
  const isEdit = !!customer;
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setForm(customer
      ? { ...EMPTY, ...customer, tags: (customer.tags || []).join(', ') }
      : EMPTY);
  }, [isOpen, customer]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (!form.phone.trim()) { toast.error('Phone is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      const res = isEdit
        ? await localCustomerAPI.update(customer._id, payload)
        : await localCustomerAPI.create(payload);
      toast.success(isEdit ? 'Customer updated' : 'Customer added');
      onSaved?.(res.data.data.customer);
      onClose();
    } catch { /* toasted */ } finally { setSaving(false); }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? 'Edit local customer' : 'New local customer'}
      size="md"
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="btn btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Add customer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label label-required">Name</label>
            <input value={form.name} onChange={set('name')} className="input" autoFocus />
          </div>
          <div>
            <label className="label label-required">Phone</label>
            <input value={form.phone} onChange={set('phone')} className="input" placeholder="+91…" />
          </div>
          <div>
            <label className="label">Alt. phone</label>
            <input value={form.altPhone} onChange={set('altPhone')} className="input" />
          </div>
          <div>
            <label className="label">Email</label>
            <input value={form.email} onChange={set('email')} className="input" />
          </div>
        </div>

        <div>
          <label className="label">Address</label>
          <textarea value={form.address} onChange={set('address')} rows={2} className="input" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">City</label>
            <input value={form.city} onChange={set('city')} className="input" />
          </div>
          <div>
            <label className="label">Company</label>
            <input value={form.companyName} onChange={set('companyName')} className="input" placeholder="if any" />
          </div>
          <div>
            <label className="label">GSTIN</label>
            <input
              value={form.gstin}
              onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
              className="input uppercase"
              placeholder="if any"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tags</label>
            <input value={form.tags} onChange={set('tags')} className="input" placeholder="VIP, Dealer, Architect" />
            <p className="text-[10px] text-gray-400 mt-0.5">Comma separated</p>
          </div>
          <div>
            <label className="label">Notes</label>
            <input value={form.notes} onChange={set('notes')} className="input" />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function LocalCustomers() {
  const navigate = useNavigate();
  const can = useAuthStore((s) => s.can);
  const canCreate = can('localCustomers', 'create');
  const canUpdate = can('localCustomers', 'update');
  const canDelete = can('localCustomers', 'delete');

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formTarget, setFormTarget] = useState(null); // { customer }
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await localCustomerAPI.getAll({ search });
      setCustomers(res.data?.data?.customers || []);
    } catch { setCustomers([]); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchCustomers, search]);

  const doDelete = async () => {
    try {
      await localCustomerAPI.remove(deleteTarget._id);
      toast.success('Customer removed');
      setDeleteTarget(null);
      fetchCustomers();
    } catch { /* toasted */ }
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <Users size={20} strokeWidth={1.6} />
          </div>
          <div>
            <h1 className="page-title">Local Customers</h1>
            <p className="page-subtitle">{customers.length} walk-in customer{customers.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        {canCreate && (
          <button onClick={() => setFormTarget({ customer: null })} className="btn btn-primary">
            <Plus size={16} /> New customer
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, company, city…"
          className="input pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-gray-400"><Loader2 className="animate-spin" size={18} /> Loading…</div>
      ) : customers.length === 0 ? (
        <div className="bg-white border border-linen-300 rounded-xl p-12 text-center text-gray-400">
          No local customers yet.{canCreate ? ' Click “New customer” to add one.' : ''}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div
              key={c._id}
              onClick={() => navigate(`/local/customers/${c._id}`)}
              className="card bg-white border border-linen-300 shadow-card hover:shadow-card-hover hover:border-brand-300 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-800 truncate">{c.name}</p>
                  {c.companyName && <p className="text-[11px] text-gray-400 truncate">{c.companyName}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {canUpdate && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setFormTarget({ customer: c }); }}
                      className="text-gray-300 hover:text-brand-700"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                      className="text-gray-300 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2 flex items-center gap-1.5">
                <Phone size={13} className="text-gray-400" /> {c.phone}
              </p>
              {(c.city || c.address) && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 truncate">
                  <MapPin size={13} className="text-gray-400 shrink-0" /> {c.city || c.address}
                </p>
              )}
              {c.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {c.tags.map((t) => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <LocalCustomerModal
        isOpen={!!formTarget}
        customer={formTarget?.customer || null}
        onClose={() => setFormTarget(null)}
        onSaved={fetchCustomers}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title="Remove customer"
        confirmLabel="Remove"
      >
        <p className="text-sm text-gray-600 mt-2">Remove <strong>{deleteTarget?.name}</strong>?</p>
      </ConfirmDialog>
    </div>
  );
}
