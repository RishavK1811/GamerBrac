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
} from 'lucide-react';

const GAMES = [
  {
    id: 'ff-max',
    name: 'Free Fire MAX' as GameTitle,
    genre: 'Battle Royale & Clash Squad',
    format: 'Squads (4 Players) / Duo',
    accentBorder: 'hover:border-violet-500',
    tagColor: 'bg-violet-950/80 text-violet-300 border-violet-800/40',
    description:
      'High-octane mobile battle royale with 48-player custom lobbies, Bermuda/Purgatory rotations, and automated kill-point calculations.',
    platforms: ['Android', 'iOS'],
  },
  {
    id: 'bgmi',
    name: 'BGMI' as GameTitle,
    genre: 'Tactical Battle Royale',
    format: 'Squads (4 Players)',
    accentBorder: 'hover:border-cyan-500',
    tagColor: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/40',
    description:
      'India’s marquee battle royale tournament format featuring Erangel & Miramar maps, official esports scoring rules, and scheduled lobby drops.',
    platforms: ['Android', 'iOS'],
  },
  {
    id: 'valorant',
    name: 'VALORANT' as GameTitle,
    genre: '5v5 Tactical FPS',
    format: 'Team of 5 + 1 Sub',
    accentBorder: 'hover:border-indigo-500',
    tagColor: 'bg-indigo-950/80 text-indigo-300 border-indigo-800/40',
    description:
      'Precise gunplay and agent abilities in competitive custom matches with automated map veto workflows and Bo1/Bo3 single elimination brackets.',
    platforms: ['PC'],
  },
];

const MOCK_TOURNAMENTS: MockTournamentPreview[] = [
  {
    id: 'tourney-1',
    title: 'Firestorm Community Cup #1',
    game: 'Free Fire MAX',
    mode: 'Squad Battle Royale (48 Slots)',
    slots: '38/48 Slots Filled',
    entry: 'Free Entry',
    schedule: 'Starts Saturday 6:00 PM IST',
    status: 'Registration Open',
  },
  {
    id: 'tourney-2',
    title: 'Apex India BGMI Scrims Series',
    game: 'BGMI',
    mode: 'Squads (Erangel + Miramar)',
    slots: '16/20 Teams Registered',
    entry: 'Free Entry',
    schedule: 'Starts Sunday 4:00 PM IST',
    status: 'Upcoming',
  },
  {
    id: 'tourney-3',
    title: 'Radiant Strike South Asia',
    game: 'VALORANT',
    mode: '5v5 Single Elimination Bracket',
    slots: '14/16 Teams Checked In',
    entry: 'Free Entry',
    schedule: 'Check-in Closes in 25 mins',
    status: 'Check-in Live',
  },
];

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

  // Fetch live tournaments from real backend API on filter change or refresh
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

    return () => {
      ignore = true;
    };
  }, [selectedGame, refreshTrigger]);

  // Keyboard accessibility for modal dismissal (Escape key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeLeaderboardId) {
        setActiveLeaderboardId(null);
      }
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
        // Fallback demo standings if tournament has no matches yet
        setLeaderboardStandings([
          {
            rank: 1,
            participant_id: 'p-1',
            name: 'GodLike Esports',
            tag: 'GODL',
            matches_played: 3,
            wins: 2,
            total_kills: 24,
            placement_points: 26,
            kill_points: 24,
            total_points: 50,
          },
          {
            rank: 2,
            participant_id: 'p-2',
            name: 'Team Soul',
            tag: 'SOUL',
            matches_played: 3,
            wins: 1,
            total_kills: 19,
            placement_points: 21,
            kill_points: 19,
            total_points: 40,
          },
          {
            rank: 3,
            participant_id: 'p-3',
            name: 'Blind Esports',
            tag: 'BLND',
            matches_played: 3,
            wins: 0,
            total_kills: 14,
            placement_points: 16,
            kill_points: 14,
            total_points: 30,
          },
        ]);
        setLoadingLeaderboard(false);
      });
  };

  // If live API has tournaments, display those, otherwise fallback gracefully to MOCK_TOURNAMENTS
  const hasLiveTournaments = apiTournaments.length > 0;
  const filteredMockTournaments =
    selectedGame === 'all'
      ? MOCK_TOURNAMENTS
      : MOCK_TOURNAMENTS.filter((t) => t.game === selectedGame);

  return (
    <section id="tournaments" className="py-20 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-violet-950/70 border border-violet-800/40 text-violet-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Featured Tournaments & Titles</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
            CHOOSE YOUR BATTLEGROUND
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-400">
            Browse tournaments across India’s top esports titles. All current events are 100% free-to-enter with transparent community rules.
          </p>
        </div>

        {/* Game Cards Showcase */}
        <div id="games" className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {GAMES.map((game) => (
            <div
              key={game.id}
              className={`p-6 rounded-2xl bg-[#111322] border border-violet-900/30 ${game.accentBorder} transition-all duration-300 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md border ${game.tagColor}`}>
                    {game.genre}
                  </span>
                  <div className="flex items-center space-x-1 text-xs text-gray-400">
                    {game.platforms.join(' • ')}
                  </div>
                </div>

                <h3 className="text-xl font-extrabold text-white mb-2">{game.name}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-4">
                  {game.description}
                </p>

                <div className="p-3 rounded-lg bg-[#0a0b12] border border-violet-950 text-xs text-gray-300 flex items-center justify-between">
                  <span className="text-gray-400 font-medium">Standard Format:</span>
                  <span className="font-semibold text-white">{game.format}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-violet-900/20 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setSelectedGame(game.name)}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <span>Filter {game.name}</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Tournament Listings Header & Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-violet-400" />
              <span>Current & Upcoming Events</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/50 text-cyan-300 ml-2">
                {hasLiveTournaments ? 'Live Database' : 'Mock Preview'}
              </span>
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 flex items-center space-x-1 mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </span>
            {['all', 'Free Fire MAX', 'BGMI', 'VALORANT'].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setSelectedGame(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  selectedGame === filter
                    ? 'bg-violet-600 text-white shadow-[0_0_12px_rgba(139,92,246,0.5)]'
                    : 'bg-[#121422] text-gray-300 border border-violet-900/40 hover:bg-[#1a1e34]'
                }`}
              >
                {filter === 'all' ? 'All Games' : filter}
              </button>
            ))}
          </div>
        </div>

        {/* Error Banner when live fetch encounters an issue */}
        {tournamentError && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Live database offline or unreachable. Displaying fallback mock tournaments.</span>
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

        {/* Tournaments Grid (Loading skeletons, Live API, or Fallback Preview) */}
        {loadingTournaments ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading tournaments">
            {[1, 2, 3].map((n) => (
              <div
                key={`skeleton-${n}`}
                className="p-6 rounded-2xl bg-[#111322] border border-violet-900/30 animate-pulse flex flex-col justify-between h-72"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-4 w-24 bg-violet-900/40 rounded"></div>
                    <div className="h-4 w-16 bg-violet-900/40 rounded-full"></div>
                  </div>
                  <div className="h-6 w-3/4 bg-violet-900/50 rounded mb-3"></div>
                  <div className="h-3 w-1/2 bg-violet-900/30 rounded mb-6"></div>
                  <div className="space-y-3">
                    <div className="h-3 w-full bg-violet-900/20 rounded"></div>
                    <div className="h-3 w-4/5 bg-violet-900/20 rounded"></div>
                    <div className="h-3 w-2/3 bg-violet-900/20 rounded"></div>
                  </div>
                </div>
                <div className="flex gap-2 pt-4 border-t border-violet-900/20">
                  <div className="h-8 flex-1 bg-violet-900/30 rounded-xl"></div>
                  <div className="h-8 flex-1 bg-violet-900/30 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {hasLiveTournaments
              ? apiTournaments.map((tourney) => (
                <div
                  key={tourney.id}
                  className="p-6 rounded-2xl bg-[#111322] border border-violet-900/40 hover:border-cyan-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-950/70 border border-violet-800/40 text-violet-300">
                        {tourney.game_title}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 capitalize">
                        {tourney.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-white mb-2">{tourney.title}</h4>
                    <p className="text-xs text-gray-400 mb-4 uppercase tracking-wider font-semibold">
                      Format: {tourney.format}
                    </p>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-gray-300">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <Users className="w-3.5 h-3.5 text-violet-400" />
                          <span>Capacity:</span>
                        </span>
                        <span className="font-semibold text-white">
                          {tourney.current_participants}/{tourney.max_participants} Registered
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-gray-300">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Starts:</span>
                        </span>
                        <span className="font-medium text-cyan-300">
                          {new Date(tourney.start_datetime).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-gray-300">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Entry:</span>
                        </span>
                        <span className="font-bold text-emerald-400 uppercase tracking-wide">
                          {tourney.is_free_entry ? 'Free Entry' : 'Standard'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-violet-900/20 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenLeaderboard(tourney.id, tourney.title)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-700/50 text-cyan-300 hover:text-white transition-all flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Medal className="w-3.5 h-3.5" />
                      <span>Standings</span>
                    </button>
                    <Link
                      to={`/tournaments/${tourney.id}`}
                      className="flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-violet-900/40 hover:bg-violet-800/60 border border-violet-700/50 text-violet-200 hover:text-white transition-all flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <span>Details</span>
                    </Link>
                  </div>
                </div>
              ))
            : filteredMockTournaments.length > 0
            ? filteredMockTournaments.map((tourney) => (
                <div
                  key={tourney.id}
                  className="p-6 rounded-2xl bg-[#111322] border border-violet-900/40 hover:border-cyan-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-950/70 border border-violet-800/40 text-violet-300">
                        {tourney.game}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          tourney.status === 'Check-in Live'
                            ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 animate-pulse'
                            : tourney.status === 'Registration Open'
                            ? 'bg-cyan-950/60 border border-cyan-500/50 text-cyan-300'
                            : 'bg-indigo-950/60 border border-indigo-500/50 text-indigo-300'
                        }`}
                      >
                        {tourney.status}
                      </span>
                    </div>

                    <h4 className="text-lg font-bold text-white mb-2">{tourney.title}</h4>
                    <p className="text-xs text-gray-400 mb-4">{tourney.mode}</p>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-gray-300">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <Users className="w-3.5 h-3.5 text-violet-400" />
                          <span>Capacity:</span>
                        </span>
                        <span className="font-semibold text-white">{tourney.slots}</span>
                      </div>

                      <div className="flex items-center justify-between text-gray-300">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Schedule:</span>
                        </span>
                        <span className="font-medium text-cyan-300">{tourney.schedule}</span>
                      </div>

                      <div className="flex items-center justify-between text-gray-300">
                        <span className="flex items-center space-x-1.5 text-gray-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Entry Fee:</span>
                        </span>
                        <span className="font-bold text-emerald-400 uppercase tracking-wide">
                          {tourney.entry}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-violet-900/20 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenLeaderboard(tourney.id, tourney.title)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-700/50 text-cyan-300 hover:text-white transition-all flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Medal className="w-3.5 h-3.5" />
                      <span>Standings</span>
                    </button>
                    <Link
                      to="/tournaments"
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-violet-900/40 hover:bg-violet-800/60 border border-violet-700/50 text-violet-200 hover:text-white transition-all flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <span>Details</span>
                    </Link>
                  </div>
                </div>
              ))
            : (
              <div className="p-12 text-center rounded-2xl bg-[#111322] border border-violet-900/30 col-span-1 md:col-span-3 flex flex-col items-center justify-center">
                <Inbox className="w-10 h-10 text-gray-500 mb-3" />
                <h4 className="text-base font-bold text-white mb-1">No Tournaments Found</h4>
                <p className="text-xs text-gray-400 max-w-sm mb-4">
                  There are currently no active or upcoming tournaments matching &quot;{selectedGame}&quot;. Check back soon or select another game title.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedGame('all')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-900/40 hover:bg-violet-800/60 border border-violet-700/50 text-violet-200 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  Show All Games
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Leaderboard Modal */}
      {activeLeaderboardId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leaderboard-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="bg-[#0f111c] border border-violet-800/50 rounded-2xl max-w-3xl w-full p-6 shadow-[0_0_40px_rgba(139,92,246,0.3)] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-violet-900/40 mb-4">
              <div className="flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-cyan-400" />
                <h4 id="leaderboard-modal-title" className="text-lg font-bold text-white">
                  {activeLeaderboardTitle} — Standings
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActiveLeaderboardId(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-colors cursor-pointer"
                aria-label="Close leaderboard modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingLeaderboard ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
                <p className="text-xs">Computing tournament standings...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-violet-900/30 text-gray-400 uppercase tracking-wider">
                      <th className="py-3 px-3"># Rank</th>
                      <th className="py-3 px-3">Player / Squad</th>
                      <th className="py-3 px-2 text-center">Matches</th>
                      <th className="py-3 px-2 text-center">Wins (WWCD)</th>
                      <th className="py-3 px-2 text-center">
                        <span className="flex items-center justify-center space-x-1">
                          <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Kills</span>
                        </span>
                      </th>
                      <th className="py-3 px-3 text-right">Total Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-900/20 text-gray-200 font-medium">
                    {leaderboardStandings.map((entry) => (
                      <tr
                        key={entry.participant_id}
                        className={`hover:bg-violet-950/30 transition-colors ${
                          entry.rank === 1
                            ? 'bg-amber-950/20 text-amber-200'
                            : entry.rank === 2
                            ? 'bg-slate-800/20 text-slate-200'
                            : entry.rank === 3
                            ? 'bg-orange-950/20 text-orange-200'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-3 font-bold">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] ${
                              entry.rank === 1
                                ? 'bg-amber-500 text-black font-black'
                                : entry.rank === 2
                                ? 'bg-slate-300 text-black font-black'
                                : entry.rank === 3
                                ? 'bg-amber-700 text-white font-black'
                                : 'text-gray-400'
                            }`}
                          >
                            {entry.rank}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">
                          <div className="flex items-center space-x-1.5">
                            <span>{entry.name}</span>
                            {entry.tag && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/40 border border-violet-700/40 text-violet-300">
                                {entry.tag}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center">{entry.matches_played}</td>
                        <td className="py-3 px-2 text-center font-bold text-emerald-400">
                          {entry.wins}
                        </td>
                        <td className="py-3 px-2 text-center text-cyan-300 font-bold">
                          {entry.total_kills}
                        </td>
                        <td className="py-3 px-3 text-right font-black text-sm text-cyan-400">
                          {entry.total_points} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-violet-900/30 flex items-center justify-between text-[11px] text-gray-400">
              <span>Points Rule: 1st=10pts, 2nd=6pts, 3rd=5pts + 1pt per Kill</span>
              <button
                type="button"
                onClick={() => setActiveLeaderboardId(null)}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors cursor-pointer"
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
