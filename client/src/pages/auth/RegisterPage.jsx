import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { gsap } from 'gsap';
import { Package, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { registerUser, clearError } from '../../store/slices/authSlice';
import { InputField, Btn } from '../../components/ui';

const passCheck = (p) => ({
  length: p.length >= 8,
  lower: /[a-z]/.test(p),
  upper: /[A-Z]/.test(p),
  special: /[!@#$%^&*(),.?":{}|<>]/.test(p),
});

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, token } = useSelector(s => s.auth);
  const [form, setForm] = useState({ login_id: '', email: '', password: '', confirm_password: '', full_name: '' });
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const cardRef = useRef(null);

  useEffect(() => { if (token) navigate('/dashboard'); }, [token, navigate]);
  useEffect(() => { return () => dispatch(clearError()); }, [dispatch]);

  useEffect(() => {
    gsap.fromTo(cardRef.current, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' });
  }, []);

  const checks = passCheck(form.password);

  const validate = () => {
    const e = {};
    if (form.login_id.length < 6 || form.login_id.length > 12) e.login_id = 'Login ID must be 6-12 characters';
    if (!form.email.includes('@')) e.email = 'Invalid email';
    if (!Object.values(checks).every(Boolean)) e.password = 'Password does not meet requirements';
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    const res = await dispatch(registerUser(form));
    if (!res.error) navigate('/dashboard');
  };

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-100 dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-200/30 dark:bg-indigo-800/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-200/30 dark:bg-violet-800/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 mb-4">
            <Package size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            Core<span className="text-indigo-600">Inventory</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create your account</p>
        </div>

        <div ref={cardRef} className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-5">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <InputField label="Full Name" placeholder="John Doe" value={form.full_name} onChange={f('full_name')} />

            <InputField
              label="Login ID"
              placeholder="6-12 characters"
              value={form.login_id}
              onChange={f('login_id')}
              error={errors.login_id}
              required
            />

            <InputField
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={f('email')}
              error={errors.email}
              required
            />

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={f('password')}
                  required
                  className="w-full px-3 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-colors"
                />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {[
                    { key: 'length', label: '8+ chars' },
                    { key: 'lower', label: 'Lowercase' },
                    { key: 'upper', label: 'Uppercase' },
                    { key: 'special', label: 'Special char' },
                  ].map(item => (
                    <div key={item.key} className={`flex items-center gap-1.5 text-xs ${checks[item.key] ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                      <CheckCircle2 size={11} className={checks[item.key] ? 'opacity-100' : 'opacity-30'} />
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>

            <InputField
              label="Confirm Password"
              type={showPass ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={form.confirm_password}
              onChange={f('confirm_password')}
              error={errors.confirm_password}
              required
            />

            <Btn type="submit" disabled={loading} className="w-full justify-center mt-1" size="lg">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : 'Create Account'}
            </Btn>
          </form>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
