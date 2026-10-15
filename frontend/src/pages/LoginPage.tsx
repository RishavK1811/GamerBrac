import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, AlertCircle, Loader2, Lock, User as UserIcon, Trophy } from 'lucide-react';
import { useAuth } from '../context';
import { ApiError } from '../api/client';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const destination = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const identifier = usernameOrEmail.trim();
    if (!identifier) { setErrorMessage('Please enter your username or email address.'); return; }
    if (!password)   { setErrorMessage('Please enter your password.'); return; }

    setIsSubmitting(true);
    try {
      await login({ username_or_email: identifier, password });
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) setErrorMessage(err.message);
      else if (err instanceof Error) setErrorMessage(err.message);
      else setErrorMessage('An unexpected error occurred during login. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 relative">
      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.15) 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)' }} />

      <div className="w-full max-w-md relative z-10 animate-entrance">
        {/* Card */}
        <div className="rounded-2xl border border-violet-700/30 shadow-[0_0_50px_rgba(139,92,246,0.18)] overflow-hidden card-glass-heavy p-8 space-y-7">

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-violet-600 to-cyan-500 p-[1.5px] shadow-[0_0_24px_rgba(139,92,246,0.45)]">
              <div className="w-full h-full bg-[#0d0f1e] rounded-[14px] flex items-center justify-center">
                <Trophy className="w-7 h-7 text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Sign In to GamerBrac</h1>
              <p className="text-xs text-gray-400 mt-1">Enter your credentials to access your player hub.</p>
            </div>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-200 text-xs flex items-start space-x-2.5 animate-entrance"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="username_or_email" className="block text-xs font-bold text-gray-300 uppercase tracking-widest">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="username_or_email"
                  type="text"
                  autoComplete="username"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="player_one or player@gamerbrac.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#080912]/80 border border-violet-800/40 hover:border-violet-600/60 focus:border-cyan-500 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-bold text-gray-300 uppercase tracking-widest">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#080912]/80 border border-violet-800/40 hover:border-violet-600/60 focus:border-cyan-500 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl btn-neon-shimmer disabled:opacity-50 disabled:cursor-not-allowed disabled:animate-none text-white font-bold text-sm uppercase tracking-wider shadow-[0_0_24px_rgba(139,92,246,0.40)] hover:shadow-[0_0_35px_rgba(139,92,246,0.60)] transition-shadow flex items-center justify-center space-x-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Footer link */}
          <div className="pt-2 border-t border-violet-900/25 text-center">
            <p className="text-xs text-gray-400">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
                Create one — it&apos;s free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
