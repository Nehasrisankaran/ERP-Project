import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { Input, Button } from '../../components/ui';
import { Briefcase, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
  if (pw.length === 0) return { label: '', color: '', width: '0%' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { label: 'Weak', color: 'bg-red-400', width: '25%' };
  if (score === 2) return { label: 'Fair', color: 'bg-amber-400', width: '50%' };
  if (score === 3) return { label: 'Good', color: 'bg-blue-400', width: '75%' };
  return { label: 'Strong', color: 'bg-green-500', width: '100%' };
}

export default function RegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const strength = getPasswordStrength(form.password);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!agreed) { setError('Please accept the terms and privacy policy.'); return; }
    setLoading(true);
    try {
      await authApi.register({ email: form.email, password: form.password, full_name: form.full_name });
      const { data: tokens } = await authApi.login(form.email, form.password);
      // Store token immediately so the axios interceptor can attach it to me()
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
      const { data: user } = await authApi.me();
      setAuth(user, tokens.access_token, tokens.refresh_token);
      navigate('/');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checks = [
    { ok: form.password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(form.password), label: 'One uppercase letter' },
    { ok: /[0-9]/.test(form.password), label: 'One number' },
  ];

  return (
    <div className="min-h-screen flex bg-[#f8f9fc]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 via-violet-700 to-violet-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 bg-white/5 rounded-full" />

        <div className="relative">
          <div className="flex items-center gap-2.5 mb-16">
            <div className="w-9 h-9 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Briefcase size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">WorkMate</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-snug mb-4">
            Build better work.<br />Together.
          </h1>
          <p className="text-violet-200 text-lg leading-relaxed max-w-sm">
            One platform for projects, people, and everything in between.
          </p>
        </div>

        <div className="relative space-y-5">
          {[
            { title: 'Project Management', desc: 'Kanban, list, and calendar views in one place' },
            { title: 'Team Collaboration', desc: 'Assign, track, and discuss — seamlessly' },
            { title: 'AI-Powered Insights', desc: 'Intelligent automation coming soon' },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-3">
              <CheckCircle2 size={16} className="text-violet-300 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-medium text-sm">{f.title}</p>
                <p className="text-violet-300 text-xs mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-sm py-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
              <Briefcase size={17} className="text-white" />
            </div>
            <span className="text-slate-800 font-bold text-lg">WorkMate</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">Create your account</h2>
          <p className="text-slate-500 text-sm mb-7">Start your workspace in seconds.</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="full_name"
              label="Full name"
              type="text"
              placeholder="Arun Kumar"
              value={form.full_name}
              onChange={set('full_name')}
              required
              autoFocus
            />
            <Input
              id="email"
              label="Work email"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={set('email')}
              required
            />

            {/* Password with show/hide + strength */}
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-xs font-medium text-slate-600">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  required
                  className="w-full px-3 py-2 pr-10 text-sm bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Strength bar */}
              {form.password.length > 0 && (
                <div className="mt-1.5">
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                      style={{ width: strength.width }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex gap-3">
                      {checks.map(c => (
                        <span key={c.label} className={`text-[10px] flex items-center gap-0.5 ${c.ok ? 'text-green-600' : 'text-slate-400'}`}>
                          <CheckCircle2 size={9} /> {c.label}
                        </span>
                      ))}
                    </div>
                    <span className={`text-[10px] font-semibold ${strength.color.replace('bg-', 'text-')}`}>
                      {strength.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Input
              id="confirm"
              label="Confirm password"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.confirm}
              onChange={set('confirm')}
              required
              error={form.confirm && form.confirm !== form.password ? 'Passwords do not match' : undefined}
            />

            <label className="flex items-start gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 rounded accent-violet-600"
              />
              <span className="text-xs text-slate-500">
                I agree to the{' '}
                <a href="#" className="text-violet-600 hover:underline">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-violet-600 hover:underline">Privacy Policy</a>
              </span>
            </label>

            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center mt-2">
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-600 hover:text-violet-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
