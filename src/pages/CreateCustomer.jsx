import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, Save } from 'lucide-react';
import { customerAPI } from '../utils/api';
import { Spinner } from '../components/common/LoadingSpinner';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { compressImage } from '../utils/compressImage';
import { showValidationErrors } from '../utils/validation';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'AUD', 'CAD', 'SGD', 'OTHER'];
const SHIPPING_TERMS = ['FOB', 'CIF', 'CNF', 'CFR', 'EXW', 'DDP', 'OTHER', ''];

function Field({ label, name, type = 'text', required, placeholder, options, value, onChange, error, className = '' }) {
  return (
    <div className={className}>
      <label className={`label ${required ? 'label-required' : ''}`}>{label}</label>
      {options ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`input ${error ? 'input-error' : ''}`}>
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
              {typeof o === 'string' ? o : o.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
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

/* ── Dynamic Array Row ── */
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

export default function CreateCustomer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    fileNumber: '',
    companyName: '',
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
    status: 'Active',
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const [emails, setEmails] = useState([{ email: '', label: 'Primary' }]);
  const [phones, setPhones] = useState([{ number: '', label: 'Primary', isWhatsapp: false }]);
  
  const [shippingAddresses, setShippingAddresses] = useState([{ label: 'Warehouse', line1: '', line2: '', city: '', country: '', state: '', pincode: '' }]);
  const [billingAddresses, setBillingAddresses] = useState([{ label: 'HQ', line1: '', line2: '', city: '', country: '', state: '', pincode: '' }]);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      customerAPI.getById(id).then((res) => {
        const c = res.data.data.customer;
        setForm({
          fileNumber: c.fileNumber || '',
          companyName: c.companyName || '',
          contactPersonName: c.contactPersonName || '',
          designation: c.designation || '',
          agent: c.agent || '',
          country: c.country || '',
          currency: c.currency || 'USD',
          shippingTerms: c.shippingTerms || '',
          paymentTerms: c.paymentTerms || '',
          portOfLoading: c.portOfLoading || '',
          portOfDischarge: c.portOfDischarge || '',
          countryOfDestination: c.countryOfDestination || '',
          taxId: c.taxId || '',
          notes: c.notes || '',
          status: c.status || 'Active',
        });
        if (c.photo) setPhotoPreview(c.photo);
        // Handle backward compatibility: old single fields → arrays
        if (c.emails?.length > 0) {
          setEmails(c.emails);
        } else if (c.email) {
          setEmails([{ email: c.email, label: 'Primary' }]);
        }
        if (c.phones?.length > 0) {
          setPhones(c.phones);
        } else if (c.phone) {
          setPhones([
            { number: c.phone, label: 'Primary', isWhatsapp: false },
            ...(c.whatsapp ? [{ number: c.whatsapp, label: 'WhatsApp', isWhatsapp: true }] : []),
          ]);
        }
        
        if (c.shippingAddresses?.length > 0) {
          setShippingAddresses(c.shippingAddresses);
        } else if (c.addresses?.length > 0) {
          setShippingAddresses(c.addresses);
        } else if (c.address) {
          setShippingAddresses([{ label: 'Default', line1: c.address, line2: '', city: c.city || '', country: c.country || '', state: '', pincode: '' }]);
        }

        if (c.billingAddresses?.length > 0) {
          setBillingAddresses(c.billingAddresses);
        } else if (c.addresses?.length > 0) {
          setBillingAddresses(c.addresses);
        } else if (c.address) {
          setBillingAddresses([{ label: 'Default', line1: c.address, line2: '', city: c.city || '', country: c.country || '', state: '', pincode: '' }]);
        }
      }).catch(() => navigate('/office/customers')).finally(() => setLoading(false));
    }
  }, [id]);

  const updateField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const updateEmail = (idx, field, value) => {
    const arr = [...emails];
    arr[idx] = { ...arr[idx], [field]: value };
    setEmails(arr);
  };
  const updatePhone = (idx, field, value) => {
    const arr = [...phones];
    arr[idx] = { ...arr[idx], [field]: value };
    setPhones(arr);
  };
  const updateShippingAddress = (idx, field, value) => {
    const arr = [...shippingAddresses];
    arr[idx] = { ...arr[idx], [field]: value };
    setShippingAddresses(arr);
  };
  const updateBillingAddress = (idx, field, value) => {
    const arr = [...billingAddresses];
    arr[idx] = { ...arr[idx], [field]: value };
    setBillingAddresses(arr);
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

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
        emails: emails.filter((e) => e.email.trim()),
        phones: phones.filter((p) => p.number.trim()),
        shippingAddresses: shippingAddresses.filter((a) => a.line1.trim()),
        billingAddresses: billingAddresses.filter((a) => a.line1.trim()),
      };
      
      let customerId = id;
      
      if (isEdit) {
        await customerAPI.update(id, payload);
        toast.success('Customer updated successfully');
      } else {
        const res = await customerAPI.create(payload);
        customerId = res.data.data.customer._id;
        toast.success('Customer created successfully');
      }

      if (photoFile) {
        const compressed = await compressImage(photoFile);
        const formData = new FormData();
        formData.append('photo', compressed);
        await customerAPI.uploadPhoto(customerId, formData);
      }

      navigate(`/office/customers/${customerId}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save customer';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-5 fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/office/customers')} className="btn-ghost btn p-2 flex-shrink-0">
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <h1 className="page-title">{isEdit ? 'Edit Customer' : 'Create New Customer'}</h1>
            {isEdit && form.fileNumber && (
              <p className="page-subtitle truncate">
                File: <span className="font-mono text-brand-600">{form.fileNumber}</span>
              </p>
            )}
          </div>
        </div>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary btn">
          {saving ? <Spinner size="sm" /> : <Save size={15} />}
          {isEdit ? 'Save Changes' : 'Create Customer'}
        </button>
      </div>

      {/* File Number */}
      {!isEdit && (
        <div className="card">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">File Number</h3>
          <Field
            label="File Number (optional — auto-generated if empty)"
            name="fileNumber"
            value={form.fileNumber}
            onChange={(v) => updateField('fileNumber', v.toUpperCase())}
            placeholder="e.g. SGH-2026-0001 (leave empty to auto-generate)"
            error={errors.fileNumber}
          />
        </div>
      )}

      {/* Company Info */}
      <div className="card">
        <div className="flex justify-between flex-wrap gap-4 mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Company Information</h3>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" name="companyName" required value={form.companyName} onChange={(v) => updateField('companyName', v)} placeholder="e.g. HomeStyle Imports Ltd" error={errors.companyName} />
            <Field label="Contact Person" name="contactPersonName" required value={form.contactPersonName} onChange={(v) => updateField('contactPersonName', v)} placeholder="e.g. John Smith" error={errors.contactPersonName} />
            <Field label="Designation" name="designation" value={form.designation} onChange={(v) => updateField('designation', v)} placeholder="e.g. Purchase Manager" />
            <Field label="Agent (if any)" name="agent" value={form.agent} onChange={(v) => updateField('agent', v)} placeholder="e.g. Agent name" />
            <Field label="Country" name="country" required value={form.country} onChange={(v) => updateField('country', v)} placeholder="e.g. USA" error={errors.country} />
          </div>
          
          <div className="flex flex-col items-center">
            <label className="block text-xs font-medium text-gray-600 mb-2">Customer Photo</label>
            <div className="relative group w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-2 border-brand-100 flex items-center justify-center cursor-pointer mb-2">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Upload size={24} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-xs font-semibold">Change Photo</span>
              </div>
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            {photoFile && <span className="text-xs text-brand-600 font-medium">Ready to upload</span>}
          </div>
        </div>
      </div>

      {/* Emails */}
      <div className="card">
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
                <input value={item.label} onChange={(e) => updateEmail(idx, 'label', e.target.value)} placeholder="e.g. Primary, Accounts" className="input" />
              </div>
            </div>
          )}
        />
      </div>

      {/* Phones */}
      <div className="card">
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
                <input value={item.label} onChange={(e) => updatePhone(idx, 'label', e.target.value)} placeholder="e.g. Mobile, Office" className="input" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer py-2">
                  <input type="checkbox" checked={item.isWhatsapp} onChange={(e) => updatePhone(idx, 'isWhatsapp', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-gray-600">WhatsApp</span>
                </label>
              </div>
            </div>
          )}
        />
      </div>

      {/* Billing Addresses */}
      <div className="card">
        <ArraySection
          title="Billing Addresses"
          items={billingAddresses}
          onAdd={() => setBillingAddresses([...billingAddresses, { label: '', line1: '', line2: '', city: '', country: '', state: '', pincode: '' }])}
          onRemove={(idx) => setBillingAddresses(billingAddresses.filter((_, i) => i !== idx))}
          renderItem={(item, idx) => (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-6">
              <div>
                <label className="label">Label</label>
                <input value={item.label} onChange={(e) => updateBillingAddress(idx, 'label', e.target.value)} placeholder="e.g. Headquarters" className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address Line 1</label>
                <input value={item.line1} onChange={(e) => updateBillingAddress(idx, 'line1', e.target.value)} placeholder="Street address..." className="input" />
              </div>
              <div className="sm:col-span-3">
                <label className="label">Address Line 2</label>
                <input value={item.line2} onChange={(e) => updateBillingAddress(idx, 'line2', e.target.value)} placeholder="Suite, floor, district..." className="input" />
              </div>
              <div>
                <label className="label">City</label>
                <input value={item.city} onChange={(e) => updateBillingAddress(idx, 'city', e.target.value)} placeholder="City" className="input" />
              </div>
              <div>
                <label className="label">State</label>
                <input value={item.state} onChange={(e) => updateBillingAddress(idx, 'state', e.target.value)} placeholder="State / Province" className="input" />
              </div>
              <div>
                <label className="label">Country</label>
                <input value={item.country} onChange={(e) => updateBillingAddress(idx, 'country', e.target.value)} placeholder="Country" className="input" />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input value={item.pincode} onChange={(e) => updateBillingAddress(idx, 'pincode', e.target.value)} placeholder="Postal code" className="input" />
              </div>
            </div>
          )}
        />
      </div>

 {/* Shipping Addresses */}
      <div className="card">
        <ArraySection
          title="Shipping Addresses"
          items={shippingAddresses}
          onAdd={() => setShippingAddresses([...shippingAddresses, { label: '', line1: '', line2: '', city: '', country: '', state: '', pincode: '' }])}
          onRemove={(idx) => setShippingAddresses(shippingAddresses.filter((_, i) => i !== idx))}
          renderItem={(item, idx) => (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pr-6">
              <div>
                <label className="label">Label</label>
                <input value={item.label} onChange={(e) => updateShippingAddress(idx, 'label', e.target.value)} placeholder="e.g. Main Warehouse" className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address Line 1</label>
                <input value={item.line1} onChange={(e) => updateShippingAddress(idx, 'line1', e.target.value)} placeholder="Street address..." className="input" />
              </div>
              <div className="sm:col-span-3">
                <label className="label">Address Line 2</label>
                <input value={item.line2} onChange={(e) => updateShippingAddress(idx, 'line2', e.target.value)} placeholder="Suite, floor, district..." className="input" />
              </div>
              <div>
                <label className="label">City</label>
                <input value={item.city} onChange={(e) => updateShippingAddress(idx, 'city', e.target.value)} placeholder="City" className="input" />
              </div>
              <div>
                <label className="label">State</label>
                <input value={item.state} onChange={(e) => updateShippingAddress(idx, 'state', e.target.value)} placeholder="State / Province" className="input" />
              </div>
              <div>
                <label className="label">Country</label>
                <input value={item.country} onChange={(e) => updateShippingAddress(idx, 'country', e.target.value)} placeholder="Country" className="input" />
              </div>
              <div>
                <label className="label">Pincode</label>
                <input value={item.pincode} onChange={(e) => updateShippingAddress(idx, 'pincode', e.target.value)} placeholder="Postal code" className="input" />
              </div>
            </div>
          )}
        />
      </div>

      {/* Logistics & Commercial Terms */}
      <div className="card">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Commercial Terms & Logistics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Currency" name="currency" value={form.currency} onChange={(v) => updateField('currency', v)} options={CURRENCIES} />
          <Field label="Shipping Terms" name="shippingTerms" value={form.shippingTerms} onChange={(v) => updateField('shippingTerms', v)} options={SHIPPING_TERMS} />
          <Field label="Payment Terms" name="paymentTerms" value={form.paymentTerms} onChange={(v) => updateField('paymentTerms', v)} placeholder="e.g. 30% Adv, 70% BL" />
          <Field label="Port of Loading" name="portOfLoading" value={form.portOfLoading} onChange={(v) => updateField('portOfLoading', v)} placeholder="e.g. Mundra, INMUN" />
          <Field label="Port of Discharge" name="portOfDischarge" value={form.portOfDischarge} onChange={(v) => updateField('portOfDischarge', v)} placeholder="e.g. Port of Long Beach" />
          <Field label="Country of Destination" name="countryOfDestination" value={form.countryOfDestination} onChange={(v) => updateField('countryOfDestination', v)} placeholder="e.g. United States" />
          <Field label="Tax ID / VAT Number" name="taxId" value={form.taxId} onChange={(v) => updateField('taxId', v)} placeholder="VAT-12345" />
        </div>
      </div>

      {/* Internal Notes */}
      <div className="card">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Internal</h3>
        <Field label="Notes" name="notes" type="textarea" value={form.notes} onChange={(v) => updateField('notes', v)} placeholder="Internal notes about this customer..." />
        {isEdit && (
          <div className="mt-4">
            <Field label="Status" name="status" value={form.status} onChange={(v) => updateField('status', v)} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
          </div>
        )}
      </div>

      {/* Bottom save button */}
      <div className="flex flex-wrap justify-end gap-3">
        <button onClick={() => navigate('/office/customers')} className="btn-secondary btn">Cancel</button>
        <button onClick={handleSubmit} disabled={saving} className="btn-primary btn">
          {saving ? <Spinner size="sm" /> : <Save size={15} />}
          {isEdit ? 'Save Changes' : 'Create Customer'}
        </button>
      </div>
    </div>
  );
}
