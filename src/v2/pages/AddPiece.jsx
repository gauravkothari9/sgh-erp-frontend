import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ImagePlus, Camera } from 'lucide-react';
import { instancesApi, productsApi, locationsApi } from '../lib/endpoints';

export default function AddPiecePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);

  const { data: locs } = useQuery({
    queryKey: ['v2', 'locations', 'showroom'],
    queryFn: () => locationsApi.list({ type: 'SHOWROOM' }).then((r) => r.data.data.locations),
  });
  const { data: prods } = useQuery({
    queryKey: ['v2', 'products', 'all'],
    queryFn: () => productsApi.list({ limit: 100 }).then((r) => r.data.data.items),
  });

  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { locationId: params.get('locationId') || '', listedPrice: '', length: '', width: '', height: '', unit: 'cm' },
  });

  const onSubmit = async (v) => {
    const fd = new FormData();
    fd.append('productId', v.productId);
    fd.append('locationId', v.locationId);
    if (v.listedPrice) fd.append('listedPrice', v.listedPrice);
    fd.append('actualDimensions', JSON.stringify({
      length: v.length ? Number(v.length) : undefined,
      width: v.width ? Number(v.width) : undefined,
      height: v.height ? Number(v.height) : undefined,
      unit: v.unit,
    }));
    if (v.qualityNotes) fd.append('qualityNotes', v.qualityNotes);
    files.forEach((f) => fd.append('photos', f));

    try {
      const res = await instancesApi.create(fd);
      const inst = res.data.data.instance;
      toast.success(`Created ${inst.instanceCode}`);
      navigate(`/v2/pieces/${inst.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold text-brand-ink">Receive new piece</h1>

      {/* Photos */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-inkMuted">Photos</p>
        <div className="grid grid-cols-4 gap-2">
          {files.map((f, i) => (
            <div key={i} className="aspect-square rounded-md overflow-hidden bg-brand-bg border border-brand-border">
              <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} className="aspect-square rounded-md border-2 border-dashed border-brand-border flex flex-col items-center justify-center text-xs text-brand-inkMuted gap-1">
            <ImagePlus size={20} /> Add
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => setFiles((p) => [...p, ...Array.from(e.target.files || [])])}
        />
        <p className="text-[11px] text-brand-inkMuted flex items-center gap-1"><ImagePlus size={11} /> Tap "Add" to choose photos.</p>
      </div>

      <Field label="Product">
        <select {...register('productId', { required: true })} className="input">
          <option value="">Select…</option>
          {(prods || []).map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
      </Field>

      <Field label="Destination showroom">
        <select {...register('locationId', { required: true })} className="input">
          <option value="">Select…</option>
          {(locs || []).map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
        </select>
      </Field>

      <Field label="Listed price (₹)">
        <input type="number" min="0" step="0.01" {...register('listedPrice')} className="input" />
      </Field>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-inkMuted">Dimensions</p>
        <div className="grid grid-cols-4 gap-2">
          <input placeholder="L" {...register('length')} className="input" />
          <input placeholder="W" {...register('width')} className="input" />
          <input placeholder="H" {...register('height')} className="input" />
          <select {...register('unit')} className="input">
            <option value="cm">cm</option>
            <option value="inch">inch</option>
          </select>
        </div>
      </div>

      <Field label="Quality notes">
        <textarea rows={3} {...register('qualityNotes')} className="input" />
      </Field>

      <button type="submit" disabled={isSubmitting} className="w-full py-2.5 rounded-lg bg-brand-primary text-white font-semibold text-sm">
        {isSubmitting ? 'Saving…' : 'Receive piece into showroom'}
      </button>

      <style>{`.input{width:100%;padding:0.5rem 0.75rem;border:1px solid var(--brand-border,#E8E2D6);border-radius:0.5rem;font-size:0.875rem;outline:none}.input:focus{border-color:#B8542A}`}</style>
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
