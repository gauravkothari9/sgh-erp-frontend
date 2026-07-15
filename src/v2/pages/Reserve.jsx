import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { instancesApi, reservationsApi } from '../lib/endpoints';

export default function ReservePage() {
  const { id } = useParams();
  const pid = id;
  const navigate = useNavigate();

  const { data: inst } = useQuery({
    queryKey: ['v2', 'instance', pid],
    queryFn: () => instancesApi.get(pid).then((r) => r.data.data.instance),
  });

  const defaultHold = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { holdUntil: defaultHold, advancePaid: 0 },
  });

  const onSubmit = async (v) => {
    try {
      await reservationsApi.create({
        instanceId: pid,
        customerName: v.customerName,
        customerPhone: v.customerPhone,
        customerEmail: v.customerEmail,
        holdUntil: v.holdUntil,
        advancePaid: Number(v.advancePaid) || 0,
        notes: v.notes,
      });
      toast.success('Piece reserved');
      navigate(`/v2/pieces/${pid}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reservation failed');
    }
  };

  if (!inst) return <div className="text-sm text-brand-inkMuted">Loading…</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <h1 className="text-xl font-bold text-brand-ink">Reserve piece</h1>
      <p className="text-sm text-brand-inkMuted">{inst.instanceCode} · {inst.product?.name}</p>

      <Field label="Customer name *"><input {...register('customerName', { required: true })} className="input" /></Field>
      <Field label="Phone"><input type="tel" {...register('customerPhone')} className="input" /></Field>
      <Field label="Email"><input type="email" {...register('customerEmail')} className="input" /></Field>
      <Field label="Hold until"><input type="date" {...register('holdUntil')} className="input" /></Field>
      <Field label="Advance paid (₹)"><input type="number" min="0" {...register('advancePaid')} className="input" /></Field>
      <Field label="Notes"><textarea rows={3} {...register('notes')} className="input" /></Field>

      <button type="submit" disabled={isSubmitting} className="w-full py-2.5 rounded-lg bg-brand-primary text-white font-semibold text-sm">
        {isSubmitting ? 'Reserving…' : 'Reserve'}
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
