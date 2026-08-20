import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { Input, Button } from '../../components/ui';
import { Briefcase } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: tokens } = await authApi.login(email, password);
      // Store token immediately so the axios interceptor can attach it to me()
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
      const { data: user } = await authApi.me();
      setAuth(user, tokens.access_token, tokens.refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f8f9fc]">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-violet-600 to-violet-900 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-14">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <Briefcase size={20} className="text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">WorkMate</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            The operating system<br />for modern companies.
          </h1>
          <p className="text-violet-200 text-lg">
            Projects, people, and work — all in one place.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="space-y-4">
          {[
            { title: 'Project Management', desc: 'Standard, milestone, and sprint modes' },
            { title: 'Team & Employee Management', desc: 'Org structure, roles, and departments' },
            { title: 'AI-Powered Automation', desc: 'Coming soon — intelligent workflows' },
          ].map(f => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 bg-violet-300 rounded-full mt-2 flex-shrink-0" />
              <div>
                <p className="text-white font-medium text-sm">{f.title}</p>
                <p className="text-violet-300 text-xs">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
              <Briefcase size={17} className="text-white" />
            </div>
            <span className="text-slate-800 font-bold text-lg">WorkMate</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-1">Welcome back</h2>
          <p className="text-slate-500 text-sm mb-8">Sign in to your workspace</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              label="Work email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-violet-600 hover:text-violet-700">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center">
              Sign in
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              Don't have an account?{' '}
              <Link to="/register" className="text-violet-600 hover:text-violet-700 font-medium">
                Create workspace
              </Link>
            </p>
          </div>

          {/* Quick Demo Credentials */}
          <div className="mt-8 p-4 bg-violet-50/70 border border-violet-100 rounded-xl">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-violet-900">Demo Account</p>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@acme.com');
                  setPassword('admin123');
                }}
                className="text-[11px] font-medium text-violet-600 hover:text-violet-800 bg-white px-2 py-0.5 rounded border border-violet-200 shadow-sm transition-colors"
              >
                Auto fill
              </button>
            </div>
            <p className="text-xs text-violet-700 font-mono">admin@acme.com</p>
            <p className="text-xs text-violet-600 font-mono">admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
