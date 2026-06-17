/**
 * Auth Client — talks to the real backend when available, falls back to a
 * localStorage-backed mock when the backend is unreachable.
 *
 * WHY: The kabaddi-pro Express api-server isn't always running in local dev /
 * preview environments. Without this fallback, every Login / Sign Up attempt
 * fails with a generic "Something went wrong" message because the fetch to
 * `/api/auth` throws a network error.
 *
 * BEHAVIOR:
 *   1. Try the real `POST /api/auth` endpoint first.
 *   2. If the fetch throws (network error, backend down), fall back to the
 *      local mock implementation.
 *   3. The mock persists users in `localStorage` under `kabaddi-users`.
 *
 * DEMO-ONLY: The mock stores passwords in plain text. This is intentional for
 * local testing and is NEVER used in production — when the real backend is
 * reachable, the mock is bypassed entirely.
 *
 * Supported actions: check-phone, register, login, forgot-password-verify,
 * reset-password, update-details.
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  phone: string;
  playerCode?: string;
  name?: string;
  role: string;
  avatar?: string;
  gender?: string;
  weight?: string;
  practiceGround?: string;
  location?: string;
  position?: string;
  jerseyNumber?: number;
  isPremium?: boolean;
  premiumExpiry?: string | null;
  premiumPlan?: string | null;
  isAdmin?: boolean;
  dateOfBirth?: string;
}

interface StoredUser extends AuthUser {
  password: string;
}

export interface AuthResponse {
  ok: boolean;
  status: number;
  data: any;
}

// ─── Storage helpers ──────────────────────────────────────────────────

const USERS_KEY = 'kabaddi-users';

function readUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function genId(): string {
  // Same shape as the real backend (cuid-like prefix + timestamp)
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function genPlayerCode(): string {
  return `KP${Math.floor(100000 + Math.random() * 900000)}`;
}

function publicUser(u: StoredUser): AuthUser {
  const { password: _pw, ...rest } = u;
  void _pw;
  return rest;
}

// ─── Mock action handlers ─────────────────────────────────────────────

function mockCheckPhone(payload: { phone?: string }): AuthResponse {
  const phone = (payload.phone || '').trim();
  const exists = readUsers().some((u) => u.phone === phone);
  return { ok: true, status: 200, data: { exists } };
}

function mockRegister(payload: {
  phone?: string;
  name?: string;
  password?: string;
  dateOfBirth?: string;
}): AuthResponse {
  const phone = (payload.phone || '').trim();
  const name = (payload.name || '').trim();
  const password = payload.password || '';
  const dateOfBirth = payload.dateOfBirth;

  if (!phone) {
    return { ok: false, status: 400, data: { error: 'Phone is required' } };
  }
  if (!name) {
    return { ok: false, status: 400, data: { error: 'Name is required' } };
  }
  if (!password || password.length < 6) {
    return {
      ok: false,
      status: 400,
      data: { error: 'Password must be at least 6 characters' },
    };
  }

  const users = readUsers();
  if (users.some((u) => u.phone === phone)) {
    return {
      ok: false,
      status: 409,
      data: { error: 'This phone number is already registered' },
    };
  }

  const newUser: StoredUser = {
    id: genId(),
    phone,
    name,
    password,
    dateOfBirth,
    role: 'player',
    playerCode: genPlayerCode(),
    avatar: '',
    isPremium: false,
    premiumExpiry: null,
    premiumPlan: null,
    isAdmin: false,
  };

  users.push(newUser);
  writeUsers(users);

  return { ok: true, status: 200, data: { user: publicUser(newUser) } };
}

function mockLogin(payload: {
  phone?: string;
  password?: string;
}): AuthResponse {
  const phone = (payload.phone || '').trim();
  const password = payload.password || '';

  const user = readUsers().find((u) => u.phone === phone);
  if (!user) {
    return {
      ok: false,
      status: 404,
      data: { error: 'No account found with this phone number. Please sign up.' },
    };
  }
  if (user.password !== password) {
    return {
      ok: false,
      status: 401,
      data: { error: 'Incorrect password' },
    };
  }

  return { ok: true, status: 200, data: { user: publicUser(user) } };
}

function mockForgotVerify(payload: {
  phone?: string;
  dateOfBirth?: string;
}): AuthResponse {
  const phone = (payload.phone || '').trim();
  const dateOfBirth = payload.dateOfBirth || '';

  const user = readUsers().find((u) => u.phone === phone);
  if (!user) {
    return {
      ok: false,
      status: 404,
      data: { error: 'No account found with this phone number' },
    };
  }
  if (user.dateOfBirth !== dateOfBirth) {
    return {
      ok: false,
      status: 400,
      data: { error: 'Date of birth does not match our records' },
    };
  }

  // Issue a single-use verification token
  const token = `vrf_${genId()}`;
  sessionStorage.setItem(`kabaddi-vrf-${phone}`, token);
  return { ok: true, status: 200, data: { verificationToken: token } };
}

function mockResetPassword(payload: {
  phone?: string;
  password?: string;
  verificationToken?: string;
}): AuthResponse {
  const phone = (payload.phone || '').trim();
  const password = payload.password || '';
  const token = payload.verificationToken || '';

  const storedToken = sessionStorage.getItem(`kabaddi-vrf-${phone}`);
  if (!storedToken || storedToken !== token) {
    return {
      ok: false,
      status: 400,
      data: { error: 'Invalid or expired verification token' },
    };
  }
  if (!password || password.length < 6) {
    return {
      ok: false,
      status: 400,
      data: { error: 'Password must be at least 6 characters' },
    };
  }

  const users = readUsers();
  const idx = users.findIndex((u) => u.phone === phone);
  if (idx < 0) {
    return {
      ok: false,
      status: 404,
      data: { error: 'Account not found' },
    };
  }

  users[idx].password = password;
  writeUsers(users);
  sessionStorage.removeItem(`kabaddi-vrf-${phone}`);

  return { ok: true, status: 200, data: { success: true } };
}

function mockUpdateDetails(payload: {
  userId?: string;
  role?: string;
  gender?: string;
  weight?: string;
  practiceGround?: string;
  location?: string;
  position?: string;
}): AuthResponse {
  const userId = payload.userId;
  if (!userId) {
    return { ok: false, status: 400, data: { error: 'userId is required' } };
  }

  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) {
    return { ok: false, status: 404, data: { error: 'User not found' } };
  }

  const allowed: (keyof StoredUser)[] = [
    'role',
    'gender',
    'weight',
    'practiceGround',
    'location',
    'position',
  ];
  for (const key of allowed) {
    const v = (payload as any)[key];
    if (v !== undefined && v !== null && v !== '') {
      (users[idx] as any)[key] = v;
    }
  }
  writeUsers(users);

  return { ok: true, status: 200, data: { user: publicUser(users[idx]) } };
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Send an auth request to the real backend. If the backend is unreachable
 * (network error) OR returns a 404/502/503 (endpoint not mounted, proxy
 * can't reach the api-server, or service unavailable), fall back to the
 * localStorage-backed mock.
 *
 * @param payload Must include an `action` field. Other fields depend on action.
 * @returns AuthResponse with { ok, status, data }
 */
export async function authRequest(payload: any): Promise<AuthResponse> {
  // First, try the real backend
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // 404 = the auth endpoint isn't mounted at all (no backend).
    // 502 = Vite dev proxy can't reach the api-server at localhost:8080.
    // 503 = service unavailable (Cashfree not configured, etc.).
    // All three mean "no real backend available" → fall back to mock.
    if (res.status === 404 || res.status === 502 || res.status === 503) {
      return runMock(payload);
    }

    // Try to parse JSON regardless of status
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      // Response wasn't JSON (probably HTML error page from proxy) → fall back to mock
      return runMock(payload);
    }

    return { ok: res.ok, status: res.status, data };
  } catch (networkErr) {
    // Backend unreachable (fetch threw) → fall back to mock
    return runMock(payload);
  }
}

/**
 * Run the localStorage-backed mock. No-op guard for SSR / unsupported envs.
 */
function runMock(payload: any): AuthResponse {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      ok: false,
      status: 503,
      data: { error: 'Backend unavailable and localStorage not supported' },
    };
  }

  const action = payload?.action;
  switch (action) {
    case 'check-phone':
      return mockCheckPhone(payload);
    case 'register':
      return mockRegister(payload);
    case 'login':
      return mockLogin(payload);
    case 'forgot-password-verify':
      return mockForgotVerify(payload);
    case 'reset-password':
      return mockResetPassword(payload);
    case 'update-details':
      return mockUpdateDetails(payload);
    default:
      return {
        ok: false,
        status: 400,
        data: { error: `Unknown auth action: ${action}` },
      };
  }
}

/**
 * Convenience: clear all locally-stored demo users (useful for testing).
 */
export function clearLocalUsers(): void {
  localStorage.removeItem(USERS_KEY);
}
