import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Trophy,
  Users,
  Menu,
  X,
  Bell,
  LogIn,
  UserPlus,
  LogOut,
  LayoutDashboard,
  Briefcase,
  Sliders,
  ChevronRight,
  Swords,
} from 'lucide-react';
import { useAuth } from '../context';
import { notificationsApi } from '../api/client';
import type { NotificationItem } from '../types';

export const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for enhanced backdrop
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

    return () => { ignore = true; };
  }, [isAuthenticated]);

  const handleLogout = async () => {
    setNotifications([]);
    setUnreadCount(0);
    setMobileMenuOpen(false);
    setShowNotifications(false);
    await logout();
    navigate('/');
  };

  const isHome = location.pathname === '/';

  const navLinkBase =
    'relative text-sm font-medium text-gray-300 hover:text-white transition-colors duration-200 group';
  const navUnderline =
    'absolute -bottom-0.5 left-0 w-0 h-px bg-gradient-to-r from-violet-400 to-cyan-400 group-hover:w-full transition-all duration-300';

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'backdrop-blur-xl bg-[#080910]/90 border-b border-violet-500/25 shadow-[0_4px_32px_rgba(0,0,0,0.5)]'
          : 'backdrop-blur-lg bg-[#080910]/70 border-b border-violet-900/20'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ─────────────────────────────────────────────────── */}
          <Link to="/" className="flex items-center space-x-3 group/logo">
            <div className="relative w-10 h-10 shrink-0">
              {/* Glow ring */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-400 opacity-80 group-hover/logo:opacity-100 transition-opacity duration-300 blur-[2px]" />
              <div className="relative w-full h-full rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[1.5px]">
                <div className="w-full h-full bg-[#0a0b14] rounded-[10px] flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-cyan-400 group-hover/logo:text-cyan-300 transition-colors" />
                </div>
              </div>
            </div>
            <div className="flex flex-col leading-none min-w-0">
              <div className="flex items-center space-x-1.5">
                <span className="text-base sm:text-[1.1rem] font-black tracking-[0.12em] bg-gradient-to-r from-violet-300 via-cyan-200 to-white bg-clip-text text-transparent uppercase truncate">
                  GamerBrac
                </span>
                <span className="text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-700/50 uppercase tracking-widest shrink-0">
                  INDIA
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] text-gray-500 tracking-wider font-medium mt-0.5 truncate hidden sm:block">
                Esports Tournament Engine
              </span>
            </div>
          </Link>

          {/* ── Desktop Nav ──────────────────────────────────────────── */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/tournaments" className={navLinkBase}>
              <span className="flex items-center space-x-1.5">
                <Swords className="w-3.5 h-3.5 text-violet-400" />
                <span>Tournaments</span>
              </span>
              <span className={navUnderline} />
            </Link>
            <a
              href={isHome ? '#games' : '/#games'}
              className={navLinkBase}
            >
              <span>Games</span>
              <span className={navUnderline} />
            </a>
            <a
              href={isHome ? '#roles' : '/#roles'}
              className={navLinkBase}
            >
              <span className="flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>Community</span>
              </span>
              <span className={navUnderline} />
            </a>
          </nav>

          {/* ── Action Row ───────────────────────────────────────────── */}
          <div className="hidden sm:flex items-center space-x-2.5 relative">

            {/* Notification Bell (Only when authenticated) */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-xl bg-[#111422] border border-violet-800/30 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/40 hover:bg-[#141830] transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  aria-label="View notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] border border-violet-700/40 z-50 overflow-hidden card-glass-heavy animate-entrance">
                    <div className="px-4 pt-4 pb-3 border-b border-violet-900/30 flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-700/50 font-bold">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center">
                          <Bell className="w-7 h-7 text-gray-600 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">No notifications yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {notifications.map((n) => (
                            <div
                              key={n.id}
                              className="p-3 rounded-xl bg-violet-950/20 border border-violet-900/25 hover:bg-violet-950/30 transition-colors"
                            >
                              <p className="text-xs font-bold text-cyan-300 mb-0.5">{n.title}</p>
                              <p className="text-[11px] text-gray-400 leading-relaxed">{n.message}</p>
                              <span className="text-[9px] text-gray-600 mt-1 block">
                                {new Date(n.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auth buttons */}
            {!isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-gray-200 hover:text-white bg-[#111422] hover:bg-[#1a1d32] border border-violet-800/40 hover:border-violet-600/60 transition-all duration-200 flex items-center space-x-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.35)] hover:shadow-[0_0_28px_rgba(139,92,246,0.55)] transition-all duration-200 flex items-center space-x-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register</span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                {/* User menu / dashboard link */}
                <Link
                  to="/dashboard"
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#111422] hover:bg-[#1a1d32] border border-violet-800/30 hover:border-violet-600/50 text-xs transition-all duration-200"
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                    {(user?.profile?.display_name || user?.username || 'U')[0].toUpperCase()}
                  </div>
                  <span className="font-bold text-white max-w-[100px] truncate text-[11px]">
                    {user?.profile?.display_name || user?.username}
                  </span>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-violet-950 text-cyan-300 border border-violet-700/50">
                    {user?.role}
                  </span>
                </Link>

                {(user?.role === 'organizer' || user?.role === 'admin') && (
                  <Link
                    to="/organizer"
                    className="p-2 rounded-xl text-gray-400 hover:text-cyan-300 hover:bg-violet-900/25 border border-transparent hover:border-violet-700/40 transition-all duration-200"
                    title="Organizer Console"
                  >
                    <Briefcase className="w-4 h-4" />
                  </Link>
                )}

                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="p-2 rounded-xl text-amber-400/80 hover:text-amber-300 hover:bg-amber-950/30 border border-transparent hover:border-amber-700/40 transition-all duration-200"
                    title="Admin Portal"
                  >
                    <Sliders className="w-4 h-4" />
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-xl text-gray-300 hover:text-red-400 bg-[#111422] hover:bg-red-950/25 border border-violet-800/30 hover:border-red-800/40 text-xs font-semibold flex items-center space-x-1.5 transition-all duration-200 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            {/* Enter Arena CTA: Points to protected dashboard route so it requires login through ProtectedRoute/auth flow */}
            <Link
              to="/dashboard"
              className="hidden lg:flex items-center space-x-1.5 px-4 py-2 text-xs font-bold tracking-wide uppercase rounded-xl btn-neon-shimmer text-white shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] transition-shadow duration-200"
            >
              <span>Enter Arena</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* ── Mobile hamburger ─────────────────────────────────────── */}
          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl text-gray-400 hover:text-white hover:bg-[#111422] border border-transparent hover:border-violet-800/40 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all cursor-pointer"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ──────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div id="mobile-nav-menu" className="md:hidden card-glass-heavy border-b border-violet-900/30 px-4 pt-3 pb-5 space-y-1 animate-entrance max-h-[calc(100vh-4rem)] overflow-y-auto">
          <Link
            to="/tournaments"
            onClick={() => setMobileMenuOpen(false)}
            className="min-h-[44px] flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:bg-violet-900/20 hover:text-white transition-all"
          >
            <Swords className="w-4 h-4 text-violet-400 shrink-0" />
            <span>Tournaments</span>
          </Link>
          <a
            href={isHome ? '#games' : '/#games'}
            onClick={() => setMobileMenuOpen(false)}
            className="min-h-[44px] flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:bg-violet-900/20 hover:text-white transition-all"
          >
            <Trophy className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Games</span>
          </a>
          <a
            href={isHome ? '#roles' : '/#roles'}
            onClick={() => setMobileMenuOpen(false)}
            className="min-h-[44px] flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-200 hover:bg-violet-900/20 hover:text-white transition-all"
          >
            <Users className="w-4 h-4 text-violet-400 shrink-0" />
            <span>Community</span>
          </a>

          {/* Mobile Auth actions */}
          <div className="pt-3 border-t border-violet-900/25 space-y-2">
            {!isAuthenticated ? (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[44px] py-2.5 rounded-xl text-center text-xs font-semibold bg-[#111422] text-white border border-violet-800/40 flex items-center justify-center space-x-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[44px] py-2.5 rounded-xl text-center text-xs font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex items-center justify-center space-x-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span>Register</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[#111422] border border-violet-800/30">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-black text-white shrink-0">
                      {(user?.profile?.display_name || user?.username || 'U')[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-white text-xs truncate">{user?.profile?.display_name || user?.username}</span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    {unreadCount > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-700/50 font-bold">
                        {unreadCount} new
                      </span>
                    )}
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-violet-950 text-cyan-300 border border-violet-700/50">
                      {user?.role}
                    </span>
                  </div>
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="min-h-[44px] flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-violet-900/20 hover:text-cyan-300 transition-all"
                >
                  <LayoutDashboard className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Player Dashboard</span>
                </Link>
                {(user?.role === 'organizer' || user?.role === 'admin') && (
                  <Link
                    to="/organizer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="min-h-[44px] flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-300 hover:bg-violet-900/20 hover:text-cyan-300 transition-all"
                  >
                    <Briefcase className="w-4 h-4 text-violet-400 shrink-0" />
                    <span>Organizer Console</span>
                  </Link>
                )}
                {user?.role === 'admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="min-h-[44px] flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-300 hover:bg-amber-950/20 transition-all"
                  >
                    <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Admin Portal</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full min-h-[44px] flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-950/20 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full min-h-[44px] flex items-center justify-center space-x-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wide btn-neon-shimmer text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]"
            >
              <span>Enter Arena</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
