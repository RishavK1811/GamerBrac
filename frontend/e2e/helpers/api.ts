import fs from 'fs';
import path from 'path';

export const API_BASE = 'http://127.0.0.1:8000/api/v1';

export interface AuthTokens {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
    is_active: boolean;
    is_verified: boolean;
  };
}

export async function registerUser(payload: {
  username: string;
  email: string;
  password?: string;
  role?: string;
}): Promise<AuthTokens & AuthTokens['user']> {
  const password = payload.password || 'SecurePass123!';
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: payload.username.toLowerCase(),
      email: payload.email,
      password: password,
      confirm_password: password,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Registration failed: ${JSON.stringify(err)}`);
  }
  const data = (await res.json()) as AuthTokens;
  return {
    ...data,
    ...data.user,
  };
}

export async function loginUser(
  usernameOrEmail: string,
  password: string = 'SecurePass123!'
): Promise<AuthTokens> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username_or_email: usernameOrEmail,
      password: password,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Login failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Computes deterministic future tournament dates separated into distinct Asia/Kolkata calendar weeks.
 * Ensures registration_deadline < check_in_deadline < start_datetime.
 * weekOffset specifies which future week (e.g. 2 for 2 weeks out, 3 for 3 weeks out).
 */
export function getTestTournamentSchedule(weekOffset: number = 2) {
  const now = new Date();
  const baseTime = now.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000;
  const regDate = new Date(baseTime + 1 * 24 * 60 * 60 * 1000);
  const checkInDate = new Date(baseTime + 2 * 24 * 60 * 60 * 1000);
  const startDate = new Date(baseTime + 3 * 24 * 60 * 60 * 1000);

  return {
    registration_deadline: regDate.toISOString(),
    check_in_deadline: checkInDate.toISOString(),
    start_datetime: startDate.toISOString(),
    registration_deadline_local: regDate.toISOString().slice(0, 16),
    check_in_deadline_local: checkInDate.toISOString().slice(0, 16),
    start_datetime_local: startDate.toISOString().slice(0, 16),
  };
}

export async function createTournament(
  token: string,
  payload: {
    title: string;
    game_title: string;
    format: string;
    max_participants: number;
    registration_deadline: string;
    start_datetime: string;
    check_in_deadline?: string;
    rules?: string;
    prize_pool_description?: string;
    is_free_entry?: boolean;
    entry_fee_per_player?: number;
  }
) {
  const res = await fetch(`${API_BASE}/tournaments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Create tournament failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

export async function updateTournamentStatus(token: string, tournamentId: string, status: string) {
  const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Update status failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

export async function createMatch(
  token: string,
  tournamentId: string,
  payload: {
    title: string;
    match_number: number;
    round_number: number;
    scheduled_start_time: string;
  }
) {
  const res = await fetch(`${API_BASE}/tournaments/${tournamentId}/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Create match failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

export async function setMatchCredentials(
  token: string,
  matchId: string,
  payload: {
    room_id: string;
    room_password: string;
    release_at: string;
    expires_at: string;
  }
) {
  const res = await fetch(`${API_BASE}/matches/${matchId}/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Set credentials failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

export function createValidEvidenceScreenshot(filePath: string): string {
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const buffer = Buffer.from(pngBase64, 'base64');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
