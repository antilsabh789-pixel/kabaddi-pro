// Base URL for the backend API.
//
// In the Replit dev environment this is empty, so requests stay relative
// (e.g. "/api/...") and are forwarded to the Express server by the Vite proxy.
//
// When the frontend is hosted on a static host that has NO backend on the same
// origin (e.g. Vercel, or a packaged Play Store WebView), set VITE_API_BASE_URL
// at build time to the public URL of the deployed Express API server, e.g.
//   VITE_API_BASE_URL=https://my-api.example.com
// Requests then go to that absolute URL instead of the (backend-less) static host.
export const API_BASE: string = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

// Prefix a relative "/api/..." path with API_BASE when configured.
export function apiUrl(path: string): string {
  if (API_BASE && path.startsWith("/api/")) {
    return API_BASE + path;
  }
  return path;
}

// Install a global fetch interceptor so every existing `fetch("/api/...")` call
// is routed to API_BASE without touching all 163 call sites individually.
// No-op when API_BASE is empty (Replit dev), so the Vite proxy keeps working.
export function installApiFetchInterceptor(): void {
  if (!API_BASE || typeof window === "undefined") return;
  const w = window as typeof window & { __apiFetchPatched?: boolean };
  if (w.__apiFetchPatched) return;
  w.__apiFetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      if (input.startsWith("/api/")) {
        return originalFetch(API_BASE + input, init);
      }
    } else if (input instanceof URL) {
      if (input.origin === window.location.origin && input.pathname.startsWith("/api/")) {
        return originalFetch(API_BASE + input.pathname + input.search, init);
      }
    } else if (input instanceof Request) {
      try {
        const u = new URL(input.url);
        if (u.origin === window.location.origin && u.pathname.startsWith("/api/")) {
          return originalFetch(new Request(API_BASE + u.pathname + u.search, input), init);
        }
      } catch {
        // ignore malformed URL, fall through
      }
    }
    return originalFetch(input, init);
  };
}
