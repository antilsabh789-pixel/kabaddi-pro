---
name: Static-host frontend needs absolute API base
description: Why relative /api calls 405/return HTML when the frontend is hosted without a same-origin backend (Vercel, Play Store WebView), and the fix.
---

# Static-host frontend needs an absolute API base

The frontend makes relative `fetch("/api/...")` calls (and one full-page
`window.location.href = "/api/payments/checkout"` redirect). These only work when
something serves the backend on the SAME origin — in Replit dev the Vite proxy
forwards `/api` to the Express api-server.

When the frontend is hosted on a static host with NO backend on its origin
(Vercel static deploy, a packaged Play Store WebView):
- POST `/api/...` → **405 Method Not Allowed** (surfaced to users as "Payment error (405)").
- GET `/api/...` → returns `index.html` (the SPA), not JSON → data screens render
  empty (this is why **Popular Players was invisible only on the live site**).

**Both symptoms share one root cause: nothing serves /api on that origin.** Do not
chase frontend rendering bugs for "missing data only in production" — check whether
the backend is reachable first (look for the request in the api-server logs; if it's
absent, the request never reached Express).

**Fix:** `src/lib/apiBase.ts` reads `VITE_API_BASE_URL` (build-time Vite env).
- Empty → no-op, relative paths flow through the Vite proxy (Replit dev unchanged).
- Set → a global `window.fetch` interceptor prefixes same-origin `/api/` requests
  with the absolute backend URL, covering all call sites at once; `apiUrl()` handles
  the non-fetch checkout redirect.

**Why:** avoids rewriting 160+ relative fetch sites and keeps dev behavior intact.

**To make the live site work (not just the frontend code):**
1. Deploy the Express api-server (`artifacts/api-server`) to a public URL. Cashfree
   secrets live on Replit, so a Replit Deployment of the api-server is the natural host.
2. Set `VITE_API_BASE_URL` in the Vercel build env to that backend URL, redeploy.
3. CORS is already enabled server-side (`app.use(cors())`), so cross-origin
   fetch/XHR works; the checkout redirect is plain navigation (no CORS needed).
