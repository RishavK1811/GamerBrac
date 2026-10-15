import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User as UserIcon,
  Shield,
  Gamepad2,
  Calendar,
  LogOut,
  Trophy,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  Sliders,
  Users,
  Plus,
  Trash2,
  UserPlus,
  Loader2,
  ExternalLink,
  Edit3,
  Check,
  X,
  Clock,
  MapPin,
  Phone,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context';
import { playersApi, teamsApi, tournamentsApi } from '../api/client';
import type {
  GameAccountCreate,
  GameAccountResponse,
  GameTitle,
  MyRegistrationItem,
  PlayerProfileResponse,
  PlayerProfileUpdate,
  TeamCreate,
  TeamMemberAdd,
  TeamResponse,
} from '../types';

type DashboardTab = 'overview' | 'profile' | 'accounts' | 'teams' | 'tournaments';

const ROSTER_LIMITS: Record<string, number> = {
  'Free Fire MAX': 6,
  'BGMI': 6,
  'VALORANT': 7,
};

export const DashboardPage: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab management via query parameter or state
  const tabParam = searchParams.get('tab') as DashboardTab | null;
  const activeTab: DashboardTab =
    tabParam && ['overview', 'profile', 'accounts', 'teams', 'tournaments'].includes(tabParam)
      ? tabParam
      : 'overview';

  const setActiveTab = (tab: DashboardTab) => {
    setSearchParams({ tab });
  };

  // State: Profile
  const [profile, setProfile] = useState<PlayerProfileResponse | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileForm, setProfileForm] = useState<PlayerProfileUpdate>({
    display_name: '',
    bio: '',
    phone_number: '',
    state_region: '',
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // State: Game Accounts
  const [accounts, setAccounts] = useState<GameAccountResponse[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);
  const [isLinkingAccount, setIsLinkingAccount] = useState<boolean>(false);
  const [accountForm, setAccountForm] = useState<GameAccountCreate>({
    game_title: 'Free Fire MAX',
    in_game_name: '',
    in_game_id: '',
  });
  const [accountActionLoading, setAccountActionLoading] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

  // State: Teams
  const [teams, setTeams] = useState<TeamResponse[]>([]);
  const [loadingTeams, setLoadingTeams] = useState<boolean>(false);
  const [showCreateTeam, setShowCreateTeam] = useState<boolean>(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState<boolean>(false);
  const [teamForm, setTeamForm] = useState<TeamCreate>({
    name: '',
    tag: '',
    primary_game: 'Free Fire MAX',
    logo_url: '',
  });
  const [recruitingTeamId, setRecruitingTeamId] = useState<string | null>(null);
  const [recruitForm, setRecruitForm] = useState<TeamMemberAdd>({
    username_or_email: '',
    role: 'player',
  });
  const [teamActionLoading, setTeamActionLoading] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);

  // State: Tournaments
  const [myTournaments, setMyTournaments] = useState<MyRegistrationItem[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState<boolean>(false);
  const [tournamentActionLoading, setTournamentActionLoading] = useState<string | null>(null);
  const [tournamentError, setTournamentError] = useState<string | null>(null);
  const [tournamentSuccess, setTournamentSuccess] = useState<string | null>(null);

  // Data refresh handlers for mutations
  const loadProfile = async () => {
    try {
      const data = await playersApi.getProfile();
      setProfile(data);
      setProfileForm({
        display_name: data.display_name || '',
        bio: data.bio || '',
        phone_number: data.phone_number || '',
        state_region: data.state_region || '',
      });
      if (data.game_accounts) {
        setAccounts(data.game_accounts);
      }
    } catch {
      // Ignore if user session is invalid
    }
  };

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const data = await playersApi.listGameAccounts();
      setAccounts(data);
    } catch {
      // Ignore error
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadTeams = async () => {
    setLoadingTeams(true);
    try {
      const data = await teamsApi.getMyTeams();
      setTeams(data);
    } catch {
      // Ignore error
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadTournaments = async () => {
    setLoadingTournaments(true);
    try {
      const data = await tournamentsApi.getMyTournaments();
      setMyTournaments(data);
    } catch {
      // Ignore error
    } finally {
      setLoadingTournaments(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    playersApi
      .getProfile()
      .then((data) => {
        if (!ignore) {
          setProfile(data);
          setProfileForm({
            display_name: data.display_name || '',
            bio: data.bio || '',
            phone_number: data.phone_number || '',
            state_region: data.state_region || '',
          });
          if (data.game_accounts) {
            setAccounts(data.game_accounts);
          }
        }
      })
      .catch(() => {});

    playersApi
      .listGameAccounts()
      .then((data) => {
        if (!ignore) setAccounts(data);
      })
      .catch(() => {});

    teamsApi
      .getMyTeams()
      .then((data) => {
        if (!ignore) setTeams(data);
      })
      .catch(() => {});

    tournamentsApi
      .getMyTournaments()
      .then((data) => {
        if (!ignore) setMyTournaments(data);
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // --- Profile Actions ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const updated = await playersApi.updateProfile(profileForm);
      setProfile(updated);
      setIsEditingProfile(false);
      setProfileSuccess('Profile updated successfully.');
      await refreshUser();
      await loadProfile();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setProfileError(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- Game Account Actions ---
  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLinkingAccount(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      await playersApi.linkGameAccount(accountForm);
      setAccountSuccess(`Linked ${accountForm.game_title} account successfully.`);
      setAccountForm({
        game_title: 'Free Fire MAX',
        in_game_name: '',
        in_game_id: '',
      });
      await loadAccounts();
      await refreshUser();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to link game account.';
      setAccountError(msg);
    } finally {
      setIsLinkingAccount(false);
    }
  };

  const handleUnlinkAccount = async (accountId: string, gameTitle: string) => {
    if (!window.confirm(`Are you sure you want to unlink your ${gameTitle} account?`)) {
      return;
    }
    setAccountActionLoading(accountId);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      await playersApi.unlinkGameAccount(accountId);
      setAccountSuccess(`Unlinked ${gameTitle} account successfully.`);
      await loadAccounts();
      await refreshUser();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unlink game account.';
      setAccountError(msg);
    } finally {
      setAccountActionLoading(null);
    }
  };

  // --- Team Actions ---
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingTeam(true);
    setTeamError(null);
    setTeamSuccess(null);

    try {
      await teamsApi.create(teamForm);
      setTeamSuccess(`Team "${teamForm.name}" created successfully.`);
      setTeamForm({
        name: '',
        tag: '',
        primary_game: 'Free Fire MAX',
        logo_url: '',
      });
      setShowCreateTeam(false);
      await loadTeams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create team.';
      setTeamError(msg);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleRecruitMember = async (teamId: string, e: React.FormEvent) => {
    e.preventDefault();
    setTeamActionLoading(`recruit-${teamId}`);
    setTeamError(null);
    setTeamSuccess(null);

    try {
      await teamsApi.addMember(teamId, recruitForm);
      setTeamSuccess(`Player added to team roster.`);
      setRecruitForm({ username_or_email: '', role: 'player' });
      setRecruitingTeamId(null);
      await loadTeams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add member.';
      setTeamError(msg);
    } finally {
      setTeamActionLoading(null);
    }
  };

  const handleRemoveMember = async (teamId: string, memberUserId: string, memberName: string) => {
    const isSelf = memberUserId === user.id;
    const confirmPrompt = isSelf
      ? 'Are you sure you want to leave this team?'
      : `Remove "${memberName}" from the roster?`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setTeamActionLoading(`remove-${memberUserId}`);
    setTeamError(null);
    setTeamSuccess(null);

    try {
      await teamsApi.removeMember(teamId, memberUserId);
      setTeamSuccess(isSelf ? 'You have left the team.' : `Removed ${memberName} from the team.`);
      await loadTeams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to remove team member.';
      setTeamError(msg);
    } finally {
      setTeamActionLoading(null);
    }
  };

  const handleDisbandTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Disband team "${teamName}"? This action cannot be undone.`)) {
      return;
    }

    setTeamActionLoading(`disband-${teamId}`);
    setTeamError(null);
    setTeamSuccess(null);

    try {
      await teamsApi.disband(teamId);
      setTeamSuccess(`Team "${teamName}" disbanded.`);
      await loadTeams();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disband team.';
      setTeamError(msg);
    } finally {
      setTeamActionLoading(null);
    }
  };

  // --- Tournament Actions ---
  const handleCheckIn = async (tournamentId: string) => {
    setTournamentActionLoading(`checkin-${tournamentId}`);
    setTournamentError(null);
    setTournamentSuccess(null);

    try {
      await tournamentsApi.checkIn(tournamentId);
      setTournamentSuccess('Checked in successfully! You are ready for match room deployment.');
      await loadTournaments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-in failed.';
      setTournamentError(msg);
    } finally {
      setTournamentActionLoading(null);
    }
  };

  const handleWithdraw = async (tournamentId: string, tournamentTitle: string) => {
    if (!window.confirm(`Are you sure you want to withdraw from "${tournamentTitle}"?`)) {
      return;
    }

    setTournamentActionLoading(`withdraw-${tournamentId}`);
    setTournamentError(null);
    setTournamentSuccess(null);

    try {
      await tournamentsApi.withdraw(tournamentId);
      setTournamentSuccess(`Withdrawn from "${tournamentTitle}".`);
      await loadTournaments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed.';
      setTournamentError(msg);
    } finally {
      setTournamentActionLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl card-glass-heavy border border-violet-700/35 shadow-[0_0_40px_rgba(139,92,246,0.18)] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-40 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 relative z-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 p-[1.5px] shadow-[0_0_24px_rgba(139,92,246,0.4)] shrink-0">
            <div className="w-full h-full bg-[#0a0b14] rounded-[14px] flex items-center justify-center text-cyan-400 font-black text-lg sm:text-xl">
              {(profile?.display_name || user.profile?.display_name || user.username || 'P')[0].toUpperCase()}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {profile?.display_name || user.profile?.display_name || user.username}
              </h1>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-violet-950/90 border border-violet-700/60 text-cyan-300">
                {user.role}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              {user.email} • Joined {new Date(user.created_at).toLocaleDateString()}
            </p>
            {profile?.state_region && (
              <p className="text-[11px] text-gray-400 flex items-center space-x-1">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span>{profile.state_region}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          {user.role === 'organizer' || user.role === 'admin' ? (
            <Link
              to="/organizer"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-violet-900/40 hover:bg-violet-800/60 border border-violet-600/50 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all shadow-sm"
            >
              <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
              <span>Organizer Console</span>
            </Link>
          ) : null}

          {user.role === 'admin' ? (
            <Link
              to="/admin"
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/50 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all shadow-sm"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Portal</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-800/50 text-red-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-violet-900/30 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] border border-violet-400/40'
              : 'text-gray-400 hover:text-white hover:bg-violet-950/40 border border-transparent'
          }`}
        >
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] border border-violet-400/40'
              : 'text-gray-400 hover:text-white hover:bg-violet-950/40 border border-transparent'
          }`}
        >
          <UserIcon className="w-4 h-4 text-violet-400" />
          <span>Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] border border-violet-400/40'
              : 'text-gray-400 hover:text-white hover:bg-violet-950/40 border border-transparent'
          }`}
        >
          <Gamepad2 className="w-4 h-4 text-emerald-400" />
          <span>Game Accounts ({accounts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('teams')}
          className={`shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'teams'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] border border-violet-400/40'
              : 'text-gray-400 hover:text-white hover:bg-violet-950/40 border border-transparent'
          }`}
        >
          <Users className="w-4 h-4 text-amber-400" />
          <span>Teams ({teams.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tournaments')}
          className={`shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center space-x-2 cursor-pointer ${
            activeTab === 'tournaments'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_18px_rgba(139,92,246,0.45)] border border-violet-400/40'
              : 'text-gray-400 hover:text-white hover:bg-violet-950/40 border border-transparent'
          }`}
        >
          <Trophy className="w-4 h-4 text-cyan-400" />
          <span>My Tournaments ({myTournaments.length})</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: OVERVIEW
      ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-3">
              <div className="flex items-center space-x-2 text-gray-400 text-xs font-semibold uppercase">
                <Shield className="w-4 h-4 text-cyan-400" />
                <span>Account Status</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-base font-bold text-white">Active</span>
                <span className="text-xs text-gray-500">(Fair Play Verified)</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Eligible for free-entry esports tournaments and automated room credential dispatch.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-3">
              <div className="flex items-center space-x-2 text-gray-400 text-xs font-semibold uppercase">
                <Gamepad2 className="w-4 h-4 text-violet-400" />
                <span>Linked Titles</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-black text-white">{accounts.length}</span>
                <span className="text-xs text-gray-400">/ 3 Supported Titles</span>
              </div>
              <p className="text-[11px] text-gray-400">
                {accounts.length > 0
                  ? accounts.map((a) => a.game_title).join(', ')
                  : 'No game IDs linked yet. Link your UID to enter tournaments.'}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-3">
              <div className="flex items-center space-x-2 text-gray-400 text-xs font-semibold uppercase">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Tournament Status</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-white">Ready to Compete</span>
                <span className="text-xs text-gray-400">({myTournaments.length} Events)</span>
              </div>
              <Link
                to="/tournaments"
                className="inline-flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Browse Tournaments &rarr;</span>
              </Link>
            </div>
          </div>

          {/* Quick Summary Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Profile Summary */}
            <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <UserIcon className="w-4 h-4 text-cyan-400" />
                  <span>Profile Overview</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  Edit Profile &rarr;
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-500">Display Name: </span>
                  <span className="text-white font-semibold">
                    {profile?.display_name || user.username}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Bio: </span>
                  <span className="text-gray-300">{profile?.bio || 'No bio provided.'}</span>
                </div>
                {profile?.state_region && (
                  <div>
                    <span className="text-gray-500">Region: </span>
                    <span className="text-gray-300">{profile.state_region}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Teams Summary */}
            <div className="p-6 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Users className="w-4 h-4 text-violet-400" />
                  <span>My Active Teams</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('teams')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  Manage Teams &rarr;
                </button>
              </div>
              {teams.length === 0 ? (
                <p className="text-xs text-gray-400">
                  You are not part of any teams yet. Create a team to enter squad or 5v5 tournaments.
                </p>
              ) : (
                <div className="space-y-2">
                  {teams.slice(0, 3).map((team) => (
                    <div
                      key={team.id}
                      className="p-2.5 rounded-xl bg-[#121424] border border-violet-900/30 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{team.name}</span>
                        <span className="text-gray-400 ml-1.5 font-mono">[{team.tag}]</span>
                        <span className="text-[10px] text-cyan-400 block">{team.primary_game}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/40">
                        {team.captain_id === user.id ? 'Captain' : 'Member'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PROFILE EDITING
      ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e101a] border border-violet-900/30 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-violet-900/30">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <UserIcon className="w-5 h-5 text-cyan-400" />
                <span>Player Profile & Identity</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Update your verified competitor details, bio, and contact information.
              </p>
            </div>
            {!isEditingProfile ? (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {profileError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{profileError}</span>
            </div>
          )}

          {profileSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {!isEditingProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
                  <span className="text-[11px] text-gray-500 font-bold uppercase">Display Name</span>
                  <p className="text-sm font-bold text-white">
                    {profile?.display_name || user.username}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
                  <span className="text-[11px] text-gray-500 font-bold uppercase">Username</span>
                  <p className="text-sm font-mono text-cyan-400">@{user.username}</p>
                </div>

                <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
                  <span className="text-[11px] text-gray-500 font-bold uppercase">Email Address</span>
                  <p className="text-sm text-gray-300">{user.email}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
                  <span className="text-[11px] text-gray-500 font-bold uppercase flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    <span>State / Region</span>
                  </span>
                  <p className="text-sm text-gray-300">
                    {profile?.state_region || 'Not specified'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
                  <span className="text-[11px] text-gray-500 font-bold uppercase flex items-center space-x-1">
                    <Phone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Phone Number</span>
                  </span>
                  <p className="text-sm text-gray-300">
                    {profile?.phone_number || 'Not specified'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#121424] border border-violet-900/30 space-y-1">
                  <span className="text-[11px] text-gray-500 font-bold uppercase">Bio</span>
                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                    {profile?.bio || 'No competitor bio provided yet.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="display_name" className="block text-xs font-bold text-gray-300 uppercase mb-1">
                    Display Name
                  </label>
                  <input
                    id="display_name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={50}
                    value={profileForm.display_name || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, display_name: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121424] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. ShadowSniper"
                  />
                </div>

                <div>
                  <label htmlFor="state_region" className="block text-xs font-bold text-gray-300 uppercase mb-1">
                    State / Region
                  </label>
                  <input
                    id="state_region"
                    type="text"
                    maxLength={100}
                    value={profileForm.state_region || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, state_region: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121424] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. Maharashtra, Delhi, Karnataka"
                  />
                </div>

                <div>
                  <label htmlFor="phone_number" className="block text-xs font-bold text-gray-300 uppercase mb-1">
                    Phone Number (Optional)
                  </label>
                  <input
                    id="phone_number"
                    type="text"
                    maxLength={20}
                    value={profileForm.phone_number || ''}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone_number: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#121424] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. +91 9876543210"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bio" className="block text-xs font-bold text-gray-300 uppercase mb-1">
                  Bio (Max 500 characters)
                </label>
                <textarea
                  id="bio"
                  rows={3}
                  maxLength={500}
                  value={profileForm.bio || ''}
                  onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121424] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400"
                  placeholder="Tell tournament organizers and teammates about your esports history..."
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer"
                >
                  {isSavingProfile ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: GAME ACCOUNTS
      ========================================================================= */}
      {activeTab === 'accounts' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e101a] border border-violet-900/30 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-violet-900/30">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Gamepad2 className="w-5 h-5 text-cyan-400" />
                <span>Linked Game Accounts</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Official UIDs used for room credential distribution and competitive anti-cheat verification.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-lg border border-cyan-800/40 self-start sm:self-auto">
              {accounts.length} / 3 Titles Linked
            </span>
          </div>

          {accountError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{accountError}</span>
            </div>
          )}

          {accountSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{accountSuccess}</span>
            </div>
          )}

          {/* Current Linked Accounts */}
          {loadingAccounts ? (
            <div className="py-8 text-center text-gray-400 text-xs flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading game accounts...</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#121424] border border-violet-900/30 space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Game Accounts Linked Yet</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Link your Free Fire MAX UID, BGMI character ID, or VALORANT Riot ID to register for tournaments.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-5 rounded-2xl bg-[#121424] border border-violet-900/40 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-400">{acc.game_title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        acc.is_verified
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50'
                          : 'bg-amber-950/80 text-amber-300 border-amber-800/50'
                      }`}
                    >
                      {acc.is_verified ? 'Verified' : 'Pending Verification'}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-white">{acc.in_game_name}</p>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">
                      UID: {acc.in_game_id || acc.game_uid}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-violet-900/20 flex justify-end">
                    <button
                      type="button"
                      disabled={accountActionLoading === acc.id}
                      onClick={() => handleUnlinkAccount(acc.id, acc.game_title)}
                      className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    >
                      {accountActionLoading === acc.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      <span>Unlink</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Link New Account Form (if not all 3 linked) */}
          {accounts.length < 3 && (
            <div className="p-6 rounded-2xl bg-[#121424] border border-violet-900/30 space-y-4 mt-6">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Link Another Game Account</span>
              </h3>

              <form onSubmit={handleLinkAccount} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label htmlFor="game_title" className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    Game Title
                  </label>
                  <select
                    id="game_title"
                    value={accountForm.game_title}
                    onChange={(e) =>
                      setAccountForm({
                        ...accountForm,
                        game_title: e.target.value as GameTitle,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0e101a] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="Free Fire MAX">Free Fire MAX</option>
                    <option value="BGMI">BGMI</option>
                    <option value="VALORANT">VALORANT</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="in_game_name" className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    In-Game Name (IGN)
                  </label>
                  <input
                    id="in_game_name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={50}
                    value={accountForm.in_game_name}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, in_game_name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0e101a] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. MortaL_99"
                  />
                </div>

                <div>
                  <label htmlFor="in_game_id" className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    In-Game UID / Riot ID
                  </label>
                  <input
                    id="in_game_id"
                    type="text"
                    required
                    minLength={3}
                    maxLength={50}
                    value={accountForm.in_game_id}
                    onChange={(e) =>
                      setAccountForm({ ...accountForm, in_game_id: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#0e101a] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400"
                    placeholder="e.g. 512349876 or Jett#IND"
                  />
                </div>

                <div className="sm:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={isLinkingAccount}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    {isLinkingAccount ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Link Game Account</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: TEAMS MANAGEMENT
      ========================================================================= */}
      {activeTab === 'teams' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e101a] border border-violet-900/30 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-violet-900/30">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <span>Competitive Teams & Rosters</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Create teams, manage rosters, and recruit verified players for squad/5v5 tournaments.
              </p>
            </div>
            {!showCreateTeam ? (
              <button
                type="button"
                onClick={() => setShowCreateTeam(true)}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Team</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateTeam(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {teamError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{teamError}</span>
            </div>
          )}

          {teamSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{teamSuccess}</span>
            </div>
          )}

          {/* Create Team Form Modal / Accordion */}
          {showCreateTeam && (
            <div className="p-6 rounded-2xl bg-[#121424] border border-violet-800/50 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Create New Esports Team</span>
              </h3>
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="team_name" className="block text-xs font-bold text-gray-400 uppercase mb-1">
                      Team Name (3-50 chars)
                    </label>
                    <input
                      id="team_name"
                      type="text"
                      required
                      minLength={3}
                      maxLength={50}
                      value={teamForm.name}
                      onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#0e101a] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400"
                      placeholder="e.g. Velocity Gaming"
                    />
                  </div>

                  <div>
                    <label htmlFor="team_tag" className="block text-xs font-bold text-gray-400 uppercase mb-1">
                      Clan Tag (2-6 chars)
                    </label>
                    <input
                      id="team_tag"
                      type="text"
                      required
                      minLength={2}
                      maxLength={6}
                      value={teamForm.tag}
                      onChange={(e) => setTeamForm({ ...teamForm, tag: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-xl bg-[#0e101a] border border-violet-800/40 text-white text-xs font-mono uppercase focus:outline-none focus:border-cyan-400"
                      placeholder="e.g. VLT"
                    />
                  </div>

                  <div>
                    <label htmlFor="team_game" className="block text-xs font-bold text-gray-400 uppercase mb-1">
                      Primary Game
                    </label>
                    <select
                      id="team_game"
                      value={teamForm.primary_game}
                      onChange={(e) =>
                        setTeamForm({ ...teamForm, primary_game: e.target.value as GameTitle })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-[#0e101a] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      <option value="Free Fire MAX">Free Fire MAX</option>
                      <option value="BGMI">BGMI</option>
                      <option value="VALORANT">VALORANT</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingTeam}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    {isCreatingTeam ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Register Team</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateTeam(false)}
                    className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Teams List */}
          {loadingTeams ? (
            <div className="py-8 text-center text-gray-400 text-xs flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading your teams...</span>
            </div>
          ) : teams.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#121424] border border-violet-900/30 space-y-3">
              <Users className="w-8 h-8 text-cyan-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Active Teams</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Create a team to become captain and recruit teammates, or ask your team captain to add your username.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {teams.map((team) => {
                const isCaptain = team.captain_id === user.id;
                const maxRoster = ROSTER_LIMITS[team.primary_game] || 6;
                const currentCount = team.members.length;
                const isFull = currentCount >= maxRoster;

                return (
                  <div
                    key={team.id}
                    className="p-6 rounded-2xl bg-[#121424] border border-violet-900/40 space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-violet-900/30">
                      <div>
                        <div className="flex items-center space-x-3">
                          <h3 className="text-base font-black text-white">{team.name}</h3>
                          <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/40">
                            [{team.tag}]
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-800/40">
                            {team.primary_game}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Captain: <span className="text-white font-semibold">{team.captain_username || 'Captain'}</span>
                          {isCaptain && <span className="text-cyan-400 ml-1">(You)</span>}
                        </p>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-xs text-gray-400">
                          Roster: <span className="text-white font-bold">{currentCount}</span> / {maxRoster}
                        </span>
                        {isCaptain ? (
                          <button
                            type="button"
                            disabled={teamActionLoading === `disband-${team.id}`}
                            onClick={() => handleDisbandTeam(team.id, team.name)}
                            className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-xs font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Disband</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={teamActionLoading === `remove-${user.id}`}
                            onClick={() => handleRemoveMember(team.id, user.id, user.username)}
                            className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-xs font-semibold flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Leave Team</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Member Roster List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Active Roster
                        </h4>
                        {isCaptain && !isFull && (
                          <button
                            type="button"
                            onClick={() =>
                              setRecruitingTeamId(recruitingTeamId === team.id ? null : team.id)
                            }
                            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{recruitingTeamId === team.id ? 'Close' : 'Add Player'}</span>
                          </button>
                        )}
                      </div>

                      {/* Recruit Player Form */}
                      {isCaptain && recruitingTeamId === team.id && (
                        <form
                          onSubmit={(e) => handleRecruitMember(team.id, e)}
                          className="p-4 rounded-xl bg-[#0e101a] border border-violet-800/40 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
                        >
                          <div>
                            <label htmlFor={`recruit_user_${team.id}`} className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                              Username or Email
                            </label>
                            <input
                              id={`recruit_user_${team.id}`}
                              type="text"
                              required
                              value={recruitForm.username_or_email}
                              onChange={(e) =>
                                setRecruitForm({ ...recruitForm, username_or_email: e.target.value })
                              }
                              className="w-full px-3 py-1.5 rounded-lg bg-[#121424] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400"
                              placeholder="e.g. gamer_pro"
                            />
                          </div>

                          <div>
                            <label htmlFor={`recruit_role_${team.id}`} className="block text-[11px] font-bold text-gray-400 uppercase mb-1">
                              Role
                            </label>
                            <select
                              id={`recruit_role_${team.id}`}
                              value={recruitForm.role}
                              onChange={(e) =>
                                setRecruitForm({
                                  ...recruitForm,
                                  role: e.target.value as 'player' | 'substitute' | 'coach',
                                })
                              }
                              className="w-full px-3 py-1.5 rounded-lg bg-[#121424] border border-violet-800/40 text-white text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                            >
                              <option value="player">Active Player</option>
                              <option value="substitute">Substitute</option>
                              <option value="coach">Coach</option>
                            </select>
                          </div>

                          <div>
                            <button
                              type="submit"
                              disabled={teamActionLoading === `recruit-${team.id}`}
                              className="w-full px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer"
                            >
                              {teamActionLoading === `recruit-${team.id}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <UserPlus className="w-3.5 h-3.5" />
                              )}
                              <span>Add to Team</span>
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Roster Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-violet-900/30 text-gray-500 uppercase tracking-wider text-[10px]">
                              <th className="pb-2">Player</th>
                              <th className="pb-2">Role</th>
                              <th className="pb-2">Joined</th>
                              {isCaptain && <th className="pb-2 text-right">Actions</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-violet-900/20">
                            {team.members.map((member) => (
                              <tr key={member.id} className="hover:bg-violet-950/20 transition-colors">
                                <td className="py-2.5">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-semibold text-white">
                                      {member.display_name || member.username}
                                    </span>
                                    <span className="text-gray-400 text-[11px]">@{member.username}</span>
                                    {member.user_id === team.captain_id && (
                                      <span className="text-[10px] text-amber-300 font-bold px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800/40">
                                        Captain
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5">
                                  <span className="capitalize text-gray-300">{member.role}</span>
                                </td>
                                <td className="py-2.5 text-gray-400">
                                  {new Date(member.joined_at).toLocaleDateString()}
                                </td>
                                {isCaptain && (
                                  <td className="py-2.5 text-right">
                                    {member.user_id !== team.captain_id && (
                                      <button
                                        type="button"
                                        disabled={teamActionLoading === `remove-${member.user_id}`}
                                        onClick={() =>
                                          handleRemoveMember(
                                            team.id,
                                            member.user_id,
                                            member.display_name || member.username
                                          )
                                        }
                                        className="text-red-400 hover:text-red-300 text-xs font-semibold cursor-pointer disabled:opacity-50"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: MY TOURNAMENTS
      ========================================================================= */}
      {activeTab === 'tournaments' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0e101a] border border-violet-900/30 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-violet-900/30">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-cyan-400" />
                <span>My Registered Tournaments</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Track tournament schedules, complete mandatory check-in, and review your competitive status.
              </p>
            </div>
            <Link
              to="/tournaments"
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all self-start sm:self-auto"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Browse All Events</span>
            </Link>
          </div>

          {tournamentError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{tournamentError}</span>
            </div>
          )}

          {tournamentSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{tournamentSuccess}</span>
            </div>
          )}

          {loadingTournaments ? (
            <div className="py-8 text-center text-gray-400 text-xs flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading registered tournaments...</span>
            </div>
          ) : myTournaments.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#121424] border border-violet-900/30 space-y-3">
              <Trophy className="w-8 h-8 text-cyan-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">No Tournaments Registered</h3>
              <p className="text-xs text-gray-400 max-w-md mx-auto">
                Explore open esports tournaments across Free Fire MAX, BGMI, and VALORANT to test your skills.
              </p>
              <Link
                to="/tournaments"
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase tracking-wider transition-all"
              >
                <span>Find Free Tournaments</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myTournaments.map((reg) => {
                const canCheckIn =
                  reg.status === 'check_in' && reg.participant_status === 'REGISTERED';
                const canWithdraw =
                  reg.status !== 'ongoing' &&
                  reg.status !== 'completed' &&
                  reg.participant_status !== 'WITHDRAWN';

                return (
                  <div
                    key={reg.participant_id}
                    className="p-6 rounded-2xl bg-[#121424] border border-violet-900/40 flex flex-col md:flex-row md:items-center justify-between gap-6"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-cyan-950 border border-cyan-800/50 text-cyan-300">
                          {reg.game_title}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-violet-950 border border-violet-800/50 text-violet-300 uppercase">
                          {reg.format}
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded border uppercase ${
                            (reg.participant_status || '').toLowerCase() === 'checked_in'
                              ? 'bg-emerald-950/80 border-emerald-800/60 text-emerald-300'
                              : (reg.participant_status || '').toLowerCase() === 'registered'
                              ? 'bg-blue-950/80 border-blue-800/60 text-blue-300'
                              : 'bg-gray-800/80 border-gray-700 text-gray-400'
                          }`}
                        >
                          {(reg.participant_status || '').toLowerCase() === 'checked_in' ? 'Checked In' : reg.participant_status}
                        </span>
                        <span className="text-xs text-gray-400">
                          Event Phase: <span className="text-white font-semibold uppercase">{reg.status.replace('_', ' ')}</span>
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white">
                        {reg.tournament_title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                        {reg.team_name && (
                          <span>
                            Team: <span className="text-white font-semibold">{reg.team_name} [{reg.team_tag}]</span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Start: {new Date(reg.start_datetime).toLocaleString()}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-violet-400" />
                          <span>Registered: {new Date(reg.registered_at).toLocaleDateString()}</span>
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                      {canCheckIn && (
                        <button
                          type="button"
                          disabled={tournamentActionLoading === `checkin-${reg.tournament_id}`}
                          onClick={() => handleCheckIn(reg.tournament_id)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
                        >
                          {tournamentActionLoading === `checkin-${reg.tournament_id}` ? (
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
                          disabled={tournamentActionLoading === `withdraw-${reg.tournament_id}`}
                          onClick={() => handleWithdraw(reg.tournament_id, reg.tournament_title)}
                          className="px-3.5 py-2 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-800/50 text-red-300 text-xs font-semibold uppercase tracking-wider flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {tournamentActionLoading === `withdraw-${reg.tournament_id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <LogOut className="w-3.5 h-3.5" />
                          )}
                          <span>Withdraw</span>
                        </button>
                      )}

                      <Link
                        to={`/tournaments/${reg.tournament_id}`}
                        className="px-3.5 py-2 rounded-xl bg-violet-900/30 hover:bg-violet-800/50 border border-violet-700/40 text-violet-200 text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Details</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
