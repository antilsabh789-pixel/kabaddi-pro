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
