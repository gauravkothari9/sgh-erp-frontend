import { useState } from 'react';
import { Plus, X, Save } from 'lucide-react';
import Modal from '../common/Modal';
import { Spinner } from '../common/LoadingSpinner';
import { customerAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { showValidationErrors } from '../../utils/validation';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'AUD', 'CAD', 'SGD', 'OTHER'];
const SHIPPING_TERMS = ['FOB', 'CIF', 'CNF', 'CFR', 'EXW', 'DDP', 'OTHER', ''];

// Inline customer-create form rendered inside a Modal. Mirrors the field
// set of /office/customers/new closely (same backend validation), so a
// user can spin up a customer from the order draft without losing context.
// On success we hand the created customer back via onCreated() — the caller
// (CreateOrder) auto-selects them and the modal closes.

function Field({ label, required, type = 'text', value, onChange, placeholder, options, error, className = '' }) {
  return (
    <div className={className}>
      <label className={`label ${required ? 'label-required' : ''}`}>{label}</label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`input ${error ? 'input-error' : ''}`}>
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className={`input resize-none ${error ? 'input-error' : ''}`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`input ${error ? 'input-error' : ''}`}
        />
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const EMPTY_ADDRESS = { label: '', line1: '', line2: '', city: '', state: '', country: '', pincode: '' };

export default function CreateCustomerModal({ isOpen, onClose, onCreated, prefillCompanyName = '' }) {
  const [form, setForm] = useState({
    fileNumber: '',
    companyName: prefillCompanyName,
    contactPersonName: '',
    designation: '',
    agent: '',
    country: '',
    currency: 'USD',
    shippingTerms: '',
    paymentTerms: '',
    portOfLoading: '',
    portOfDischarge: '',
    countryOfDestination: '',
    taxId: '',
    notes: '',
  });

  const [emails, setEmails] = useState([{ email: '', label: 'Primary' }]);
  const [phones, setPhones] = useState([{ number: '', label: 'Primary', isWhatsapp: false }]);
  const [shippingAddresses, setShippingAddresses] = useState([{ ...EMPTY_ADDRESS, label: 'Warehouse' }]);
  const [billingAddresses, setBillingAddresses] = useState([{ ...EMPTY_ADDRESS, label: 'HQ' }]);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const updateField = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  // Generic per-row update for the array sections. Mutating a copy keeps
  // the existing entries (label, isWhatsapp, etc.) intact.
  const updateInArray = (setter) => (idx, field, value) =>
    setter((arr) => {
      const next = [...arr];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });

  const updateEmail = updateInArray(setEmails);
  const updatePhone = updateInArray(setPhones);
  const updateShippingAddress = updateInArray(setShippingAddresses);
  const updateBillingAddress = updateInArray(setBillingAddresses);

  const validate = () => {
    const e = {};
    if (!form.companyName.trim()) e.companyName = 'Company Name is required';
    if (!form.contactPersonName.trim()) e.contactPersonName = 'Contact Person is required';
    if (!form.country.trim()) e.country = 'Country is required';
    setErrors(e);
    return e;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      showValidationErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        status: 'Active',
        emails: emails.filter((e) => e.email.trim()),
        phones: phones.filter((p) => p.number.trim()),
        shippingAddresses: shippingAddresses.filter((a) => a.line1.trim()),
        billingAddresses: billingAddresses.filter((a) => a.line1.trim()),
      };
      const res = await customerAPI.create(payload);
      const created = res.data.data.customer;
      toast.success('Customer created');
      // Hand back the fresh record so the caller can auto-select it.
      onCreated?.(created);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title="Create New Customer"
      size="full"
      footer={(
        <>
          <button onClick={onClose} disabled={saving} className="btn-secondary btn">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary btn">
            {saving ? <Spinner size="sm" /> : <Save size={15} />}
            Create &amp; Select
          </button>
        </>
      )}
    >
      <div className="space-y-5">
        {/* File Number (optional, auto-generated server-side if empty) */}
        <div className="card">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">File Number</h3>
          <Field
            label="File Number (optional — auto-generated if empty)"
            value={form.fileNumber}
            onChange={(v) => updateField('fileNumber', v.toUpperCase())}
            placeholder="e.g. SGH-2026-0001"
            error={errors.fileNumber}
          />
        </div>

        {/* Company Info */}
        <div className="card">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Company Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" required value={form.companyName} onChange={(v) => updateField('companyName', v)} placeholder="e.g. HomeStyle Imports Ltd" error={errors.companyName} />
            <Field label="Contact Person" required value={form.contactPersonName} onChange={(v) => updateField('contactPersonName', v)} placeholder="e.g. John Smith" error={errors.contactPersonName} />
            <Field label="Designation" value={form.designation} onChange={(v) => updateField('designation', v)} placeholder="e.g. Purchase Manager" />
            <Field label="Agent (if any)" value={form.agent} onChange={(v) => updateField('agent', v)} placeholder="e.g. Agent name" />
            <Field label="Country" required value={form.country} onChange={(v) => updateField('country', v)} placeholder="e.g. USA" error={errors.country} />
          </div>
        </div>

        {/* Contacts — emails + phones combined */}
        <div className="card space-y-5">
          <ArraySection
            title="Email Addresses"
            items={emails}
            onAdd={() => setEmails([...emails, { email: '', label: '' }])}
            onRemove={(idx) => setEmails(emails.filter((_, i) => i !== idx))}
            renderItem={(item, idx) => (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-6">
                <div className="sm:col-span-2">
                  <label className="label">Email</label>
                  <input value={item.email} onChange={(e) => updateEmail(idx, 'email', e.target.value)} placeholder="buyer@company.com" className="input" />
                </div>
                <div>
                  <label className="label">Label</label>
                  <input value={item.label} onChange={(e) => updateEmail(idx, 'label', e.target.value)} placeholder="Primary, Accounts" className="input" />
                </div>
              </div>
            )}
          />

          <ArraySection
            title="Phone Numbers"
            items={phones}
            onAdd={() => setPhones([...phones, { number: '', label: '', isWhatsapp: false }])}
            onRemove={(idx) => setPhones(phones.filter((_, i) => i !== idx))}
            renderItem={(item, idx) => (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pr-6">
                <div className="sm:col-span-2">
                  <label className="label">Phone Number</label>
                  <input value={item.number} onChange={(e) => updatePhone(idx, 'number', e.target.value)} placeholder="+1 555 000 0000" className="input" />
                </div>
                <div>
                  <label className="label">Label</label>
                  <input value={item.label} onChange={(e) => updatePhone(idx, 'label', e.target.value)} placeholder="Mobile, Office" className="input" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input
                      type="checkbox"
                      checked={item.isWhatsapp}
                      onChange={(e) => updatePhone(idx, 'isWhatsapp', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-gray-600">WhatsApp</span>
                  </label>
                </div>
              </div>
            )}
          />
        </div>

        {/* Billing addresses */}
        <div className="card">
          <ArraySection
            title="Billing Addresses"
            items={billingAddresses}
            onAdd={() => setBillingAddresses([...billingAddresses, { ...EMPTY_ADDRESS }])}
            onRemove={(idx) => setBillingAddresses(billingAddresses.filter((_, i) => i !== idx))}
            renderItem={(item, idx) => (
              <AddressGrid item={item} update={(f, v) => updateBillingAddress(idx, f, v)} />
            )}
          />
        </div>

        {/* Shipping addresses */}
        <div className="card">
          <ArraySection
            title="Shipping Addresses"
            items={shippingAddresses}
            onAdd={() => setShippingAddresses([...shippingAddresses, { ...EMPTY_ADDRESS }])}
            onRemove={(idx) => setShippingAddresses(shippingAddresses.filter((_, i) => i !== idx))}
            renderItem={(item, idx) => (
              <AddressGrid item={item} update={(f, v) => updateShippingAddress(idx, f, v)} />
            )}
          />
        </div>

        {/* Commercial & logistics */}
        <div className="card">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Commercial Terms &amp; Logistics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Currency" value={form.currency} onChange={(v) => updateField('currency', v)} options={CURRENCIES} />
            <Field label="Shipping Terms" value={form.shippingTerms} onChange={(v) => updateField('shippingTerms', v)} options={SHIPPING_TERMS} />
            <Field label="Payment Terms" value={form.paymentTerms} onChange={(v) => updateField('paymentTerms', v)} placeholder="e.g. 30% Adv, 70% BL" />
            <Field label="Port of Loading" value={form.portOfLoading} onChange={(v) => updateField('portOfLoading', v)} placeholder="e.g. Mundra, INMUN" />
            <Field label="Port of Discharge" value={form.portOfDischarge} onChange={(v) => updateField('portOfDischarge', v)} placeholder="e.g. Port of Long Beach" />
            <Field label="Country of Destination" value={form.countryOfDestination} onChange={(v) => updateField('countryOfDestination', v)} placeholder="e.g. United States" />
            <Field label="Tax ID / VAT Number" value={form.taxId} onChange={(v) => updateField('taxId', v)} placeholder="VAT-12345" />
          </div>
        </div>

        {/* Internal */}
        <div className="card">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Internal</h3>
          <Field label="Notes" type="textarea" value={form.notes} onChange={(v) => updateField('notes', v)} placeholder="Internal notes about this customer..." />
        </div>
      </div>
    </Modal>
  );
}

function ArraySection({ title, items, onAdd, onRemove, renderItem }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
        <button type="button" onClick={onAdd} className="btn-secondary btn btn-sm">
          <Plus size={13} /> Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No {title.toLowerCase()} added yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="relative border border-brand-100 rounded-lg p-4 bg-brand-50/30">
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="absolute top-2 right-2 p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title="Remove"
              >
                <X size={14} />
              </button>
              {renderItem(item, idx)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddressGrid({ item, update }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-6">
      <div>
        <label className="label">Label</label>
        <input value={item.label} onChange={(e) => update('label', e.target.value)} placeholder="e.g. HQ" className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Address Line 1</label>
        <input value={item.line1} onChange={(e) => update('line1', e.target.value)} placeholder="Street address..." className="input" />
      </div>
      <div className="sm:col-span-3">
        <label className="label">Address Line 2</label>
        <input value={item.line2} onChange={(e) => update('line2', e.target.value)} placeholder="Suite, floor, district..." className="input" />
      </div>
      <div>
        <label className="label">City</label>
        <input value={item.city} onChange={(e) => update('city', e.target.value)} placeholder="City" className="input" />
      </div>
      <div>
        <label className="label">State</label>
        <input value={item.state} onChange={(e) => update('state', e.target.value)} placeholder="State / Province" className="input" />
      </div>
      <div>
        <label className="label">Country</label>
        <input value={item.country} onChange={(e) => update('country', e.target.value)} placeholder="Country" className="input" />
      </div>
      <div>
        <label className="label">Pincode</label>
        <input value={item.pincode} onChange={(e) => update('pincode', e.target.value)} placeholder="Postal code" className="input" />
      </div>
    </div>
  );
}
