# Kabaddi Pro

Live kabaddi scoring, tournament management, and player tracking app — migrated from Vercel/Next.js to Replit Vite + React.

## Run & Operate

- `pnpm --filter @workspace/kabaddi-pro run dev` — run the frontend (port auto-assigned)
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vite + React + Tailwind CSS v4
- API: Express 5 (artifacts/api-server)
- State: Zustand (persisted to localStorage)
- UI: Radix UI + shadcn components
- Animations: Framer Motion
- Build: Vite (esbuild)

## Where things live

- `artifacts/kabaddi-pro/src/app/page.tsx` — main app component (splash → auth → tabs)
- `artifacts/kabaddi-pro/src/components/kabaddi/` — all feature screens (76 components)
- `artifacts/kabaddi-pro/src/lib/store.ts` — Zustand global store (source of truth for state)
- `artifacts/kabaddi-pro/src/index.css` — Tailwind v4 theme (brand colors, animations)
- `artifacts/api-server/src/` — Express API routes

## Architecture decisions

- Migrated from Next.js to Vite + React — no SSR, fully client-rendered
- All `next/dynamic` → `React.lazy` + `Suspense`
- All `next/image` → standard `<img>` tags
- `next-themes` kept (it's a standalone package, not Next.js-specific)
- API routes (51 endpoints) remain in `artifacts/kabaddi-pro/src/app/api/` for reference — production calls go to the Express api-server
- Zustand persisted store handles all user state (auth, active tab, match state)

## Product

- **Splash screen** → **Auth** (phone/OTP) → **Home tab** (upcoming matches, news)
- **Tournaments tab** — browse and manage kabaddi tournaments
- **Quick Score tab** — live match scoring interface
- **Profile tab** — player profile, stats, premium features
- Live scoring with toss flow, real-time events
- Premium subscription via Cashfree payments
- Dark/light mode support

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `next-themes` is used for ThemeProvider (not Next.js-specific, works in Vite)
- `artifacts/kabaddi-pro/src/lib/db.ts` imports Prisma — this is server-side only and not bundled by Vite
- The API server (Express) must be started separately for backend features
- All custom CSS animations/classes are in `src/index.css` (not globals.css)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
