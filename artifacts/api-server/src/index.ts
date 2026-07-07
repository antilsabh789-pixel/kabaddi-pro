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
  ];

  for (const sql of statements) {
    try {
      await db.$executeRawUnsafe(sql);
      logger.info({ sql: sql.slice(0, 80) }, 'auto-migrate: applied');
    } catch (err) {
      // Log but don't crash — the column might already exist, or the DB user
      // might not have ALTER permission (in which case the deploy must run
      // `prisma db push` manually).
      logger.warn({ err, sql: sql.slice(0, 80) }, 'auto-migrate: skipped (already exists or no permission)');
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
