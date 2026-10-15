import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApiTournament, GameTitle, LeaderboardEntry, MockTournamentPreview } from '../types';
import { getApiUrl } from '../api/client';
import { getFormatDisplayLabel } from '../config/tournamentConfig';
import freefireImg from '../assets/games/freefire.svg';
import bgmiImg from '../assets/games/bgmi.svg';
import valorantImg from '../assets/games/valorant.svg';
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
  ShieldAlert,
  Zap,
} from 'lucide-react';

const GAMES = [
  {
    id: 'ff-max',
    name: 'Free Fire MAX' as GameTitle,
    genre: 'Battle Royale',
    format: 'Squads (4) / Duo',
    artwork: freefireImg,
    accentBorder: 'hover:border-amber-500/70',
    accentGlow: 'hover:shadow-[0_0_28px_rgba(245,158,11,0.22)]',
    tagBg: 'bg-amber-950/80 text-amber-300 border-amber-800/40',
    orbColor: 'bg-amber-600/10',
    iconColor: 'text-amber-400',
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
    artwork: bgmiImg,
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
    genre: 'Tactical FPS',
    format: '1v1 (Solo) / 2v2 (Duo)',
    artwork: valorantImg,
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

const formatIST = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
};

const formatISTDateOnly = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
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

  const filteredTournaments = apiTournaments.filter((t) =>
    selectedGame === 'all' ? true : t.game_title === selectedGame
  );

  const freeTournaments = filteredTournaments.filter((t) => t.is_free_entry === true);
  const paidTournaments = filteredTournaments.filter((t) => t.is_free_entry === false);

  const weeklyFreeTournament = freeTournaments.length > 0 ? freeTournaments[0] : null;
  const subsequentFreeTournaments = freeTournaments.slice(1);

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
            <span>Official Esports Titles &amp; Brackets</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight uppercase leading-none">
            CHOOSE YOUR{' '}
            <span className="bg-gradient-to-r from-violet-400 via-cyan-300 to-amber-300 bg-clip-text text-transparent">
              BATTLEGROUND
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-gray-400 leading-relaxed">
            Browse verified tournaments across Free Fire MAX, BGMI, and VALORANT. Participate in the
            official Weekly Free Tournament or explore scheduled entry brackets.
          </p>
        </div>

        {/* ── Game Cards with 16:9 Artwork ─────────────────────────── */}
        <div id="games" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {GAMES.map((game) => {
            const Icon = game.Icon;
            return (
              <div
                key={game.id}
                className={`group relative p-5 rounded-2xl bg-[#0e1020]/80 border border-violet-900/30 ${game.accentBorder} ${game.accentGlow} backdrop-blur-sm hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col`}
              >
                <div className={`absolute top-0 right-0 w-36 h-36 ${game.orbColor} rounded-full blur-3xl pointer-events-none`} />

                {/* 16:9 Landscape Artwork Container (Zero layout shift) */}
                <div className="relative aspect-video w-full rounded-xl overflow-hidden mb-4 bg-[#060810] border border-violet-900/30">
                  <img
                    src={game.artwork}
                    alt={game.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e1020] via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-2.5 left-3 flex items-center space-x-1.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${game.tagBg}`}>
                      {game.genre}
                    </span>
                  </div>
                </div>

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`p-2 rounded-lg bg-[#080910]/80 border border-gray-800/60 ${game.iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-black text-white">{game.name}</h3>
                  </div>
                  <span className="text-[10px] text-gray-500 font-semibold">{game.platforms}</span>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed mb-4 flex-1">{game.description}</p>

                <div className="p-2.5 rounded-xl bg-[#080910]/70 border border-gray-800/40 text-xs flex items-center justify-between mb-4">
                  <span className="text-gray-500 font-medium">Format:</span>
                  <span className="font-bold text-white">{game.format}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedGame(game.name)}
                  className={`mt-auto w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-200 flex items-center justify-center space-x-1.5 cursor-pointer ${
                    selectedGame === game.name
                      ? 'bg-violet-600 border-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]'
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

        {/* ── Global Filter Bar ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10 pb-6 border-b border-violet-900/30">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-violet-400" />
              <span>Filter By Game:</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['all', 'Free Fire MAX', 'BGMI', 'VALORANT'].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedGame(filter)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  selectedGame === filter
                    ? 'bg-violet-600 text-white shadow-[0_0_16px_rgba(139,92,246,0.45)] border border-violet-500'
                    : 'bg-[#0e1020] text-gray-300 border border-violet-900/40 hover:bg-[#161930] hover:border-violet-600/50'
                }`}
              >
                {filter === 'all' ? 'All Games' : filter}
              </button>
            ))}
            {selectedGame !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedGame('all')}
                className="text-[11px] text-gray-400 hover:text-white underline ml-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {tournamentError && (
          <div
            role="alert"
            className="mb-8 p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Could not load live tournaments from database. Please retry connection.</span>
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

        {/* ═══════════════════════════════════════════════════════════════
            SECTION A: FREE TOURNAMENT OF THE WEEK
           ═══════════════════════════════════════════════════════════════ */}
        <div className="mb-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 text-[10px] font-black uppercase tracking-widest">
                  Section A
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-violet-950/60 border border-violet-800/40 text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                  Asia/Kolkata Calendar Week Authority
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  tournamentError
                    ? 'bg-red-950/60 border-red-700/40 text-red-300'
                    : 'bg-emerald-950/60 border-emerald-700/40 text-emerald-300'
                }`}>
                  {tournamentError ? 'Connection Issue' : 'Live Database'}
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white flex items-center space-x-2.5 tracking-tight uppercase">
                <Trophy className="w-7 h-7 text-amber-400" />
                <span>Free Tournament of the Week</span>
              </h3>
            </div>
            <span className="text-xs text-gray-400 max-w-xs">
              Exactly one official free community event is scheduled across the platform per calendar week.
            </span>
          </div>

          {loadingTournaments ? (
            <div className="p-8 rounded-2xl bg-[#0e1020] border border-violet-900/25 flex flex-col gap-4" aria-busy="true" aria-label="Loading free tournament">
              <div className="h-6 w-48 rounded-lg skeleton-shimmer" />
              <div className="h-10 w-3/4 rounded-lg skeleton-shimmer" />
              <div className="h-4 w-1/2 rounded skeleton-shimmer" />
            </div>
          ) : weeklyFreeTournament ? (
            <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#12132b]/95 via-[#0e1020]/90 to-[#0a0d18]/95 border-2 border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.15)] backdrop-blur-md overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-black uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>OFFICIAL FREE TOURNAMENT OF THE WEEK</span>
                    </span>
                    <span className="px-3 py-1 rounded-full bg-violet-950/80 border border-violet-800/40 text-violet-300 text-xs font-bold">
                      {weeklyFreeTournament.game_title}
                    </span>
                    <span className={`px-3 py-1 rounded-full border text-xs font-bold capitalize ${getStatusStyle(weeklyFreeTournament.status)}`}>
                      {weeklyFreeTournament.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-2">
                      {weeklyFreeTournament.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-300 max-w-2xl leading-relaxed">
                      Official weekly platform bracket. Entry is 100% free with verified competitive rules, live slot management, and anti-cheat enforcement.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-[#080a14]/70 border border-gray-800/50">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block">Format</span>
                      <span className="text-sm font-black text-white uppercase">
                        {getFormatDisplayLabel(weeklyFreeTournament.game_title, weeklyFreeTournament.format)}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#080a14]/70 border border-gray-800/50">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block">Capacity</span>
                      <span className="text-sm font-black text-emerald-400">
                        {weeklyFreeTournament.current_participants} / {weeklyFreeTournament.max_participants}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#080a14]/70 border border-gray-800/50">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block">Starts (IST)</span>
                      <span className="text-xs font-bold text-cyan-300">{formatIST(weeklyFreeTournament.start_datetime)}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#080a14]/70 border border-gray-800/50">
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block">Entry Fee</span>
                      <span className="text-xs font-black text-emerald-300 uppercase">₹0 (Free)</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[220px]">
                  <Link
                    to={`/tournaments/${weeklyFreeTournament.id}`}
                    className="w-full py-3.5 px-6 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black transition-all shadow-[0_0_24px_rgba(16,185,129,0.35)] flex items-center justify-center space-x-2 text-center"
                  >
                    <span>View Tournament Details</span>
                    <ChevronRight className="w-4 h-4 text-black" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleOpenLeaderboard(weeklyFreeTournament.id, weeklyFreeTournament.title)}
                    className="w-full py-3 px-6 rounded-xl text-xs font-bold uppercase tracking-wider bg-violet-950/40 hover:bg-violet-900/60 border border-violet-700/50 text-violet-200 hover:text-white transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Medal className="w-4 h-4 text-cyan-400" />
                    <span>View Standings</span>
                  </button>
                </div>
              </div>

              {/* Capacity progress bar */}
              <div className="mt-6 pt-4 border-t border-gray-800/60">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
                  <span className="font-semibold">Registered Competitors</span>
                  <span className="font-bold text-white">
                    {Math.round((weeklyFreeTournament.current_participants / weeklyFreeTournament.max_participants) * 100)}% Filled
                  </span>
                </div>
                <div className="w-full h-2 bg-[#060810] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((weeklyFreeTournament.current_participants / weeklyFreeTournament.max_participants) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Polished Empty State for Free Tournament of the Week */
            <div className="p-8 sm:p-12 text-center rounded-3xl bg-[#0e1020]/80 border border-violet-900/30 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 text-emerald-400" />
              </div>
              <h4 className="text-xl font-black text-white mb-2">This Week&apos;s Free Tournament Is Coming Soon</h4>
              <p className="text-xs sm:text-sm text-gray-400 max-w-lg mb-6 leading-relaxed">
                Every calendar week (Monday 00:00 to Sunday 23:59:59 IST) features one official community tournament with 100% free entry across the platform.
                Organizers are preparing the next bracket — check back shortly or register your squad early.
              </p>
              <Link
                to="/tournaments"
                className="px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] flex items-center space-x-2"
              >
                <span>Browse All Tournaments</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Subsequent scheduled free tournaments in upcoming weeks */}
          {subsequentFreeTournaments.length > 0 && (
            <div className="mt-8">
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Upcoming Weekly Free Tournaments</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subsequentFreeTournaments.map((tourney) => (
                  <div
                    key={tourney.id}
                    className="p-5 rounded-2xl bg-[#0e1020]/80 border border-emerald-900/30 hover:border-emerald-500/50 transition-all flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/40 text-emerald-300">
                        {tourney.game_title}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${getStatusStyle(tourney.status)}`}>
                        {tourney.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h5 className="text-sm font-bold text-white mb-1 line-clamp-1">{tourney.title}</h5>
                    <p className="text-[11px] text-gray-400 mb-4">{formatISTDateOnly(tourney.start_datetime)}</p>
                    <div className="mt-auto pt-3 border-t border-gray-800/60 flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">FREE ENTRY</span>
                      <Link
                        to={`/tournaments/${tourney.id}`}
                        className="text-xs font-semibold text-cyan-300 hover:text-white flex items-center space-x-1"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            SECTION B: PAID / ENTRY TOURNAMENTS
           ═══════════════════════════════════════════════════════════════ */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-700/50 text-cyan-300 text-[10px] font-black uppercase tracking-widest">
                  Section B
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-950/60 border border-amber-800/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  Entry Brackets
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-white flex items-center space-x-2.5 tracking-tight uppercase">
                <Zap className="w-7 h-7 text-cyan-400" />
                <span>Paid / Entry Tournaments</span>
              </h3>
            </div>
          </div>

          {/* High-visibility MVP Safety Notice */}
          <div
            role="note"
            className="mb-8 p-4 sm:p-5 rounded-2xl bg-[#14120a] border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center gap-3.5 text-xs shadow-[0_0_30px_rgba(245,158,11,0.08)]"
          >
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                  Online Payment Processing Disabled (MVP Release)
                </span>
              </div>
              <p className="text-gray-300 leading-relaxed text-[11px]">
                Entry fee payment gateways, wallet transactions, and cash prize payouts are strictly inactive during this release.
                Brackets displayed in this section are for scheduling and preview only. No real-money fees will be deducted.
              </p>
            </div>
          </div>

          {/* Paid tournaments list or empty state */}
          {loadingTournaments ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading entry tournaments">
              {[1, 2, 3].map((n) => (
                <div key={`paid-skeleton-${n}`} className="p-6 rounded-2xl bg-[#0e1020] border border-violet-900/25 flex flex-col gap-4 h-64">
                  <div className="h-5 w-28 rounded-lg skeleton-shimmer" />
                  <div className="h-6 w-3/4 rounded-lg skeleton-shimmer" />
                  <div className="flex-1" />
                  <div className="h-9 w-full rounded-xl skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : paidTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {paidTournaments.map((tourney) => {
                const fillPct =
                  tourney.max_participants > 0
                    ? Math.min(100, Math.round((tourney.current_participants / tourney.max_participants) * 100))
                    : 0;
                return (
                  <div
                    key={tourney.id}
                    className="group relative p-6 rounded-2xl bg-[#0e1020]/80 border border-cyan-900/40 hover:border-cyan-500/60 hover:shadow-[0_0_28px_rgba(6,182,212,0.18)] hover:-translate-y-0.5 backdrop-blur-sm transition-all duration-300 flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-800/40 text-cyan-300">
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
                      {getFormatDisplayLabel(tourney.game_title, tourney.format)}
                    </p>

                    <div className="space-y-2 text-xs mb-5">
                      <div className="flex items-center justify-between text-gray-400">
                        <span className="flex items-center space-x-1.5">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Slots</span>
                        </span>
                        <span className="font-bold text-gray-200">
                          {tourney.current_participants}/{tourney.max_participants}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#080910] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${fillPct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-gray-400">
                        <span className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Starts</span>
                        </span>
                        <span className="font-medium text-cyan-300">{formatIST(tourney.start_datetime)}</span>
                      </div>

                      <div className="flex items-center justify-between text-gray-400">
                        <span className="flex items-center space-x-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Entry</span>
                        </span>
                        <span className="font-bold text-amber-400 uppercase tracking-wide text-[10px]">
                          Paid Bracket (Payments Inactive)
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-800/60 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenLeaderboard(tourney.id, tourney.title)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-700/40 text-cyan-300 hover:text-white transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Medal className="w-3.5 h-3.5" />
                        <span>Standings</span>
                      </button>
                      <Link
                        to={`/tournaments/${tourney.id}`}
                        className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-violet-900/30 hover:bg-violet-800/50 border border-violet-700/40 text-violet-200 hover:text-white transition-all flex items-center justify-center space-x-1.5"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : filteredMockTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredMockTournaments.map((tourney) => (
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
              ))}
            </div>
          ) : (
            /* Polished Empty State for Paid / Entry Tournaments */
            <div className="p-8 sm:p-12 text-center rounded-3xl bg-[#0e1020]/80 border border-violet-900/25 flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-800/30 flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-cyan-400" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">No Entry Tournaments Listed</h4>
              <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-2 leading-relaxed">
                There are currently no paid or entry tournaments scheduled for {selectedGame === 'all' ? 'any game' : selectedGame}.
              </p>
              <p className="text-[11px] text-gray-500 max-w-sm">
                All platform competitions currently feature free community entry with zero entry fees.
              </p>
            </div>
          )}
        </div>
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
