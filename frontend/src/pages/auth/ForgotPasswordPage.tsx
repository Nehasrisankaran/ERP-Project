import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Mail, ArrowLeft } from 'lucide-react';
import { Input, Button } from '../../components/ui';
import { api } from '../../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      // intentionally generic — don't reveal if email exists
    } finally {
      setLoading(false);
      setSent(true); // always show success to prevent enumeration
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fc] p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-violet-600 rounded-xl flex items-center justify-center">
            <Briefcase size={17} className="text-white" />
          </div>
          <span className="text-slate-800 font-bold text-lg">WorkMate</span>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Mail size={26} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Check your email</h2>
            <p className="text-slate-500 text-sm mb-2">
              If an account exists for <span className="font-medium text-slate-700">{email}</span>,
              we've sent password reset instructions.
            </p>
            <p className="text-xs text-slate-400 mb-8">Didn't receive it? Check your spam folder.</p>
            <button
              onClick={() => setSent(false)}
              className="text-sm text-violet-600 hover:text-violet-700 font-medium"
            >
              Try a different email
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Forgot your password?</h2>
            <p className="text-slate-500 text-sm mb-8">
              Enter your work email and we'll send you a reset link.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
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
              <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center">
                Send reset link
              </Button>
            </form>
          </>
        )}

        <div className="mt-8 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
            <ArrowLeft size={13} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
