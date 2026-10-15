import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Trophy,
  Calendar,
  Clock,
  Users,
  ShieldCheck,
  ArrowLeft,
  Medal,
  X,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Check,
  LogOut,
  UserCheck,
  Gamepad2,
  KeyRound,
  Copy,
  Upload,
  Camera,
  Coins,
  Scale,
  AlertOctagon,
  Lock,
  Swords,
  ShieldAlert,
} from 'lucide-react';
import freeFireSvg from '../assets/games/freefire.svg';
import bgmiSvg from '../assets/games/bgmi.svg';
import valorantSvg from '../assets/games/valorant.svg';
import {
  calculateRankDistribution,
  calculatePrizePool,
  getMinParticipationTarget,
  getTeamSize,
  calculateTeamEntryFee,
  getFormatDisplayLabel,
  getFormatLongLabel,
} from '../config/tournamentConfig';
import { tournamentsApi, teamsApi, matchesApi, reportsApi, ApiError } from '../api/client';
import { useAuth } from '../context';
import type {
  TournamentDetail,
  LeaderboardEntry,
  MyRegistrationItem,
  TeamResponse,
  MatchListItem,
  MatchCredentialResponse,
} from '../types';

export const TournamentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Player participation state
  const [myRegistration, setMyRegistration] = useState<MyRegistrationItem | null>(null);
  const [captainedTeams, setCaptainedTeams] = useState<TeamResponse[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Leaderboard modal state
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [standings, setStandings] = useState<LeaderboardEntry[]>([]);
  const [loadingStandings, setLoadingStandings] = useState<boolean>(false);

  // Matches state
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(true);

  // Credentials modal state
  const [showCredModal, setShowCredModal] = useState<boolean>(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchListItem | null>(null);
  const [credentialData, setCredentialData] = useState<MatchCredentialResponse | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [loadingCredentials, setLoadingCredentials] = useState<boolean>(false);
  const [copiedRoom, setCopiedRoom] = useState<boolean>(false);
  const [copiedPass, setCopiedPass] = useState<boolean>(false);

  // Score submission modal state
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);
  const [scoreMatch, setScoreMatch] = useState<MatchListItem | null>(null);
  const [scorePlacement, setScorePlacement] = useState<number>(1);
  const [scoreKills, setScoreKills] = useState<number>(0);
  const [scoreNotes, setScoreNotes] = useState<string>('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [matchParticipantId, setMatchParticipantId] = useState<string | null>(null);
  const [fetchingParticipant, setFetchingParticipant] = useState<boolean>(false);
  const [isSubmittingScore, setIsSubmittingScore] = useState<boolean>(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreSuccess, setScoreSuccess] = useState<string | null>(null);

  // Dispute reporting modal state
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [reportMatch, setReportMatch] = useState<MatchListItem | null>(null);
  const [reportCategory, setReportCategory] = useState<string>('DISPUTE');
  const [reportDescription, setReportDescription] = useState<string>('');
  const [reportEvidenceUrl, setReportEvidenceUrl] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  // Manual refresh handlers for after user actions (register, check-in, withdraw)
  const refreshTournament = async () => {
    if (!id) return;
    try {
      const data = await tournamentsApi.getById(id);
      setTournament(data);
    } catch {
      // Ignore background errors
    }
  };

  const refreshUserData = async () => {
    if (!isAuthenticated || !id) return;
    try {
      const [regs, myTeams] = await Promise.all([
        tournamentsApi.getMyTournaments(),
        teamsApi.getMyTeams(),
      ]);

      const foundReg = regs.find(
        (r) => r.tournament_id === id && r.participant_status?.toLowerCase() !== 'withdrawn'
      );
      setMyRegistration(foundReg || null);

      if (tournament) {
        const eligible = myTeams.filter(
          (t) =>
            t.captain_id === user?.id &&
            t.primary_game.toLowerCase() === tournament.game_title.toLowerCase()
        );
        setCaptainedTeams(eligible);
        if (eligible.length > 0) {
          setSelectedTeamId((prev) => prev || eligible[0].id);
        }
      }
    } catch {
      // Ignore background errors
    }
  };

  const fetchMatches = async () => {
    if (!id) return;
    try {
      setLoadingMatches(true);
      const data = await matchesApi.listTournamentMatches(id);
      setMatches(Array.isArray(data) ? data : []);
    } catch {
      setMatches([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    if (!id) return;
    matchesApi
      .listTournamentMatches(id)
      .then((data) => {
        if (!ignore) {
          setMatches(Array.isArray(data) ? data : []);
          setLoadingMatches(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setMatches([]);
          setLoadingMatches(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  // Initial tournament fetch
  useEffect(() => {
    let ignore = false;
    if (!id) return;

    tournamentsApi
      .getById(id)
      .then((data) => {
        if (!ignore) {
          setTournament(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Tournament not found.';
          setErrorMessage(msg);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id]);

  // Initial user data fetch
  useEffect(() => {
    let ignore = false;
    if (!isAuthenticated || !id || !tournament) return;

    Promise.all([tournamentsApi.getMyTournaments(), teamsApi.getMyTeams()])
      .then(([regs, myTeams]) => {
        if (!ignore) {
          const foundReg = regs.find(
            (r) => r.tournament_id === id && r.participant_status?.toLowerCase() !== 'withdrawn'
          );
          setMyRegistration(foundReg || null);

          const eligible = myTeams.filter(
            (t) =>
              t.captain_id === user?.id &&
              t.primary_game.toLowerCase() === tournament.game_title.toLowerCase()
          );
          setCaptainedTeams(eligible);
          if (eligible.length > 0) {
            setSelectedTeamId((prev) => prev || eligible[0].id);
          }
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [isAuthenticated, id, tournament, user?.id]);

  const handleOpenLeaderboard = () => {
    if (!id) return;
    setShowLeaderboard(true);
    setLoadingStandings(true);

    tournamentsApi
      .getLeaderboard(id)
      .then((res) => {
        setStandings(res.standings || []);
        setLoadingStandings(false);
      })
      .catch(() => {
        setStandings([]);
        setLoadingStandings(false);
      });
  };

  // --- Match Credentials Action ---
  const handleViewCredentials = async (m: MatchListItem) => {
    setSelectedMatch(m);
    setShowCredModal(true);
    setLoadingCredentials(true);
    setCredentialError(null);
    setCredentialData(null);
    setCopiedRoom(false);
    setCopiedPass(false);

    try {
      const creds = await matchesApi.getCredentials(m.id);
      setCredentialData(creds);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setCredentialError(err.message);
      } else if (err instanceof Error) {
        setCredentialError(err.message);
      } else {
        setCredentialError('Failed to load room credentials.');
      }
    } finally {
      setLoadingCredentials(false);
    }
  };

  // --- Score Submission Actions ---
  const handleOpenScoreModal = async (m: MatchListItem) => {
    setScoreMatch(m);
    setScorePlacement(1);
    setScoreKills(0);
    setScoreNotes('');
    setEvidenceFile(null);
    setScoreError(null);
    setScoreSuccess(null);
    setShowScoreModal(true);
    setFetchingParticipant(true);
    setMatchParticipantId(null);

    try {
      const matchDetail = await matchesApi.getMatch(m.id);
      if (myRegistration && matchDetail.participants) {
        const found = matchDetail.participants.find(
          (p) => p.tournament_participant_id === myRegistration.participant_id
        );
        if (found) {
          setMatchParticipantId(found.id);
        }
      }
    } catch {
      // Ignore background error
    } finally {
      setFetchingParticipant(false);
    }
  };

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoreMatch || !matchParticipantId) {
      setScoreError('Cannot submit score: you are not assigned as a participant in this match.');
      return;
    }
    if (!evidenceFile) {
      setScoreError('Screenshot evidence is required (JPEG, PNG, or WEBP under 5MB).');
      return;
    }
    if (evidenceFile.size > 5 * 1024 * 1024) {
      setScoreError('Evidence file exceeds maximum allowed size of 5MB.');
      return;
    }

    setIsSubmittingScore(true);
    setScoreError(null);
    setScoreSuccess(null);

    try {
      const uploadRes = await matchesApi.uploadEvidence(scoreMatch.id, evidenceFile);
      await matchesApi.submitScore(scoreMatch.id, {
        match_participant_id: matchParticipantId,
        placement: Number(scorePlacement),
        kills: Number(scoreKills),
        evidence_url: uploadRes.evidence_url,
        evidence_file_name: uploadRes.file_name,
        notes: scoreNotes.trim() || undefined,
      });

      setScoreSuccess('Score and screenshot evidence submitted successfully for organizer verification!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit score.';
      setScoreError(msg);
    } finally {
      setIsSubmittingScore(false);
    }
  };

  // --- Dispute Reporting Actions ---
  const handleOpenReportModal = (m: MatchListItem) => {
    setReportMatch(m);
    setReportCategory('MATCH_DISPUTE');
    setReportDescription('');
    setReportEvidenceUrl('');
    setReportError(null);
    setReportSuccess(null);
    setShowReportModal(true);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDescription.trim()) {
      setReportError('Please enter a description of the dispute or issue.');
      return;
    }

    setIsSubmittingReport(true);
    setReportError(null);
    setReportSuccess(null);

    try {
      await reportsApi.submitReport({
        tournament_id: tournament?.id,
        match_id: reportMatch?.id,
        category: reportCategory,
        description: reportDescription.trim(),
        evidence_url: reportEvidenceUrl.trim() || undefined,
      });

      setReportSuccess('Dispute report filed successfully. Our moderation team has been notified.');
      setReportDescription('');
      setReportEvidenceUrl('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit dispute report.';
      setReportError(msg);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // --- Registration Action ---
  const handleRegister = async () => {
    if (!id || !tournament) return;
    setIsActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    const isTeamFormat = tournament.format.toLowerCase() !== 'solo';
    const payload = isTeamFormat ? { team_id: selectedTeamId } : {};

    try {
      await tournamentsApi.register(id, payload);
      setActionSuccess('Successfully registered for the tournament!');
      await Promise.all([refreshTournament(), refreshUserData()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setActionError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Check-in Action ---
  const handleCheckIn = async () => {
    if (!id) return;
    setIsActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await tournamentsApi.checkIn(id);
      setActionSuccess('Checked in successfully! You are confirmed for match room deployment.');
      await Promise.all([refreshTournament(), refreshUserData()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-in failed.';
      setActionError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  // --- Withdraw Action ---
  const handleWithdraw = async () => {
    if (!id || !tournament) return;
    if (!window.confirm(`Are you sure you want to withdraw from "${tournament.title}"?`)) {
      return;
    }

    setIsActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await tournamentsApi.withdraw(id);
      setActionSuccess('Successfully withdrawn from the tournament.');
      setMyRegistration(null);
      await Promise.all([refreshTournament(), refreshUserData()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed.';
      setActionError(msg);
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4" aria-busy="true">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        <p className="text-sm text-gray-400">Loading tournament details...</p>
      </div>
    );
  }

  if (errorMessage || !tournament) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="p-8 rounded-2xl bg-[#0e101a] border border-red-900/40 space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Tournament Not Found</h2>
          <p className="text-xs text-gray-400">
            {errorMessage || 'The requested tournament could not be loaded.'}
          </p>
          <Link
            to="/tournaments"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold uppercase tracking-wider transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  const fillPercent =
    tournament.max_participants > 0
      ? Math.min(
          100,
          Math.round((tournament.current_participants / tournament.max_participants) * 100)
        )
      : 0;

  const isFull = tournament.current_participants >= tournament.max_participants;
  const isSolo = tournament.format.toLowerCase() === 'solo';
  const isTeamFormat = !isSolo;
  const teamSize = tournament.team_size ?? getTeamSize(tournament.game_title, tournament.format);
  const maxPlayerSlots = tournament.max_player_slots ?? (tournament.max_participants * teamSize);
  const currentPlayerSlots = tournament.current_player_slots ?? (tournament.current_participants * teamSize);
  const entryFeePerPlayer = tournament.entry_fee_per_player ?? 0;
  const teamEntryFee = tournament.team_entry_fee ?? calculateTeamEntryFee(entryFeePerPlayer, tournament.game_title, tournament.format);
  const minParticipation = getMinParticipationTarget(tournament.game_title, tournament.format, tournament.max_participants);
  const minTeamsTarget = tournament.min_participants_30pct ?? minParticipation.minTeams;
  const minPlayersTarget = tournament.min_players_30pct ?? minParticipation.minPlayers;
  const confirmedCount = tournament.confirmed_entries_count ?? tournament.current_participants;
  const minParticipationMet = tournament.min_participation_met ?? (confirmedCount >= minTeamsTarget);
  const prizePoolPreview = tournament.prize_pool_preview ?? calculatePrizePool(confirmedCount, entryFeePerPlayer, tournament.game_title, tournament.format).prizePool;
  const rankDistributions = calculateRankDistribution(prizePoolPreview, isTeamFormat);

  const getArtwork = () => {
    const t = tournament.game_title.toLowerCase();
    if (t.includes('free fire')) return freeFireSvg;
    if (t.includes('bgmi')) return bgmiSvg;
    if (t.includes('valorant')) return valorantSvg;
    return null;
  };
  const gameArtwork = getArtwork();

  const isRegistered = !!myRegistration;
  const isCheckedIn = myRegistration?.participant_status?.toLowerCase() === 'checked_in';
  const canCheckIn =
    tournament.status.toLowerCase() === 'check_in' &&
    myRegistration?.participant_status?.toLowerCase() === 'registered';
  const canWithdraw =
    tournament.status.toLowerCase() !== 'ongoing' &&
    tournament.status.toLowerCase() !== 'completed' &&
    myRegistration &&
    myRegistration.participant_status?.toLowerCase() !== 'withdrawn';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top back button */}
      <div>
        <Link
          to="/tournaments"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-gray-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tournaments</span>
        </Link>
      </div>

      {/* Main Tournament Banner Card */}
      <div className="p-8 rounded-3xl card-glass-heavy border border-violet-700/35 shadow-[0_0_40px_rgba(139,92,246,0.18)] space-y-6 relative overflow-hidden">
        {gameArtwork && (
          <div className="absolute right-0 top-0 bottom-0 w-1/3 max-w-sm pointer-events-none opacity-20 overflow-hidden hidden sm:block">
            <img
              src={gameArtwork}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover object-center"
            />
          </div>
        )}
        <div className="absolute top-0 right-0 w-80 h-40 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-black px-3 py-1 rounded-xl bg-cyan-950/80 border border-cyan-600/60 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]">
              {tournament.game_title}
            </span>
            <span className="text-xs font-black px-3 py-1 rounded-xl bg-violet-950/80 border border-violet-700/60 text-violet-300 uppercase">
              {getFormatDisplayLabel(tournament.game_title, tournament.format)} {isTeamFormat ? `(${teamSize}P/Team)` : '(Solo)'}
            </span>
            {tournament.is_free_entry ? (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 tracking-wider">
                FREE ENTRY
              </span>
            ) : (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-lg bg-violet-950/80 border border-violet-500/60 text-violet-300 tracking-wider">
                ENTRY TIER: ₹{entryFeePerPlayer}
              </span>
            )}
          </div>

          <span className="text-xs font-black px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 uppercase shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            {tournament.status.replace(/_/g, ' ')}
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight relative z-10 leading-tight">
          {tournament.title}
        </h1>

        {tournament.description && (
          <p className="text-sm text-gray-300 leading-relaxed max-w-3xl">
            {tournament.description}
          </p>
        )}

        {/* Schedule & Slots Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-violet-900/30">
          <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
            <span className="text-[11px] text-gray-400 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Event Date</span>
            </span>
            <p className="text-sm font-bold text-white">
              {new Date(tournament.start_datetime).toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
            <span className="text-[11px] text-gray-400 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-400" />
              <span>Registration Closes</span>
            </span>
            <p className="text-sm font-bold text-white">
              {new Date(tournament.registration_deadline).toLocaleString()}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
            <span className="text-[11px] text-gray-400 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Capacity</span>
            </span>
            <p className="text-sm font-bold text-white">
              {tournament.current_participants} / {tournament.max_participants} {isTeamFormat ? 'Teams' : 'Players'}
            </p>
            <p className="text-[11px] text-gray-400">
              {currentPlayerSlots} / {maxPlayerSlots} player slots ({fillPercent}%)
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
            <span className="text-[11px] text-gray-400 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Entry Fee</span>
            </span>
            {tournament.is_free_entry ? (
              <p className="text-sm font-bold text-emerald-400">100% Free Entry</p>
            ) : (
              <div>
                <p className="text-sm font-bold text-violet-300">
                  ₹{entryFeePerPlayer} <span className="text-[11px] text-gray-400">/ player</span>
                </p>
                {isTeamFormat && (
                  <p className="text-[11px] text-cyan-400 font-semibold">
                    ₹{teamEntryFee} / team
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Row */}
        <div className="pt-2 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleOpenLeaderboard}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all flex items-center space-x-2 cursor-pointer"
          >
            <Medal className="w-4 h-4 text-cyan-300" />
            <span>View Standings & Leaderboard</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          PLAYER PARTICIPATION & REGISTRATION PANEL
      ========================================================================= */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#0e101a] border border-cyan-900/40 shadow-[0_0_25px_rgba(6,182,212,0.1)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-violet-900/30">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Gamepad2 className="w-5 h-5 text-cyan-400" />
              <span>Tournament Participation</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {tournament.is_free_entry
                ? 'Zero entry fees. Automatic credential delivery for checked-in participants.'
                : `Entry Tier ₹${entryFeePerPlayer}/player. Real-money checkouts disabled in preview mode.`}
            </p>
          </div>
          {isRegistered && (
            <span
              className={`text-xs font-bold px-3 py-1 rounded-lg border uppercase self-start sm:self-auto ${
                isCheckedIn
                  ? 'bg-emerald-950/80 border-emerald-800/60 text-emerald-300'
                  : 'bg-blue-950/80 border-blue-800/60 text-blue-300'
              }`}
            >
              {isCheckedIn ? 'Checked In' : 'Registered'}
            </span>
          )}
        </div>

        {!tournament.is_free_entry && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs space-y-1.5">
            <div className="flex items-center space-x-2 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Preview Only — Real-Money Entry Disabled</span>
            </div>
            <p className="text-gray-300 leading-relaxed">
              Paid tournaments are currently in preview mode pending legal compliance and payment partner integration.
              Cash checkout, deposits, and real-money registrations are strictly gated.
            </p>
          </div>
        )}

        {actionError && (
          <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{actionError}</span>
          </div>
        )}

        {actionSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* NOT LOGGED IN */}
        {!isAuthenticated ? (
          <div className="p-6 rounded-2xl bg-[#121424] border border-violet-900/40 text-center space-y-4">
            <p className="text-xs text-gray-300">
              Sign in with your GamerBrac player account to register and enter this tournament.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]"
            >
              <span>Sign In to Register</span>
            </Link>
          </div>
        ) : isRegistered ? (
          /* CURRENTLY REGISTERED */
          <div className="p-6 rounded-2xl bg-[#121424] border border-violet-900/40 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-white">
                    You are registered for this event
                  </span>
                </div>
                {myRegistration?.team_name && (
                  <p className="text-xs text-cyan-400 mt-1">
                    Registered Team: <span className="text-white font-semibold">{myRegistration.team_name} [{myRegistration.team_tag}]</span>
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Registered at {new Date(myRegistration?.registered_at || '').toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {canCheckIn && (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleCheckIn}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Check In Now</span>
                  </button>
                )}

                {canWithdraw && (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleWithdraw}
                    className="px-4 py-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-800/50 text-red-300 text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5" />
                    )}
                    <span>Withdraw</span>
                  </button>
                )}
              </div>
            </div>

            {tournament.status === 'check_in' && !isCheckedIn && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  Check-in is currently LIVE! You must check in to receive the Room ID and Password before match start.
                </span>
              </div>
            )}

            {isCheckedIn && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>
                  Attendance verified! You are confirmed for the match lobby.
                </span>
              </div>
            )}
          </div>
        ) : (
          /* NOT REGISTERED YET */
          <div className="p-6 rounded-2xl bg-[#121424] border border-violet-900/40 space-y-4">
            {tournament.status !== 'registration_open' ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-gray-400">
                  Registration is currently closed for this event.
                </p>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-lg border border-cyan-800/40 uppercase">
                  Status: {tournament.status.replace('_', ' ')}
                </span>
              </div>
            ) : isFull ? (
              <div className="text-center py-4 space-y-2">
                <p className="text-xs text-amber-400 font-bold">
                  Tournament Capacity Reached ({tournament.max_participants} / {tournament.max_participants} slots filled)
                </p>
                <p className="text-xs text-gray-400">
                  Check back later in case registered participants withdraw before the deadline.
                </p>
              </div>
            ) : isSolo ? (
              /* SOLO REGISTRATION */
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Solo Competitor Registration</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Register directly using your linked {tournament.game_title} account.
                  </p>
                </div>

                {!tournament.is_free_entry ? (
                  <button
                    type="button"
                    disabled
                    className="px-6 py-2.5 rounded-xl bg-gray-800/80 border border-gray-700/60 text-gray-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 cursor-not-allowed self-start sm:self-auto"
                    title="Real-money entry is currently disabled pending payment partner integration"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Paid Registration Gated (Preview)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleRegister}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all cursor-pointer self-start sm:self-auto"
                  >
                    {isActionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Register for Free</span>
                  </button>
                )}
              </div>
            ) : (
              /* TEAM REGISTRATION (SQUAD / 5V5) */
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Team Registration ({getFormatDisplayLabel(tournament.game_title, tournament.format).toUpperCase()})
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Only the team captain can register a team. Your team must have {tournament.game_title} as its primary game.
                  </p>
                </div>

                {captainedTeams.length === 0 ? (
                  <div className="p-4 rounded-xl bg-[#0e101a] border border-amber-900/40 space-y-3">
                    <p className="text-xs text-amber-300">
                      You are not currently the captain of an active {tournament.game_title} team.
                    </p>
                    <Link
                      to="/dashboard?tab=teams"
                      className="inline-flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      <span>Create or Manage Your Teams in Player Hub &rarr;</span>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                    <div className="sm:col-span-2">
                      <label htmlFor="select_team" className="block text-xs font-bold text-gray-400 uppercase mb-1">
                        Select Captained Team
                      </label>
                      <select
                        id="select_team"
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#0e101a] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                      >
                        {captainedTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name} [{team.tag}] — {team.members.length} members
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      {!tournament.is_free_entry ? (
                        <button
                          type="button"
                          disabled
                          className="w-full px-5 py-2.5 rounded-xl bg-gray-800/80 border border-gray-700/60 text-gray-400 font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 cursor-not-allowed"
                          title="Real-money entry is currently disabled pending payment partner integration"
                        >
                          <Lock className="w-4 h-4" />
                          <span>Paid Registration Gated (Preview)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isActionLoading || !selectedTeamId}
                          onClick={handleRegister}
                          className="w-full px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all cursor-pointer"
                        >
                          {isActionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          <span>Register Team</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scheduled Matches & Room Lobbies */}
      <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-violet-900/40">
          <div className="flex items-center space-x-2 text-white font-bold text-base">
            <Swords className="w-5 h-5 text-cyan-400" />
            <span>Scheduled Matches & Room Lobbies</span>
          </div>
          <button
            type="button"
            onClick={fetchMatches}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <span>Refresh Matches</span>
          </button>
        </div>

        {loadingMatches ? (
          <div className="py-8 text-center text-gray-400 text-xs flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Loading match lobbies...</span>
          </div>
        ) : matches.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-xs">
            No matches scheduled by the organizer yet. Check back closer to tournament start!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((m) => {
              const hasCredentials = m.has_credentials;
              return (
                <div
                  key={m.id}
                  className="p-5 rounded-xl bg-violet-950/20 border border-violet-800/40 hover:border-violet-700/60 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-violet-900/40 text-violet-300">
                          Round {m.round_number} &bull; Match {m.match_number}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                            m.status === 'completed'
                              ? 'bg-emerald-950/60 border border-emerald-800/50 text-emerald-400'
                              : m.status === 'in_progress'
                              ? 'bg-red-950/60 border border-red-800/50 text-red-400 animate-pulse'
                              : 'bg-yellow-950/60 border border-yellow-800/50 text-yellow-400'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-sm mt-1">{m.title}</h4>
                    </div>

                    {hasCredentials && (
                      <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded flex items-center space-x-1">
                        <KeyRound className="w-3 h-3" />
                        <span>Room Ready</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-gray-400 flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    <span>
                      {new Date(m.scheduled_start_time).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Actions for players */}
                  <div className="pt-2 border-t border-violet-900/30 flex flex-wrap items-center gap-2">
                    {/* View Room ID / Password */}
                    <button
                      type="button"
                      onClick={() => handleViewCredentials(m)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Room Credentials</span>
                    </button>

                    {/* Submit Score & Evidence */}
                    {isCheckedIn && (
                      <button
                        type="button"
                        onClick={() => handleOpenScoreModal(m)}
                        className="px-3 py-1.5 rounded-lg bg-violet-600/30 hover:bg-violet-600/40 text-violet-200 border border-violet-500/40 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Submit Score</span>
                      </button>
                    )}

                    {/* Report Dispute */}
                    {isAuthenticated && (
                      <button
                        type="button"
                        onClick={() => handleOpenReportModal(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-950/50 text-red-400 border border-red-800/40 text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer ml-auto"
                        title="Report Match Dispute"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Dispute</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          TOURNAMENT SPECIFICATIONS, RULES, PRIZE DISTRIBUTION & TERMS
      ========================================================================= */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-white font-bold text-lg">
          <Scale className="w-5 h-5 text-cyan-400" />
          <span>Tournament Specifications, Rules & Terms</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Tournament Specifications & Capacities */}
          <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-violet-900/40">
              <div className="flex items-center space-x-2 text-violet-300 font-bold text-sm">
                <Gamepad2 className="w-4 h-4 text-violet-400" />
                <span>Format & Exact Capacities</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-violet-950 border border-violet-800 text-violet-300 uppercase">
                {tournament.game_title}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-violet-900/20">
                <span className="text-gray-400">Game & Mode:</span>
                <span className="text-white font-semibold">{tournament.game_title} &bull; {getFormatLongLabel(tournament.game_title, tournament.format)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-violet-900/20">
                <span className="text-gray-400">Team Size:</span>
                <span className="text-cyan-300 font-semibold">{isTeamFormat ? `${teamSize} Players per Team` : '1 Player (Solo)'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-violet-900/20">
                <span className="text-gray-400">Maximum Capacity:</span>
                <span className="text-white font-semibold">
                  {tournament.max_participants} {isTeamFormat ? 'Teams' : 'Players'} ({maxPlayerSlots} total player slots)
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-violet-900/20">
                <span className="text-gray-400">Confirmed Participation:</span>
                <span className="text-emerald-400 font-semibold">
                  {confirmedCount} / {tournament.max_participants} {isTeamFormat ? 'Teams' : 'Players'} ({currentPlayerSlots} slots)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-900/40 text-[11px] text-gray-400 space-y-1">
              <span className="font-bold text-violet-300 block">Authoritative Platform Capacities:</span>
              <p>&bull; Free Fire MAX: Squad (13 teams/52 slots), Duo (25 teams/50 slots), Solo (50 slots)</p>
              <p>&bull; BGMI: Solo (100 slots), Squad (25 teams/100 slots), Duo (50 teams/100 slots)</p>
              <p>&bull; VALORANT: 1v1 Solo (50 slots), 2v2 Duo (25 teams/50 slots)</p>
            </div>
          </div>

          {/* Card 2: Entry Fees & 30% Minimum Participation Threshold */}
          <div className="p-6 rounded-2xl bg-[#0e101a] border border-cyan-900/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cyan-900/40">
              <div className="flex items-center space-x-2 text-cyan-300 font-bold text-sm">
                <Coins className="w-4 h-4 text-cyan-400" />
                <span>Entry & 30% Participation Policy</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                minParticipationMet
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-800 text-amber-300'
              }`}>
                {minParticipationMet ? 'Threshold Met' : 'Pending 30%'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-violet-900/20">
                <span className="text-gray-400">Entry Tier:</span>
                <span className="font-bold text-white">
                  {tournament.is_free_entry ? (
                    <span className="text-emerald-400">100% Free Entry (₹0)</span>
                  ) : (
                    <span className="text-violet-300">₹{entryFeePerPlayer} / player {isTeamFormat ? `(₹${teamEntryFee} / team)` : ''}</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-violet-900/20">
                <span className="text-gray-400">30% Minimum Required:</span>
                <span className="text-cyan-300 font-semibold">
                  {minTeamsTarget} {isTeamFormat ? 'Teams' : 'Players'} ({minPlayersTarget} player slots)
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-violet-900/20">
                <span className="text-gray-400">Current Progress:</span>
                <span className="font-bold text-white">
                  {confirmedCount} / {tournament.max_participants} registered ({Math.min(100, Math.round((confirmedCount / tournament.max_participants) * 100))}%)
                </span>
              </div>
            </div>

            {/* Visual 30% Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Registration Fill</span>
                <span className="text-cyan-300 font-mono">30% Min Target: {minTeamsTarget}</span>
              </div>
              <div className="relative w-full h-2 bg-gray-900 rounded-full overflow-hidden border border-violet-900/30">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (confirmedCount / tournament.max_participants) * 100)}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]"
                  style={{ left: `${Math.min(100, (minTeamsTarget / tournament.max_participants) * 100)}%` }}
                  title="30% Minimum Participation Threshold"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-[11px] text-gray-300 space-y-1">
              <span className="font-bold text-amber-300 flex items-center space-x-1">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Automatic Cancellation & 100% Refund:</span>
              </span>
              <p className="leading-relaxed">
                If participation does not reach at least 30% of capacity by registration deadline, the tournament is automatically cancelled. 100% of entry fees are immediately returned to registered players with zero deduction.
              </p>
            </div>
          </div>

          {/* Card 3: Dynamic Prize Pool & Largest-Remainder Rank Distribution */}
          <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-violet-900/40">
              <div className="flex items-center space-x-2 text-cyan-300 font-bold text-sm">
                <Trophy className="w-4 h-4 text-cyan-400" />
                <span>Prize Pool & Rank Distribution</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase">
                Floor 65% Pool
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Prize Pool Formula:</span>
                <span className="font-mono text-cyan-300 text-[11px]">floor(65% &times; collected fees)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Platform Reserve (35%):</span>
                <span className="text-gray-300 text-[11px]">Covers hosting, anti-cheat & ops</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-violet-900/20 font-bold">
                <span className="text-white">Active Prize Pool:</span>
                <span className="text-emerald-400 text-base">₹{prizePoolPreview.toLocaleString()}</span>
              </div>
            </div>

            {/* Rank Distribution Table */}
            <div className="overflow-x-auto pt-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-violet-900/40 text-[10px] text-gray-400 uppercase tracking-wider">
                    <th className="pb-1.5">Rank</th>
                    <th className="pb-1.5 text-center">Share</th>
                    <th className="pb-1.5 text-right">Award</th>
                    <th className="pb-1.5 text-right pr-1">Payout Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-900/20">
                  {rankDistributions.map((alloc) => (
                    <tr key={alloc.rank} className="hover:bg-violet-950/20">
                      <td className="py-1.5 font-bold text-white">#{alloc.rank}</td>
                      <td className="py-1.5 text-center text-cyan-300 font-semibold">{alloc.percentage}%</td>
                      <td className="py-1.5 text-right font-mono font-bold text-emerald-400">
                        ₹{alloc.amount.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-right pr-1 text-[10px] text-gray-400">
                        {isTeamFormat ? 'Team Captain' : 'Player'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed italic">
              * Ranks rounded with largest-remainder method (Hare-Niemeyer with higher-rank tie-breaking) ensuring exact whole-rupee allocation with zero rounding discrepancy.
            </p>
          </div>

          {/* Card 4: Player Terms, Anti-Cheat & Publisher Compliance */}
          <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-violet-900/40">
              <div className="flex items-center space-x-2 text-violet-300 font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-violet-400" />
                <span>Fair Play, Anti-Cheat & Publisher Notice</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-400">
                Verified
              </span>
            </div>

            <div className="space-y-2.5 text-xs text-gray-300 leading-relaxed">
              {tournament.rules && (
                <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-800/40 mb-3">
                  <span className="font-bold text-violet-300 block mb-1">Organizer Rules:</span>
                  <p className="text-gray-300 text-xs whitespace-pre-line leading-relaxed">
                    {tournament.rules}
                  </p>
                </div>
              )}
              <div>
                <span className="font-bold text-white block mb-0.5">&bull; Device & Emulator Restrictions:</span>
                <p className="text-gray-400 text-[11px]">
                  Free Fire MAX & BGMI are mobile only (Android/iOS). Emulators (Bluestacks, LDPlayer, GameLoop) and keyboard/mouse adapters are strictly prohibited. VALORANT is PC only with Riot Vanguard active.
                </p>
              </div>

              <div>
                <span className="font-bold text-white block mb-0.5">&bull; Anti-Cheat & Rematch Protocol:</span>
                <p className="text-gray-400 text-[11px]">
                  Zero tolerance for cheats, hacks, scripts, or teaming. Permanent platform bans apply. Player disconnections do not warrant a rematch; remakes are only scheduled if custom room servers crash before zone 1.
                </p>
              </div>

              <div>
                <span className="font-bold text-white block mb-0.5">&bull; Screenshot Evidence & Dispute Window:</span>
                <p className="text-gray-400 text-[11px]">
                  All captains/players must submit uncropped match summary screenshots within 15 minutes of match conclusion. Disputes must be filed within 15 minutes of match end with screenshot proof.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-gray-950/60 border border-gray-800/60 text-[10px] text-gray-400">
                <span className="font-bold text-gray-300 block mb-0.5">Publisher Compliance Statement:</span>
                This competition is an independent community tournament hosted on GamerBrac. GamerBrac is not affiliated with, endorsed by, or sponsored by Garena (Free Fire MAX), KRAFTON (BGMI), or Riot Games (VALORANT).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-leaderboard-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-[#0e101a] border border-violet-700/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(139,92,246,0.3)] space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-violet-900/40">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-violet-950/60 border border-violet-700/60 flex items-center justify-center text-cyan-400">
                  <Medal className="w-5 h-5" />
                </div>
                <div>
                  <h4 id="detail-leaderboard-modal-title" className="text-lg font-bold text-white">
                    Live Tournament Standings
                  </h4>
                  <p className="text-xs text-cyan-300">{tournament.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaderboard(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-violet-900/40 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingStandings ? (
              <div className="py-12 text-center space-y-3" aria-busy="true">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
                <p className="text-xs text-gray-400">Calculating cumulative standings...</p>
              </div>
            ) : standings.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-xs">
                No verified match scores submitted for this tournament yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-violet-900/40 text-gray-400 uppercase tracking-wider text-[10px]">
                      <th className="pb-3 pl-2">Rank</th>
                      <th className="pb-3">Competitor / Team</th>
                      <th className="pb-3 text-center">Matches</th>
                      <th className="pb-3 text-center">Wins</th>
                      <th className="pb-3 text-center">Kills</th>
                      <th className="pb-3 text-right pr-2">Total Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-900/20">
                    {standings.map((entry) => (
                      <tr key={entry.participant_id} className="hover:bg-violet-950/20 transition-colors">
                        <td className="py-3 pl-2 font-bold text-cyan-400">#{entry.rank}</td>
                        <td className="py-3 font-semibold text-white">
                          {entry.name} {entry.tag && <span className="text-gray-400">[{entry.tag}]</span>}
                        </td>
                        <td className="py-3 text-center text-gray-300">{entry.matches_played}</td>
                        <td className="py-3 text-center text-gray-300">{entry.wins}</td>
                        <td className="py-3 text-center text-cyan-300 font-bold">{entry.total_kills}</td>
                        <td className="py-3 text-right pr-2 font-extrabold text-white text-sm">
                          {entry.total_points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Room Credentials Modal */}
      {showCredModal && selectedMatch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-cred-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowCredModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-[#0e101a] border border-cyan-800/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.2)] space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-violet-900/40">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 id="room-cred-modal-title" className="text-base font-bold text-white">
                    Match Room Credentials
                  </h4>
                  <p className="text-xs text-gray-400">{selectedMatch.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCredModal(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-violet-900/40 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingCredentials ? (
              <div className="py-8 text-center space-y-3" aria-busy="true">
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto" />
                <p className="text-xs text-gray-400">Decrypting room access keys...</p>
              </div>
            ) : credentialError ? (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 space-y-2" role="alert">
                <div className="flex items-center space-x-2 text-red-400 text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Access Window Restricted</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{credentialError}</p>
                <p className="text-[11px] text-gray-500 pt-1">
                  Note: Match credentials are only revealed to checked-in participants during the official match window.
                </p>
              </div>
            ) : credentialData ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-violet-950/40 border border-violet-800/40 space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      Room ID / Custom Lobby ID
                    </label>
                    <div className="flex items-center justify-between mt-1 p-2.5 rounded-lg bg-black/60 border border-violet-900/60 font-mono text-sm text-cyan-300 font-bold">
                      <span data-testid="room-id-value">{credentialData.room_id}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(credentialData.room_id);
                          setCopiedRoom(true);
                          setTimeout(() => setCopiedRoom(false), 2000);
                        }}
                        className="p-1 rounded hover:bg-violet-800/40 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy Room ID"
                        aria-label="Copy Room ID"
                      >
                        {copiedRoom ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      Room Password
                    </label>
                    <div className="flex items-center justify-between mt-1 p-2.5 rounded-lg bg-black/60 border border-violet-900/60 font-mono text-sm text-cyan-300 font-bold">
                      <span data-testid="room-password-value">{credentialData.room_password}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(credentialData.room_password);
                          setCopiedPass(true);
                          setTimeout(() => setCopiedPass(false), 2000);
                        }}
                        className="p-1 rounded hover:bg-violet-800/40 text-gray-400 hover:text-white transition-colors cursor-pointer"
                        title="Copy Password"
                        aria-label="Copy Password"
                      >
                        {copiedPass ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-gray-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Release Time:</span>
                    <span className="text-gray-300">
                      {new Date(credentialData.release_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expires:</span>
                    <span className="text-gray-300">
                      {new Date(credentialData.expires_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40 flex items-start space-x-2 text-[11px] text-amber-300/90">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Do not share credentials outside your registered roster. Unregistered accounts in lobby will be kicked.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Score Submission Modal */}
      {showScoreModal && scoreMatch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="score-submit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowScoreModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-[#0e101a] border border-violet-700/60 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(139,92,246,0.3)] space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-violet-900/40">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-violet-950/60 border border-violet-700/60 flex items-center justify-center text-violet-400">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h4 id="score-submit-modal-title" className="text-base font-bold text-white">
                    Submit Match Score & Evidence
                  </h4>
                  <p className="text-xs text-cyan-300">{scoreMatch.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScoreModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-violet-900/40 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {scoreSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 space-y-3 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs text-emerald-300 font-semibold">{scoreSuccess}</p>
                <button
                  type="button"
                  onClick={() => setShowScoreModal(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitScore} className="space-y-4">
                {fetchingParticipant && (
                  <div className="py-2 text-center text-xs text-gray-400 flex items-center justify-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span>Verifying match roster entry...</span>
                  </div>
                )}

                {!fetchingParticipant && !matchParticipantId && (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 text-[11px] text-amber-300/90 leading-relaxed">
                    Notice: Your registration is not yet assigned to this specific match lobby. Once the organizer populates the match roster from checked-in players, submissions will be unlocked.
                  </div>
                )}

                {scoreError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-2" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{scoreError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="score-placement" className="block text-[11px] font-semibold text-gray-400 mb-1">
                      Placement / Rank
                    </label>
                    <input
                      id="score-placement"
                      type="number"
                      min={1}
                      max={100}
                      value={scorePlacement}
                      onChange={(e) => setScorePlacement(Math.max(1, parseInt(e.target.value) || 1))}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-violet-900/60 focus:border-cyan-500 text-white text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="score-kills" className="block text-[11px] font-semibold text-gray-400 mb-1">
                      Total Kills
                    </label>
                    <input
                      id="score-kills"
                      type="number"
                      min={0}
                      max={200}
                      value={scoreKills}
                      onChange={(e) => setScoreKills(Math.max(0, parseInt(e.target.value) || 0))}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-black/50 border border-violet-900/60 focus:border-cyan-500 text-white text-xs outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="score-evidence-file" className="block text-[11px] font-semibold text-gray-400 mb-1">
                    Screenshot Evidence (Required &bull; max 5MB &bull; PNG/JPEG/WEBP)
                  </label>
                  <div className="mt-1 flex items-center justify-center px-4 py-3 border border-dashed border-violet-800/60 rounded-xl bg-violet-950/10 hover:bg-violet-950/20 transition-colors">
                    <div className="text-center space-y-1">
                      <Camera className="w-5 h-5 text-violet-400 mx-auto" />
                      <div className="text-xs text-gray-300">
                        {evidenceFile ? (
                          <span className="text-cyan-400 font-semibold">{evidenceFile.name} ({(evidenceFile.size / 1024).toFixed(0)} KB)</span>
                        ) : (
                          <span>Click to select screenshot evidence</span>
                        )}
                      </div>
                      <input
                        id="score-evidence-file"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setEvidenceFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="score-evidence-file"
                        className="inline-block mt-1 px-3 py-1 rounded-lg bg-violet-900/40 hover:bg-violet-900/60 text-violet-300 text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Browse File
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="score-notes" className="block text-[11px] font-semibold text-gray-400 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    id="score-notes"
                    rows={2}
                    value={scoreNotes}
                    onChange={(e) => setScoreNotes(e.target.value)}
                    placeholder="e.g. End screen scoreboard confirmation..."
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-violet-900/60 focus:border-cyan-500 text-white text-xs outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingScore || !matchParticipantId || !evidenceFile}
                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {isSubmittingScore ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Submit for Verification</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Dispute Reporting Modal */}
      {showReportModal && reportMatch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dispute-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowReportModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-[#0e101a] border border-red-900/50 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(239,68,68,0.2)] space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-violet-900/40">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 id="dispute-modal-title" className="text-base font-bold text-white">
                    File Match Dispute / Issue
                  </h4>
                  <p className="text-xs text-gray-400">{reportMatch.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-violet-900/40 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 space-y-3 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs text-emerald-300 font-semibold">{reportSuccess}</p>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                {reportError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-2" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{reportError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="report-category" className="block text-[11px] font-semibold text-gray-400 mb-1">
                    Dispute Category
                  </label>
                  <select
                    id="report-category"
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-violet-900/60 focus:border-red-500 text-white text-xs outline-none"
                  >
                    <option value="MATCH_DISPUTE">Match Result Dispute</option>
                    <option value="CHEATING_SUSPICION">Cheating / Illegal Script Suspicion</option>
                    <option value="NO_SHOW">Roster No-Show / Delay</option>
                    <option value="TOXICITY">Toxicity / Harassment</option>
                    <option value="OTHER">Other Issue</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="report-description" className="block text-[11px] font-semibold text-gray-400 mb-1">
                    Detailed Explanation
                  </label>
                  <textarea
                    id="report-description"
                    rows={3}
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Describe what occurred, participant handles involved, and timestamp..."
                    required
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-violet-900/60 focus:border-red-500 text-white text-xs outline-none resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="report-evidence-url" className="block text-[11px] font-semibold text-gray-400 mb-1">
                    Supporting Link / Clip URL (Optional)
                  </label>
                  <input
                    id="report-evidence-url"
                    type="url"
                    value={reportEvidenceUrl}
                    onChange={(e) => setReportEvidenceUrl(e.target.value)}
                    placeholder="https://youtu.be/... or image link"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-violet-900/60 focus:border-red-500 text-white text-xs outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingReport || !reportDescription.trim()}
                  className="w-full py-2.5 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {isSubmittingReport ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                  <span>Submit Dispute to Moderation</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
