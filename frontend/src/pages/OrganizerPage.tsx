import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Trophy,
  ShieldCheck,
  ShieldAlert,
  Plus,
  RefreshCw,
  Users,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Clock,
  Swords,
  KeyRound,
  FileCheck,
  FileX,
  ExternalLink,
  ChevronRight,
  UserX,
} from 'lucide-react';
import { useAuth } from '../context';
import { organizerApi, tournamentsApi, ApiError, getApiUrl } from '../api/client';
import {
  getModeConfig,
  getFormatDisplayLabel,
  getFormatLongLabel,
} from '../config/tournamentConfig';
import type {
  ApiTournament,
  TournamentDetail,
  TournamentCreateRequest,
  TournamentFormat,
  TournamentStatus,
  ParticipantSummary,
  MatchListItem,
  MatchCreateRequest,
  MatchCredentialSetRequest,
  MatchCredentialResponse,
  ScoreSubmissionResponse,
  GameTitle,
} from '../types';

export const OrganizerPage: React.FC = () => {
  const { user } = useAuth();

  // Active Tab: 'tournaments' | 'matches' | 'submissions'
  const [activeTab, setActiveTab] = useState<'tournaments' | 'matches' | 'submissions'>('tournaments');

  // Tournaments state
  const [tournaments, setTournaments] = useState<ApiTournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState<boolean>(true);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const [selectedTournamentDetail, setSelectedTournamentDetail] = useState<TournamentDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showScheduleMatchModal, setShowScheduleMatchModal] = useState<boolean>(false);
  const [showCredentialModal, setShowCredentialModal] = useState<boolean>(false);
  const [showViewCredModal, setShowViewCredModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);

  // Match & Credential state
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [loadingMatches, setLoadingMatches] = useState<boolean>(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [activeCredentials, setActiveCredentials] = useState<MatchCredentialResponse | null>(null);

  // Submissions state
  const [submissions, setSubmissions] = useState<ScoreSubmissionResponse[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState<boolean>(false);
  const [selectedSubmission, setSelectedSubmission] = useState<ScoreSubmissionResponse | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState<string>('');

  // Action status & errors
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form states
  const [createForm, setCreateForm] = useState<TournamentCreateRequest>({
    title: '',
    description: '',
    game_title: 'BGMI',
    format: 'squad',
    max_participants: 16,
    registration_deadline: '',
    check_in_deadline: '',
    start_datetime: '',
    rules: '',
    prize_pool_description: 'Official community glory and GamerBrac verified points.',
  });

  const [matchForm, setMatchForm] = useState<MatchCreateRequest>({
    title: 'Match 1 - Round 1',
    match_number: 1,
    round_number: 1,
    scheduled_start_time: '',
  });

  const [credForm, setCredForm] = useState<MatchCredentialSetRequest>({
    room_id: '',
    room_password: '',
    release_at: '',
    expires_at: '',
  });

  // Load organizer's tournaments
  const fetchTournaments = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingTournaments(true);
      setActionError(null);
      const data = await organizerApi.listMyTournaments(user.id);
      setTournaments(data);
      if (data.length > 0 && !selectedTournamentId) {
        setSelectedTournamentId(data[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to load organized tournaments.');
      }
    } finally {
      setLoadingTournaments(false);
    }
  }, [user, selectedTournamentId]);

  useEffect(() => {
    if (user?.role === 'admin' || (user?.role === 'organizer' && user?.is_verified)) {
      let ignore = false;
      organizerApi
        .listMyTournaments(user.id)
        .then((data) => {
          if (!ignore) {
            setTournaments(data);
            setLoadingTournaments(false);
            if (data.length > 0) {
              setSelectedTournamentId((prev) => prev || data[0].id);
            }
          }
        })
        .catch((err) => {
          if (!ignore) {
            setLoadingTournaments(false);
            if (err instanceof ApiError) setActionError(err.message);
          }
        });
      return () => {
        ignore = true;
      };
    }
  }, [user]);

  // Load tournament detail with participants when selected
  const fetchTournamentDetail = useCallback(async (id: string) => {
    try {
      setLoadingDetail(true);
      const data = await tournamentsApi.getById(id);
      setSelectedTournamentDetail(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      }
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) return;
    let ignore = false;
    tournamentsApi
      .getById(selectedTournamentId)
      .then((data) => {
        if (!ignore) {
          setSelectedTournamentDetail(data);
          setLoadingDetail(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setLoadingDetail(false);
          if (err instanceof ApiError) setActionError(err.message);
        }
      });
    return () => {
      ignore = true;
    };
  }, [selectedTournamentId]);

  // Load matches for selected tournament
  const fetchMatches = useCallback(async (tournamentId: string) => {
    try {
      setLoadingMatches(true);
      const data = await organizerApi.listMatches(tournamentId);
      setMatches(data);
      if (data.length > 0 && !selectedMatchId) {
        setSelectedMatchId(data[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      }
    } finally {
      setLoadingMatches(false);
    }
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedTournamentId || (activeTab !== 'matches' && activeTab !== 'submissions')) return;
    let ignore = false;
    organizerApi
      .listMatches(selectedTournamentId)
      .then((data) => {
        if (!ignore) {
          setMatches(data);
          setLoadingMatches(false);
          if (data.length > 0) {
            setSelectedMatchId((prev) => prev || data[0].id);
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          setLoadingMatches(false);
          if (err instanceof ApiError) setActionError(err.message);
        }
      });
    return () => {
      ignore = true;
    };
  }, [selectedTournamentId, activeTab]);

  // Load submissions for selected match
  const fetchSubmissions = useCallback(async (matchId: string) => {
    try {
      setLoadingSubmissions(true);
      const data = await organizerApi.listSubmissions(matchId);
      setSubmissions(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      }
    } finally {
      setLoadingSubmissions(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedMatchId || activeTab !== 'submissions') return;
    let ignore = false;
    organizerApi
      .listSubmissions(selectedMatchId)
      .then((data) => {
        if (!ignore) {
          setSubmissions(data);
          setLoadingSubmissions(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setLoadingSubmissions(false);
          if (err instanceof ApiError) setActionError(err.message);
        }
      });
    return () => {
      ignore = true;
    };
  }, [selectedMatchId, activeTab]);

  // Handle tournament creation
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const payload: TournamentCreateRequest = {
        ...createForm,
        check_in_deadline: createForm.check_in_deadline?.trim() ? createForm.check_in_deadline : undefined,
        description: createForm.description?.trim() ? createForm.description : undefined,
        rules: createForm.rules?.trim() ? createForm.rules : undefined,
      };
      const created = await organizerApi.createTournament(payload);
      setActionSuccess(`Tournament "${created.title}" successfully created in Draft.`);
      setShowCreateModal(false);
      setTournaments((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      setSelectedTournamentId(created.id);
      await fetchTournaments();
      await fetchTournamentDetail(created.id);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to create tournament.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle status transition
  const handleUpdateStatus = async (status: TournamentStatus) => {
    if (!selectedTournamentId) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await organizerApi.updateTournamentStatus(selectedTournamentId, status);
      setActionSuccess(`Tournament status advanced to "${status.toUpperCase()}".`);
      await fetchTournaments();
      await fetchTournamentDetail(selectedTournamentId);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to transition tournament status.');
      }
    }
  };

  // Handle participant moderation
  const handleModerateParticipant = async (participantId: string, newStatus: 'checked_in' | 'disqualified') => {
    if (!selectedTournamentId) return;
    try {
      const statusValue = newStatus === 'checked_in' ? 'checked_in' : 'disqualified';
      await organizerApi.updateParticipantStatus(selectedTournamentId, participantId, { status: statusValue as any });
      setActionSuccess(`Participant status updated to ${newStatus}.`);
      await fetchTournamentDetail(selectedTournamentId);
      await fetchTournaments();
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      }
    }
  };

  // Handle match creation
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournamentId) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const match = await organizerApi.createMatch(selectedTournamentId, matchForm);
      setActionSuccess(`Match "${match.title}" scheduled successfully.`);
      setShowScheduleMatchModal(false);
      await fetchMatches(selectedTournamentId);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle setting room credentials
  const handleSetCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await organizerApi.setMatchCredentials(selectedMatchId, credForm);
      setActionSuccess('AES-256-GCM room credentials encrypted and dispatch window configured.');
      setShowCredentialModal(false);
      await fetchMatches(selectedTournamentId);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // View decrypted credentials
  const handleViewCredentials = async (matchId: string) => {
    setActionError(null);
    try {
      const creds = await organizerApi.getMatchCredentials(matchId);
      setActiveCredentials(creds);
      setShowViewCredModal(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      }
    }
  };

  const [assigningMatchId, setAssigningMatchId] = useState<string | null>(null);

  // Assign checked-in participants to match
  const handleAssignCheckedInParticipants = async (matchId: string) => {
    if (!selectedTournamentId) return;
    try {
      setAssigningMatchId(matchId);
      setActionError(null);
      setActionSuccess(null);

      const tDetail = await tournamentsApi.getById(selectedTournamentId);
      const checkedIn = (tDetail.participants || []).filter(
        (p) => (p.status || '').toLowerCase() === 'checked_in'
      );

      if (checkedIn.length === 0) {
        setActionError('No checked-in participants available in this tournament to assign.');
        return;
      }

      let newlyAssigned = 0;
      for (let i = 0; i < checkedIn.length; i++) {
        try {
          await organizerApi.addMatchParticipant(matchId, checkedIn[i].id, i + 1);
          newlyAssigned++;
        } catch {
          // Ignore if already assigned or invalid
        }
      }

      setActionSuccess(`Assigned ${newlyAssigned} checked-in participant(s) to match.`);
      await fetchMatches(selectedTournamentId);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to assign participants.');
      }
    } finally {
      setAssigningMatchId(null);
    }
  };

  // Handle submission review (approve or reject)
  const handleReviewScore = async (status: 'approved' | 'rejected') => {
    if (!selectedMatchId || !selectedSubmission) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await organizerApi.reviewSubmission(selectedMatchId, selectedSubmission.id, {
        status,
        reviewer_notes: reviewerNotes,
      });
      setActionSuccess(`Submission marked as ${status.toUpperCase()} and leaderboard updated.`);
      setShowReviewModal(false);
      setSelectedSubmission(null);
      await fetchSubmissions(selectedMatchId);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // If user is unverified organizer, show pending approval screen
  if (user?.role === 'organizer' && !user?.is_verified) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div className="p-8 rounded-3xl bg-[#0e101a] border border-amber-900/40 shadow-[0_0_35px_rgba(245,158,11,0.15)] space-y-6">
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-600 p-0.5 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              <div className="w-full h-full bg-[#0d0e17] rounded-[14px] flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-8 h-8" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Organizer Verification Pending
              </h1>
              <p className="text-xs text-amber-400 font-semibold mt-1">
                Account Status: Awaiting Super-Administrator Approval
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-900/30 text-xs text-gray-300 space-y-3 leading-relaxed">
            <p>
              Welcome, <span className="text-white font-bold">@{user.username}</span>! To maintain fair play and competitive integrity across Indian esports, all new tournament organizer accounts must be reviewed and verified by a GamerBrac platform administrator.
            </p>
            <p>
              Once approved, your account will gain access to tournament creation, participant check-in gates, AES-256-GCM room credential dispatch, and official score verification tools.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-[#141624] border border-violet-900/30 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">Username</span>
              <p className="text-sm font-bold text-white">@{user.username}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#141624] border border-violet-900/30 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">Registered Email</span>
              <p className="text-sm font-bold text-white truncate">{user.email}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#141624] border border-violet-900/30 space-y-1">
              <span className="text-[10px] uppercase font-bold text-gray-500">Approval State</span>
              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                Pending Review
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-violet-900/20">
            <Link
              to="/tournaments"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
            >
              <span>Explore Public Tournaments</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-xl bg-[#141624] hover:bg-[#1a1d30] border border-violet-900/40 text-xs font-semibold text-gray-200 transition-colors"
            >
              Return to Player Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-entrance">
      {/* Header Banner */}
      <div className="p-8 rounded-3xl card-glass-heavy border border-violet-700/35 shadow-[0_0_40px_rgba(139,92,246,0.18)] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-40 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center space-x-5 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[1.5px] shadow-[0_0_24px_rgba(139,92,246,0.4)]">
            <div className="w-full h-full bg-[#0a0b14] rounded-[14px] flex items-center justify-center text-cyan-400">
              <Briefcase className="w-8 h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Tournament Organizer Console
              </h1>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 flex items-center space-x-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Organizer Permissions Active</span>
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Administer free-entry tournaments, time-locked AES credentials, and verified score leaderboards.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 relative z-10">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl btn-neon-shimmer text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:shadow-[0_0_30px_rgba(139,92,246,0.6)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tournament</span>
          </button>
          <button
            onClick={fetchTournaments}
            className="p-2.5 rounded-xl bg-[#111422] hover:bg-[#1a1d30] border border-violet-800/40 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Global Alert Messages */}
      {actionError && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-200 text-xs flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-200 text-xs flex items-center space-x-3">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-violet-900/30 space-x-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('tournaments')}
          className={`pb-3 flex items-center space-x-2 transition-colors relative ${
            activeTab === 'tournaments' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Tournaments & Rosters</span>
          {activeTab === 'tournaments' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('matches')}
          className={`pb-3 flex items-center space-x-2 transition-colors relative ${
            activeTab === 'matches' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Swords className="w-4 h-4" />
          <span>Matches & AES Room Dispatch</span>
          {activeTab === 'matches' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('submissions')}
          className={`pb-3 flex items-center space-x-2 transition-colors relative ${
            activeTab === 'submissions' ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Score Review & Results</span>
          {activeTab === 'submissions' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
          )}
        </button>
      </div>

      {/* TAB 1: TOURNAMENTS & ROSTERS */}
      {activeTab === 'tournaments' && (
        <div className="space-y-6">
          {loadingTournaments ? (
            <div className="p-12 text-center text-gray-400 text-xs">Loading organized tournaments...</div>
          ) : tournaments.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#0e101a] border border-violet-900/30 text-center space-y-4">
              <Trophy className="w-10 h-10 text-gray-500 mx-auto" />
              <h3 className="text-base font-bold text-white">No Tournaments Created Yet</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Host your first competitive esports event for Free Fire MAX, BGMI, or VALORANT. All tournaments are free-to-play.
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wider"
              >
                Create Tournament
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Tournaments List */}
              <div className="lg:col-span-1 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Your Hosted Events</h3>
                <div className="space-y-2">
                  {tournaments.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTournamentId(t.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        selectedTournamentId === t.id
                          ? 'bg-[#151728] border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                          : 'bg-[#0e101a] border-violet-900/30 hover:border-violet-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-cyan-400 uppercase text-[10px] tracking-wider">
                          {t.game_title}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-950/80 text-violet-300 border border-violet-800/50">
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate">{t.title}</h4>
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
                        <span>Format: {getFormatDisplayLabel(t.game_title, t.format)}</span>
                        <span>
                          {t.current_participants} / {t.max_participants} Slots
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Selected Tournament Controls & Participant Roster */}
              <div className="lg:col-span-2 space-y-6">
                {loadingDetail || !selectedTournamentDetail ? (
                  <div className="p-8 rounded-2xl bg-[#0e101a] border border-violet-900/30 text-center text-xs text-gray-400">
                    Loading tournament details...
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-6">
                    {/* Event Overview & Lifecycle Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-violet-900/30">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-lg font-black text-white">{selectedTournamentDetail.title}</h2>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-violet-950 text-violet-300 border border-violet-800">
                            {selectedTournamentDetail.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {selectedTournamentDetail.game_title} • {getFormatLongLabel(selectedTournamentDetail.game_title, selectedTournamentDetail.format)} • Max {selectedTournamentDetail.max_participants} Participants
                        </p>
                      </div>

                      {/* State Transition Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedTournamentDetail.status === 'draft' && (
                          <button
                            onClick={() => handleUpdateStatus('registration_open')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Open Registrations</span>
                          </button>
                        )}

                        {selectedTournamentDetail.status === 'registration_open' && (
                          <button
                            onClick={() => handleUpdateStatus('registration_closed')}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold"
                          >
                            Close Registrations
                          </button>
                        )}

                        {selectedTournamentDetail.status === 'registration_closed' && (
                          <button
                            onClick={() => handleUpdateStatus('check_in')}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center space-x-1"
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>Start Check-in Window</span>
                          </button>
                        )}

                        {selectedTournamentDetail.status === 'check_in' && (
                          <button
                            onClick={() => handleUpdateStatus('ongoing')}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1"
                          >
                            <Swords className="w-3.5 h-3.5" />
                            <span>Launch Tournament Ongoing</span>
                          </button>
                        )}

                        {selectedTournamentDetail.status === 'ongoing' && (
                          <button
                            onClick={() => handleUpdateStatus('completed')}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center space-x-1"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Complete Tournament</span>
                          </button>
                        )}

                        {selectedTournamentDetail.status !== 'completed' && selectedTournamentDetail.status !== 'cancelled' && (
                          <button
                            onClick={() => handleUpdateStatus('cancelled')}
                            className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold"
                          >
                            Cancel Event
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Participant Roster Table */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center space-x-2">
                          <Users className="w-4 h-4 text-cyan-400" />
                          <span>Participant Roster ({selectedTournamentDetail.participants?.length || 0})</span>
                        </h3>
                      </div>

                      {!selectedTournamentDetail.participants || selectedTournamentDetail.participants.length === 0 ? (
                        <p className="text-xs text-gray-500 italic py-4">No players or teams have registered yet.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-violet-900/30">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#141624] text-gray-400 font-semibold border-b border-violet-900/30">
                              <tr>
                                <th className="p-3">Player / Team</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Registered At</th>
                                <th className="p-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-violet-900/20 text-gray-300">
                              {selectedTournamentDetail.participants.map((p: ParticipantSummary) => (
                                <tr key={p.id} className="hover:bg-[#141624]/40">
                                  <td className="p-3 font-semibold text-white">
                                    {p.team_name ? (
                                      <div>
                                        <span>{p.team_name}</span>
                                        {p.team_tag && <span className="text-gray-500 ml-1">[{p.team_tag}]</span>}
                                        <p className="text-[10px] text-gray-400">Captain: @{p.username || p.user_id}</p>
                                      </div>
                                    ) : (
                                      <span>@{p.username || p.user_id}</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        (p.status || '').toLowerCase() === 'checked_in'
                                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                          : (p.status || '').toLowerCase() === 'disqualified'
                                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                          : 'bg-violet-950 text-violet-300 border border-violet-800'
                                      }`}
                                    >
                                      {p.status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-gray-400">
                                    {new Date(p.registered_at).toLocaleDateString()}
                                  </td>
                                  <td className="p-3 text-right space-x-2">
                                    {(p.status || '').toLowerCase() === 'registered' && (
                                      <button
                                        onClick={() => handleModerateParticipant(p.id, 'checked_in')}
                                        className="px-2 py-1 rounded bg-cyan-950 text-cyan-300 hover:bg-cyan-900 text-[10px] font-semibold"
                                      >
                                        Check In
                                      </button>
                                    )}
                                    {p.status !== 'DISQUALIFIED' && (
                                      <button
                                        onClick={() => handleModerateParticipant(p.id, 'disqualified')}
                                        className="px-2 py-1 rounded bg-rose-950 text-rose-300 hover:bg-rose-900 text-[10px] font-semibold inline-flex items-center space-x-1"
                                      >
                                        <UserX className="w-3 h-3" />
                                        <span>Disqualify</span>
                                      </button>
                                    )}
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MATCHES & AES ROOM DISPATCH */}
      {activeTab === 'matches' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0e101a] border border-violet-900/30">
            <div className="flex items-center space-x-3">
              <label className="text-xs font-semibold text-gray-300">Select Tournament:</label>
              <select
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[#141624] border border-violet-900/40 text-xs text-white"
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.game_title})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowScheduleMatchModal(true)}
              disabled={!selectedTournamentId}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Match</span>
            </button>
          </div>

          {loadingMatches ? (
            <div className="p-8 text-center text-xs text-gray-400">Loading matches...</div>
          ) : matches.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[#0e101a] border border-violet-900/30 text-center space-y-3">
              <Swords className="w-8 h-8 text-gray-500 mx-auto" />
              <p className="text-xs text-gray-400">No matches scheduled for this tournament yet.</p>
              <button
                onClick={() => setShowScheduleMatchModal(true)}
                className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold"
              >
                Schedule First Match
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="p-5 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-4 hover:border-violet-700/60 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">
                      Round {m.round_number} • Match {m.match_number}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-950 text-violet-300 border border-violet-800">
                      {m.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-white">{m.title}</h4>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Start: {new Date(m.scheduled_start_time).toLocaleString()}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#141624] border border-violet-900/20 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Credentials:</span>
                      {m.has_credentials ? (
                        <span className="text-emerald-400 font-bold flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>AES-256 Configured</span>
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center space-x-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Not Configured</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-violet-900/20">
                      <span className="text-gray-400">Assigned:</span>
                      <span className="text-cyan-300 font-bold">{m.participants_count} Competitor(s)</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAssignCheckedInParticipants(m.id)}
                    disabled={assigningMatchId === m.id}
                    className="w-full py-1.5 rounded-lg bg-violet-950/70 hover:bg-violet-900 border border-violet-800/50 text-violet-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Users className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{assigningMatchId === m.id ? 'Assigning...' : 'Assign Checked-In Roster'}</span>
                  </button>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-violet-900/20">
                    <button
                      onClick={() => {
                        setSelectedMatchId(m.id);
                        setShowCredentialModal(true);
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 text-xs font-semibold flex items-center justify-center space-x-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{m.has_credentials ? 'Edit Credentials' : 'Set Credentials'}</span>
                    </button>

                    {m.has_credentials && (
                      <button
                        onClick={() => handleViewCredentials(m.id)}
                        className="p-1.5 rounded-lg bg-[#141624] hover:bg-[#1a1d30] text-gray-300 hover:text-white"
                        title="View Decrypted Credentials"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCORE REVIEW & LEADERBOARD RESULTS */}
      {activeTab === 'submissions' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-[#0e101a] border border-violet-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <label className="text-xs font-semibold text-gray-300">Select Match:</label>
              <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[#141624] border border-violet-900/40 text-xs text-white"
              >
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} (R{m.round_number} M{m.match_number})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => selectedMatchId && fetchSubmissions(selectedMatchId)}
              className="px-3 py-1.5 rounded-lg bg-[#141624] hover:bg-[#1a1d30] text-xs text-gray-300 font-semibold"
            >
              Refresh Submissions
            </button>
          </div>

          {loadingSubmissions ? (
            <div className="p-8 text-center text-xs text-gray-400">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[#0e101a] border border-violet-900/30 text-center space-y-2">
              <FileCheck className="w-8 h-8 text-gray-500 mx-auto" />
              <p className="text-xs text-gray-400">No score submissions for this match yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-violet-900/30 bg-[#0e101a]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141624] text-gray-400 font-semibold border-b border-violet-900/30">
                  <tr>
                    <th className="p-4">Participant</th>
                    <th className="p-4">Placement</th>
                    <th className="p-4">Kills</th>
                    <th className="p-4">Evidence</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-900/20 text-gray-300">
                  {submissions.map((s) => (
                    <tr key={s.id} className="hover:bg-[#141624]/40">
                      <td className="p-4 font-semibold text-white">ID: {s.submitted_by_id.slice(0, 8)}...</td>
                      <td className="p-4">Rank #{s.placement}</td>
                      <td className="p-4">{s.kills} Kills</td>
                      <td className="p-4">
                        <a
                          href={getApiUrl(s.evidence_url)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300 inline-flex items-center space-x-1"
                        >
                          <span>View Screenshot</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            s.status === 'approved'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : s.status === 'rejected'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {s.status === 'pending' ? (
                          <button
                            onClick={() => {
                              setSelectedSubmission(s);
                              setReviewerNotes(s.notes || '');
                              setShowReviewModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold"
                          >
                            Review & Verify
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-500">Verified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE TOURNAMENT MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-[#0e101a] border border-violet-900/60 p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-violet-900/30">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-cyan-400" />
                <span>Create New Tournament</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTournament} className="space-y-4 text-xs">
              <div>
                <label htmlFor="create_tournament_title" className="block text-gray-300 font-semibold mb-1">
                  Tournament Title *
                </label>
                <input
                  id="create_tournament_title"
                  type="text"
                  required
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. GamerBrac Pro Invitational 2026"
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="create_tournament_game" className="block text-gray-300 font-semibold mb-1">
                    Game Title *
                  </label>
                  <select
                    id="create_tournament_game"
                    value={createForm.game_title}
                    onChange={(e) => {
                      const g = e.target.value as GameTitle;
                      let fmt = createForm.format;
                      if (g === 'VALORANT') {
                        if (fmt !== 'solo' && fmt !== 'duo') {
                          fmt = 'solo';
                        }
                      } else {
                        if (fmt === '5v5') {
                          fmt = 'squad';
                        }
                      }
                      const cfg = getModeConfig(g, fmt);
                      setCreateForm({
                        ...createForm,
                        game_title: g,
                        format: fmt,
                        max_participants: cfg?.maxTeams ?? createForm.max_participants,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                  >
                    <option value="BGMI">BGMI</option>
                    <option value="Free Fire MAX">Free Fire MAX</option>
                    <option value="VALORANT">VALORANT</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="create_tournament_format" className="block text-gray-300 font-semibold mb-1">
                    Format *
                  </label>
                  <select
                    id="create_tournament_format"
                    value={createForm.format}
                    onChange={(e) => {
                      const fmt = e.target.value as TournamentFormat;
                      const cfg = getModeConfig(createForm.game_title, fmt);
                      setCreateForm({
                        ...createForm,
                        format: fmt,
                        max_participants: cfg?.maxTeams ?? createForm.max_participants,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                  >
                    {createForm.game_title === 'VALORANT' ? (
                      <>
                        <option value="solo">1v1 (Solo)</option>
                        <option value="duo">2v2 (Duo)</option>
                      </>
                    ) : (
                      <>
                        <option value="solo">Solo</option>
                        <option value="duo">Duo</option>
                        <option value="squad">Squad</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="create_tournament_slots" className="block text-gray-300 font-semibold mb-1">
                  Slot Capacity *
                </label>
                <input
                  id="create_tournament_slots"
                  type="number"
                  min="2"
                  max="1024"
                  required
                  value={createForm.max_participants}
                  onChange={(e) => setCreateForm({ ...createForm, max_participants: parseInt(e.target.value) || 16 })}
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="create_tournament_reg_deadline" className="block text-gray-300 font-semibold mb-1">
                    Registration Deadline *
                  </label>
                  <input
                    id="create_tournament_reg_deadline"
                    type="datetime-local"
                    required
                    value={createForm.registration_deadline}
                    onChange={(e) => setCreateForm({ ...createForm, registration_deadline: e.target.value })}
                    className="w-full px-2 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label htmlFor="create_tournament_checkin_deadline" className="block text-gray-300 font-semibold mb-1">
                    Check-in Deadline
                  </label>
                  <input
                    id="create_tournament_checkin_deadline"
                    type="datetime-local"
                    value={createForm.check_in_deadline || ''}
                    onChange={(e) => setCreateForm({ ...createForm, check_in_deadline: e.target.value })}
                    className="w-full px-2 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label htmlFor="create_tournament_start_datetime" className="block text-gray-300 font-semibold mb-1">
                    Start Datetime *
                  </label>
                  <input
                    id="create_tournament_start_datetime"
                    type="datetime-local"
                    required
                    value={createForm.start_datetime}
                    onChange={(e) => setCreateForm({ ...createForm, start_datetime: e.target.value })}
                    className="w-full px-2 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white text-[11px]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="create_tournament_rules" className="block text-gray-300 font-semibold mb-1">
                  Tournament Rules
                </label>
                <textarea
                  id="create_tournament_rules"
                  rows={3}
                  value={createForm.rules || ''}
                  onChange={(e) => setCreateForm({ ...createForm, rules: e.target.value })}
                  placeholder="Fair play rules, device restrictions, disconnect policies..."
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-800/40 text-[11px] text-gray-300 flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Zero Entry Fee: GamerBrac strictly prohibits cash entry fees or gambling.</span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-violet-900/20">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#141624] text-gray-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold"
                >
                  {isSubmitting ? 'Creating...' : 'Create Tournament (Draft)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE MATCH MODAL */}
      {showScheduleMatchModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0e101a] border border-violet-900/60 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-violet-900/30">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Swords className="w-5 h-5 text-cyan-400" />
                <span>Schedule Tournament Match</span>
              </h3>
              <button onClick={() => setShowScheduleMatchModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMatch} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-300 font-semibold mb-1">Match Title *</label>
                <input
                  type="text"
                  required
                  value={matchForm.title}
                  onChange={(e) => setMatchForm({ ...matchForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Match # *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={matchForm.match_number}
                    onChange={(e) => setMatchForm({ ...matchForm, match_number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 font-semibold mb-1">Round # *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={matchForm.round_number}
                    onChange={(e) => setMatchForm({ ...matchForm, round_number: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-semibold mb-1">Scheduled Start Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={matchForm.scheduled_start_time}
                  onChange={(e) => setMatchForm({ ...matchForm, scheduled_start_time: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-violet-900/20">
                <button
                  type="button"
                  onClick={() => setShowScheduleMatchModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#141624] text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold"
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AES CREDENTIALS MODAL */}
      {showCredentialModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0e101a] border border-violet-900/60 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-violet-900/30">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-cyan-400" />
                <span>Configure Room Credentials</span>
              </h3>
              <button onClick={() => setShowCredentialModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Credentials are encrypted using AES-256-GCM authenticated cipher. Only registered, checked-in players can decrypt them during the active release window.
            </p>

            <form onSubmit={handleSetCredentials} className="space-y-3 text-xs">
              <div>
                <label htmlFor="cred_room_id" className="block text-gray-300 font-semibold mb-1">
                  Room ID / Match Code *
                </label>
                <input
                  id="cred_room_id"
                  type="text"
                  required
                  value={credForm.room_id}
                  onChange={(e) => setCredForm({ ...credForm, room_id: e.target.value })}
                  placeholder="e.g. CUSTOM-ROOM-4912"
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white font-mono"
                />
              </div>

              <div>
                <label htmlFor="cred_room_password" className="block text-gray-300 font-semibold mb-1">
                  Room Password *
                </label>
                <input
                  id="cred_room_password"
                  type="text"
                  required
                  value={credForm.room_password}
                  onChange={(e) => setCredForm({ ...credForm, room_password: e.target.value })}
                  placeholder="e.g. SafePass#992"
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cred_release_at" className="block text-gray-300 font-semibold mb-1">
                    Release At *
                  </label>
                  <input
                    id="cred_release_at"
                    type="datetime-local"
                    required
                    value={credForm.release_at}
                    onChange={(e) => setCredForm({ ...credForm, release_at: e.target.value })}
                    className="w-full px-2 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white text-[11px]"
                  />
                </div>
                <div>
                  <label htmlFor="cred_expires_at" className="block text-gray-300 font-semibold mb-1">
                    Expires At *
                  </label>
                  <input
                    id="cred_expires_at"
                    type="datetime-local"
                    required
                    value={credForm.expires_at}
                    onChange={(e) => setCredForm({ ...credForm, expires_at: e.target.value })}
                    className="w-full px-2 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white text-[11px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-violet-900/20">
                <button
                  type="button"
                  onClick={() => setShowCredentialModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#141624] text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                >
                  {isSubmitting ? 'Encrypting...' : 'Save & Encrypt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DECRYPTED CREDENTIALS MODAL */}
      {showViewCredModal && activeCredentials && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0e101a] border border-emerald-900/60 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-violet-900/30">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-emerald-400" />
                <span>Room Credentials</span>
              </h3>
              <button onClick={() => setShowViewCredModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#141624] border border-violet-900/30 space-y-1">
                <span className="text-gray-400 text-[10px] uppercase font-bold">Room ID</span>
                <p className="text-sm font-mono font-bold text-cyan-300 select-all">{activeCredentials.room_id}</p>
              </div>

              <div className="p-3 rounded-xl bg-[#141624] border border-violet-900/30 space-y-1">
                <span className="text-gray-400 text-[10px] uppercase font-bold">Password</span>
                <p className="text-sm font-mono font-bold text-emerald-300 select-all">{activeCredentials.room_password}</p>
              </div>

              <div className="p-2.5 rounded-xl bg-violet-950/20 text-[10px] text-gray-400 space-y-0.5">
                <p>Release: {new Date(activeCredentials.release_at).toLocaleString()}</p>
                <p>Expires: {new Date(activeCredentials.expires_at).toLocaleString()}</p>
              </div>
            </div>

            <button
              onClick={() => setShowViewCredModal(false)}
              className="w-full py-2 rounded-xl bg-[#141624] hover:bg-[#1a1d30] text-xs font-semibold text-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* SCORE SUBMISSION REVIEW MODAL */}
      {showReviewModal && selectedSubmission && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0e101a] border border-violet-900/60 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-violet-900/30">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-cyan-400" />
                <span>Verify Score Submission</span>
              </h3>
              <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#141624] border border-violet-900/30 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Claimed Placement:</span>
                <span className="font-bold text-white">Rank #{selectedSubmission.placement}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Claimed Kills:</span>
                <span className="font-bold text-white">{selectedSubmission.kills} Kills</span>
              </div>
              <div className="pt-2 border-t border-violet-900/20">
                <a
                  href={getApiUrl(selectedSubmission.evidence_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
                >
                  <span>Open Evidence Screenshot</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">Reviewer Notes</label>
              <textarea
                rows={3}
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
                placeholder="Optional notes for player notification..."
                className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-xs text-white"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-violet-900/20">
              <button
                onClick={() => handleReviewScore('rejected')}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold flex items-center space-x-1"
              >
                <FileX className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
              <button
                onClick={() => handleReviewScore('approved')}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve & Verify</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
