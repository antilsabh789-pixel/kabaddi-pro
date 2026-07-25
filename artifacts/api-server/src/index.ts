import app from "./app";
import { db } from "./lib/db";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Auto-migrate any pending schema changes that don't require a data backfill.
 * We use raw SQL with IF NOT EXISTS so this is idempotent and safe to run on
 * every boot. This avoids the "Internal server error" crash that happens when
 * the Prisma client expects a column that doesn't exist in the deployed DB yet
 * (which happens when schema.prisma is updated but `prisma db push` wasn't run
 * against production).
 *
 * Each statement is wrapped in its own try/catch so a failure on one column
 * doesn't block the others or prevent the server from starting.
 */
async function autoMigrate() {
  const statements = [
    // showCoachBadge — added when the coach role was deprecated and replaced
    // with an opt-in cosmetic badge. Default false (no badge).
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showCoachBadge" BOOLEAN NOT NULL DEFAULT false`,
    // Academy.offDays — JSON array of weekday names that are holidays.
    `ALTER TABLE "academies" ADD COLUMN IF NOT EXISTS "offDays" TEXT NOT NULL DEFAULT '[]'`,
    // Attendance.session + note — supports morning/evening sessions per day.
    `ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "session" TEXT NOT NULL DEFAULT 'default'`,
    `ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "note" TEXT`,
    // FeeRecord.expiryDate + period — for "days left" calculation in coach dashboard.
    `ALTER TABLE "fee_records" ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP`,
    `ALTER TABLE "fee_records" ADD COLUMN IF NOT EXISTS "period" TEXT NOT NULL DEFAULT 'monthly'`,
    // Ground.mapLink — raw Google Maps URL pasted by user. Optional. Used to
    // open the location directly in Google Maps instead of asking the user for
    // raw latitude/longitude (which was a poor UX in the Add Ground form).
    `ALTER TABLE "Ground" ADD COLUMN IF NOT EXISTS "mapLink" TEXT`,
    // User.provisional — placeholder accounts created when a scorer/coach adds
    // a non-registered player by phone. They get upgraded in place on real
    // signup. See schema.prisma for the full rationale.
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provisional" BOOLEAN NOT NULL DEFAULT false`,
    // GiveawayParticipant.entryType — distinguishes free / referral / premium_direct / paid entries.
    // Replaces the overloaded isPremium boolean (which was reused as a "paid ₹2" flag during the
    // all-free refactor). The boolean is kept for backward compat with old admin queries.
    `ALTER TABLE "giveaway_participants" ADD COLUMN IF NOT EXISTS "entryType" TEXT NOT NULL DEFAULT 'free'`,
    // DiscountCode — new admin-managed coupon table (replaces hardcoded VALID_COUPONS).
    `CREATE TABLE IF NOT EXISTS "DiscountCode" (
      "id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "discountType" TEXT NOT NULL,
      "discountValue" INTEGER NOT NULL,
      "maxUses" INTEGER NOT NULL DEFAULT 0,
      "usedCount" INTEGER NOT NULL DEFAULT 0,
      "minOrderAmount" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "expiresAt" TIMESTAMP(3),
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "DiscountCode_code_key" ON "DiscountCode"("code")`,
  ];

  // The Attendance table's unique constraint changed from
  // (academyId, userId, date) → (academyId, userId, date, session).
  // We need to drop the old constraint and add the new one. This is safe
  // because the new column defaults to 'default', so existing rows get a
  // unique value per (academyId, userId, date) tuple.
  const constraintStatements = [
    // Drop old constraint if it exists (PostgreSQL IF EXISTS)
    `ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_academyId_userId_date_key"`,
    // Add new composite constraint
    `ALTER TABLE "attendances" DROP CONSTRAINT IF EXISTS "attendances_academyId_userId_date_session_key"`,
    `ALTER TABLE "attendances" ADD CONSTRAINT "attendances_academyId_userId_date_session_key" UNIQUE ("academyId", "userId", "date", "session")`,
  ];

  // Create the academy_announcements table if it doesn't exist. This is
  // idempotent — CREATE TABLE IF NOT EXISTS is a no-op if the table exists.
  // We use raw SQL instead of `prisma db push` so the server can boot on
  // Vercel without a separate migration step.
  const tableStatements = [
    `CREATE TABLE IF NOT EXISTS "academy_announcements" (
      "id" TEXT NOT NULL,
      "academyId" TEXT NOT NULL,
      "coachUserId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "scheduledAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "academy_announcements_pkey" PRIMARY KEY ("id")
    )`,
    // Foreign keys — add IF NOT EXISTS guard by dropping first (Postgres doesn't
    // support ADD CONSTRAINT IF NOT EXISTS, so we wrap in a DO block)
    `DO $$ BEGIN
      ALTER TABLE "academy_announcements" ADD CONSTRAINT "academy_announcements_academyId_fkey"
        FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "academy_announcements" ADD CONSTRAINT "academy_announcements_coachUserId_fkey"
        FOREIGN KEY ("coachUserId") REFERENCES "User"("id") ON DELETE RESTRICT;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    // Index for querying announcements by academy (most common query)
    `CREATE INDEX IF NOT EXISTS "academy_announcements_academyId_idx" ON "academy_announcements"("academyId")`,
  ];

  // ─── Chat tables (player-to-player DMs + block + report) ────────────
  // Created here so the server can boot on Vercel/Railway without a
  // separate `prisma db push` step. All statements are idempotent.
  const chatTableStatements = [
    // ChatThread — one row per 1:1 conversation
    `CREATE TABLE IF NOT EXISTS "ChatThread" (
      "id" TEXT NOT NULL,
      "userAId" TEXT NOT NULL,
      "userBId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ChatThread_userAId_userBId_key" ON "ChatThread"("userAId", "userBId")`,
    `CREATE INDEX IF NOT EXISTS "ChatThread_userBId_idx" ON "ChatThread"("userBId")`,
    `DO $$ BEGIN
      ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userAId_fkey"
        FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userBId_fkey"
        FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    // ChatMessage — one row per message in a thread
    `CREATE TABLE IF NOT EXISTS "ChatMessage" (
      "id" TEXT NOT NULL,
      "threadId" TEXT NOT NULL,
      "senderId" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "isRead" BOOLEAN NOT NULL DEFAULT false,
      "readAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "ChatMessage_senderId_idx" ON "ChatMessage"("senderId")`,
    `DO $$ BEGIN
      ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey"
        FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey"
        FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    // ChatBlock — "I don't want to receive messages from this person"
    `CREATE TABLE IF NOT EXISTS "ChatBlock" (
      "id" TEXT NOT NULL,
      "blockerId" TEXT NOT NULL,
      "blockedId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChatBlock_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ChatBlock_blockerId_blockedId_key" ON "ChatBlock"("blockerId", "blockedId")`,
    `CREATE INDEX IF NOT EXISTS "ChatBlock_blockedId_idx" ON "ChatBlock"("blockedId")`,
    `DO $$ BEGIN
      ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_blockerId_fkey"
        FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_blockedId_fkey"
        FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    // ChatReport — escalations from players, reviewed by admins
    `CREATE TABLE IF NOT EXISTS "ChatReport" (
      "id" TEXT NOT NULL,
      "reporterId" TEXT NOT NULL,
      "reportedId" TEXT NOT NULL,
      "threadId" TEXT,
      "messageId" TEXT,
      "reason" TEXT NOT NULL,
      "details" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "reviewedBy" TEXT,
      "reviewedAt" TIMESTAMP(3),
      "adminNote" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "ChatReport_status_createdAt_idx" ON "ChatReport"("status", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "ChatReport_reportedId_idx" ON "ChatReport"("reportedId")`,
    `CREATE INDEX IF NOT EXISTS "ChatReport_reporterId_idx" ON "ChatReport"("reporterId")`,
    `DO $$ BEGIN
      ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_reporterId_fkey"
        FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_reportedId_fkey"
        FOREIGN KEY ("reportedId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_reviewedBy_fkey"
        FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    // ChatMessage.deletedAt — soft-delete (unsend) column added for the
    // "delete for everyone" feature. Idempotent: ADD COLUMN IF NOT EXISTS
    // (Postgres) is a no-op on existing columns. SQLite < 3.35 doesn't
    // support IF NOT EXISTS on ADD COLUMN, so we wrap in a try/catch and
    // ignore "duplicate column" errors (handled by the loop's catch below).
    `ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`,
    // Notification.threadId — for type='chat' notifications, the
    // conversation thread this notification belongs to, so the recipient
    // can jump straight into the right conversation when they tap the
    // notification in the bell panel.
    `ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "threadId" TEXT`,
  ];

  // ─── Giveaway tables ────────────────────────────────────────────────
  // The Giveaway feature was added in schema.prisma, but `prisma db push`
  // was never run on production — so the GiveawayRound and GiveawayParticipant
  // tables didn't exist, causing EVERY /api/giveaway/* endpoint to 500
  // ("Internal server error"). The auto-migrate above only adds the entryType
  // COLUMN to giveaway_participants (assuming the table already exists), so
  // it didn't help when the table itself was missing.
  //
  // This block creates both tables idempotently (CREATE TABLE IF NOT EXISTS)
  // using the same column definitions as schema.prisma. Once the tables exist,
  // the existing `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "entryType"` will
  // also work correctly on the next boot.
  const giveawayTableStatements = [
    // GiveawayRound — one row per 15-day giveaway round.
    `CREATE TABLE IF NOT EXISTS "GiveawayRound" (
      "id" TEXT NOT NULL,
      "roundNumber" INTEGER NOT NULL,
      "startDate" TIMESTAMP(3) NOT NULL,
      "endDate" TIMESTAMP(3) NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "winnersJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "GiveawayRound_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "GiveawayRound_roundNumber_key" ON "GiveawayRound"("roundNumber")`,
    // GiveawayParticipant — one row per user per round.
    `CREATE TABLE IF NOT EXISTS "GiveawayParticipant" (
      "id" TEXT NOT NULL,
      "giveawayRoundId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "name" TEXT,
      "isPremium" BOOLEAN NOT NULL DEFAULT false,
      "entryType" TEXT NOT NULL DEFAULT 'free',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "GiveawayParticipant_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "GiveawayParticipant_giveawayRoundId_userId_key" ON "GiveawayParticipant"("giveawayRoundId", "userId")`,
    `CREATE INDEX IF NOT EXISTS "GiveawayParticipant_giveawayRoundId_idx" ON "GiveawayParticipant"("giveawayRoundId")`,
    `CREATE INDEX IF NOT EXISTS "GiveawayParticipant_userId_idx" ON "GiveawayParticipant"("userId")`,
    `DO $$ BEGIN
      ALTER TABLE "GiveawayParticipant" ADD CONSTRAINT "GiveawayParticipant_giveawayRoundId_fkey"
        FOREIGN KEY ("giveawayRoundId") REFERENCES "GiveawayRound"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "GiveawayParticipant" ADD CONSTRAINT "GiveawayParticipant_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    // UserStreak — daily check-in streak system. Same problem as giveaway:
    // added in schema.prisma but never created on the production DB.
    `CREATE TABLE IF NOT EXISTS "UserStreak" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "currentStreak" INTEGER NOT NULL DEFAULT 0,
      "longestStreak" INTEGER NOT NULL DEFAULT 0,
      "totalCheckIns" INTEGER NOT NULL DEFAULT 0,
      "lastCheckIn" TIMESTAMP(3),
      "claimedMilestones" TEXT NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserStreak_userId_key" ON "UserStreak"("userId")`,
    `DO $$ BEGIN
      ALTER TABLE "UserStreak" ADD CONSTRAINT "UserStreak_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

    // TeamJoinRequest — players requesting to join a team.
    `CREATE TABLE IF NOT EXISTS "TeamJoinRequest" (
      "id" TEXT NOT NULL,
      "teamId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "TeamJoinRequest_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "TeamJoinRequest_teamId_idx" ON "TeamJoinRequest"("teamId")`,
    `CREATE INDEX IF NOT EXISTS "TeamJoinRequest_userId_idx" ON "TeamJoinRequest"("userId")`,
    `DO $$ BEGIN
      ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
    `DO $$ BEGIN
      ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  ];

  // Run giveaway/streak/team-join table creation — track success/failure counts
  // so we can log a LOUD summary at the end. Previously we silently swallowed
  // errors with `logger.warn` and never surfaced whether the migration worked.
  let giveawaySuccess = 0;
  let giveawayFailure = 0;
  const giveawayFailures: { sql: string; err: string }[] = [];
  for (const sql of giveawayTableStatements) {
    try {
      await db.$executeRawUnsafe(sql);
      giveawaySuccess++;
      logger.info({ sql: sql.slice(0, 80) }, 'auto-migrate: applied giveaway/streak/team-join table');
    } catch (err) {
      giveawayFailure++;
      const errStr = String(err).slice(0, 500); // bumped from 200 → 500 for debugging
      giveawayFailures.push({ sql: sql.slice(0, 80), err: errStr });
      logger.warn({ err: errStr, sql: sql.slice(0, 80) }, 'auto-migrate: giveaway/streak/team-join table FAILED');
    }
  }
  logger.info(
    { total: giveawayTableStatements.length, success: giveawaySuccess, failure: giveawayFailure },
    'auto-migrate: GIVEAWAY/STREAK/TEAM-JOIN SUMMARY',
  );
  if (giveawayFailure > 0) {
    logger.error(
      { failures: giveawayFailures },
      'auto-migrate: GIVEAWAY TABLE CREATION HAD FAILURES — giveaway endpoints may 500. See /api/giveaway/diagnose-public for details.',
    );
  }

  // POST-MIGRATION VERIFICATION — query information_schema to confirm the
  // tables ACTUALLY exist (the CREATE TABLE could have failed silently even
  // if no error was thrown, e.g. due to a connection pooler quirk). Log a
  // clear PASS/FAIL for each expected table.
  const expectedGiveawayTables = ['GiveawayRound', 'GiveawayParticipant', 'UserStreak', 'TeamJoinRequest'];
  for (const t of expectedGiveawayTables) {
    try {
      const result = await db.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = current_schema()
          AND table_name = ${t}
        ) as exists
      `;
      const exists = !!result[0]?.exists;
      if (exists) {
        logger.info({ table: t }, 'auto-migrate: VERIFY table exists ✓');
      } else {
        logger.error({ table: t }, 'auto-migrate: VERIFY table MISSING ✗ — giveaway endpoints will 500!');
      }
    } catch (err) {
      logger.error({ table: t, err: String(err).slice(0, 200) }, 'auto-migrate: VERIFY failed to check table existence');
    }
  }

  for (const sql of chatTableStatements) {
    try {
      await db.$executeRawUnsafe(sql);
      logger.info({ sql: sql.slice(0, 100) }, 'auto-migrate: applied chat table');
    } catch (err) {
      logger.warn({ err: String(err).slice(0, 200), sql: sql.slice(0, 100) }, 'auto-migrate: chat table skipped');
    }
  }

  for (const sql of [...statements, ...constraintStatements, ...tableStatements]) {
    try {
      await db.$executeRawUnsafe(sql);
      logger.info({ sql: sql.slice(0, 100) }, 'auto-migrate: applied');
    } catch (err) {
      // Log but don't crash — the column might already exist, the constraint
      // might already be in the desired state, or the DB user might lack
      // ALTER permission (in which case the deploy must run `prisma db push`
      // manually).
      logger.warn({ err: String(err).slice(0, 200), sql: sql.slice(0, 100) }, 'auto-migrate: skipped');
    }
  }
}

async function main() {
  await autoMigrate();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
