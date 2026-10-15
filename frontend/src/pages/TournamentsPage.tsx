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
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { tournamentsApi } from '../api/client';
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
      t.format.toLowerCase().includes(q)
    );
  });

  const getGameBadgeColor = (title: string) => {
    switch (title as GameTitle) {
      case 'Free Fire MAX':
        return 'text-amber-400 border-amber-800/40 bg-amber-950/30';
      case 'BGMI':
        return 'text-cyan-400 border-cyan-800/40 bg-cyan-950/30';
      case 'VALORANT':
        return 'text-rose-400 border-rose-800/40 bg-rose-950/30';
      default:
        return 'text-violet-400 border-violet-800/40 bg-violet-950/30';
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'registration_open') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
          Registration Open
        </span>
      );
    }
    if (s === 'check_in') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 animate-pulse">
          Check-in Live
        </span>
      );
    }
    if (s === 'ongoing') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-950/80 text-amber-300 border border-amber-800/50">
          Matches Ongoing
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gray-900 text-gray-400 border border-gray-700/50">
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-violet-900/30">
        <div>
          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Trophy className="w-4 h-4" />
            <span>National Esports Circuit</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white uppercase">
            Tournament Directory
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Browse verified free-to-enter tournaments for Free Fire MAX, BGMI, and VALORANT.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs px-3 py-1.5 rounded-xl bg-violet-950/50 border border-violet-800/40 text-violet-300 font-semibold flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>100% Free Entry • Zero RMG</span>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0e101a] p-4 rounded-2xl border border-violet-900/40 shadow-lg">
        {/* Game Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center space-x-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Game:</span>
          </span>
          {['all', 'Free Fire MAX', 'BGMI', 'VALORANT'].map((game) => (
            <button
              key={game}
              type="button"
              onClick={() => setSelectedGame(game)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedGame === game
                  ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]'
                  : 'bg-[#121422] text-gray-300 border border-violet-900/40 hover:bg-[#1a1e34]'
              }`}
            >
              {game === 'all' ? 'All Games' : game}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tournament title..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#121422] border border-violet-900/50 text-white placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
          />
        </div>
      </div>

      {/* Error alert with retry */}
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
            className="px-3 py-1.5 rounded-lg bg-amber-900/50 hover:bg-amber-800/70 border border-amber-700/60 text-white font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Tournaments Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 animate-pulse space-y-4"
            >
              <div className="h-5 w-24 bg-violet-900/30 rounded"></div>
              <div className="h-6 w-3/4 bg-violet-900/40 rounded"></div>
              <div className="h-4 w-1/2 bg-violet-900/20 rounded"></div>
              <div className="pt-4 border-t border-violet-900/20 flex justify-between">
                <div className="h-4 w-20 bg-violet-900/30 rounded"></div>
                <div className="h-8 w-24 bg-violet-900/40 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-xl bg-violet-950/40 border border-violet-800/50 flex items-center justify-center text-violet-400">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Tournaments Found</h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {searchQuery
              ? `No tournaments match "${searchQuery}". Try adjusting your search or filters.`
              : `No scheduled events found for ${selectedGame}. Check back soon or select another game.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((t) => {
            const fillPercent =
              t.max_participants > 0
                ? Math.min(100, Math.round((t.current_participants / t.max_participants) * 100))
                : 0;

            return (
              <div
                key={t.id}
                className="group p-6 rounded-2xl bg-[#0e101a] border border-violet-900/40 hover:border-cyan-500/50 transition-all hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getGameBadgeColor(
                        t.game_title
                      )}`}
                    >
                      {t.game_title}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                    {t.title}
                  </h3>

                  <div className="flex items-center space-x-3 text-xs text-gray-400">
                    <span className="font-semibold text-gray-300 uppercase">{t.format}</span>
                    <span>•</span>
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-violet-400" />
                      <span>{new Date(t.start_datetime).toLocaleDateString()}</span>
                    </span>
                  </div>

                  {/* Slot progress bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-400 flex items-center space-x-1">
                        <Users className="w-3 h-3 text-cyan-400" />
                        <span>Registered Slots</span>
                      </span>
                      <span className="font-bold text-gray-200">
                        {t.current_participants} / {t.max_participants}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#141624] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-600 to-cyan-400 transition-all duration-300"
                        style={{ width: `${fillPercent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-violet-900/20 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Free Entry
                  </span>
                  <Link
                    to={`/tournaments/${t.id}`}
                    className="px-3.5 py-2 rounded-xl bg-violet-900/30 hover:bg-cyan-950/60 border border-violet-700/50 hover:border-cyan-500/60 text-white hover:text-cyan-300 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
