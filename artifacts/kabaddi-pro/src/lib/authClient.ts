/**
 * Auth Client — talks to the real backend only.
 *
 * IMPORTANT: This file used to fall back to a localStorage-backed mock when
 * the backend was unreachable. That caused critical bugs in production:
 *   - Mock login let users "log in" to stale fake accounts whose IDs weren't
 *     in the real database, breaking every subsequent API call.
 *   - Mock check-phone returned stale data, hiding the real backend's answer.
 *   - Mock forgot-password-verify / reset-password gave users fake tokens
 *     that the real backend would reject, trapping them in a broken flow.
 *
 * The mock is now DISABLED for ALL actions. If the backend is unreachable,
 * we return a clear 503 error so the user knows to retry. The mock code is
 * preserved below for reference / future explicit demo mode, but it's never
 * invoked automatically.
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
  return `KP${Math.floor(1001 + Math.random() * 8999)}`;
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
  referralCode?: string;
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

  // Mock mode: referral codes can't be validated against a real DB, so just
  // echo back the result. In production the real backend validates + grants
  // premium days inline during /api/auth register.
  return {
    ok: true,
    status: 200,
    data: {
      user: publicUser(newUser),
      referral: payload.referralCode
        ? { applied: false, error: 'Referral codes require the live backend' }
        : { applied: false, error: null },
    },
  };
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
 * (network error) OR returns any non-OK status (404, 502, 503, 500, etc.),
 * fall back to the localStorage-backed mock.
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

    // Try to parse the body as JSON first — this lets us distinguish a real
    // backend response (JSON, even on error) from a non-backend response
    // (HTML error page from a proxy, empty 404, etc.).
    let data: any = null;
    let parsed = false;
    try {
      data = await res.json();
      parsed = true;
    } catch {
      // Not JSON — likely an HTML error page from a proxy or a 404 from
      // the dev server. Fall through to mock fallback below.
    }

    if (parsed) {
      // The real backend returned JSON — pass through both success AND error
      // responses. A 400 ("password too short") or 409 ("already registered")
      // from the backend must reach the UI; we should NOT silently fall back
      // to the mock in those cases.
      return { ok: res.ok, status: res.status, data };
    }

    // JSON parse failed. Treat as "backend not really reachable".
    // 404 = endpoint not mounted in dev; 502/503/504 = proxy/upstream errors.
    // NEVER fall back to the mock — see file header for why. Surface a clear
    // 503 so the user knows to retry.
    if (res.status === 404 || res.status === 502 || res.status === 503 || res.status === 504) {
      return {
        ok: false,
        status: 503,
        data: { error: 'Cannot reach server. Please check your internet connection and try again.' },
      };
    }
    // Any other non-JSON status — surface as a generic error so the UI can
    // show something instead of silently using mock data.
    return {
      ok: false,
      status: res.status,
      data: { error: `Unexpected server response (${res.status}). Please try again.` },
    };
  } catch (networkErr) {
    // Backend unreachable (fetch threw). NEVER fall back to the mock — see
    // file header for why. Show a clear error so the user knows to retry.
    void networkErr;
    return {
      ok: false,
      status: 503,
      data: { error: 'Cannot reach server. Please check your internet connection and try again.' },
    };
  }
}

/**
 * Mock fallback is INTENTIONALLY DISABLED. The mock code below is preserved
 * for future explicit demo mode (e.g. behind a `?demo=1` flag), but is no
 * longer invoked automatically from `authRequest`. If you need to re-enable
 * it, gate it behind an explicit flag — never auto-trigger on network errors.
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
