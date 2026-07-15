import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { authAPI } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

// localStorage key for the "remember me" credentials. Stores BOTH email and
// password (base64-encoded) so returning users on trusted machines land a
// single click away from their dashboard. Base64 is obfuscation, not
// encryption — anyone with access to the browser can decode it, so this
// should only be used on trusted devices.
const REMEMBER_CREDS_KEY = 'sgh-erp-remember-creds';

const encodeCreds = (email, password) => {
  try {
    return btoa(
      unescape(encodeURIComponent(JSON.stringify({ email, password })))
    );
  } catch {
    return null;
  }
};

const decodeCreds = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(raw))));
  } catch {
    return null;
  }
};

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  // Bootstrap mode: when the backend reports zero users, we expose a
  // "Create Admin Account" panel so a fresh install can sign itself in
  // without a seed script. The flag flips to false the moment any user
  // exists, so this UI disappears for everyone else.
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [bootstrapForm, setBootstrapForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [bootstrapLoading, setBootstrapLoading] = useState(false);

  // On mount, pre-fill both fields if the last login opted into "remember me".
  useEffect(() => {
    const saved = decodeCreds(localStorage.getItem(REMEMBER_CREDS_KEY));
    if (saved?.email) {
      setForm({ email: saved.email, password: saved.password || '' });
      setRememberMe(true);
    }
  }, []);

  // Ask the backend whether this instance has zero users. If so, we're in
  // bootstrap mode and the "Create Admin Account" entry point becomes
  // visible. Any error (offline, 500, etc.) just leaves the flag false —
  // the normal sign-in form still works.
  useEffect(() => {
    let cancelled = false;
    authAPI
      .getBootstrapStatus()
      .then((res) => {
        if (!cancelled) setCanBootstrap(!!res.data?.data?.canBootstrap);
      })
      .catch(() => {
        /* silent — bootstrap entry just stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBootstrapSubmit = async (e) => {
    e.preventDefault();
    const { fullName, email, password, confirmPassword } = bootstrapForm;
    const missing = [];
    if (!fullName) missing.push('Full Name');
    if (!email) missing.push('Email');
    if (!password) missing.push('Password');
    if (missing.length > 0) {
      toast.error(`${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required`);
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setBootstrapLoading(true);
    try {
      const res = await authAPI.bootstrapAdmin({ fullName, email, password });
      const { token, data } = res.data;
      setAuth(data.user, token);
      toast.success(`Welcome, ${data.user.fullName}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Could not create admin. Please try again.';
      toast.error(msg);
      // If the server tells us bootstrap is no longer allowed (because a
      // user was just created in parallel), collapse the panel.
      if (err.response?.status === 403) {
        setCanBootstrap(false);
        setBootstrapOpen(false);
      }
    } finally {
      setBootstrapLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.login({ ...form, rememberMe });
      const { token, data } = res.data;
      
      setAuth(data.user, token);

      if (rememberMe) {
        const encoded = encodeCreds(form.email, form.password);
        if (encoded) localStorage.setItem(REMEMBER_CREDS_KEY, encoded);
      } else {
        localStorage.removeItem(REMEMBER_CREDS_KEY);
      }

      toast.success(`Welcome back, ${data.user.fullName}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-wood-800 via-brand-900 to-wood-900 flex items-center justify-center p-4">
      {/* Background texture overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500 shadow-2xl mb-4">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SGH ERP</h1>
          <p className="text-white/60 text-sm mt-1">SGH Crafts — Jodhpur</p>
        </div>

        {/* Login form */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6">
            {bootstrapOpen ? 'Create admin account' : 'Sign in to continue'}
          </h2>

          {bootstrapOpen ? (
            <form onSubmit={handleBootstrapSubmit} className="space-y-4">
              <div>
                <label className="label">Full name</label>
                <input
                  type="text"
                  value={bootstrapForm.fullName}
                  onChange={(e) =>
                    setBootstrapForm({ ...bootstrapForm, fullName: e.target.value })
                  }
                  className="input"
                  placeholder="Jane Doe"
                  autoFocus
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  value={bootstrapForm.email}
                  onChange={(e) =>
                    setBootstrapForm({ ...bootstrapForm, email: e.target.value })
                  }
                  className="input"
                  placeholder="admin@sghcrafts.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  value={bootstrapForm.password}
                  onChange={(e) =>
                    setBootstrapForm({ ...bootstrapForm, password: e.target.value })
                  }
                  className="input"
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Min 12 chars, with uppercase, lowercase, digit and symbol.
                </p>
              </div>

              <div>
                <label className="label">Confirm password</label>
                <input
                  type="password"
                  value={bootstrapForm.confirmPassword}
                  onChange={(e) =>
                    setBootstrapForm({
                      ...bootstrapForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="input"
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={bootstrapLoading}
                className="btn-primary btn w-full justify-center mt-2"
              >
                {bootstrapLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create admin & sign in'
                )}
              </button>

              <button
                type="button"
                onClick={() => setBootstrapOpen(false)}
                className="text-sm text-gray-600 hover:text-gray-900 w-full text-center mt-2"
              >
                Back to sign in
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                placeholder="admin@sghcrafts.com"
                autoFocus
                autoComplete="email"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input pr-10"
                  placeholder="Your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>



            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 accent-brand-600 rounded"
              />
              Remember me
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn w-full justify-center mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          )}

          {canBootstrap && !bootstrapOpen && (
            <div className="mt-6 pt-4 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-500 mb-2">
                No accounts exist yet on this instance.
              </p>
              <button
                type="button"
                onClick={() => setBootstrapOpen(true)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Create admin account
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            SGH ERP v1.0 — Office Module
          </p>
        </div>
      </div>
    </div>
  );
}
