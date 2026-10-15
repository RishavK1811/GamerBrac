import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, Loader2, Lock, Mail, User as UserIcon, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context';
import { ApiError } from '../api/client';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Client-side validations
  const usernameValid = /^[a-z0-9_]{3,30}$/.test(username.trim().toLowerCase());
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password);
  const passwordValid = hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername) {
      setErrorMessage('Username is required.');
      return;
    }
    if (!usernameValid) {
      setErrorMessage(
        'Username must be 3-30 characters long and contain only lowercase letters, numbers, and underscores.'
      );
      return;
    }
    if (!cleanEmail) {
      setErrorMessage('Email address is required.');
      return;
    }
    if (!passwordValid) {
      setErrorMessage(
        'Password must be at least 8 characters long and contain an uppercase letter, lowercase letter, digit, and special character.'
      );
      return;
    }
    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        username: cleanUsername,
        email: cleanEmail,
        password,
        confirm_password: confirmPassword,
      });
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Registration failed. Please check your inputs and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16 relative">
      {/* Ambient background glows */}
      <div
        className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.16) 0%, transparent 70%)' }}
      />

      <div className="w-full max-w-md relative z-10 animate-entrance">
        {/* Card */}
        <div className="rounded-2xl border border-violet-700/35 shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden card-glass-heavy p-8 space-y-6">

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-violet-600 p-[1.5px] shadow-[0_0_24px_rgba(6,182,212,0.4)]">
              <div className="w-full h-full bg-[#0d0f1e] rounded-[14px] flex items-center justify-center">
                <UserPlus className="w-7 h-7 text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">
                Create Player Account
              </h1>
              <p className="text-xs text-gray-400 mt-1">
                Join GamerBrac to compete in Free Fire MAX, BGMI, and VALORANT tournaments.
              </p>
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg_username"
                className="block text-xs font-bold text-gray-300 uppercase tracking-widest"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  id="reg_username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="shadow_sniper"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#080912]/80 border border-violet-800/40 hover:border-violet-600/60 focus:border-cyan-500 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                />
              </div>
              <p className="text-[10px] text-gray-500">3-30 chars, lowercase letters, numbers, and underscores only</p>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg_email"
                className="block text-xs font-bold text-gray-300 uppercase tracking-widest"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="reg_email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@gamerbrac.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#080912]/80 border border-violet-800/40 hover:border-violet-600/60 focus:border-cyan-500 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg_password"
                className="block text-xs font-bold text-gray-300 uppercase tracking-widest"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reg_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#080912]/80 border border-violet-800/40 hover:border-violet-600/60 focus:border-cyan-500 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                />
              </div>

              {/* Password checklist */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 text-[10px]">
                <span className={`flex items-center space-x-1 transition-colors ${hasMinLength ? 'text-emerald-400 font-medium' : 'text-gray-500'}`}>
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Min 8 characters</span>
                </span>
                <span className={`flex items-center space-x-1 transition-colors ${hasUpper ? 'text-emerald-400 font-medium' : 'text-gray-500'}`}>
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Uppercase letter</span>
                </span>
                <span className={`flex items-center space-x-1 transition-colors ${hasLower ? 'text-emerald-400 font-medium' : 'text-gray-500'}`}>
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Lowercase letter</span>
                </span>
                <span className={`flex items-center space-x-1 transition-colors ${hasDigit && hasSpecial ? 'text-emerald-400 font-medium' : 'text-gray-500'}`}>
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Number & Symbol</span>
                </span>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="reg_confirm_password"
                className="block text-xs font-bold text-gray-300 uppercase tracking-widest"
              >
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="reg_confirm_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#080912]/80 border border-violet-800/40 hover:border-violet-600/60 focus:border-cyan-500 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                />
              </div>
              {confirmPassword.length > 0 && passwordsMatch && (
                <div className="flex items-center space-x-1 text-[10px] pt-1">
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Passwords match</span>
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl btn-neon-shimmer disabled:opacity-50 disabled:cursor-not-allowed disabled:animate-none text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_24px_rgba(6,182,212,0.35)] hover:shadow-[0_0_35px_rgba(6,182,212,0.55)] transition-shadow flex items-center justify-center space-x-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/50 mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-white" />
                  <span>Complete Registration</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="pt-3 border-t border-violet-900/25 text-center flex flex-col items-center gap-2">
            <p className="text-xs text-gray-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
            <div className="flex items-center space-x-1.5 text-[10px] text-gray-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Free-to-enter tournaments only. No hidden charges.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
