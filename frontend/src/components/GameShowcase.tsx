import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiTournament, GameTitle, LeaderboardEntry, MockTournamentPreview } from '../types';
import { getApiUrl } from '../api/client';
import {
  Trophy,
  Users,
  Calendar,
  Sparkles,
  Filter,
  CheckCircle2,
  Medal,
  X,
  Crosshair,
  RefreshCw,
  AlertCircle,
  Inbox,
  ChevronRight,
  Flame,
  Target,
  Swords,
} from 'lucide-react';

const GAMES = [
  {
    id: 'ff-max',
    name: 'Free Fire MAX' as GameTitle,
    genre: 'Battle Royale',
    format: 'Squads (4) / Duo',
    accentBorder: 'hover:border-violet-500/70',
    accentGlow: 'hover:shadow-[0_0_28px_rgba(139,92,246,0.22)]',
    tagBg: 'bg-violet-950/80 text-violet-300 border-violet-800/40',
    orbColor: 'bg-violet-600/10',
    iconColor: 'text-violet-400',
    Icon: Flame,
    platforms: 'Android · iOS',
    description:
      'High-octane mobile battle royale with 48-player custom lobbies, Bermuda/Purgatory rotations, and automated kill-point calculations.',
  },
  {
    id: 'bgmi',
    name: 'BGMI' as GameTitle,
    genre: 'Tactical Battle Royale',
    format: 'Squads (4)',
    accentBorder: 'hover:border-cyan-500/70',
    accentGlow: 'hover:shadow-[0_0_28px_rgba(6,182,212,0.22)]',
    tagBg: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/40',
    orbColor: 'bg-cyan-600/10',
    iconColor: 'text-cyan-400',
    Icon: Target,
    platforms: 'Android · iOS',
    description:
      "India's marquee battle royale featuring Erangel & Miramar maps, official esports scoring rules, and scheduled lobby drops.",
  },
  {
    id: 'valorant',
    name: 'VALORANT' as GameTitle,
    genre: '5v5 Tactical FPS',
    format: 'Team of 5 + 1 Sub',
    accentBorder: 'hover:border-rose-500/70',
    accentGlow: 'hover:shadow-[0_0_28px_rgba(244,63,94,0.20)]',
    tagBg: 'bg-rose-950/80 text-rose-300 border-rose-800/40',
    orbColor: 'bg-rose-600/8',
    iconColor: 'text-rose-400',
    Icon: Swords,
    platforms: 'PC (Windows)',
    description:
      'Precise gunplay and agent abilities in competitive custom matches with automated map veto workflows and Bo1/Bo3 elimination brackets.',
  },
];

const MOCK_TOURNAMENTS: MockTournamentPreview[] = [];

const getStatusStyle = (status: string) => {
  const s = status.toLowerCase().replace(/_/g, ' ');
  if (s === 'registration open') return 'bg-emerald-950/70 border-emerald-700/50 text-emerald-300';
  if (s === 'check in') return 'bg-cyan-950/70 border-cyan-600/50 text-cyan-300 animate-pulse';
  if (s === 'ongoing') return 'bg-amber-950/70 border-amber-700/50 text-amber-300';
  if (s === 'completed') return 'bg-gray-900 border-gray-700/50 text-gray-400';
  return 'bg-violet-950/60 border-violet-700/40 text-violet-300';
};

export const GameShowcase: React.FC = () => {
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [apiTournaments, setApiTournaments] = useState<ApiTournament[]>([]);
  const [activeLeaderboardId, setActiveLeaderboardId] = useState<string | null>(null);
  const [activeLeaderboardTitle, setActiveLeaderboardTitle] = useState<string>('');
  const [leaderboardStandings, setLeaderboardStandings] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);
  const [loadingTournaments, setLoadingTournaments] = useState<boolean>(true);
  const [tournamentError, setTournamentError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const fetchTournaments = useCallback(() => {
    setLoadingTournaments(true);
    setTournamentError(null);
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let ignore = false;
    const url =
      selectedGame === 'all'
        ? '/api/v1/tournaments'
        : `/api/v1/tournaments?game=${encodeURIComponent(selectedGame)}`;

    fetch(getApiUrl(url))
      .then((res) => {
        if (!res.ok) throw new Error('Live database unreachable');
        return res.json();
      })
      .then((data: ApiTournament[]) => {
        if (!ignore) {
          setApiTournaments(data);
          setLoadingTournaments(false);
          setTournamentError(null);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setTournamentError(err.message || 'Failed to connect to live tournament database');
          setApiTournaments([]);
          setLoadingTournaments(false);
        }
      });

    return () => { ignore = true; };
  }, [selectedGame, refreshTrigger]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeLeaderboardId) setActiveLeaderboardId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLeaderboardId]);

  const handleOpenLeaderboard = (tournamentId: string, title: string) => {
    setActiveLeaderboardId(tournamentId);
    setActiveLeaderboardTitle(title);
    setLoadingLeaderboard(true);
    setLeaderboardStandings([]);

    fetch(getApiUrl(`/api/v1/tournaments/${tournamentId}/leaderboard`))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch leaderboard');
        return res.json();
      })
      .then((data: { standings: LeaderboardEntry[] }) => {
        setLeaderboardStandings(data.standings || []);
        setLoadingLeaderboard(false);
      })
      .catch(() => {
        setLeaderboardStandings([]);
        setLoadingLeaderboard(false);
      });
  };

  const hasLiveTournaments = apiTournaments.length > 0;
  const filteredMockTournaments =
    selectedGame === 'all'
      ? MOCK_TOURNAMENTS
      : MOCK_TOURNAMENTS.filter((t) => t.game === selectedGame);

  return (
    <section id="tournaments" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Section Heading ───────────────────────────────────────── */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-violet-950/60 border border-violet-800/40 text-violet-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Featured Tournaments &amp; Titles</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase leading-none">
            CHOOSE YOUR{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
              BATTLEGROUND
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-gray-400 leading-relaxed">
            Browse tournaments across India's top esports titles. All events are 100% free-to-enter
            with transparent community rules.
          </p>
        </div>

        {/* ── Game Cards ───────────────────────────────────────────── */}
        <div id="games" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {GAMES.map((game) => {
            const Icon = game.Icon;
            return (
              <div
                key={game.id}
                className={`group relative p-6 rounded-2xl bg-[#0e1020]/80 border border-violet-900/30 ${game.accentBorder} ${game.accentGlow} backdrop-blur-sm hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col`}
              >
                <div className={`absolute top-0 right-0 w-36 h-36 ${game.orbColor} rounded-full blur-3xl pointer-events-none`} />

                <div className="flex items-start justify-between mb-5">
                  <div className={`p-2.5 rounded-xl bg-[#080910]/60 border border-gray-800/60 ${game.iconColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${game.tagBg}`}>
                      {game.genre}
                    </span>
                    <span className="text-[10px] text-gray-500">{game.platforms}</span>
                  </div>
                </div>

                <h3 className="text-xl font-extrabold text-white mb-2">{game.name}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-5 flex-1">{game.description}</p>

                <div className="p-3 rounded-xl bg-[#080910]/60 border border-gray-800/40 text-xs flex items-center justify-between mb-5">
                  <span className="text-gray-500 font-medium">Format:</span>
                  <span className="font-bold text-white">{game.format}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedGame(game.name)}
                  className={`mt-auto w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer ${
                    selectedGame === game.name
                      ? 'bg-violet-600 border-violet-500 text-white'
                      : 'bg-transparent border-gray-700/50 text-gray-400 hover:border-violet-500/50 hover:text-white'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter {game.name}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* ── Tournament Listings ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-violet-400" />
              <span>Current &amp; Upcoming Events</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-2 ${
                tournamentError
                  ? 'bg-red-950/60 border-red-700/40 text-red-300'
                  : 'bg-emerald-950/60 border-emerald-700/40 text-emerald-300'
              }`}>
                {tournamentError ? 'Connection Issue' : 'Live Database'}
              </span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </span>
            {['all', 'Free Fire MAX', 'BGMI', 'VALORANT'].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedGame(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  selectedGame === filter
                    ? 'bg-violet-600 text-white shadow-[0_0_14px_rgba(139,92,246,0.5)]'
                    : 'bg-[#0e1020] text-gray-300 border border-violet-900/40 hover:bg-[#161930] hover:border-violet-600/50'
                }`}
              >
                {filter === 'all' ? 'All Games' : filter}
              </button>
            ))}
          </div>
        </div>

        {/* Error banner */}
        {tournamentError && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Could not load live tournaments. Please retry.</span>
            </div>
            <button
              type="button"
              onClick={() => fetchTournaments()}
              className="px-3 py-1.5 rounded-lg bg-amber-900/50 hover:bg-amber-800/70 border border-amber-700/60 text-white font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        )}

        {/* Tournament grid */}
        {loadingTournaments ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading tournaments">
            {[1, 2, 3].map((n) => (
              <div
                key={`skeleton-${n}`}
                className="p-6 rounded-2xl bg-[#0e1020] border border-violet-900/25 flex flex-col gap-4 h-72"
              >
                <div className="flex items-center justify-between">
                  <div className="h-5 w-28 rounded-lg skeleton-shimmer" />
                  <div className="h-5 w-20 rounded-full skeleton-shimmer" />
                </div>
                <div className="h-6 w-3/4 rounded-lg skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                <div className="flex-1" />
                <div className="h-1.5 w-full rounded-full skeleton-shimmer" />
                <div className="flex gap-2 pt-2 border-t border-violet-900/20">
                  <div className="h-9 flex-1 rounded-xl skeleton-shimmer" />
                  <div className="h-9 flex-1 rounded-xl skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {hasLiveTournaments
              ? apiTournaments.map((tourney) => {
                  const fillPct =
                    tourney.max_participants > 0
                      ? Math.min(100, Math.round((tourney.current_participants / tourney.max_participants) * 100))
                      : 0;
                  return (
                    <div
                      key={tourney.id}
                      className="group relative p-6 rounded-2xl bg-[#0e1020]/80 border border-violet-900/35 hover:border-cyan-500/50 hover:shadow-[0_0_28px_rgba(6,182,212,0.15)] hover:-translate-y-0.5 backdrop-blur-sm transition-all duration-300 flex flex-col"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-violet-950/80 border border-violet-800/40 text-violet-300">
                          {tourney.game_title}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${getStatusStyle(tourney.status)}`}>
                          {tourney.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white mb-1 group-hover:text-cyan-200 transition-colors line-clamp-1">
                        {tourney.title}
                      </h4>
                      <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-wider font-semibold">
                        {tourney.format}
                      </p>

                      <div className="space-y-2 text-xs mb-5">
                        <div className="flex items-center justify-between text-gray-400">
                          <span className="flex items-center space-x-1.5">
                            <Users className="w-3.5 h-3.5 text-violet-400" />
                            <span>Slots</span>
                          </span>
                          <span className="font-bold text-gray-200">
                            {tourney.current_participants}/{tourney.max_participants}
                          </span>
                        </div>
                        {/* Capacity bar */}
                        <div className="w-full h-1.5 bg-[#080910] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-600 to-cyan-400 rounded-full transition-all duration-500"
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-gray-400">
                          <span className="flex items-center space-x-1.5">
                            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Starts</span>
                          </span>
                          <span className="font-medium text-cyan-300">
                            {new Date(tourney.start_datetime).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-gray-400">
                          <span className="flex items-center space-x-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Entry</span>
                          </span>
                          <span className="font-bold text-emerald-400 uppercase tracking-wide text-[10px]">
                            {tourney.is_free_entry ? 'Free Entry' : 'Standard'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-auto pt-4 border-t border-gray-800/60 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenLeaderboard(tourney.id, tourney.title)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-700/40 hover:border-cyan-500/60 text-cyan-300 hover:text-white transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Medal className="w-3.5 h-3.5" />
                          <span>Standings</span>
                        </button>
                        <Link
                          to={`/tournaments/${tourney.id}`}
                          className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-violet-900/30 hover:bg-violet-800/50 border border-violet-700/40 hover:border-violet-500/60 text-violet-200 hover:text-white transition-all flex items-center justify-center space-x-1.5"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })
              : filteredMockTournaments.length > 0
              ? filteredMockTournaments.map((tourney) => (
                  <div
                    key={tourney.id}
                    className="p-6 rounded-2xl bg-[#0e1020]/80 border border-violet-900/35 hover:border-cyan-500/50 transition-all flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-violet-950/80 border border-violet-800/40 text-violet-300">
                        {tourney.game}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white mb-2">{tourney.title}</h4>
                    <div className="mt-auto pt-4 border-t border-gray-800/60 flex gap-2">
                      <Link
                        to="/tournaments"
                        className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-violet-900/30 hover:bg-violet-800/50 border border-violet-700/40 text-violet-200 hover:text-white transition-all flex items-center justify-center space-x-1.5"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))
              : (
                <div className="p-12 text-center rounded-2xl bg-[#0e1020]/80 border border-violet-900/25 col-span-1 md:col-span-3 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-950/50 border border-violet-800/40 flex items-center justify-center mb-4">
                    <Inbox className="w-8 h-8 text-gray-500" />
                  </div>
                  <h4 className="text-base font-bold text-white mb-2">No Tournaments Found</h4>
                  <p className="text-xs text-gray-400 max-w-sm mb-5">
                    There are currently no active or upcoming tournaments matching &quot;{selectedGame}&quot;.
                    Check back soon or select another game title.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedGame('all')}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-violet-900/40 hover:bg-violet-800/60 border border-violet-700/50 text-violet-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    Show All Games
                  </button>
                </div>
              )}
          </div>
        )}
      </div>

      {/* ── Leaderboard Modal ────────────────────────────────────────── */}
      {activeLeaderboardId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leaderboard-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
        >
          <div className="card-glass-heavy rounded-2xl max-w-3xl w-full p-6 shadow-[0_0_50px_rgba(139,92,246,0.35)] animate-entrance">
            <div className="flex items-center justify-between pb-4 border-b border-violet-900/35 mb-5">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-violet-950/80 border border-violet-700/40">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                </div>
                <h4 id="leaderboard-modal-title" className="text-base font-bold text-white">
                  {activeLeaderboardTitle} — Standings
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveLeaderboardId(null)}
                className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors cursor-pointer"
                aria-label="Close leaderboard modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingLeaderboard ? (
              <div className="py-16 flex flex-col items-center justify-center text-gray-400 space-y-3">
                <RefreshCw className="w-7 h-7 animate-spin text-cyan-400" />
                <p className="text-xs">Computing tournament standings…</p>
              </div>
            ) : leaderboardStandings.length === 0 ? (
              <div className="py-16 text-center">
                <Inbox className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No standings available yet.</p>
                <p className="text-xs text-gray-500 mt-1">Results will appear once matches are completed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-violet-900/30 text-gray-500 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Rank</th>
                      <th className="py-3 px-3">Player / Squad</th>
                      <th className="py-3 px-2 text-center">Matches</th>
                      <th className="py-3 px-2 text-center">Wins</th>
                      <th className="py-3 px-2 text-center">
                        <span className="flex items-center justify-center space-x-1">
                          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Kills</span>
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-900/15 text-gray-200 font-medium">
                    {leaderboardStandings.map((entry) => {
                      const rankStyles =
                        entry.rank === 1
                          ? 'bg-amber-950/30'
                          : entry.rank === 2
                          ? 'bg-slate-800/20'
                          : entry.rank === 3
                          ? 'bg-orange-950/20'
                          : '';
                      const rankBadge =
                        entry.rank === 1
                          ? 'bg-amber-500 text-black'
                          : entry.rank === 2
                          ? 'bg-slate-300 text-black'
                          : entry.rank === 3
                          ? 'bg-amber-700 text-white'
                          : 'bg-gray-800 text-gray-400';
                      return (
                        <tr key={entry.participant_id} className={`hover:bg-violet-950/20 transition-colors ${rankStyles}`}>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${rankBadge}`}>
                              {entry.rank}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-white">
                            <div className="flex items-center space-x-1.5">
                              <span>{entry.name}</span>
                              {entry.tag && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-violet-900/40 border border-violet-700/40 text-violet-300">
                                  {entry.tag}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center text-gray-300">{entry.matches_played}</td>
                          <td className="py-3 px-2 text-center font-bold text-emerald-400">{entry.wins}</td>
                          <td className="py-3 px-2 text-center text-cyan-300 font-bold">{entry.total_kills}</td>
                          <td className="py-3 px-3 text-right font-black text-sm text-cyan-400">{entry.total_points} pts</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-violet-900/25 flex items-center justify-between text-[10px] text-gray-500">
              <span>Points: 1st=10pts · 2nd=6pts · 3rd=5pts · +1pt per Kill</span>
              <button
                type="button"
                onClick={() => setActiveLeaderboardId(null)}
                className="px-4 py-2 rounded-lg bg-[#111422] hover:bg-[#1a1e35] border border-gray-700/50 text-gray-300 hover:text-white transition-colors cursor-pointer text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
