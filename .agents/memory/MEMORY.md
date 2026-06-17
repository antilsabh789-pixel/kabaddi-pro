# Memory Index

- [Static-host API base](static-host-api-base.md) — relative /api 405s (POST) / returns HTML (GET) when no same-origin backend (Vercel/WebView); use VITE_API_BASE_URL + fetch interceptor.
- [Tailwind @theme inline dark mode](tailwind-theme-inline-dark-mode.md) — `@theme inline` bakes literal colors; `.dark` CSS-var overrides are dead code, must use paired `dark:` utilities.
- [API trust model](api-trust-model.md) — no server session layer; endpoints trust client-supplied ids; recover identity by exact unique-phone match, never endsWith/findFirst.
- [API server stale build](api-server-stale-build.md) — api-server dev is build+start (esbuild, no hot reload); restart the workflow after route edits.
- [Prisma + Postgres setup](prisma-postgres-setup.md) — api-server on Replit-managed Postgres via DATABASE_URL; build must run `prisma generate` (client externalized); publish migrates schema not data.
- [Match schema drift](match-schema-drift.md) — match data shape mismatches to watch for.
- [Git push workflow](git-push-workflow.md) — committing is blocked in main-agent bash; push needs a valid token in the URL.
