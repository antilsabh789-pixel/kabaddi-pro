// Base URL for the backend API.
//
// Resolution order (highest priority first):
//   1. window.__API_BASE_URL__ — set at runtime (e.g. by a deploy script
//      that rewrites index.html, or manually via browser console for testing)
//   2. localStorage.getItem('apiBaseUrl') — manual override for testing/QA
//   3. import.meta.env.VITE_API_BASE_URL — set at build time on Vercel
//   4. '' (empty) — fall back to current origin (Vite dev proxy or same-origin prod)
//
// When API_BASE is empty, requests stay relative (e.g. "/api/...") and rely on:
//   - Vite dev proxy (vite.config.ts → server.proxy['/api']) in dev, OR
//   - Same-origin Express server in production (rare — usually prod is split
//     between Vercel for static + Railway for API, in which case API_BASE
//     MUST be set to the Railway URL).

function readRuntimeApiBase(): string {
  if (typeof window === 'undefined') return '';
  // 1. Runtime global (set by deploy script or hand-edited index.html)
  const g = (window as any).__API_BASE_URL__;
  if (typeof g === 'string' && g.trim()) return g.trim().replace(/\/$/, '');
  // 2. localStorage override (for QA/testing without rebuilds)
  try {
    const ls = window.localStorage?.getItem('apiBaseUrl');
    if (ls && ls.trim()) return ls.trim().replace(/\/$/, '');
  } catch {
    /* localStorage may be disabled (private mode) — ignore */
  }
  // 3. Build-time env var
  const env = (import.meta as any).env?.VITE_API_BASE_URL;
  if (typeof env === 'string' && env.trim()) return env.trim().replace(/\/$/, '');
  // 4. Empty → same-origin
  return '';
}

export const API_BASE: string = readRuntimeApiBase();

// Prefix a relative "/api/..." path with API_BASE when configured.
export function apiUrl(path: string): string {
  if (API_BASE && path.startsWith('/api/')) {
    return API_BASE + path;
  }
  return path;
}

// Friendly error message for HTML responses (the classic "Unexpected token '<'"
// V8 SyntaxError that fires whenever the SPA fallback returns index.html
// instead of JSON). Used by the global fetch interceptor below.
const CONNECTION_ERROR_MSG =
  'Could not connect to server. Please check your connection and try again.';

/**
 * Wrap a Response so that calling `.json()` on an HTML/non-JSON response
 * throws a user-friendly error instead of the cryptic V8 SyntaxError
 * ("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON").
 *
 * This is the root cause of confusing chat errors when the API is unreachable
 * (e.g. VITE_API_BASE_URL not set on Vercel, backend down, proxy misconfigured).
 * The SPA fallback returns index.html with status 200, and res.json() crashes.
 *
 * We read the body ONCE as text, then attempt JSON.parse. If the body isn't
 * JSON (or looks like HTML), we throw a friendly error.
 */
function wrapResponseJson(originalRes: Response): Response {
  // Already wrapped (defensive — shouldn't happen)
  const r = originalRes as Response & { __safeJsonPatched?: boolean };
  if (r.__safeJsonPatched) return r;
  r.__safeJsonPatched = true;

  const origJson = r.json.bind(r);
  r.json = async function (): Promise<any> {
    const ct = r.headers.get('content-type') || '';
    let text = '';
    try {
      text = await r.text();
    } catch {
      // body already consumed or unreadable — fall back to original
      return origJson();
    }
    if (!text) return {} as any;
    const looksLikeHtml =
      text.trim().startsWith('<') ||
      text.includes('<!DOCTYPE') ||
      text.includes('<html');
    const isJsonCt = ct.includes('application/json') || ct.includes('text/json');
    if (!isJsonCt) {
      if (looksLikeHtml) throw new Error(CONNECTION_ERROR_MSG);
      throw new Error('Unexpected response from server. Please try again.');
    }
    try {
      return JSON.parse(text);
    } catch {
      if (looksLikeHtml) throw new Error(CONNECTION_ERROR_MSG);
      throw new Error('Could not parse server response. Please try again.');
    }
  };
  return r;
}

// Install a global fetch interceptor that does TWO things:
//   1. Routes `/api/*` requests to API_BASE when configured (no-op if empty)
//   2. Wraps every response so `.json()` throws a friendly error if the
//      response is HTML (instead of the cryptic "Unexpected token '<'")
//
// Together these prevent the most common chat/API failure modes:
//   - Frontend on Vercel + API on Railway without VITE_API_BASE_URL set
//   - Backend temporarily down — frontend gets HTML 404/500 page
//   - Proxy misconfigured — frontend gets SPA index.html
export function installApiFetchInterceptor(): void {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { __apiFetchPatched?: boolean };
  if (w.__apiFetchPatched) return;
  w.__apiFetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string | null = null;
    let finalInput: RequestInfo | URL = input;

    // Rewrite /api/* to API_BASE if configured
    if (API_BASE) {
      if (typeof input === "string") {
        if (input.startsWith("/api/")) {
          url = API_BASE + input;
          finalInput = url;
        }
      } else if (input instanceof URL) {
        if (input.origin === window.location.origin && input.pathname.startsWith("/api/")) {
          url = API_BASE + input.pathname + input.search;
          finalInput = url;
        }
      } else if (input instanceof Request) {
        try {
          const u = new URL(input.url);
          if (u.origin === window.location.origin && u.pathname.startsWith("/api/")) {
            url = API_BASE + u.pathname + u.search;
            finalInput = new Request(url, input);
          }
        } catch {
          // ignore malformed URL, fall through
        }
      }
    }

    const res = await originalFetch(finalInput, init);
    // Only wrap responses for /api/* calls — don't touch arbitrary fetches
    // (e.g. Google Fonts, AdSense scripts) which legitimately return non-JSON.
    const isApiCall =
      (typeof finalInput === 'string' && finalInput.includes('/api/')) ||
      (finalInput instanceof URL && finalInput.pathname.includes('/api/')) ||
      (finalInput instanceof Request && finalInput.url.includes('/api/'));
    if (isApiCall) {
      return wrapResponseJson(res);
    }
    return res;
  };
}
