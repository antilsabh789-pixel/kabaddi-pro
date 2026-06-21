---
name: legacy password scheme
description: How pre-bcrypt Kabaddi Pro accounts store passwords and the seed-data quirks around them
---

# Legacy password hashing

The original Next.js app and the seed script hashed passwords as
`sha256(password + 'kabaddi_pro_salt')` → a 64-char lowercase hex string.
The Express api-server later switched to bcrypt (`$2`-prefixed). After data
migration, most existing accounts still carry the legacy SHA-256 hash.

**Rule:** `verifyPassword` must accept BOTH formats — bcrypt first, then the
legacy SHA-256+salt scheme (constant-time compare). On a successful legacy
login, re-hash to bcrypt and persist so accounts converge over time.

**Why:** verifying only bcrypt silently rejected every legacy account, which
surfaced on the client as a generic "Something went wrong" (the client shows a
catch-block message, not the 401 body), making it look like a network/db bug.

## Seed-data quirks (non-obvious)
- Seeded demo users (~40 of them) have password **`demo123`** and phones stored
  **without** the `+91` prefix (e.g. `8000000001`). The login UI always sends
  `+91${phone}`, so these seed users can't be reached from the app — fine for
  data, but don't use them to "test login via the UI"; test via direct API with
  the exact stored phone.
- Real registered users store phone **with** `+91` (e.g. `+919996121950`).
- A 64-hex stored password means legacy; a `$2`-prefix means already upgraded.
