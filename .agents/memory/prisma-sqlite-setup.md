---
name: Prisma SQLite Setup
description: How Prisma v5 + SQLite is configured in the api-server; gotchas with db push and schema drift.
---

# Prisma SQLite Setup

## The rule
Use Prisma v5.22.0 (`@prisma/client@^5.22.0`, `prisma@^5.22.0` devDep). Prisma v7 is incompatible with the `url = env(...)` pattern in the datasource.

**Why:** Prisma v7 changed the datasource config to require a `prisma.config.ts` with adapter-based setup, which is much more complex. v5 just works with the standard schema.

## DATABASE_URL
The env var `DATABASE_URL` is runtime-managed by Replit (injected automatically). The api-server overrides it in `src/lib/db.ts` using `SQLITE_DATABASE_URL` or a hardcoded path fallback:
```ts
const dbUrl = process.env['SQLITE_DATABASE_URL'] || `file:${path.join(process.cwd(), 'prisma', 'custom.db')}`;
```
The actual SQLite DB is at `artifacts/api-server/prisma/custom.db`.

## Schema drift fix
`prisma db push` resolves paths relative to WHERE it runs, not the schema file. Running it from `artifacts/api-server` with `--schema=./prisma/schema.prisma` creates a new DB at `prisma/prisma/custom.db` instead of updating `prisma/custom.db`. Use raw SQL instead:
```ts
await db.$executeRawUnsafe('ALTER TABLE Match ADD COLUMN liveStreamUrl TEXT');
```

**How to apply:** Any time the Prisma schema has columns that don't exist in the SQLite DB, add them with raw ALTER TABLE via the PrismaClient `$executeRawUnsafe`.
