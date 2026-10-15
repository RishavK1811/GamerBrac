import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LayoutDashboard, Loader2 } from 'lucide-react';
import { useAuth } from '../context';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 p-8 text-center"
        aria-busy="true"
        aria-label="Verifying authentication credentials"
      >
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Verifying security credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="p-8 rounded-2xl bg-[#0e101a] border border-amber-900/50 shadow-[0_0_30px_rgba(245,158,11,0.15)] text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-white uppercase">
              Access Restricted
            </h2>
            <p className="text-sm text-gray-300 max-w-md mx-auto">
              This portal requires <span className="font-bold text-amber-300 uppercase">{allowedRoles.join(' or ')}</span> authorization. Your current account role is{' '}
              <span className="font-bold text-cyan-300 uppercase">{user.role}</span>.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs tracking-wide uppercase transition-all shadow-[0_0_15px_rgba(139,92,246,0.4)] flex items-center justify-center space-x-2"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Player Dashboard</span>
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#141624] hover:bg-[#1a1d30] border border-violet-900/40 text-gray-300 hover:text-white font-semibold text-xs tracking-wide uppercase transition-all flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
