import { useState, useEffect } from 'react';
import PhotoPicker from '../common/PhotoPicker';
import Modal from '../common/Modal';
import { customerAPI } from '../../utils/api';
import { Spinner } from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { Upload } from 'lucide-react';
import { compressImage } from '../../utils/compressImage';
import { showValidationErrors } from '../../utils/validation';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'AUD', 'CAD', 'SGD', 'OTHER'];
const SHIPPING_TERMS = ['FOB', 'CIF', 'CNF', 'CFR', 'EXW', 'DDP', 'OTHER', ''];

/* ── Field component defined OUTSIDE CustomerForm so React keeps a stable
     component identity across re‑renders (fixes inputs losing focus) ── */
function Field({ label, name, type = 'text', required, placeholder, options, form, setForm, errors }) {
  const handleChange = (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }));

  return (
    <div>
      <label className={`label ${required ? 'label-required' : ''}`}>{label}</label>
      {options ? (
        <select
          value={form[name]}
          onChange={handleChange}
          className={`input ${errors[name] ? 'input-error' : ''}`}
        >
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
              {typeof o === 'string' ? o : o.label}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={form[name]}
          onChange={handleChange}
          rows={3}
          placeholder={placeholder}
          className={`input resize-none ${errors[name] ? 'input-error' : ''}`}
        />
      ) : (
        <input
          type={type}
          value={form[name]}
          onChange={handleChange}
          placeholder={placeholder}
          className={`input ${errors[name] ? 'input-error' : ''}`}
        />
      )}
      {errors[name] && <p className="text-xs text-red-500 mt-1">{errors[name]}</p>}
    </div>
  );
}

export default function CustomerForm({ isOpen, onClose, onSuccess, customer }) {
  const isEdit = !!customer;
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    contactPersonName: '',
    designation: '',
    email: '',
    phone: '',
    alternatePhone: '',
    whatsapp: '',
    country: '',
    city: '',
    paymentTerms: '',
    shippingTerms: '',
    portOfLoading: '',
    portOfDischarge: '',
    countryOfDestination: '',
    taxId: '',
    notes: '',
    status: 'Active',
  });
  
  const [shippingAddresses, setShippingAddresses] = useState([{ label: 'Warehouse', line1: '', line2: '', city: '', country: '', state: '', pincode: '' }]);
  const [billingAddresses, setBillingAddresses] = useState([{ label: 'HQ', line1: '', line2: '', city: '', country: '', state: '', pincode: '' }]);

  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (customer) {
      setForm({
        companyName: customer.companyName || '',
        contactPersonName: customer.contactPersonName || '',
        designation: customer.designation || '',
        email: customer.email || '',
        phone: customer.phone || '',
        alternatePhone: customer.alternatePhone || '',
        whatsapp: customer.whatsapp || '',
        country: customer.country || '',
        city: customer.city || '',
        currency: customer.currency || 'USD',
        paymentTerms: customer.paymentTerms || '',
        shippingTerms: customer.shippingTerms || '',
        portOfLoading: customer.portOfLoading || '',
        portOfDischarge: customer.portOfDischarge || '',
        countryOfDestination: customer.countryOfDestination || '',
        taxId: customer.taxId || '',
        notes: customer.notes || '',
        status: customer.status || 'Active',
      });
      if (customer.photo) setPhotoPreview(customer.photo);

      if (customer.shippingAddresses?.length > 0) {
        setShippingAddresses(customer.shippingAddresses);
      } else if (customer.address) {
        setShippingAddresses([{ label: 'Default', line1: customer.address, line2: '', city: customer.city || '', country: customer.country || '', state: '', pincode: '' }]);
      }
      if (customer.billingAddresses?.length > 0) {
        setBillingAddresses(customer.billingAddresses);
      } else if (customer.address) {
        setBillingAddresses([{ label: 'Default', line1: customer.address, line2: '', city: customer.city || '', country: customer.country || '', state: '', pincode: '' }]);
      }
    }
  }, [customer]);

  const validate = () => {
    const e = {};
    if (!form.companyName.trim()) e.companyName = 'Company Name is required';
    if (!form.contactPersonName.trim()) e.contactPersonName = 'Contact Person is required';
    if (!form.country.trim()) e.country = 'Country is required';
    setErrors(e);
    return e;
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
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

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      showValidationErrors(errs);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        shippingAddresses: shippingAddresses.filter((a) => a.line1.trim()),
        billingAddresses: billingAddresses.filter((a) => a.line1.trim()),
      };
      
      let customerId = customer?._id;

      if (isEdit) {
        await customerAPI.update(customer._id, payload);
        toast.success('Customer updated successfully');
      } else {
        const res = await customerAPI.create(payload);
        customerId = res.data.data.customer._id;
        toast.success('Customer created successfully');
      }

      if (photoFile && customerId) {
        const compressed = await compressImage(photoFile);
        const formData = new FormData();
        formData.append('photo', compressed);
        await customerAPI.uploadPhoto(customerId, formData);
      }

      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save customer';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  /* Shared props passed to every Field */
  const fieldProps = { form, setForm, errors };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Customer — ${customer.fileNumber}` : 'Create New Customer'}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className="btn-secondary btn" disabled={loading}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="btn-primary btn" disabled={loading}>
            {loading ? <Spinner size="sm" /> : isEdit ? 'Save Changes' : 'Create Customer'}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Section: Company Info */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Company Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" name="companyName" required placeholder="e.g. HomeStyle Imports Ltd" {...fieldProps} />
            <Field label="Contact Person" name="contactPersonName" required placeholder="e.g. John Smith" {...fieldProps} />
            <Field label="Designation" name="designation" placeholder="e.g. Purchase Manager" {...fieldProps} />
            <Field label="Email" name="email" type="email" placeholder="buyer@company.com" {...fieldProps} />
            <Field label="Phone (Primary)" name="phone" placeholder="+1 555 000 0000" {...fieldProps} />
            <Field label="WhatsApp" name="whatsapp" placeholder="+1 555 000 0000" {...fieldProps} />
            <Field label="Alternate Phone" name="alternatePhone" placeholder="+1 555 000 0001" {...fieldProps} />
            <Field label="Country" name="country" required placeholder="e.g. USA" {...fieldProps} />
            <Field label="City" name="city" placeholder="e.g. New York" {...fieldProps} />
          </div>

          <div className="mt-4 flex flex-col items-center sm:items-start">
            <label className="label mb-2">Customer Photo</label>
            <div className="relative group w-24 h-24 rounded-full overflow-hidden bg-gray-100 border border-brand-100 flex items-center justify-center cursor-pointer mb-2">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Upload size={20} className="text-gray-400 group-hover:text-brand-500 transition-colors" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-[12px] font-semibold text-center leading-tight">Change<br/>Photo</span>
              </div>
            </div>
            <PhotoPicker
              onFiles={(files) => handlePhotoChange({ target: { files } })}
              label={photoPreview ? 'Change photo' : 'Add photo'}
              icon={Upload}
            />
            {photoFile && <span className="text-xs text-brand-600 font-medium">Ready to upload</span>}
          </div>

          {/* Quick Addresses - using simplified input for Modal */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <label className="label">Shipping Address</label>
                <textarea 
                  className={`input resize-none`} 
                  rows={3} 
                  placeholder="Primary shipping address..."
                  value={shippingAddresses[0]?.line1 || ''}
                  onChange={(e) => updateShippingAddress(0, 'line1', e.target.value)}
                />
             </div>
             <div>
                <label className="label">Billing Address</label>
                <textarea 
                  className={`input resize-none`} 
                  rows={3} 
                  placeholder="Primary billing address..."
                  value={billingAddresses[0]?.line1 || ''}
                  onChange={(e) => updateBillingAddress(0, 'line1', e.target.value)}
                />
             </div>
          </div>
        </div>

        <div className="section-divider" />

        {/* Section: Commercial Terms */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Commercial Terms
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Currency" name="currency" options={CURRENCIES} {...fieldProps} />
            <Field label="Shipping Terms" name="shippingTerms" options={SHIPPING_TERMS} {...fieldProps} />
            <Field label="Payment Terms" name="paymentTerms" placeholder="e.g. 30% advance, 70% before shipment" {...fieldProps} />
            <Field label="Tax ID / VAT Number" name="taxId" placeholder="VAT-12345" {...fieldProps} />
            <Field label="Port of Loading" name="portOfLoading" placeholder="e.g. Mundra Port, INMUN" {...fieldProps} />
            <Field label="Port of Discharge" name="portOfDischarge" placeholder="e.g. Port of Rotterdam" {...fieldProps} />
            <Field label="Country of Destination" name="countryOfDestination" placeholder="e.g. USA" {...fieldProps} />
          </div>
        </div>

        <div className="section-divider" />

        {/* Section: Internal */}
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
            Internal Notes
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Notes" name="notes" type="textarea" placeholder="Internal notes about this customer (not shown to customer)..." {...fieldProps} />
            </div>
            {isEdit && (
              <Field
                label="Status"
                name="status"
                options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
                {...fieldProps}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

