import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Filter,
  Search,
  Calendar,
  Users,
  AlertCircle,
  RefreshCw,
  Inbox,
  ChevronRight,
  ShieldCheck,
  Flame,
  Swords,
  Target,
} from 'lucide-react';
import { tournamentsApi } from '../api/client';
import { getFormatDisplayLabel } from '../config/tournamentConfig';
import type { ApiTournament, GameTitle } from '../types';

export const TournamentsPage: React.FC = () => {
  const [tournaments, setTournaments] = useState<ApiTournament[]>([]);
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const fetchTournaments = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    tournamentsApi
      .list({ game: selectedGame })
      .then((data) => {
        if (!ignore) {
          setTournaments(data);
          setIsLoading(false);
          setErrorMessage(null);
        }
      })
      .catch((err: Error) => {
        if (!ignore) {
          setErrorMessage(err.message || 'Failed to load tournament directory.');
          setTournaments([]);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedGame, refreshTrigger]);

  const filteredTournaments = tournaments.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.game_title.toLowerCase().includes(q) ||
      t.format.toLowerCase().includes(q) ||
      getFormatDisplayLabel(t.game_title, t.format).toLowerCase().includes(q)
    );
  });

  const getGameBadge = (title: string) => {
    switch (title as GameTitle) {
      case 'Free Fire MAX':
        return {
          color: 'text-amber-400 border-amber-800/40 bg-amber-950/40',
          icon: <Flame className="w-3 h-3 text-amber-400 mr-1" />,
        };
      case 'BGMI':
        return {
          color: 'text-cyan-400 border-cyan-800/40 bg-cyan-950/40',
          icon: <Target className="w-3 h-3 text-cyan-400 mr-1" />,
        };
      case 'VALORANT':
        return {
          color: 'text-rose-400 border-rose-800/40 bg-rose-950/40',
          icon: <Swords className="w-3 h-3 text-rose-400 mr-1" />,
        };
      default:
        return {
          color: 'text-violet-400 border-violet-800/40 bg-violet-950/40',
          icon: <Trophy className="w-3 h-3 text-violet-400 mr-1" />,
        };
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'registration_open') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Registration Open</span>
        </span>
      );
    }
    if (s === 'check_in') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 animate-pulse flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>Check-in Live</span>
        </span>
      );
    }
    if (s === 'ongoing') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-950/80 text-amber-300 border border-amber-700/50 flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Ongoing</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-gray-900/90 text-gray-400 border border-gray-700/50">
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-entrance">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-violet-900/30">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Trophy className="w-4 h-4 text-cyan-400" />
            <span>National Esports Circuit</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white uppercase">
            Tournament Directory
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
            Browse verified free-to-enter tournaments for Free Fire MAX, BGMI, and VALORANT.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs px-4 py-2 rounded-xl bg-violet-950/60 border border-violet-700/40 text-violet-300 font-semibold flex items-center space-x-2 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>100% Free Entry • Zero RMG</span>
          </span>
        </div>
      </div>

      {/* ── Filter and Search Bar ─────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 card-glass-heavy p-4 rounded-2xl border border-violet-800/40 shadow-lg">
        {/* Game Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center space-x-1 mr-2">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>
          {['all', 'Free Fire MAX', 'BGMI', 'VALORANT'].map((game) => (
            <button
              key={game}
              type="button"
              onClick={() => setSelectedGame(game)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                selectedGame === game
                  ? 'bg-violet-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.5)] border border-violet-400/50'
                  : 'bg-[#111422] text-gray-300 border border-violet-900/40 hover:bg-[#1a1d30] hover:text-white'
              }`}
            >
              {game === 'all' ? 'All Games' : game}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tournament title or format..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#080912]/80 border border-violet-800/40 hover:border-violet-600/60 focus:border-cyan-500 text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
          />
        </div>
      </div>

      {/* ── Error alert with retry ─────────────────────────────────── */}
      {errorMessage && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={fetchTournaments}
            className="px-3.5 py-1.5 rounded-lg bg-amber-900/50 hover:bg-amber-800/70 border border-amber-700/60 text-white font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* ── Tournaments Grid ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-[#0e1020] border border-violet-900/30 flex flex-col gap-4 h-64"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-24 rounded-lg skeleton-shimmer" />
                <div className="h-5 w-20 rounded-full skeleton-shimmer" />
              </div>
              <div className="h-6 w-3/4 rounded-lg skeleton-shimmer" />
              <div className="h-4 w-1/2 rounded skeleton-shimmer" />
              <div className="flex-1" />
              <div className="h-1.5 w-full rounded-full skeleton-shimmer" />
              <div className="h-9 w-full rounded-xl skeleton-shimmer" />
            </div>
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="p-16 text-center rounded-2xl card-glass-heavy border border-violet-900/30 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-950/50 border border-violet-800/50 flex items-center justify-center text-violet-400">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">No Tournaments Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            {searchQuery
              ? `No tournaments match "${searchQuery}". Try adjusting your search query or game filter.`
              : `No scheduled events found for ${selectedGame}. Check back soon or select another game.`}
          </p>
          <button
            type="button"
            onClick={() => { setSelectedGame('all'); setSearchQuery(''); }}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-900/40 hover:bg-violet-800/60 border border-violet-700/50 text-violet-200 transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((t) => {
            const badge = getGameBadge(t.game_title);
            const fillPercent =
              t.max_participants > 0
                ? Math.min(100, Math.round((t.current_participants / t.max_participants) * 100))
                : 0;

            return (
              <div
                key={t.id}
                className="group p-6 rounded-2xl bg-[#0e1020]/90 border border-violet-900/40 hover:border-cyan-500/50 hover:shadow-[0_0_30px_rgba(6,182,212,0.18)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between space-y-5 backdrop-blur-sm"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border flex items-center ${badge.color}`}
                    >
                      {badge.icon}
                      <span>{t.game_title}</span>
                    </span>
                    {getStatusBadge(t.status)}
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {t.title}
                  </h3>

                  <div className="flex items-center space-x-3 text-xs text-gray-400">
                    <span className="font-semibold text-gray-300 uppercase">
                      {getFormatDisplayLabel(t.game_title, t.format)}
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-violet-400" />
                      <span>{new Date(t.start_datetime).toLocaleDateString()}</span>
                    </span>
                  </div>

                  {/* Slot progress bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400 flex items-center space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Registered Slots</span>
                      </span>
                      <span className="font-bold text-gray-200">
                        {t.current_participants} / {t.max_participants}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#080912] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-600 to-cyan-400 transition-all duration-500 rounded-full"
                        style={{ width: `${fillPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-violet-900/30 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Free Entry</span>
                  </span>
                  <Link
                    to={`/tournaments/${t.id}`}
                    className="px-4 py-2 rounded-xl bg-violet-900/30 hover:bg-cyan-950/70 border border-violet-700/50 hover:border-cyan-500/60 text-white hover:text-cyan-300 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                  >
                    <span>View Bracket</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
