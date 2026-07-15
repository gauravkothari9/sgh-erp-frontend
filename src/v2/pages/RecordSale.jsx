import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { instancesApi, salesApi } from '../lib/endpoints';

export default function RecordSalePage() {
  const { id } = useParams();
  const pid = id;
  const navigate = useNavigate();

  const { data: inst } = useQuery({
    queryKey: ['v2', 'instance', pid],
    queryFn: () => instancesApi.get(pid).then((r) => r.data.data.instance),
  });

  const { register, handleSubmit, formState: { isSubmitting } } = useForm();

  const onSubmit = async (v) => {
    try {
      const res = await salesApi.create({
        instanceId: pid,
        showroomId: inst.currentLocationId,
        customerName: v.customerName,
        customerPhone: v.customerPhone,
        customerAddress: v.customerAddress,
        salePrice: Number(v.salePrice),
        discount: Number(v.discount) || 0,
        paymentMode: v.paymentMode || undefined,
        paymentStatus: v.paymentStatus || 'PENDING',
        notes: v.notes,
      });
      toast.success(`Sale ${res.data.data.sale.saleNo} recorded`);
      navigate(`/v2/pieces/${pid}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    }
  };

  if (!inst) return <div className="text-sm text-brand-inkMuted">Loading…</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <h1 className="text-xl font-bold text-brand-ink">Record sale</h1>
      <p className="text-sm text-brand-inkMuted">{inst.instanceCode} · {inst.product?.name}</p>

      <Field label="Customer name *"><input {...register('customerName', { required: true })} className="input" /></Field>
      <Field label="Phone"><input type="tel" {...register('customerPhone')} className="input" /></Field>
      <Field label="Delivery address"><textarea rows={2} {...register('customerAddress')} className="input" /></Field>
      <Field label="Sale price (₹) *">
        <input type="number" min="0" step="0.01" defaultValue={inst.listedPrice} {...register('salePrice', { required: true })} className="input" />
      </Field>
      <Field label="Discount (₹)"><input type="number" min="0" defaultValue={0} {...register('discount')} className="input" /></Field>
      <Field label="Payment mode">
        <select {...register('paymentMode')} className="input">
          <option value="">—</option>
          {['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'].map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
        </select>
      </Field>
      <Field label="Payment status">
        <select {...register('paymentStatus')} className="input" defaultValue="PENDING">
          {['PENDING', 'PARTIAL', 'PAID'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Notes"><textarea rows={2} {...register('notes')} className="input" /></Field>

      <button type="submit" disabled={isSubmitting} className="w-full py-2.5 rounded-lg bg-brand-primary text-white font-semibold text-sm">
        {isSubmitting ? 'Recording…' : 'Record sale & dispatch'}
      </button>
      <style>{`.input{width:100%;padding:0.5rem 0.75rem;border:1px solid #E8E2D6;border-radius:0.5rem;font-size:0.875rem;outline:none}.input:focus{border-color:#B8542A}`}</style>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-brand-inkMuted">{label}</span>
      {children}
    </label>
  );
}
