import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Store, ShieldPlus } from 'lucide-react';
import { authApi } from '../lib/endpoints';
import { useAuthV2 } from '../stores/authStore';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const setupSchema = z
  .object({
    fullName: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters'),
    confirm: z.string().min(8, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

function LoginForm({ onSuccess }) {
  const [busy, setBusy] = useState(false);
  const setTokens = useAuthV2((s) => s.setTokens);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      const res = await authApi.login(values.email, values.password);
      const { accessToken, refreshToken, user } = res.data.data;
      setTokens(accessToken, refreshToken, user);
      toast.success(`Welcome, ${user.name}`);
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-brand-ink">Email</label>
        <input
          type="email"
          autoComplete="username"
          {...register('email')}
          className="w-full px-3 py-2 rounded-lg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 outline-none text-sm"
        />
        {errors.email && <p className="text-xs text-brand-error">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-brand-ink">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className="w-full px-3 py-2 rounded-lg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 outline-none text-sm"
        />
        {errors.password && <p className="text-xs text-brand-error">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded-lg bg-brand-primary text-white font-semibold text-sm hover:bg-brand-primary/90 disabled:opacity-60"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

function SetupAdminForm({ onSuccess }) {
  const [busy, setBusy] = useState(false);
  const setTokens = useAuthV2((s) => s.setTokens);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(setupSchema) });

  const onSubmit = async (values) => {
    setBusy(true);
    try {
      const res = await authApi.setupAdmin({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
      });
      const { accessToken, refreshToken, user } = res.data.data;
      setTokens(accessToken, refreshToken, user);
      toast.success(`Admin created — welcome, ${user.name}`);
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create admin');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-lg bg-brand-primary/10 border border-brand-primary/30 px-3 py-2 text-[11px] text-brand-ink">
        No administrator account exists yet. Create the first admin to get started.
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-brand-ink">Full name</label>
        <input
          type="text"
          {...register('fullName')}
          className="w-full px-3 py-2 rounded-lg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 outline-none text-sm"
        />
        {errors.fullName && <p className="text-xs text-brand-error">{errors.fullName.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-brand-ink">Email</label>
        <input
          type="email"
          autoComplete="username"
          {...register('email')}
          className="w-full px-3 py-2 rounded-lg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 outline-none text-sm"
        />
        {errors.email && <p className="text-xs text-brand-error">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-brand-ink">Password</label>
        <input
          type="password"
          autoComplete="new-password"
          {...register('password')}
          className="w-full px-3 py-2 rounded-lg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 outline-none text-sm"
        />
        {errors.password && <p className="text-xs text-brand-error">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-brand-ink">Confirm password</label>
        <input
          type="password"
          autoComplete="new-password"
          {...register('confirm')}
          className="w-full px-3 py-2 rounded-lg border border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40 outline-none text-sm"
        />
        {errors.confirm && <p className="text-xs text-brand-error">{errors.confirm.message}</p>}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-2.5 rounded-lg bg-brand-primary text-white font-semibold text-sm hover:bg-brand-primary/90 disabled:opacity-60"
      >
        {busy ? 'Creating admin…' : 'Create admin & sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('loading'); // 'loading' | 'login' | 'setup'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.adminExists();
        if (cancelled) return;
        setMode(res.data?.data?.exists ? 'login' : 'setup');
      } catch {
        if (!cancelled) setMode('login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goDashboard = () => navigate('/v2/dashboard', { replace: true });

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-brand-surface rounded-2xl border border-brand-border p-6 shadow-sm space-y-4">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
            {mode === 'setup' ? <ShieldPlus size={22} /> : <Store size={22} />}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-brand-ink">SGH Crafts</h1>
          <p className="text-xs text-brand-inkMuted">
            {mode === 'setup' ? 'First-time setup' : 'Showroom Inventory · v2'}
          </p>
        </div>

        {mode === 'loading' && (
          <p className="text-xs text-brand-inkMuted text-center py-6">Checking setup…</p>
        )}

        {mode === 'login' && <LoginForm onSuccess={goDashboard} />}

        {mode === 'setup' && <SetupAdminForm onSuccess={goDashboard} />}
      </div>
    </div>
  );
}
