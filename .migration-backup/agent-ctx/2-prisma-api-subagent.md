# Task 2 - Prisma + API Subagent

## Task
Update Prisma schema with coach models and create API routes

## Work Completed

### 1. Prisma Schema Updates
- Added `FeeRecord` model (mapped to `fee_records`) with unique constraint on `[academyId, userId, month]`
- Added `StudentReward` model (mapped to `student_rewards`) with type, title, description, points, month, icon fields
- Added `ParentContact` model (mapped to `parent_contacts`) with unique constraint on `[userId, academyId]`
- Updated `User` model: added `feeRecords FeeRecord[]`, `rewards StudentReward[]`, `parentContacts ParentContact[]`
- Updated `Academy` model: added `feeRecords FeeRecord[]`, `rewards StudentReward[]`, `parentContacts ParentContact[]`

Note: Changed `parentContact ParentContact?` to `parentContacts ParentContact[]` on User model because `userId` in ParentContact is not unique by itself (part of composite unique with `academyId`), so Prisma requires a one-to-many relation.

### 2. Database Migration
- Ran `bun run db:push` successfully
- Prisma Client regenerated

### 3. API Routes Created

**`/api/coach/attendance/route.ts`**
- GET: Fetch attendance by academyId, optional date filter
- POST: Bulk upsert attendance records for a given date using the `academyId_userId_date` unique constraint

**`/api/coach/fees/route.ts`**
- GET: Fetch fee records by academyId, optional month and status filters
- POST: Upsert fee record on `[academyId, userId, month]` unique constraint
- PUT: Mark fee as paid (sets status="paid" and paidAt timestamp)

**`/api/coach/rewards/route.ts`**
- GET: Fetch rewards by academyId, optional type and month filters
- POST: Create a new student reward

**`/api/coach/parents/route.ts`**
- GET: Fetch parent contacts by academyId
- POST: Upsert parent contact on `[userId, academyId]` unique constraint

### 4. Lint Check
- Passed with no errors
