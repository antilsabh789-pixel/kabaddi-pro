---
name: Match Schema Drift
description: Actual SQLite DB column names differ from Prisma schema in key places. Always verify before writing routes.
---

# Match Schema Drift

## Key differences between schema.prisma and actual SQLite DB

### Match model
- `liveStreamUrl` — IN schema, WAS MISSING in DB. Fixed by ALTER TABLE. Now present.
- `type`, `date`, `round` — NOT in schema or DB (routes used these incorrectly; fixed to use `isPractice` boolean instead)

### MatchEvent model  
- Uses `timestamp` (not `createdAt`) for ordering
- Field names: `eventType` (not `type`), `value` (not `points`), `details` (not `description`)
- `teamId` is required (not nullable)

### TournamentEntry model
- Fields: `played`, `won`, `lost`, `drawn`, `scoreDiff`, `points` (not wins/losses/draws)

### Payment model
- Field: `amount` (not `amountPaise`); no `discountPaise`, `couponCode`, or `env` fields

### FeeRecord model (maps to `fee_records` table)
- Uses `status` string ('pending'/'paid'/'overdue'), not `isPaid` boolean
- Uses `notes` (not `note`)
- Has `paidAt` DateTime

### Attendance model (maps to `attendances` table)
- No `note` field

### ParentContact model (maps to `parent_contacts` table)
- Fields: `parentName`, `parentPhone`, `relation` (not `phone`, `relationship`)

### StudentReward model (maps to `student_rewards` table)
- Has required `title` field

### Ground model
- Uses `lat`/`lng` (not `latitude`/`longitude`)

### Activity model
- Has required `title` and `description` fields

### Challenge model
- Fields: `fromUserId`, `toUserId`, `fromTeamId`, `toTeamId` (not `senderId`/`receiverId`)

**How to apply:** Before writing any new Express route, verify the actual DB column names by running a `findFirst` with `select` and checking the output.
