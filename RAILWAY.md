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
It calls `/api/*` which Vercel rewrites to the Railway api-server URL — set
`API_BASE_URL` (or whatever your frontend's fetch wrapper reads) on Vercel to
your Railway service's public URL.
