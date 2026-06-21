---
name: API server stale build gotcha
description: Why newly added Express routes can 404 until the api-server workflow is restarted
---

The `@workspace/api-server` dev workflow runs `pnpm run build && pnpm run start`
(esbuild bundle to `dist/index.mjs`, then `node dist/index.mjs`). It does NOT
watch/reload on source change.

**Symptom:** a newly added/changed route returns 404 even though it is present in
both `src/routes/*.ts` AND the compiled `dist/index.mjs`. Other (older) routes in
the same router file still work. A 404 returns non-JSON, so the kabaddi-pro
frontend surfaces it as "Payment error (404/405)".

**Why:** the long-running node process is serving an OLD in-memory build from a
previous start; editing source / rebuilding dist does not affect it.

**How to apply:** after adding or changing any api-server route, restart the
`artifacts/api-server: API Server` workflow (which re-runs build+start). Verify with
`curl -X <METHOD> http://localhost:8080/api/<path>` — a JSON body (even an error)
means the route is live; a bare 404 means stale.
