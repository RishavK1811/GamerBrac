import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, Loader2, Lock, Mail, User as UserIcon, CheckCircle2 } from 'lucide-react';
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
    <div className="max-w-md mx-auto px-4 py-16 sm:px-6">
      <div className="bg-[#0e101a] border border-violet-900/40 rounded-2xl shadow-[0_0_35px_rgba(139,92,246,0.15)] p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 p-0.5 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <div className="w-full h-full bg-[#0d0e17] rounded-[10px] flex items-center justify-center text-cyan-400">
              <UserPlus className="w-6 h-6" />
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            Create Player Account
          </h1>
          <p className="text-xs text-gray-400">
            Join GamerBrac to compete in Free Fire MAX, BGMI, and VALORANT tournaments.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start space-x-2.5 animate-in fade-in"
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
              className="block text-xs font-semibold text-gray-300 uppercase tracking-wider"
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
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#121422] border border-violet-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>
            <p className="text-[11px] text-gray-500">3-30 chars, lowercase letters, numbers, and underscores only</p>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="reg_email"
              className="block text-xs font-semibold text-gray-300 uppercase tracking-wider"
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
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#121422] border border-violet-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="reg_password"
              className="block text-xs font-semibold text-gray-300 uppercase tracking-wider"
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
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#121422] border border-violet-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Password checklist */}
            <div className="grid grid-cols-2 gap-1 pt-1.5 text-[10px]">
              <span className={`flex items-center space-x-1 ${hasMinLength ? 'text-emerald-400' : 'text-gray-500'}`}>
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Min 8 characters</span>
              </span>
              <span className={`flex items-center space-x-1 ${hasUpper ? 'text-emerald-400' : 'text-gray-500'}`}>
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Uppercase letter</span>
              </span>
              <span className={`flex items-center space-x-1 ${hasLower ? 'text-emerald-400' : 'text-gray-500'}`}>
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Lowercase letter</span>
              </span>
              <span className={`flex items-center space-x-1 ${hasDigit && hasSpecial ? 'text-emerald-400' : 'text-gray-500'}`}>
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>Number & Symbol</span>
              </span>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="reg_confirm_password"
              className="block text-xs font-semibold text-gray-300 uppercase tracking-wider"
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
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-[#121422] border border-violet-900/50 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center space-x-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
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
        <div className="pt-4 border-t border-violet-900/30 text-center">
          <p className="text-xs text-gray-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
