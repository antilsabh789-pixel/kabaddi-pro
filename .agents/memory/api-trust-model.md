---
name: API trust model
description: How the Express API authenticates callers and the safe way to recover a user identity.
---

# Kabaddi Pro API trust model

The Express API (`artifacts/api-server`) has **no server-side session/auth layer**. Login returns
the user object, which the client persists (Zustand → localStorage). Every subsequent endpoint
trusts a client-supplied id in the request body (e.g. `userId`, `followerId`). There is no token
verifying the caller is who they claim. This is a uniform (weak) trust model across all routes.

**Identity recovery:** after a DB reseed, a persisted `userId` may no longer exist. Recover by an
**exact match on the unique `phone` column** (`db.user.findUnique({ where: { phone } })`).
NEVER use `endsWith` + `findFirst` on a normalized phone — it is non-deterministic and can collide
across phone formats, binding actions to the wrong account.

**Why:** phone is `@unique` and is the real identity in this OTP/phone-based app, so exact match is
deterministic and collision-free, and is consistent with the existing body-trust model (no worse).

**How to apply:** when adding/auditing any user-scoped write (payments, follows, profile), resolve
the user id strictly; do not introduce fuzzy phone matching. Real auth (sessions/JWT/OTP re-challenge)
would need to be added uniformly across routes, not bolted onto one endpoint.
