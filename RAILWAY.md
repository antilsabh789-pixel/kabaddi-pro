# Railway Deployment

This repo is configured for Railway via two files at the root:

- `railway.json` — Railway-specific build + deploy config
- `nixpacks.toml` — fallback config (works for any nixpacks-based builder)

## What gets deployed

Only the **api-server** (`artifacts/api-server`) is deployed on Railway. The
frontend (`artifacts/kabaddi-pro`) is deployed separately on Vercel — see
`vercel.json`.

## Required environment variables

Set these in the Railway service → Variables tab:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ yes | Railway provisioned Postgres gives you this. Or use any external Postgres URL. |
| `PORT` | ✅ yes | Railway auto-injects this. Do NOT set manually. |
| `NODE_ENV` | recommended | Set to `production` for prod logging + perf. |
| `CASHFREE_ENV` | for payments | `production` or `sandbox`. |
| `CASHFREE_APP_ID` | for payments | Your Cashfree app ID. |
| `CASHFREE_SECRET_KEY` | for payments | Your Cashfree secret key. |
| `APP_URL` | for payments | Absolute URL of the frontend (e.g. `https://kabaddi-pro.vercel.app`). Used to build Cashfree return URLs. |
| `LOG_LEVEL` | optional | `info` (default), `debug`, `warn`, `error`. |

The server crashes at boot if `DATABASE_URL` or `PORT` is missing — by design,
so misconfigs are loud.

## How the build works

1. **Setup**: nixpacks installs Node.js 20 from `engines.node` + `.node-version`.
2. **Install**: `corepack enable pnpm` (uses `pnpm@10.26.1` from `packageManager`)
   then `pnpm install --frozen-lockfile`.
3. **Build**: `pnpm --filter @workspace/api-server run build` — this runs
   `prisma generate` (compiles the Prisma client from `schema.prisma`) then
   `node ./build.mjs` (esbuild bundles everything into `dist/index.mjs`).
4. **Start**: `pnpm --filter @workspace/api-server run start` — runs
   `node --enable-source-maps ./dist/index.mjs`.

The build deliberately **skips the root typecheck** (`pnpm run typecheck`) because
the typecheck has pre-existing errors in legacy files (`coach.ts`, `giveaway.ts`)
that don't affect the runtime bundle — esbuild transpiles without typechecking.

## Database migrations

The api-server auto-migrates on boot (see `src/index.ts → autoMigrate()`). It
uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` etc., so it's safe to run on
every deploy. For schema changes that need data backfills, run
`pnpm --filter db push` manually against the production DB.

## Health check

Railway pings `GET /api/healthz` after deploy. The endpoint returns
`{ "status": "ok" }` with HTTP 200.

## Common build failures

| Symptom | Cause | Fix |
|---|---|---|
| `Use pnpm instead` during install | nixpacks fell back to npm | Ensure `railway.json` or `nixpacks.toml` is at repo root (committed). |
| `DATABASE_URL must be set` at boot | DB not provisioned | Add a Postgres database in Railway → Variables → "Reference another service" → `DATABASE_URL`. |
| `Cannot find module '@workspace/db'` | Workspace deps not installed | Ensure `pnpm install --frozen-lockfile` ran (the `railway.json` install phase). |
| Build OOMs | api-server bundle is 1.7MB | Upgrade Railway plan or set `NODE_OPTIONS=--max-old-space-size=4096`. |
| `Port X is already in use` | Two services on same port | Railway auto-assigns ports — don't hardcode `PORT` in Variables. |

## Frontend (Vercel)

The frontend lives in `artifacts/kabaddi-pro` and is deployed via `vercel.json`.
It calls `/api/*` which the frontend's fetch interceptor (see
`artifacts/kabaddi-pro/src/lib/apiBase.ts`) rewrites to the Railway API URL.

### ⚠️ CRITICAL: Set the API URL on Vercel

If you do NOT set the API URL, every `/api/*` request from the frontend will
hit Vercel's SPA fallback (which returns `index.html` with HTTP 200). This
causes the frontend to try `JSON.parse("<!DOCTYPE html>...")` which throws
the cryptic error:

> `Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON`

This is the **#1 cause** of "chat not working" / "search not showing results"
reports. The fix is to set ONE of these:

| Option | Where | When it takes effect | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | Vercel → Settings → Environment Variables | After rebuild | Recommended for production. Set to your Railway URL (e.g. `https://kabaddi-pro-api.up.railway.app`). |
| `window.__API_BASE_URL__` | Edit `artifacts/kabaddi-pro/index.html` directly | Immediately (no rebuild) | Useful for hotfix. Set the value in the `<script>` block at the top of `<head>`. |
| `localStorage.setItem('apiBaseUrl', '...')` | Browser console | Per-browser, immediately | For QA/testing only. Set on each device you test from. |

After setting `VITE_API_BASE_URL` on Vercel, trigger a redeploy
(Deployments → Redeploy) so the value gets baked into the bundle.

### How `vercel.json` routing works

The `rewrites` block in `vercel.json`:

```json
"rewrites": [
  { "source": "/((?!api/).*)", "destination": "/index.html" }
]
```

This means: any path that does NOT start with `/api/` falls through to
`index.html` (the SPA). Paths starting with `/api/` are NOT caught by this
rewrite — they go to Vercel's normal request handling (which is a 404 if no
serverless function matches). The frontend's fetch interceptor (with
`VITE_API_BASE_URL` set) rewrites those `/api/*` requests to the Railway URL
*before* they hit the network, so Vercel's 404 never triggers.

If `VITE_API_BASE_URL` is NOT set, `/api/*` requests go to Vercel and return
404. The frontend's `safeJson` helper (in `apiBase.ts`) detects HTML responses
and throws a user-friendly "Could not connect to server" error instead of the
cryptic V8 SyntaxError.

