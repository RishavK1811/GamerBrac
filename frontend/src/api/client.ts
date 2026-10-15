import type {
  ApiTournament,
  AuditLogResponse,
  EvidenceUploadResponse,
  GameAccountCreate,
  GameAccountResponse,
  HealthCheckData,
  LeaderboardEntry,
  MatchCreateRequest,
  MatchCredentialResponse,
  MatchCredentialSetRequest,
  MatchListItem,
  MatchParticipantResponse,
  MatchResponse,
  MatchStatus,
  MyRegistrationItem,
  NotificationItem,
  NotificationListResponse,
  ParticipantResponse,
  ParticipantStatusUpdateRequest,
  ParticipantSummary,
  PlatformModesConfigResponse,
  PlayerProfileResponse,
  PlayerProfileUpdate,
  RegisterRequest,
  ReportCreateRequest,
  ReportResolveRequest,
  ReportResponse,
  ScoreSubmissionCreateRequest,
  ScoreSubmissionResponse,
  ScoreSubmissionReviewRequest,
  TeamCreate,
  TeamMemberAdd,
  TeamMemberResponse,
  TeamResponse,
  TokenResponse,
  TournamentCreateRequest,
  TournamentDetail,
  TournamentFinancialPreview,
  TournamentStatus,
  TournamentStatusUpdateRequest,
  TournamentUpdateRequest,
  UserLoginRequest,
  UserRegisterRequest,
  UserResponse,
  UserSuspensionRequest,
} from '../types';

const TOKEN_STORAGE_KEY = 'gamerbrac_access_token';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function getApiUrl(endpoint: string): string {
  if (!endpoint) return '';
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${cleanEndpoint}`;
}

export class ApiError extends Error {
  public status: number;
  public details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Format FastAPI/Pydantic error payload into a clean, human-readable message.
 */
export function formatApiError(status: number, data: unknown): string {
  if (data && typeof data === 'object') {
    const errorObj = data as { detail?: unknown };
    if (typeof errorObj.detail === 'string') {
      return errorObj.detail;
    }
    if (Array.isArray(errorObj.detail)) {
      // Pydantic validation error array: [{ loc: [...], msg: "..." }]
      const messages = errorObj.detail.map((err) => {
        if (typeof err === 'object' && err !== null && 'msg' in err) {
          const field = Array.isArray(err.loc) ? err.loc.slice(-1)[0] : 'field';
          return `${field}: ${err.msg.replace(/^Value error,\s*/i, '')}`;
        }
        return String(err);
      });
      return messages.join('. ');
    }
  }

  switch (status) {
    case 400:
      return 'Invalid request data provided.';
    case 401:
      return 'Authentication required or session expired.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Rate limit exceeded. Please wait a moment before retrying.';
    case 500:
      return 'Internal server error. Please try again later.';
    default:
      return `Request failed with status ${status}.`;
  }
}

// Token storage helpers
export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch {
      // Ignore quota errors in restricted environments
    }
  },
  remove(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  },
};

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth = false, headers = {}, ...customConfig } = options;

  const reqHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  if (!(customConfig.body instanceof FormData) && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    const token = tokenStorage.get();
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  let response: Response;
  const url = getApiUrl(endpoint);
  try {
    response = await fetch(url, {
      ...customConfig,
      headers: reqHeaders,
    });
  } catch (error: unknown) {
    throw new ApiError(
      'Unable to connect to GamerBrac servers. Please check your internet connection.',
      0,
      error
    );
  }

  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401 && !skipAuth) {
      tokenStorage.remove();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gamerbrac:auth-unauthorized'));
      }
    }
    const message = formatApiError(response.status, data);
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

// Centralized API Endpoints
export const authApi = {
  async register(payload: UserRegisterRequest): Promise<TokenResponse> {
    return request<TokenResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  async login(payload: UserLoginRequest): Promise<TokenResponse> {
    return request<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuth: true,
    });
  },

  async logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/api/v1/auth/logout', {
      method: 'POST',
    });
  },

  async getMe(): Promise<UserResponse> {
    return request<UserResponse>('/api/v1/auth/me', {
      method: 'GET',
    });
  },
};

export const tournamentsApi = {
  async list(params?: { game?: string; status?: string; is_free_entry?: boolean }): Promise<ApiTournament[]> {
    const query = new URLSearchParams();
    if (params?.game && params.game !== 'all') {
      query.set('game', params.game);
    }
    if (params?.status && params.status !== 'all') {
      query.set('status', params.status);
    }
    if (params?.is_free_entry !== undefined) {
      query.set('is_free_entry', String(params.is_free_entry));
    }
    const qs = query.toString();
    const endpoint = `/api/v1/tournaments${qs ? `?${qs}` : ''}`;
    return request<ApiTournament[]>(endpoint, { method: 'GET', skipAuth: true });
  },

  async getById(tournamentId: string): Promise<TournamentDetail> {
    return request<TournamentDetail>(`/api/v1/tournaments/${tournamentId}`, {
      method: 'GET',
      skipAuth: true,
    });
  },

  async getLeaderboard(tournamentId: string): Promise<{ tournament_id: string; standings: LeaderboardEntry[] }> {
    return request<{ tournament_id: string; standings: LeaderboardEntry[] }>(
      `/api/v1/tournaments/${tournamentId}/leaderboard`,
      { method: 'GET', skipAuth: true }
    );
  },

  async register(tournamentId: string, payload: RegisterRequest = {}): Promise<ParticipantResponse> {
    return request<ParticipantResponse>(`/api/v1/tournaments/${tournamentId}/register`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async checkIn(tournamentId: string): Promise<ParticipantResponse> {
    return request<ParticipantResponse>(`/api/v1/tournaments/${tournamentId}/check-in`, {
      method: 'POST',
    });
  },

  async withdraw(tournamentId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/tournaments/${tournamentId}/register`, {
      method: 'DELETE',
    });
  },

  async getMyTournaments(): Promise<MyRegistrationItem[]> {
    return request<MyRegistrationItem[]>('/api/v1/tournaments/my', {
      method: 'GET',
    });
  },

  async getModesConfig(): Promise<PlatformModesConfigResponse> {
    return request<PlatformModesConfigResponse>('/api/v1/tournaments/modes/config', {
      method: 'GET',
      skipAuth: true,
    });
  },

  async getFinancialPreview(tournamentId: string, expectedCosts?: number): Promise<TournamentFinancialPreview> {
    const qs = expectedCosts !== undefined ? `?expected_costs=${expectedCosts}` : '';
    return request<TournamentFinancialPreview>(`/api/v1/tournaments/${tournamentId}/financial-preview${qs}`, {
      method: 'GET',
    });
  },
};

export const playersApi = {
  async getProfile(): Promise<PlayerProfileResponse> {
    return request<PlayerProfileResponse>('/api/v1/players/profile', {
      method: 'GET',
    });
  },

  async updateProfile(payload: PlayerProfileUpdate): Promise<PlayerProfileResponse> {
    return request<PlayerProfileResponse>('/api/v1/players/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async listGameAccounts(): Promise<GameAccountResponse[]> {
    return request<GameAccountResponse[]>('/api/v1/players/game-accounts', {
      method: 'GET',
    });
  },

  async linkGameAccount(payload: GameAccountCreate): Promise<GameAccountResponse> {
    return request<GameAccountResponse>('/api/v1/players/game-accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async unlinkGameAccount(accountId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/players/game-accounts/${accountId}`, {
      method: 'DELETE',
    });
  },
};

export const teamsApi = {
  async getMyTeams(): Promise<TeamResponse[]> {
    return request<TeamResponse[]>('/api/v1/teams/my', {
      method: 'GET',
    });
  },

  async getById(teamId: string): Promise<TeamResponse> {
    return request<TeamResponse>(`/api/v1/teams/${teamId}`, {
      method: 'GET',
    });
  },

  async create(payload: TeamCreate): Promise<TeamResponse> {
    return request<TeamResponse>('/api/v1/teams', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async addMember(teamId: string, payload: TeamMemberAdd): Promise<TeamMemberResponse> {
    return request<TeamMemberResponse>(`/api/v1/teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async removeMember(teamId: string, userId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  async disband(teamId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/teams/${teamId}`, {
      method: 'DELETE',
    });
  },
};

export const notificationsApi = {
  async list(): Promise<NotificationListResponse> {
    return request<NotificationListResponse>('/api/v1/notifications', {
      method: 'GET',
    });
  },

  async markRead(notificationId: string): Promise<NotificationItem> {
    return request<NotificationItem>(`/api/v1/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  },
};

export const systemApi = {
  async getHealth(): Promise<HealthCheckData> {
    return request<HealthCheckData>('/api/v1/health', {
      method: 'GET',
      skipAuth: true,
    });
  },
};

export const organizerApi = {
  async listMyTournaments(organizerId: string): Promise<ApiTournament[]> {
    return request<ApiTournament[]>(`/api/v1/tournaments?organizer_id=${encodeURIComponent(organizerId)}`, {
      method: 'GET',
    });
  },

  async createTournament(payload: TournamentCreateRequest): Promise<TournamentDetail> {
    return request<TournamentDetail>('/api/v1/tournaments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTournament(tournamentId: string, payload: TournamentUpdateRequest): Promise<TournamentDetail> {
    return request<TournamentDetail>(`/api/v1/tournaments/${tournamentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async updateTournamentStatus(tournamentId: string, status: TournamentStatus): Promise<TournamentDetail> {
    const payload: TournamentStatusUpdateRequest = { status };
    return request<TournamentDetail>(`/api/v1/tournaments/${tournamentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateParticipantStatus(
    tournamentId: string,
    participantId: string,
    payload: ParticipantStatusUpdateRequest
  ): Promise<ParticipantSummary> {
    return request<ParticipantSummary>(`/api/v1/tournaments/${tournamentId}/participants/${participantId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async createMatch(tournamentId: string, payload: MatchCreateRequest): Promise<MatchResponse> {
    return request<MatchResponse>(`/api/v1/tournaments/${tournamentId}/matches`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listMatches(tournamentId: string): Promise<MatchListItem[]> {
    return request<MatchListItem[]>(`/api/v1/tournaments/${tournamentId}/matches`, {
      method: 'GET',
    });
  },

  async getMatch(matchId: string): Promise<MatchResponse> {
    return request<MatchResponse>(`/api/v1/matches/${matchId}`, {
      method: 'GET',
    });
  },

  async updateMatchStatus(matchId: string, status: MatchStatus): Promise<MatchResponse> {
    return request<MatchResponse>(`/api/v1/matches/${matchId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async addMatchParticipant(
    matchId: string,
    tournamentParticipantId: string,
    slotNumber: number
  ): Promise<MatchParticipantResponse> {
    return request<MatchParticipantResponse>(`/api/v1/matches/${matchId}/participants`, {
      method: 'POST',
      body: JSON.stringify({
        tournament_participant_id: tournamentParticipantId,
        slot_number: slotNumber,
      }),
    });
  },

  async removeMatchParticipant(matchId: string, matchParticipantId: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/v1/matches/${matchId}/participants/${matchParticipantId}`, {
      method: 'DELETE',
    });
  },

  async setMatchCredentials(
    matchId: string,
    payload: MatchCredentialSetRequest
  ): Promise<{ message: string; match_id: string; release_at: string; expires_at: string }> {
    return request<{ message: string; match_id: string; release_at: string; expires_at: string }>(
      `/api/v1/matches/${matchId}/credentials`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async getMatchCredentials(matchId: string): Promise<MatchCredentialResponse> {
    return request<MatchCredentialResponse>(`/api/v1/matches/${matchId}/credentials`, {
      method: 'GET',
    });
  },

  async listSubmissions(matchId: string): Promise<ScoreSubmissionResponse[]> {
    return request<ScoreSubmissionResponse[]>(`/api/v1/matches/${matchId}/submissions`, {
      method: 'GET',
    });
  },

  async reviewSubmission(
    matchId: string,
    submissionId: string,
    payload: ScoreSubmissionReviewRequest
  ): Promise<ScoreSubmissionResponse> {
    return request<ScoreSubmissionResponse>(`/api/v1/matches/${matchId}/submissions/${submissionId}/review`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

export const adminApi = {
  async listPendingOrganizers(): Promise<UserResponse[]> {
    return request<UserResponse[]>('/api/v1/admin/organizers/pending', {
      method: 'GET',
    });
  },

  async approveOrganizer(userId: string): Promise<UserResponse> {
    return request<UserResponse>(`/api/v1/admin/organizers/${userId}/approve`, {
      method: 'POST',
    });
  },

  async listUsers(params?: { role?: string; is_active?: boolean; search?: string }): Promise<UserResponse[]> {
    const query = new URLSearchParams();
    if (params?.role) query.set('role', params.role);
    if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return request<UserResponse[]>(`/api/v1/admin/users${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  },

  async suspendUser(userId: string, payload: UserSuspensionRequest): Promise<UserResponse> {
    return request<UserResponse>(`/api/v1/admin/users/${userId}/suspend`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async reactivateUser(userId: string): Promise<UserResponse> {
    return request<UserResponse>(`/api/v1/admin/users/${userId}/reactivate`, {
      method: 'POST',
    });
  },

  async listReports(params?: { status?: string }): Promise<ReportResponse[]> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') {
      query.set('status', params.status);
    }
    const qs = query.toString();
    return request<ReportResponse[]>(`/api/v1/admin/reports${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  },

  async resolveReport(reportId: string, payload: ReportResolveRequest): Promise<ReportResponse> {
    return request<ReportResponse>(`/api/v1/admin/reports/${reportId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async getAuditLogs(params?: { action?: string; resource_type?: string }): Promise<AuditLogResponse[]> {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.resource_type) query.set('resource_type', params.resource_type);
    const qs = query.toString();
    return request<AuditLogResponse[]>(`/api/v1/admin/audit-logs${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  },
};

export const matchesApi = {
  async listTournamentMatches(tournamentId: string): Promise<MatchListItem[]> {
    return request<MatchListItem[]>(`/api/v1/tournaments/${tournamentId}/matches`, {
      method: 'GET',
    });
  },

  async getMatch(matchId: string): Promise<MatchResponse> {
    return request<MatchResponse>(`/api/v1/matches/${matchId}`, {
      method: 'GET',
    });
  },

  async getCredentials(matchId: string): Promise<MatchCredentialResponse> {
    return request<MatchCredentialResponse>(`/api/v1/matches/${matchId}/credentials`, {
      method: 'GET',
    });
  },

  async uploadEvidence(matchId: string, file: File): Promise<EvidenceUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return request<EvidenceUploadResponse>(`/api/v1/matches/${matchId}/evidence`, {
      method: 'POST',
      body: formData,
    });
  },

  async submitScore(matchId: string, payload: ScoreSubmissionCreateRequest): Promise<ScoreSubmissionResponse> {
    return request<ScoreSubmissionResponse>(`/api/v1/matches/${matchId}/submissions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMySubmissions(matchId: string): Promise<ScoreSubmissionResponse[]> {
    return request<ScoreSubmissionResponse[]>(`/api/v1/matches/${matchId}/submissions`, {
      method: 'GET',
    });
  },
};

export const reportsApi = {
  async submitReport(payload: ReportCreateRequest): Promise<ReportResponse> {
    return request<ReportResponse>('/api/v1/admin/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
