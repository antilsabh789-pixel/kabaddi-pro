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
  ];

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
