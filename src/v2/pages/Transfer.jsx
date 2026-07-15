import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { instancesApi, locationsApi, stockApi } from '../lib/endpoints';

export default function TransferPage() {
  const { id } = useParams();
  const pid = id;
  const navigate = useNavigate();

  const { data: inst } = useQuery({
    queryKey: ['v2', 'instance', pid],
    queryFn: () => instancesApi.get(pid).then((r) => r.data.data.instance),
  });
  const { data: locs } = useQuery({
    queryKey: ['v2', 'locations', 'showroom'],
    queryFn: () => locationsApi.list({ type: 'SHOWROOM' }).then((r) => r.data.data.locations),
  });

  const { register, handleSubmit, formState: { isSubmitting } } = useForm();

  const onSubmit = async (v) => {
    try {
      const res = await stockApi.transfer({
        instanceId: pid,
        fromLocationId: inst.currentLocationId,
        toLocationId: v.toLocationId,
        remarks: v.remarks,
      });
      toast.success(`Transfer ${res.data.data.voucherNo} posted`);
      navigate(`/v2/pieces/${pid}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transfer failed');
    }
  };

  if (!inst) return <div className="text-sm text-brand-inkMuted">Loading…</div>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
      <h1 className="text-xl font-bold text-brand-ink">Transfer piece</h1>
      <div className="bg-brand-surface border border-brand-border rounded-xl p-4 text-sm">
        <p className="font-mono font-bold text-brand-primary">{inst.instanceCode}</p>
        <p className="font-semibold text-brand-ink">{inst.product?.name}</p>
        <p className="text-xs text-brand-inkMuted mt-1">From: {inst.currentLocation?.name}</p>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-inkMuted">To showroom</span>
        <select {...register('toLocationId', { required: true })} className="w-full px-3 py-2 rounded-lg border border-brand-border text-sm">
          <option value="">Select…</option>
          {(locs || []).filter((l) => l.id !== inst.currentLocationId).map((l) => (
            <option key={l.id} value={l.id}>{l.code} — {l.name}</option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-inkMuted">Reason / remarks</span>
        <textarea rows={3} {...register('remarks')} className="w-full px-3 py-2 rounded-lg border border-brand-border text-sm" />
      </label>

      <button type="submit" disabled={isSubmitting} className="w-full py-2.5 rounded-lg bg-brand-primary text-white font-semibold text-sm">
        {isSubmitting ? 'Posting…' : 'Post transfer'}
      </button>
    </form>
  );
}
