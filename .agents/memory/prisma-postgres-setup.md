---
name: Prisma + Postgres setup
description: How the api-server's Prisma database is wired (Replit managed Postgres) and the deploy gotchas.
---

# Prisma + Postgres (api-server)

The Express `api-server` uses **Prisma** as its ORM. As of the SQLite→Postgres
migration it targets **Replit-managed PostgreSQL** via `env("DATABASE_URL")`
(`prisma/schema.prisma` provider = `postgresql`). `src/lib/db.ts` constructs
`PrismaClient` with no datasource override — it reads `DATABASE_URL` directly.

- The old SQLite file `prisma/custom.db` is no longer used at runtime (kept as a
  backup; original dev data was migrated into Postgres via a Prisma dump/restore).
- `@workspace/db` (lib/db, Drizzle+pg) is a **dead/unused dependency** — the
  api-server does NOT import it. All routes use Prisma (`db.user.*`, etc.).

## Deploy gotcha — prisma generate in build
`build.mjs` (esbuild) **externalizes `@prisma/client`**, so the generated client
+ query engine must exist in `node_modules` at runtime. The package `build`
script therefore runs `prisma generate && node ./build.mjs`. **Do not remove the
`prisma generate`** — a fresh autoscale deploy would otherwise ship without a
Postgres-targeted client. (This is code generation, not a schema mutation, so it
is allowed in the deploy build command.)

## Prod data
**Why:** Replit Publish migrates the *schema* dev→prod automatically but NOT data.
**How to apply:** A freshly published prod DB is schema-only → content endpoints
(e.g. popular-players, which lists DB users) appear empty until users register.
To copy existing dev content into prod, the user picks **"overwrite data"** in the
Publish UI. The agent must NOT write DDL/seed scripts against prod (read-only).
