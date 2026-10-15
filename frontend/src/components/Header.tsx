import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Trophy,
  Users,
  Menu,
  X,
  Terminal,
  Bell,
  LogIn,
  UserPlus,
  LogOut,
  LayoutDashboard,
  Briefcase,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../context';
import { notificationsApi } from '../api/client';
import type { NotificationItem } from '../types';

interface HeaderProps {
  onScrollToSection?: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Fetch real notifications when authenticated
  useEffect(() => {
    let ignore = false;
    if (!isAuthenticated) return;

    notificationsApi
      .list()
      .then((res) => {
        if (!ignore) {
          setNotifications(res.items || []);
          setUnreadCount(res.unread_count || 0);
        }
      })
      .catch(() => {
        if (!ignore) {
          setNotifications([]);
          setUnreadCount(0);
        }
      });

    return () => {
      ignore = true;
    };
  }, [isAuthenticated]);

  const handleLogout = async () => {
    setNotifications([]);
    setUnreadCount(0);
    await logout();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0a0b10]/85 border-b border-violet-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-0.5 shadow-[0_0_15px_rgba(139,92,246,0.5)]">
              <div className="w-full h-full bg-[#0d0e17] rounded-[10px] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-violet-400 via-cyan-300 to-white bg-clip-text text-transparent">
                  GAMERBRAC
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-700/50">
                  INDIA
                </span>
              </div>
              <p className="text-[11px] text-gray-400 tracking-tight">Esports Tournament Engine</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
            <Link
              to="/tournaments"
              className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center space-x-1"
            >
              <span>Tournaments</span>
            </Link>
            <a
              href={isHome ? '#games' : '/#games'}
              className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center space-x-1"
            >
              <span>Games</span>
            </a>
            <a
              href={isHome ? '#roles' : '/#roles'}
              className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center space-x-1"
            >
              <Users className="w-4 h-4 text-violet-400" />
              <span>Roles</span>
            </a>
            <a
              href={isHome ? '#status' : '/#status'}
              className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center space-x-1"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>API Health</span>
            </a>
          </nav>

          {/* Action Badges / CTAs / Auth Controls */}
          <div className="hidden sm:flex items-center space-x-3 relative">
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl bg-[#121424] border border-violet-800/40 text-gray-300 hover:text-cyan-300 hover:border-cyan-500/50 transition-all cursor-pointer relative"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-[#0e101a] border border-violet-800/50 rounded-2xl shadow-[0_0_25px_rgba(139,92,246,0.3)] p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-violet-900/30 mb-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Notifications
                    </span>
                    <span className="text-[10px] text-cyan-400 font-semibold">
                      {unreadCount} Unread
                    </span>
                  </div>

                  {!isAuthenticated ? (
                    <div className="p-4 text-center text-xs text-gray-400 space-y-2">
                      <p>Sign in to view real-time match and credential updates.</p>
                      <Link
                        to="/login"
                        onClick={() => setShowNotifications(false)}
                        className="inline-block text-cyan-400 hover:underline font-semibold"
                      >
                        Sign in &rarr;
                      </Link>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-400">
                      No notifications yet.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-2.5 rounded-xl bg-violet-950/20 border border-violet-900/30 text-xs"
                        >
                          <p className="font-bold text-cyan-300">{n.title}</p>
                          <p className="text-[11px] text-gray-300 mt-0.5">{n.message}</p>
                          <span className="text-[9px] text-gray-500 mt-1 block">
                            {new Date(n.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auth Buttons or User Menu */}
            {!isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-gray-200 hover:text-white hover:bg-violet-900/30 border border-violet-900/40 transition-colors flex items-center space-x-1"
                >
                  <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all flex items-center space-x-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                {/* Role and User Display */}
                <Link
                  to="/dashboard"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#141624] hover:bg-[#1a1d30] border border-violet-900/40 text-xs transition-colors"
                >
                  <span className="font-bold text-white max-w-[120px] truncate">
                    {user?.profile?.display_name || user?.username}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-violet-950 text-cyan-300 border border-violet-700/60">
                    {user?.role}
                  </span>
                </Link>

                {user?.role === 'organizer' || user?.role === 'admin' ? (
                  <Link
                    to="/organizer"
                    className="p-1.5 rounded-lg text-gray-300 hover:text-cyan-400 hover:bg-violet-900/30 border border-transparent hover:border-violet-900/40 transition-all"
                    title="Organizer Console"
                  >
                    <Briefcase className="w-4 h-4" />
                  </Link>
                ) : null}

                {user?.role === 'admin' ? (
                  <Link
                    to="/admin"
                    className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-950/30 border border-transparent hover:border-amber-900/40 transition-all"
                    title="Admin Portal"
                  >
                    <Sliders className="w-4 h-4" />
                  </Link>
                ) : null}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 transition-all cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            <Link
              to="/tournaments"
              className="px-4 py-2 text-xs font-semibold tracking-wide uppercase rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all cursor-pointer"
            >
              Enter Arena
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0d0f1a] border-b border-violet-900/40 px-4 pt-2 pb-5 space-y-3 animate-in slide-in-from-top-4 duration-150">
          <Link
            to="/tournaments"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-violet-900/30 hover:text-cyan-400"
          >
            Tournaments
          </Link>
          <a
            href={isHome ? '#games' : '/#games'}
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-violet-900/30 hover:text-cyan-400"
          >
            Games
          </a>
          <a
            href={isHome ? '#roles' : '/#roles'}
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-violet-900/30 hover:text-cyan-400"
          >
            Roles
          </a>
          <a
            href={isHome ? '#status' : '/#status'}
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-gray-200 hover:bg-violet-900/30 hover:text-cyan-400"
          >
            API Health
          </a>

          {/* Mobile Auth actions */}
          <div className="pt-3 border-t border-violet-900/30 space-y-2">
            {!isAuthenticated ? (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 rounded-lg text-center text-xs font-semibold bg-[#141624] text-white border border-violet-900/50 flex items-center justify-center space-x-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2.5 rounded-lg text-center text-xs font-semibold bg-violet-600 text-white flex items-center justify-center space-x-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="px-3 py-2 rounded-lg bg-[#141624] text-xs flex justify-between items-center">
                  <span className="font-bold text-white">{user?.username}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-violet-950 text-cyan-300">
                    {user?.role}
                  </span>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-violet-900/30 hover:text-cyan-400 flex items-center space-x-2"
                >
                  <LayoutDashboard className="w-4 h-4 text-cyan-400" />
                  <span>Player Dashboard</span>
                </Link>
                {user?.role === 'organizer' || user?.role === 'admin' ? (
                  <Link
                    to="/organizer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-violet-900/30 hover:text-cyan-400 flex items-center space-x-2"
                  >
                    <Briefcase className="w-4 h-4 text-violet-400" />
                    <span>Organizer Console</span>
                  </Link>
                ) : null}
                {user?.role === 'admin' ? (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-sm font-medium text-amber-300 hover:bg-amber-950/30 flex items-center space-x-2"
                  >
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>Admin Portal</span>
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-400 hover:bg-red-950/30 flex items-center space-x-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            <div className="pt-2">
              <Link
                to="/tournaments"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full block text-center py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
              >
                Enter Arena
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
