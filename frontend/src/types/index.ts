export type GameTitle = 'Free Fire MAX' | 'BGMI' | 'VALORANT';

export type UserRole = 'player' | 'organizer' | 'admin';

export interface HealthCheckData {
  status: string;
  app_name: string;
  version: string;
  environment: string;
  database: string;
  timestamp: string;
  supported_games: string[];
}

export interface GameInfo {
  id: string;
  name: GameTitle;
  format: string;
  genre: string;
  badgeColor: 'violet' | 'cyan' | 'emerald';
  description: string;
  registeredTeamsCount: number;
  upcomingEventsCount: number;
  tagline: string;
}

export interface MockTournamentPreview {
  id: string;
  title: string;
  game: GameTitle;
  mode: string;
  slots: string;
  entry: string;
  schedule: string;
  status: 'Registration Open' | 'Upcoming' | 'Check-in Live';
}

export interface ApiTournament {
  id: string;
  title: string;
  game_title: string;
  format: string;
  status: string;
  max_participants: number;
  current_participants: number;
  registration_deadline: string;
  start_datetime: string;
  organizer_id: string;
  is_free_entry: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  participant_id: string;
  user_id?: string;
  team_id?: string;
  name: string;
  tag?: string;
  matches_played: number;
  wins: number;
  total_kills: number;
  placement_points: number;
  kill_points: number;
  total_points: number;
}

export interface GameAccountResponse {
  id: string;
  game_title: GameTitle;
  in_game_name: string;
  in_game_id: string;
  is_verified: boolean;
  created_at?: string;
  // Optional legacy alias for components expecting game_uid
  game_uid?: string;
}

export interface GameAccountCreate {
  game_title: GameTitle;
  in_game_name: string;
  in_game_id: string;
}

export interface PlayerProfileUpdate {
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  phone_number?: string;
  state_region?: string;
}

export interface PlayerProfileResponse {
  id: string;
  user_id?: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  state_region?: string | null;
  created_at?: string;
  game_accounts?: GameAccountResponse[];
}

export interface TeamMemberResponse {
  id: string;
  team_id: string;
  user_id: string;
  username: string;
  display_name?: string | null;
  role: 'captain' | 'player' | 'substitute' | 'coach';
  joined_at: string;
}

export interface TeamResponse {
  id: string;
  name: string;
  tag: string;
  primary_game: string;
  captain_id: string;
  captain_username?: string | null;
  logo_url?: string | null;
  created_at: string;
  members: TeamMemberResponse[];
}

export interface TeamCreate {
  name: string;
  tag: string;
  primary_game: GameTitle;
  logo_url?: string;
}

export interface TeamMemberAdd {
  username_or_email: string;
  role?: 'player' | 'substitute' | 'coach';
}

export interface RegisterRequest {
  team_id?: string;
}

export interface ParticipantResponse {
  id: string;
  tournament_id: string;
  user_id: string;
  team_id?: string | null;
  status: 'REGISTERED' | 'CHECKED_IN' | 'WITHDRAWN';
  registered_at: string;
  checked_in_at?: string | null;
}

export interface MyRegistrationItem {
  participant_id: string;
  tournament_id: string;
  tournament_title: string;
  game_title: string;
  format: string;
  status: string;
  max_participants: number;
  current_participants: number;
  start_datetime: string;
  registration_deadline: string;
  check_in_deadline?: string | null;
  participant_status: 'REGISTERED' | 'CHECKED_IN' | 'WITHDRAWN';
  registered_at: string;
  checked_in_at?: string | null;
  team_id?: string | null;
  team_name?: string | null;
  team_tag?: string | null;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  profile?: PlayerProfileResponse | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserResponse;
}

export interface UserLoginRequest {
  username_or_email: string;
  password: string;
}

export interface UserRegisterRequest {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  link_url?: string;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unread_count: number;
}

export interface TournamentDetail extends ApiTournament {
  description?: string;
  check_in_deadline?: string;
  rules?: string;
  prize_pool_description?: string;
  participants?: ParticipantSummary[];
}

export type TournamentFormat = 'solo' | 'duo' | 'squad' | '5v5';

export type TournamentStatus =
  | 'draft'
  | 'registration_open'
  | 'registration_closed'
  | 'check_in'
  | 'ongoing'
  | 'completed'
  | 'cancelled';

export type ParticipantStatus = 'REGISTERED' | 'CHECKED_IN' | 'WITHDRAWN' | 'DISQUALIFIED';

export interface ParticipantSummary {
  id: string;
  user_id: string;
  team_id?: string | null;
  status: ParticipantStatus;
  registered_at: string;
  checked_in_at?: string | null;
  username?: string | null;
  team_name?: string | null;
  team_tag?: string | null;
}

export interface TournamentCreateRequest {
  title: string;
  description?: string;
  game_title: GameTitle;
  format: TournamentFormat;
  max_participants: number;
  registration_deadline: string;
  check_in_deadline?: string;
  start_datetime: string;
  rules?: string;
  prize_pool_description?: string;
}

export interface TournamentUpdateRequest {
  title?: string;
  description?: string;
  max_participants?: number;
  registration_deadline?: string;
  check_in_deadline?: string;
  start_datetime?: string;
  rules?: string;
  prize_pool_description?: string;
}

export interface TournamentStatusUpdateRequest {
  status: TournamentStatus;
}

export interface ParticipantStatusUpdateRequest {
  status: ParticipantStatus;
}

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface MatchParticipantResponse {
  id: string;
  match_id: string;
  tournament_participant_id: string;
  slot_number: number;
  created_at: string;
}

export interface MatchResponse {
  id: string;
  tournament_id: string;
  title: string;
  match_number: number;
  round_number: number;
  status: MatchStatus;
  scheduled_start_time: string;
  has_credentials: boolean;
  release_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  participants: MatchParticipantResponse[];
}

export interface MatchListItem {
  id: string;
  tournament_id: string;
  title: string;
  match_number: number;
  round_number: number;
  status: MatchStatus;
  scheduled_start_time: string;
  has_credentials: boolean;
  participants_count: number;
}

export interface MatchCreateRequest {
  title: string;
  match_number: number;
  round_number: number;
  scheduled_start_time: string;
}

export interface MatchCredentialSetRequest {
  room_id: string;
  room_password: string;
  release_at: string;
  expires_at: string;
}

export interface MatchCredentialResponse {
  match_id: string;
  room_id: string;
  room_password: string;
  release_at: string;
  expires_at: string;
}

export interface ScoreSubmissionResponse {
  id: string;
  match_id: string;
  match_participant_id: string;
  submitted_by_id: string;
  kills: number;
  placement: number;
  evidence_url: string;
  evidence_file_name?: string | null;
  notes?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_notes?: string | null;
  reviewed_by_id?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScoreSubmissionReviewRequest {
  status: 'approved' | 'rejected';
  reviewer_notes?: string;
}

export interface ReportResponse {
  id: string;
  reporter_id: string;
  reported_user_id?: string | null;
  tournament_id?: string | null;
  match_id?: string | null;
  category: string;
  description: string;
  evidence_url?: string | null;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  resolution_notes?: string | null;
  resolved_by_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportResolveRequest {
  status: 'resolved' | 'dismissed' | 'investigating';
  resolution_notes?: string;
}

export interface AuditLogResponse {
  id: string;
  user_id?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  ip_address?: string | null;
  details?: string | null;
  created_at: string;
}

export interface UserSuspensionRequest {
  reason: string;
}

export interface ScoreSubmissionCreateRequest {
  match_participant_id: string;
  kills: number;
  placement: number;
  evidence_url: string;
  evidence_file_name?: string | null;
  notes?: string | null;
}

export interface EvidenceUploadResponse {
  evidence_url: string;
  file_name: string;
  size_bytes: number;
}

export interface ReportCreateRequest {
  reported_user_id?: string | null;
  tournament_id?: string | null;
  match_id?: string | null;
  category: string;
  description: string;
  evidence_url?: string | null;
}
