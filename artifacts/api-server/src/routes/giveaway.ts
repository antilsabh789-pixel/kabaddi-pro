import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { db } from '../lib/db';

const router = Router();

const ROUND_DURATION_DAYS = 15;
const PRIZES = [
  { rank: 1, name: '1kg Protein Powder', icon: '🥇' },
  { rank: 2, name: 'Kabaddi Kit', icon: '🥈' },
  { rank: 3, name: 'Shaker Water Bottle (Kabaddi Pro Branded)', icon: '🥉' },
];

/**
 * ₹2 giveaway entry fee (in paise — Cashfree expects integer paise).
 * This is the ONLY payment in the app now — every other feature is free.
 */
const GIVEAWAY_ENTRY_FEE_PAISE = 200; // ₹2.00
const GIVEAWAY_ENTRY_FEE_INR = '2.00';

/**
 * Cashfree config (mirrored from payments.ts so this route can create + verify
 * its own ₹2 orders without reaching into another router's private helper).
 */
function getCashfreeConfig() {
  const cashfreeIsLive = process.env['CASHFREE_IS_LIVE'];
  const cashfreeEnv = process.env['CASHFREE_ENV'];
  const isProduction = cashfreeIsLive === 'true' || cashfreeIsLive === '1' || cashfreeEnv === 'production';
  return {
    appId: (process.env['CASHFREE_APP_ID'] || '').trim(),
    secretKey: (process.env['CASHFREE_SECRET_KEY'] || '').trim(),
    apiVersion: process.env['CASHFREE_API_VERSION'] || '2023-08-01',
    baseUrl: isProduction ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
    env: isProduction ? 'production' : 'sandbox',
    isProduction,
  };
}

/**
 * Build an ABSOLUTE return URL for Cashfree to redirect back to after payment.
 *
 * Cashfree's /orders API REJECTS relative URLs with HTTP 422, which silently
 * broke the ₹2 giveaway entry-fee flow whenever APP_URL was not set (the
 * common case in Replit deployments). This helper resolves the public origin
 * from, in priority order:
 *   1. The explicit returnUrl passed by the caller (if absolute)
 *   2. process.env.APP_URL
 *   3. The `Origin` request header (sent by browsers on same-origin POSTs)
 *   4. The `Referer` request header (always sent by browsers)
 *   5. req.protocol + req.host as a last resort
 *
 * The `{order_id}` placeholder is preserved so Cashfree can substitute the
 * real order id into the redirect URL.
 */
function buildAbsoluteReturnUrl(req: any, pathWithQuery: string, explicitReturnUrl?: string): string {
  // 1. Caller-supplied absolute URL wins.
  if (explicitReturnUrl && /^https?:\/\//i.test(explicitReturnUrl)) {
    return explicitReturnUrl;
  }

  // 2. APP_URL env var.
  const appUrl = (process.env['APP_URL'] || '').trim().replace(/\/+$/, '');
  if (appUrl) {
    return `${appUrl}${pathWithQuery}`;
  }

  // 3. Origin header (most reliable browser-sent header for the public origin).
  const origin = (req?.get?.('origin') || '').trim();
  if (origin && origin !== 'null') {
    return `${origin}${pathWithQuery}`;
  }

  // 4. Referer header — strip the path, keep scheme+host.
  const referer = (req?.get?.('referer') || '').trim();
  if (referer) {
    try {
      const u = new URL(referer);
      return `${u.origin}${pathWithQuery}`;
    } catch { /* fall through */ }
  }

  // 5. req.protocol + req.host — least reliable (may be the proxy's host),
  //    but better than emitting a relative URL that Cashfree will reject.
  const proto = (req?.protocol || 'https');
  const host = (req?.get?.('host') || req?.get?.('x-forwarded-host') || '').trim();
  if (host) {
    return `${proto}://${host}${pathWithQuery}`;
  }

  // Last-ditch fallback — emit the relative URL. Cashfree will likely reject
  // it, but at least we tried everything else first.
  return pathWithQuery;
}

/**
 * Get or create the active giveaway round.
 */
async function getOrCreateActiveRound() {
  const now = new Date();
  let round = await withSelfHeal(() =>
    db.giveawayRound.findFirst({
      where: { status: 'active' },
      orderBy: { roundNumber: 'desc' },
    }),
  );

  if (!round) {
    const lastRound = await withSelfHeal(() =>
      db.giveawayRound.findFirst({ orderBy: { roundNumber: 'desc' } }),
    );
    const nextNumber = (lastRound?.roundNumber || 0) + 1;
    const startDate = now;
    const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
    round = await withSelfHeal(() =>
      db.giveawayRound.create({
        data: { roundNumber: nextNumber, startDate, endDate, status: 'active' },
      }),
    );
  }
  // IMPORTANT: Do NOT auto-complete the round or auto-create the next round
  // when the timer expires. The admin must manually select winners first.
  // The round stays 'active' even after endDate so the admin can see
  // "Round ended — select winners" in the UI. Once the admin calls
  // POST /giveaway/admin/select-winners, THAT endpoint marks the round as
  // 'completed' and creates the next round.
  return round;
}

/**
 * Sanitize a Prisma/DB error for return to the client.
 *
 * Returns a SHORT, human-readable hint about what's wrong so the frontend
 * can show a useful toast instead of the generic "Internal server error".
 *
 * Strategy: check Prisma's structured error code FIRST (most reliable), then
 * fall back to regex pattern matching on the message (covers raw Postgres
 * errors that bypass Prisma's classification).
 *
 * Prisma error codes we care about:
 *   P2021 — The table `X` does not exist in the current database  ← OUR MAIN ISSUE
 *   P2022 — The column `X` does not exist in the current database
 *   P2024 — Timed out fetching a connection from the pool
 *   P2003 — Foreign key constraint failed
 *   P2002 — Unique constraint failed
 *   P2009 — Query validation error (schema mismatch)
 *   P2010 — Raw query failed
 *   P1001—P1017 — Connection / initialization errors
 *
 * Raw Postgres error messages (when the SQL bypasses Prisma, e.g. in
 * $executeRawUnsafe) use DIFFERENT wording:
 *   - "relation \"X\" does not exist" (with double quotes — Postgres style)
 *   - "column \"X\" does not exist"
 *   - "permission denied for table X"
 *
 * NOTE: we deliberately DON'T return the raw Prisma message verbatim because
 * it includes the full SQL/invocation context which can leak schema info.
 * But we DO include the error code so support can grep server logs.
 */
function sanitizeDbError(err: unknown): string {
  // 1. Prisma structured errors — check `code` field for reliable detection.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const code = err.code;
    // P2022 has a `meta.column` property naming the missing column — extract it
    // so the user (and we) can see EXACTLY which column needs to be added.
    const meta = err.meta as Record<string, unknown> | undefined;
    switch (code) {
      case 'P2021': {
        const table = meta?.table ? ` (table: ${String(meta.table)})` : '';
        return `DB table missing (Prisma ${code})${table}. Auto-migrate did not create the table. Will self-heal on next request.`;
      }
      case 'P2022': {
        const column = meta?.column ? `: ${String(meta.column)}` : '';
        return `DB column missing (Prisma ${code})${column}. Schema is out of date — please redeploy or run \`prisma db push\`.`;
      }
      case 'P2024':
        return `DB connection pool timeout (Prisma ${code}). Too many concurrent queries.`;
      case 'P2003': {
        const fk = meta?.field_name ? ` (field: ${String(meta.field_name)})` : '';
        return `DB foreign key constraint failed (Prisma ${code})${fk}.`;
      }
      case 'P2002': {
        const target = meta?.target ? ` (target: ${JSON.stringify(meta.target)})` : '';
        return `DB unique constraint failed (Prisma ${code})${target}.`;
      }
      case 'P2009':
        return `DB query validation error (Prisma ${code}). Schema mismatch — run \`prisma db push\`.`;
      case 'P2010':
        return `DB raw query failed (Prisma ${code}).`;
      default:
        return `DB error (Prisma ${code}).`;
    }
  }
  // P1001—P1017 are PrismaClientInitializationError (subclass of KnownRequestError? actually NO — it's a separate class)
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return `DB connection failed (Prisma init). Check DATABASE_URL. Error code: ${err.errorCode || 'unknown'}.`;
  }

  // 2. Fall back to message regex (covers raw Postgres errors from $executeRawUnsafe).
  const msg = err instanceof Error ? err.message : String(err);
  if (/relation ".*" does not exist/i.test(msg)) {
    return 'DB table missing (raw Postgres). Auto-migrate did not create the table.';
  }
  if (/The table `.*` does not exist/i.test(msg)) {
    return 'DB table missing (Prisma P2021 wording). Auto-migrate did not create the table.';
  }
  if (/column ".*" does not exist/i.test(msg) || /The column `.*` does not exist/i.test(msg)) {
    return 'DB column missing. Schema is out of date.';
  }
  if (/permission denied/i.test(msg)) {
    return 'DB permission denied. User lacks required privileges.';
  }
  if (/syntax error/i.test(msg)) {
    return 'DB syntax error.';
  }
  if (/PrismaClientInitializationError/i.test(msg) || /DATABASE_URL/i.test(msg)) {
    return 'DB connection failed — check DATABASE_URL.';
  }
  if (/connect\s+ECONNREFUSED/i.test(msg) || /Can't reach database server/i.test(msg)) {
    return 'DB server unreachable.';
  }
  // Last resort — return first 180 chars so we can see the actual error.
  // We bumped this from 100 → 180 because the original 100-char limit was
  // truncating the error right at "Invalid `db.X.method()` invocation",
  // which told us NOTHING about the underlying cause. 180 chars is enough
  // to see the Prisma error code AND the first sentence of the actual
  // error, while still avoiding huge SQL dumps.
  return msg.slice(0, 180);
}

/**
 * Self-heal: try to CREATE the giveaway tables on-the-fly if they don't exist.
 *
 * This is a RUNTIME fallback that runs INSIDE the request handler when
 * Prisma throws P2021 (table does not exist). The auto-migrate on boot is
 * supposed to handle this, but if it fails silently (e.g. the DB user lacks
 * CREATE permission, or the connection pooler blocks DDL), we end up here.
 *
 * We try each CREATE TABLE statement individually and swallow errors. After
 * the attempt, the caller can retry the original query.
 *
 * Returns true if ANY table was actually created (i.e. we should retry).
 */
async function selfHealGiveawayTables(): Promise<boolean> {
  const statements = [
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
  ];
  let createdAny = false;
  for (const sql of statements) {
    try {
      await db.$executeRawUnsafe(sql);
      createdAny = true;
    } catch {
      // swallow — we'll let the retry fail with the original P2021 if needed
    }
  }
  return createdAny;
}

/**
 * Wrap a giveaway DB operation with self-healing.
 *
 * If the first attempt throws P2021 (table missing), we try to CREATE the
 * tables and retry ONCE. If the retry still fails, we throw the original
 * error so the caller's catch block handles it.
 */
async function withSelfHeal<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    const isTableMissing =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021';
    const msg = err instanceof Error ? err.message : String(err);
    const msgLooksMissing = /does not exist/i.test(msg);
    if (!isTableMissing && !msgLooksMissing) throw err;
    // Try to self-heal
    const healed = await selfHealGiveawayTables();
    if (!healed) throw err;
    // Retry once
    return await op();
  }
}


/**
 * Count a user's SUCCESSFUL referrals (where someone actually signed up using their code).
 * Each successful referral = 1 giveaway participation entry.
 */
async function countSuccessfulReferrals(userId: string): Promise<number> {
  // A referral is "successful" when referredId is not null (someone signed up using the code)
  return db.referral.count({
    where: { referrerId: userId, referredId: { not: null } },
  });
}

/**
 * Count how many giveaway rounds a user has ALREADY entered using a REFERRAL entry.
 * We track this by writing `entryType='referral'` on referral-funded entries and
 * `entryType='paid'` on ₹2-fee-funded entries. For backward compat with rows
 * created before the entryType column existed (which all have entryType='free'
 * as the default), we also count isPremium=false rows as referral-funded.
 */
async function countReferralEntriesUsed(userId: string): Promise<number> {
  return db.giveawayParticipant.count({
    where: {
      userId,
      OR: [
        { entryType: 'referral' },
        { entryType: 'free', isPremium: false }, // legacy rows
      ],
    },
  });
}

/**
 * Count ALL past participations by this user (referral + paid + premium_direct + free).
 */
async function countAllPastParticipations(userId: string): Promise<number> {
  return db.giveawayParticipant.count({
    where: { userId },
  });
}

/**
 * Determine if a user is a PAID premium subscriber (not a free/streak/referral grant).
 * Used to gate the "premium direct entry" path in the giveaway — paid-premium users
 * get free direct entry to every round, no referral needed.
 *
 * Returns true if:
 *   - premiumPlan is one of the paid plans (daily/weekly/monthly/yearly/lifetime), AND
 *   - premiumExpiry is null (lifetime) OR in the future
 *   - (streak/referral grants are NOT considered paid premium)
 */
async function isPaidPremiumUser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { premiumPlan: true, premiumExpiry: true, isAdmin: true },
  });
  if (!user) return false;
  // Admins always get premium-direct entry (they're effectively lifetime premium).
  if (user.isAdmin) return true;
  const paidPlans = ['daily', 'weekly', 'monthly', 'yearly', 'lifetime'];
  if (!user.premiumPlan || !paidPlans.includes(user.premiumPlan)) return false;
  if (user.premiumPlan === 'lifetime') return true;
  if (!user.premiumExpiry) return false;
  return user.premiumExpiry.getTime() > Date.now();
}

/**
 * GET /api/giveaway/status
 * Returns the current active round, time remaining, participant count, prizes,
 * and the user's eligibility info.
 *
 * NEW RULES (current):
 *   - Every user gets ONE FREE entry the first time they ever participate (lifetime).
 *   - PAID-PREMIUM users (active daily/weekly/monthly/yearly/lifetime plan) get
 *     free DIRECT entry to every round — no referral needed.
 *   - Otherwise, each round requires at least 1 unused successful referral.
 *   - The ₹2 paid-entry path is REMOVED. The ₹2 daily plan still exists for
 *     users who want to BUY 1-day premium (handled by /api/payments/create-order,
 *     NOT by the giveaway).
 */
router.get('/giveaway/status', async (req, res) => {
  try {
    const userId = (req.query['userId'] as string) || '';
    const round = await getOrCreateActiveRound();
    const participantCount = await withSelfHeal(() =>
      db.giveawayParticipant.count({
        where: { giveawayRoundId: round.id },
      }),
    );

    let hasParticipated = false;
    let successfulReferrals = 0;
    let referralEntriesUsed = 0;
    let referralEntriesRemaining = 0;
    let canParticipate = false;
    let blockReason = '';
    let freeEntryAvailable = false;
    let hasUsedFreeEntry = false;
    let isPremiumUser = false;
    let premiumDirectEntryAvailable = false;

    if (userId) {
      const existing = await db.giveawayParticipant.findUnique({
        where: { giveawayRoundId_userId: { giveawayRoundId: round.id, userId } },
      });
      hasParticipated = !!existing;

      successfulReferrals = await countSuccessfulReferrals(userId);
      referralEntriesUsed = await countReferralEntriesUsed(userId);
      referralEntriesRemaining = Math.max(0, successfulReferrals - referralEntriesUsed);

      // Every user gets 1 LIFETIME FREE entry (no referral, no premium).
      const totalPastParticipations = await countAllPastParticipations(userId);
      hasUsedFreeEntry = totalPastParticipations > 0;
      freeEntryAvailable = !hasUsedFreeEntry;

      // PAID-PREMIUM users get free direct entry to every round.
      isPremiumUser = await isPaidPremiumUser(userId);
      premiumDirectEntryAvailable = isPremiumUser;

      // Participation rules (evaluated in priority order):
      // 1. Already in this round → blocked
      // 2. Free entry available → allowed (one-time lifetime free entry)
      // 3. Paid-premium user → allowed (premium direct entry, no referral needed)
      // 4. Referral entries remaining → allowed (referral path)
      // 5. Otherwise → blocked. (The ₹2 paid-entry path was removed.)
      if (hasParticipated) {
        canParticipate = false;
        blockReason = 'already_participated';
      } else if (freeEntryAvailable) {
        canParticipate = true;
        blockReason = '';
      } else if (premiumDirectEntryAvailable) {
        canParticipate = true;
        blockReason = '';
      } else if (referralEntriesRemaining > 0) {
        canParticipate = true;
        blockReason = ''; // referral path available
      } else {
        // No free entry, no premium, no referral entries left.
        // Tell the user they need either premium or a referral.
        canParticipate = false;
        blockReason = 'referral_or_premium_required';
      }
    }

    // Get past winners (player codes only)
    const completedRounds = await db.giveawayRound.findMany({
      where: { status: 'completed', winnersJson: { not: null } },
      orderBy: { roundNumber: 'desc' },
      take: 5,
    });

    const pastWinners: any[] = [];
    for (const cr of completedRounds) {
      try {
        const winnerIds: string[] = JSON.parse(cr.winnersJson || '[]');
        const winners = await db.user.findMany({
          where: { id: { in: winnerIds } },
          select: { id: true, playerCode: true },
        });
        for (let i = 0; i < winnerIds.length; i++) {
          const w = winners.find(u => u.id === winnerIds[i]);
          if (w) {
            pastWinners.push({
              roundId: cr.id,
              roundNumber: cr.roundNumber,
              rank: i + 1,
              playerId: w.playerCode || w.id.slice(-6),
              prize: PRIZES[i]?.name || 'Prize',
            });
          }
        }
      } catch { /* skip parse errors */ }
    }

    return res.json({
      round: {
        id: round.id,
        roundNumber: round.roundNumber,
        startDate: round.startDate,
        endDate: round.endDate,
        status: round.status,
        hasEnded: new Date(round.endDate) < new Date(), // true if timer expired
      },
      prizes: PRIZES,
      participantCount,
      hasParticipated,
      // Eligibility info for the current user
      successfulReferrals,
      referralEntriesUsed,
      referralEntriesRemaining,
      freeEntryAvailable, // true if user hasn't used their 1 lifetime free entry
      hasUsedFreeEntry,
      isPremiumUser, // true if user has an active paid-premium plan (or is admin)
      premiumDirectEntryAvailable, // true if user can enter this round free via premium
      canParticipate,
      blockReason, // '', 'already_participated', 'referral_or_premium_required'
      pastWinners,
    });
  } catch (error) {
    console.error('Giveaway status error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * POST /api/giveaway/participate
 * User joins the current giveaway round using one of:
 *   - 'free'           — one-time lifetime free entry (only if never participated before)
 *   - 'premium_direct' — paid-premium users get free direct entry to every round
 *   - 'referral'       — consumes 1 successful-referral slot
 *
 * The ₹2 paid-entry path is REMOVED. Users who want premium can buy it via
 * /api/payments/create-order (daily plan = ₹2 for 1 day).
 *
 * The `entryType` field on GiveawayParticipant records which path was used.
 * The legacy `isPremium` boolean is also set for backward compat with old admin queries:
 *   - isPremium=false for free / referral / premium_direct (none of these are ₹2-paid)
 *   - isPremium=true only for legacy 'paid' rows created before this refactor
 */
router.post('/giveaway/participate', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, name: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const round = await getOrCreateActiveRound();

    // Check if already participating in this round
    const existing = await db.giveawayParticipant.findUnique({
      where: { giveawayRoundId_userId: { giveawayRoundId: round.id, userId } },
    });
    if (existing) return res.status(409).json({ error: 'Already participating in this round' });

    // Determine entry path in priority order:
    // 1. FREE ENTRY: 1 lifetime free entry for brand-new users.
    // 2. PREMIUM DIRECT: paid-premium users get free direct entry to every round.
    // 3. REFERRAL: consumes 1 successful-referral slot.
    // 4. Otherwise → reject. Tell the user to either buy premium or refer a friend.
    const totalPastParticipations = await countAllPastParticipations(userId);
    const freeEntryAvailable = totalPastParticipations === 0;
    let chosenEntryType: 'free' | 'premium_direct' | 'referral';

    if (freeEntryAvailable) {
      chosenEntryType = 'free';
    } else if (await isPaidPremiumUser(userId)) {
      chosenEntryType = 'premium_direct';
    } else {
      const successfulReferrals = await countSuccessfulReferrals(userId);
      const referralEntriesUsed = await countReferralEntriesUsed(userId);
      const referralEntriesRemaining = Math.max(0, successfulReferrals - referralEntriesUsed);
      if (referralEntriesRemaining <= 0) {
        return res.status(403).json({
          error: 'No free entry, no premium, and no referral entries left. Buy premium (₹2 for 1 day) or refer a friend to participate.',
          blockReason: 'referral_or_premium_required',
          successfulReferrals,
          referralEntriesRemaining: 0,
        });
      }
      chosenEntryType = 'referral';
    }

    // Create the participant record. isPremium=false for all new paths
    // (the legacy isPremium=true was only ever set by the removed ₹2 paid flow).
    await db.giveawayParticipant.create({
      data: {
        giveawayRoundId: round.id,
        userId: user.id,
        phone: user.phone,
        name: user.name,
        isPremium: false,
        entryType: chosenEntryType,
      },
    });

    const participantCount = await db.giveawayParticipant.count({
      where: { giveawayRoundId: round.id },
    });

    const successfulReferrals = await countSuccessfulReferrals(userId);
    const referralEntriesUsed = await countReferralEntriesUsed(userId);
    const referralEntriesRemaining = Math.max(0, successfulReferrals - referralEntriesUsed);

    return res.json({
      success: true,
      participantCount,
      freeEntryAvailable: false, // just used it (either the lifetime free one, premium direct, or a referral slot)
      referralEntriesRemaining,
      entryFundedBy: chosenEntryType,
    });
  } catch (error) {
    console.error('Giveaway participate error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * POST /api/giveaway/create-entry-order
 * Creates a Cashfree order for the ₹2 giveaway entry fee.
 *
 * Body: { userId, returnUrl? }
 * Returns: { orderId, paymentSessionId, cfOrderId, amount, env }
 *
 * The frontend redirects to Cashfree's hosted checkout using the session id.
 * On success, Cashfree redirects back to returnUrl with ?order_id=...
 * The frontend then calls /giveaway/verify-entry-payment to confirm + auto-enter the round.
 */
router.post('/giveaway/create-entry-order', async (req, res) => {
  try {
    const { userId, returnUrl } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const round = await getOrCreateActiveRound();

    // Refuse if already in this round — no need to charge them again.
    const existing = await db.giveawayParticipant.findUnique({
      where: { giveawayRoundId_userId: { giveawayRoundId: round.id, userId } },
    });
    if (existing) {
      return res.status(409).json({ error: 'You are already participating in this round.' });
    }

    const config = getCashfreeConfig();
    if (!config.appId || !config.secretKey) {
      return res.status(500).json({ error: 'Payment gateway not configured on the server.' });
    }

    const orderId = `KP_GIVEAWAY_${user.id.slice(-6)}_${Date.now()}`;
    const amountInr = GIVEAWAY_ENTRY_FEE_INR;

    const cashfreePayload = {
      order_id: orderId,
      order_amount: parseFloat(amountInr),
      order_currency: 'INR',
      customer_details: {
        customer_id: user.id,
        customer_name: user.name || 'Kabaddi Pro User',
        customer_phone: (user.phone || '').replace(/\D/g, '').slice(-10),
        customer_email: user.email || `${user.id}@kabaddipro.app`,
      },
      order_meta: {
        // Cashfree REJECTS relative URLs with HTTP 422 — use the helper to
        // resolve an absolute origin from APP_URL or the request headers.
        return_url: buildAbsoluteReturnUrl(
          req,
          '/?giveaway_payment=success&order_id={order_id}',
          returnUrl,
        ),
      },
      order_note: `Giveaway Round ${round.roundNumber} entry fee`,
    };

    const cfResponse = await fetch(`${config.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cashfreePayload),
    });

    if (!cfResponse.ok) {
      const err = await cfResponse.text();
      console.error('Cashfree giveaway order creation failed:', {
        status: cfResponse.status,
        body: err,
        env: config.env,
        hasAppId: !!config.appId,
        hasSecretKey: !!config.secretKey,
        returnUrl: cashfreePayload.order_meta.return_url,
      });
      // Surface a useful error to the frontend so the user sees WHY the
      // payment failed to start (instead of a vague "Could not start payment").
      let friendlyError = 'Payment gateway error.';
      if (cfResponse.status === 401 || cfResponse.status === 403) {
        friendlyError = 'Payment gateway credentials are invalid. Please contact support.';
      } else if (cfResponse.status === 422) {
        friendlyError = 'Payment request rejected by gateway (likely a bad return URL). Please contact support.';
      }
      return res.status(502).json({
        error: friendlyError,
        details: err.slice(0, 500),
        cfStatus: cfResponse.status,
      });
    }

    const cfOrder = await cfResponse.json() as { payment_session_id?: string; cf_order_id?: string };

    // Persist the order so /verify-entry-payment can find it. The `plan` field
    // is reused as 'giveaway_entry' to distinguish from the legacy premium plans.
    await db.payment.create({
      data: {
        userId: user.id,
        cashfreeOrderId: orderId,
        plan: 'giveaway_entry',
        amount: GIVEAWAY_ENTRY_FEE_PAISE,
        status: 'pending',
      },
    });

    return res.json({
      orderId,
      paymentSessionId: cfOrder.payment_session_id,
      sessionId: cfOrder.payment_session_id,
      cfOrderId: cfOrder.cf_order_id,
      amount: amountInr,
      env: config.env,
    });
  } catch (error) {
    console.error('Giveaway create-entry-order error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/giveaway/payment-diagnose
 * Returns the Cashfree configuration status so the frontend can show a useful
 * error if the gateway isn't set up. Mirrors /payments/diagnose but is scoped
 * to the giveaway route so the giveaway UI doesn't need to know about the
 * premium-payments route.
 */
router.get('/giveaway/payment-diagnose', async (req, res) => {
  const config = getCashfreeConfig();
  // Echo back what return_url WOULD be resolved to, so the frontend can show
  // it to the user / developer for debugging.
  const sampleReturnUrl = buildAbsoluteReturnUrl(req, '/?giveaway_payment=success&order_id={order_id}');
  return res.json({
    env: config.env,
    hasAppId: !!config.appId,
    hasSecretKey: !!config.secretKey,
    baseUrl: config.baseUrl,
    appUrlSet: !!process.env['APP_URL'],
    sampleReturnUrl,
    isAbsolute: /^https?:\/\//i.test(sampleReturnUrl),
  });
});

/**
 * POST /api/giveaway/verify-entry-payment
 * Verifies a ₹2 Cashfree order, marks the Payment as paid, AND auto-enters the user
 * into the current giveaway round as a paid entry (isPremium=true on the participant row).
 *
 * Body: { orderId }
 * Returns: { success, participantCount, entryFundedBy: 'paid' }
 */
router.post('/giveaway/verify-entry-payment', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });

    const payment = await db.payment.findUnique({ where: { cashfreeOrderId: orderId } });
    if (!payment) return res.status(400).json({ error: 'Payment order not found' });
    if (payment.plan !== 'giveaway_entry') {
      return res.status(400).json({ error: 'This order is not a giveaway entry fee.' });
    }

    // Already processed (idempotent — return success without re-entering)
    if (payment.status === 'success') {
      const round = await getOrCreateActiveRound();
      const existing = await db.giveawayParticipant.findUnique({
        where: { giveawayRoundId_userId: { giveawayRoundId: round.id, userId: payment.userId } },
      });
      if (existing) {
        return res.json({ success: true, alreadyEntered: true, participantCount: await db.giveawayParticipant.count({ where: { giveawayRoundId: round.id } }) });
      }
    }

    const config = getCashfreeConfig();
    const cfResponse = await fetch(`${config.baseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
      },
    });

    if (!cfResponse.ok) {
      const errBody = await cfResponse.text().catch(() => '');
      console.error('Giveaway verify-entry-payment: Cashfree GET /orders failed:', {
        status: cfResponse.status,
        body: errBody.slice(0, 300),
        orderId,
      });
      return res.status(502).json({
        error: 'Could not verify payment with gateway.',
        cfStatus: cfResponse.status,
      });
    }
    const cfOrder = await cfResponse.json() as { order_status?: string; [k: string]: unknown };

    if (cfOrder.order_status !== 'PAID') {
      // Map Cashfree's order_status to a human-readable reason so the frontend
      // toast tells the user WHY the payment didn't go through. Without this,
      // the user just sees "Payment could not be verified" which is unhelpful.
      const statusMessages: Record<string, string> = {
        'ACTIVE': 'Payment was started but not completed. The Cashfree page may have been closed before payment.',
        'EXPIRED': 'Payment session expired before completion. Please try again.',
        'FAILED': 'Payment failed at the gateway. Please try again or use a different payment method.',
        'CANCELLED': 'Payment was cancelled.',
        'PENDING': 'Payment is still pending at the gateway. Please wait a moment and re-open the giveaway.',
        'REFUNDED': 'Payment was refunded.',
      };
      const reason = statusMessages[cfOrder.order_status || ''] || `Payment status: ${cfOrder.order_status || 'unknown'}`;
      return res.json({ success: false, status: cfOrder.order_status, reason });
    }

    // Mark the payment as paid.
    await db.payment.update({ where: { id: payment.id }, data: { status: 'success' } });

    // Auto-enter the user into the current round as a paid entry.
    const user = await db.user.findUnique({
      where: { id: payment.userId },
      select: { id: true, phone: true, name: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const round = await getOrCreateActiveRound();
    const existing = await db.giveawayParticipant.findUnique({
      where: { giveawayRoundId_userId: { giveawayRoundId: round.id, userId: user.id } },
    });
    if (!existing) {
      await db.giveawayParticipant.create({
        data: {
          giveawayRoundId: round.id,
          userId: user.id,
          phone: user.phone,
          name: user.name,
          isPremium: true, // paid entry — distinguished from referral-funded entries
        },
      });
    }

    const participantCount = await db.giveawayParticipant.count({
      where: { giveawayRoundId: round.id },
    });

    return res.json({
      success: true,
      alreadyEntered: !!existing,
      participantCount,
      entryFundedBy: 'paid',
    });
  } catch (error) {
    console.error('Giveaway verify-entry-payment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/giveaway/diagnose-public
 * NO AUTH — runs the same DB probes as /admin/diagnose but does NOT require
 * an adminId. Intentionally public so we can curl Railway directly from a
 * laptop to see what's wrong when the admin panel won't open.
 *
 * Returns: {
 *   ok: boolean,
 *   checks: [{ name, ok, error?, rawError? }],
 *   failingCheck?: string,
 *   hint?: string,
 *   tableVerification?: [{ table, exists }]
 * }
 *
 * The `rawError` field is INCLUDED here (but not in /admin/diagnose) because
 * this endpoint is for debugging only — we need the raw Prisma error code +
 * message to figure out why tables aren't being created.
 */
router.get('/giveaway/diagnose-public', async (req, res) => {
  const checks: { name: string; ok: boolean; error?: string; rawError?: string; code?: string }[] = [];

  // Check 1: User table
  try {
    await db.user.findFirst({ select: { id: true } });
    checks.push({ name: 'user_table', ok: true });
  } catch (err) {
    checks.push({
      name: 'user_table',
      ok: false,
      error: sanitizeDbError(err),
      rawError: err instanceof Error ? err.message.slice(0, 500) : String(err),
      code: err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined,
    });
  }

  // Check 2: GiveawayRound table
  try {
    await db.giveawayRound.findFirst({ select: { id: true } });
    checks.push({ name: 'giveaway_round_table', ok: true });
  } catch (err) {
    checks.push({
      name: 'giveaway_round_table',
      ok: false,
      error: sanitizeDbError(err),
      rawError: err instanceof Error ? err.message.slice(0, 500) : String(err),
      code: err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined,
    });
  }

  // Check 3: GiveawayParticipant table
  try {
    await db.giveawayParticipant.findFirst({ select: { id: true } });
    checks.push({ name: 'giveaway_participant_table', ok: true });
  } catch (err) {
    checks.push({
      name: 'giveaway_participant_table',
      ok: false,
      error: sanitizeDbError(err),
      rawError: err instanceof Error ? err.message.slice(0, 500) : String(err),
      code: err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined,
    });
  }

  // Check 4: Referral table
  try {
    await db.referral.findFirst({ select: { id: true } });
    checks.push({ name: 'referral_table', ok: true });
  } catch (err) {
    checks.push({
      name: 'referral_table',
      ok: false,
      error: sanitizeDbError(err),
      rawError: err instanceof Error ? err.message.slice(0, 500) : String(err),
      code: err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined,
    });
  }

  // Check 5: getOrCreateActiveRound (exercises GiveawayRound fully)
  try {
    await getOrCreateActiveRound();
    checks.push({ name: 'get_or_create_active_round', ok: true });
  } catch (err) {
    checks.push({
      name: 'get_or_create_active_round',
      ok: false,
      error: sanitizeDbError(err),
      rawError: err instanceof Error ? err.message.slice(0, 500) : String(err),
      code: err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined,
    });
  }

  // Check 6: Verify tables exist via information_schema (raw SQL — bypasses Prisma)
  const tableVerification: { table: string; exists: boolean }[] = [];
  const expectedTables = ['User', 'GiveawayRound', 'GiveawayParticipant', 'Referral', 'UserStreak', 'TeamJoinRequest'];
  for (const t of expectedTables) {
    try {
      const result = await db.$queryRaw<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = current_schema()
          AND table_name = ${t}
        ) as exists
      `;
      tableVerification.push({ table: t, exists: !!result[0]?.exists });
    } catch (err) {
      tableVerification.push({ table: t, exists: false });
    }
  }

  // Check 7: Current DB user + permissions (debug)
  let dbUserInfo: { user?: string; dbName?: string; canCreateTable?: boolean; error?: string } = {};
  try {
    const sessionInfo = await db.$queryRaw<{ user: string; db: string }[]>`SELECT current_user as user, current_database() as db`;
    dbUserInfo.user = sessionInfo[0]?.user;
    dbUserInfo.dbName = sessionInfo[0]?.db;
    // Try to actually CREATE a temp table to verify CREATE permission
    try {
      await db.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "_giveaway_diagnose_test" (id TEXT)');
      await db.$executeRawUnsafe('DROP TABLE IF EXISTS "_giveaway_diagnose_test"');
      dbUserInfo.canCreateTable = true;
    } catch (err) {
      dbUserInfo.canCreateTable = false;
      dbUserInfo.error = err instanceof Error ? err.message.slice(0, 200) : String(err);
    }
  } catch (err) {
    dbUserInfo.error = err instanceof Error ? err.message.slice(0, 200) : String(err);
  }

  const failing = checks.find(c => !c.ok);
  return res.json({
    ok: !failing,
    checks,
    failingCheck: failing?.name,
    hint: failing?.error,
    rawHint: failing?.rawError,
    prismaCode: failing?.code,
    tableVerification,
    dbUserInfo,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/giveaway/admin/diagnose
 * ADMIN ONLY — runs a series of DB probes and reports the FIRST one that
 * fails. Used by the GiveawayScreen admin panel to show a useful error
 * message instead of the generic "Internal server error" when something
 * is wrong with the database schema/tables.
 *
 * Returns: {
 *   ok: boolean,
 *   checks: [{ name, ok, error? }],
 *   failingCheck?: string,  // name of the first failing check
 *   hint?: string           // human-readable hint for the failing check
 * }
 */
router.get('/giveaway/admin/diagnose', async (req, res) => {
  const adminId = (req.query['adminId'] as string) || '';
  const checks: { name: string; ok: boolean; error?: string }[] = [];

  // Check 1: User table + isAdmin column
  try {
    if (adminId) {
      const admin = await db.user.findUnique({
        where: { id: adminId },
        select: { isAdmin: true },
      });
      if (!admin) {
        checks.push({ name: 'user_lookup', ok: false, error: 'Admin user not found' });
      } else if (!admin.isAdmin) {
        checks.push({ name: 'user_lookup', ok: false, error: 'User is not an admin' });
      } else {
        checks.push({ name: 'user_lookup', ok: true });
      }
    } else {
      // Just verify the table is queryable
      await db.user.findFirst({ select: { id: true } });
      checks.push({ name: 'user_lookup', ok: true });
    }
  } catch (err) {
    checks.push({ name: 'user_lookup', ok: false, error: sanitizeDbError(err) });
  }

  // Check 2: GiveawayRound table
  try {
    await db.giveawayRound.findFirst({ select: { id: true } });
    checks.push({ name: 'giveaway_round_table', ok: true });
  } catch (err) {
    checks.push({ name: 'giveaway_round_table', ok: false, error: sanitizeDbError(err) });
  }

  // Check 3: GiveawayParticipant table
  try {
    await db.giveawayParticipant.findFirst({ select: { id: true } });
    checks.push({ name: 'giveaway_participant_table', ok: true });
  } catch (err) {
    checks.push({ name: 'giveaway_participant_table', ok: false, error: sanitizeDbError(err) });
  }

  // Check 4: Referral table
  try {
    await db.referral.findFirst({ select: { id: true } });
    checks.push({ name: 'referral_table', ok: true });
  } catch (err) {
    checks.push({ name: 'referral_table', ok: false, error: sanitizeDbError(err) });
  }

  // Check 5: getOrCreateActiveRound (exercises GiveawayRound fully)
  try {
    await getOrCreateActiveRound();
    checks.push({ name: 'get_or_create_active_round', ok: true });
  } catch (err) {
    checks.push({ name: 'get_or_create_active_round', ok: false, error: sanitizeDbError(err) });
  }

  const failing = checks.find(c => !c.ok);
  return res.json({
    ok: !failing,
    checks,
    failingCheck: failing?.name,
    hint: failing?.error,
  });
});

/**
 * GET /api/giveaway/admin/participants
 * ADMIN ONLY — returns all participants with contact info for the current round.
 */
router.get('/giveaway/admin/participants', async (req, res) => {
  try {
    const adminId = (req.query['adminId'] as string) || '';
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true, phone: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const round = await getOrCreateActiveRound();
    const participants = await withSelfHeal(() =>
      db.giveawayParticipant.findMany({
        where: { giveawayRoundId: round.id },
        include: {
          user: { select: { id: true, playerCode: true, name: true, phone: true, isPremium: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );

    return res.json({
      round: { id: round.id, roundNumber: round.roundNumber, endDate: round.endDate },
      participants: participants.map(p => ({
        id: p.id,
        userId: p.user.id,
        playerCode: p.user.playerCode,
        name: p.user.name,
        phone: p.user.phone,
        isPremium: p.user.isPremium,
        joinedAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error('Giveaway admin participants error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * GET /api/giveaway/admin/all-participants?adminId=...
 * ADMIN ONLY — returns participants from EVERY round (current + completed),
 * grouped by round. Use this in the admin panel so the admin can see all
 * users who have ever entered the giveaway, even after winners have been
 * selected for a round.
 *
 * Response shape:
 *   {
 *     rounds: [{
 *       id, roundNumber, status, startDate, endDate,
 *       winnerIds: string[],            // [] if no winners selected yet
 *       participants: [{
 *         id, userId, playerCode, name, phone, isPremium, joinedAt, isWinner
 *       }]
 *     }],
 *     totalParticipants: number,       // sum across all rounds
 *     uniqueParticipants: number       // distinct users across all rounds
 *   }
 */
router.get('/giveaway/admin/all-participants', async (req, res) => {
  try {
    const adminId = (req.query['adminId'] as string) || '';
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Fetch every round, newest first, with its participants.
    const rounds = await db.giveawayRound.findMany({
      orderBy: { roundNumber: 'desc' },
      include: {
        participants: {
          include: {
            user: { select: { id: true, playerCode: true, name: true, phone: true, isPremium: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const roundsPayload = rounds.map((r) => {
      const winnerIds: string[] = r.winnersJson ? (() => {
        try { return JSON.parse(r.winnersJson) as string[]; } catch { return []; }
      })() : [];

      const winnerSet = new Set(winnerIds);

      return {
        id: r.id,
        roundNumber: r.roundNumber,
        status: r.status,
        startDate: r.startDate,
        endDate: r.endDate,
        winnerIds,
        participants: r.participants.map((p) => ({
          id: p.id,
          userId: p.user.id,
          playerCode: p.user.playerCode,
          name: p.user.name,
          phone: p.user.phone,
          isPremium: p.user.isPremium,
          joinedAt: p.createdAt,
          isWinner: winnerSet.has(p.user.id),
        })),
      };
    });

    const totalParticipants = roundsPayload.reduce((sum, r) => sum + r.participants.length, 0);
    const uniqueUserIdSet = new Set<string>();
    for (const r of roundsPayload) {
      for (const p of r.participants) uniqueUserIdSet.add(p.userId);
    }

    return res.json({
      rounds: roundsPayload,
      totalParticipants,
      uniqueParticipants: uniqueUserIdSet.size,
    });
  } catch (error) {
    console.error('Giveaway admin all-participants error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * GET /api/giveaway/admin/pending-rounds?adminId=...
 * ADMIN ONLY — returns all completed rounds that have NO winners selected yet.
 * Used to let the admin select winners for past rounds that were auto-completed.
 */
router.get('/giveaway/admin/pending-rounds', async (req, res) => {
  try {
    const adminId = (req.query['adminId'] as string) || '';
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Find all rounds that are completed but have no winners (winnersJson is null)
    const pendingRounds = await db.giveawayRound.findMany({
      where: {
        status: 'completed',
        winnersJson: null,
      },
      orderBy: { roundNumber: 'desc' },
      include: {
        _count: { select: { participants: true } },
      },
    });

    return res.json({
      rounds: pendingRounds.map(r => ({
        id: r.id,
        roundNumber: r.roundNumber,
        startDate: r.startDate,
        endDate: r.endDate,
        participantCount: r._count.participants,
      })),
    });
  } catch (error) {
    console.error('Giveaway pending rounds error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * POST /api/giveaway/admin/select-winners
 * ADMIN ONLY — Randomly selects 3 winners from the current round.
 *
 * IMPORTANT: Winners are selected from ALL participants of the round, regardless of
 * their CURRENT premium status. A user who bought a ₹2 daily premium, participated,
 * and then had their premium expire is STILL eligible to win — their participation
 * was locked in at the moment they entered. We do NOT re-check premium status here.
 */
router.post('/giveaway/admin/select-winners', async (req, res) => {
  try {
    const { adminId, roundId } = req.body;
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // If roundId is provided, select winners for that specific round (covers
    // past completed rounds that were auto-completed without winners).
    // Otherwise, use the current active round.
    let round;
    let createNextRound = false;

    if (roundId) {
      round = await db.giveawayRound.findUnique({ where: { id: roundId } });
      if (!round) return res.status(404).json({ error: 'Round not found' });
      if (round.winnersJson) return res.status(400).json({ error: 'Winners already selected for this round' });
      // Don't create a next round if we're selecting winners for a past round
      // (the current active round already exists)
      createNextRound = false;
    } else {
      round = await getOrCreateActiveRound();
      // Only create next round if this is the active round (not a past one)
      createNextRound = true;
    }

    // Fetch ALL participants — no premium-status filter. Once a user is in, they're in.
    const participants = await db.giveawayParticipant.findMany({
      where: { giveawayRoundId: round.id },
      include: { user: { select: { id: true, playerCode: true, name: true, phone: true } } },
    });

    if (participants.length < 3) {
      return res.status(400).json({ error: `Need at least 3 participants. Current: ${participants.length}` });
    }

    // Fisher-Yates shuffle — produces a uniform unbiased permutation.
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const winners = shuffled.slice(0, 3);

    const winnerIds = winners.map(w => w.user.id);
    const winnersJson = JSON.stringify(winnerIds);

    await db.giveawayRound.update({
      where: { id: round.id },
      data: { status: 'completed', winnersJson },
    });

    // Only create next round if this was the active round
    if (createNextRound) {
      const nextNumber = round.roundNumber + 1;
      const now = new Date();
      const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
      await db.giveawayRound.create({
        data: { roundNumber: nextNumber, startDate: now, endDate, status: 'active' },
      });
    }

    return res.json({
      success: true,
      winners: winners.map((w, i) => ({
        rank: i + 1,
        prize: PRIZES[i]?.name || 'Prize',
        playerCode: w.user.playerCode || w.user.id.slice(-6),
        name: w.user.name,
        phone: w.user.phone,
        userId: w.user.id,
      })),
    });
  } catch (error) {
    console.error('Giveaway select winners error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * POST /api/giveaway/admin/select-winners-manual
 * ADMIN ONLY — Admin manually picks specific winners by user ID.
 * Body: { adminId, winnerIds: string[], roundId? }
 *
 * Same as select-winners but the admin chooses who wins (no random shuffle).
 * Used when the admin wants to override the random draw or pick specific players.
 */
router.post('/giveaway/admin/select-winners-manual', async (req, res) => {
  try {
    const { adminId, winnerIds, roundId } = req.body;
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!winnerIds || !Array.isArray(winnerIds) || winnerIds.length === 0) {
      return res.status(400).json({ error: 'winnerIds array is required (1-3 winner IDs)' });
    }
    if (winnerIds.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 winners allowed' });
    }

    let round;
    let createNextRound = false;

    if (roundId) {
      round = await db.giveawayRound.findUnique({ where: { id: roundId } });
      if (!round) return res.status(404).json({ error: 'Round not found' });
      if (round.winnersJson) return res.status(400).json({ error: 'Winners already selected for this round' });
      createNextRound = false;
    } else {
      round = await getOrCreateActiveRound();
      createNextRound = true;
    }

    // Verify all winnerIds are participants of this round
    const participants = await db.giveawayParticipant.findMany({
      where: { giveawayRoundId: round.id, userId: { in: winnerIds } },
      include: { user: { select: { id: true, playerCode: true, name: true, phone: true } } },
    });

    if (participants.length !== winnerIds.length) {
      const found = participants.map(p => p.userId);
      const missing = winnerIds.filter((id: string) => !found.includes(id));
      return res.status(400).json({ error: `Some winner IDs are not participants of this round: ${missing.join(', ')}` });
    }

    // Preserve the admin's chosen order (first = rank 1, etc.)
    const orderedWinners = winnerIds.map((id: string) =>
      participants.find(p => p.userId === id)
    ).filter(Boolean);

    const winnersJson = JSON.stringify(winnerIds);

    await db.giveawayRound.update({
      where: { id: round.id },
      data: { status: 'completed', winnersJson },
    });

    if (createNextRound) {
      const nextNumber = round.roundNumber + 1;
      const now = new Date();
      const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
      await db.giveawayRound.create({
        data: { roundNumber: nextNumber, startDate: now, endDate, status: 'active' },
      });
    }

    return res.json({
      success: true,
      winners: orderedWinners.map((w: any, i: number) => ({
        rank: i + 1,
        prize: PRIZES[i]?.name || 'Prize',
        playerCode: w.user.playerCode || w.user.id.slice(-6),
        name: w.user.name,
        phone: w.user.phone,
        userId: w.user.id,
      })),
    });
  } catch (error) {
    console.error('Giveaway manual select winners error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/giveaway/admin/round-participants?adminId=...&roundId=...
 * ADMIN ONLY — returns all participants for a specific round (including past rounds).
 * Used by the 'Change Winners' feature to show who participated.
 */
router.get('/giveaway/admin/round-participants', async (req, res) => {
  try {
    const adminId = (req.query['adminId'] as string) || '';
    const roundId = (req.query['roundId'] as string) || '';
    if (!adminId || !roundId) return res.status(400).json({ error: 'adminId and roundId are required' });

    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const participants = await db.giveawayParticipant.findMany({
      where: { giveawayRoundId: roundId },
      include: {
        user: { select: { id: true, playerCode: true, name: true, phone: true, isPremium: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      participants: participants.map(p => ({
        id: p.id,
        userId: p.user.id,
        playerCode: p.user.playerCode,
        name: p.user.name,
        phone: p.user.phone,
        isPremium: p.user.isPremium,
        joinedAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error('Giveaway round participants error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/giveaway/admin/change-winners
 * ADMIN ONLY — Changes the winners of an already-completed round.
 * Body: { adminId, roundId, winnerIds: string[] }
 *
 * Works on rounds that already have winnersJson set (overwrites it).
 * Does NOT create a next round (the round is already completed).
 * Used when the admin wants to correct or change the winners after
 * they've already been selected.
 */
router.post('/giveaway/admin/change-winners', async (req, res) => {
  try {
    const { adminId, roundId, winnerIds } = req.body;
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!roundId || !winnerIds || !Array.isArray(winnerIds) || winnerIds.length === 0) {
      return res.status(400).json({ error: 'roundId and winnerIds (1-3 IDs) are required' });
    }
    if (winnerIds.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 winners allowed' });
    }

    const round = await db.giveawayRound.findUnique({ where: { id: roundId } });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    if (round.status !== 'completed') return res.status(400).json({ error: 'Round is not completed yet' });

    // Verify all winnerIds are participants of this round
    const participants = await db.giveawayParticipant.findMany({
      where: { giveawayRoundId: roundId, userId: { in: winnerIds } },
      include: { user: { select: { id: true, playerCode: true, name: true, phone: true } } },
    });

    if (participants.length !== winnerIds.length) {
      const found = participants.map(p => p.userId);
      const missing = winnerIds.filter((id: string) => !found.includes(id));
      return res.status(400).json({ error: `Some winner IDs are not participants of this round: ${missing.join(', ')}` });
    }

    // Overwrite the winners
    const winnersJson = JSON.stringify(winnerIds);
    await db.giveawayRound.update({
      where: { id: roundId },
      data: { winnersJson },
    });

    // Return winners in admin's chosen order
    const orderedWinners = winnerIds.map((id: string) =>
      participants.find(p => p.userId === id)
    ).filter(Boolean);

    return res.json({
      success: true,
      message: 'Winners updated successfully',
      winners: orderedWinners.map((w: any, i: number) => ({
        rank: i + 1,
        prize: PRIZES[i]?.name || 'Prize',
        playerCode: w.user.playerCode || w.user.id.slice(-6),
        name: w.user.name,
        phone: w.user.phone,
        userId: w.user.id,
      })),
    });
  } catch (error) {
    console.error('Giveaway change winners error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/giveaway/admin/reset
 * ADMIN ONLY — Starts a fresh giveaway round.
 *
 * IMPORTANT: This does NOT delete past rounds or winners. It only:
 *   1. Marks the current active round as 'completed' (keeps its participants + winners)
 *   2. Creates a new round with the next round number + 15-day countdown
 *
 * Past winners from all previous rounds remain visible in the Past Winners section.
 */
router.post('/giveaway/admin/reset', async (req, res) => {
  try {
    const { adminId } = req.body;
    const admin = await withSelfHeal(() =>
      db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } }),
    );
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // 1. Mark the current active round as 'completed' (don't delete it!)
    //    This preserves its participants and winnersJson for the Past Winners section.
    await withSelfHeal(() =>
      db.giveawayRound.updateMany({
        where: { status: 'active' },
        data: { status: 'completed' },
      }),
    );

    // 2. Create a new round with the next round number + 15-day countdown
    const lastRound = await withSelfHeal(() =>
      db.giveawayRound.findFirst({ orderBy: { roundNumber: 'desc' } }),
    );
    const nextNumber = (lastRound?.roundNumber || 0) + 1;
    const now = new Date();
    const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const newRound = await withSelfHeal(() =>
      db.giveawayRound.create({
        data: { roundNumber: nextNumber, startDate: now, endDate, status: 'active' },
      }),
    );

    return res.json({
      success: true,
      message: `Fresh Round ${nextNumber} started. Past rounds and winners are preserved.`,
      round: {
        id: newRound.id,
        roundNumber: newRound.roundNumber,
        startDate: newRound.startDate,
        endDate: newRound.endDate,
        status: newRound.status,
      },
    });
  } catch (error) {
    console.error('Giveaway reset error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * POST /api/giveaway/admin/force-start-next-round
 * ADMIN ONLY — Force-starts the next round, picking up from where the last
 * round ended. Used when:
 *   - The current round is stuck in an error state
 *   - Round N ended with errors and the admin wants to start Round N+1
 *   - The timer shows 00:00:00:00 because the round expired but wasn't completed
 *
 * Behavior:
 *   1. If there's an active round, mark it as 'completed' (preserves participants
 *      and winnersJson for the Past Winners section).
 *   2. If there's NO completed round with winners, mark it as completed with
 *      winnersJson=null (no winners selected — admin can add them later
 *      via /admin/select-winners-manual).
 *   3. Create a new round with roundNumber = lastRound.roundNumber + 1,
 *      startDate = now, endDate = now + 15 days, status = 'active'.
 *
 * Returns: { success, message, round: { id, roundNumber, startDate, endDate, status } }
 *
 * Body: { adminId: string }
 */
router.post('/giveaway/admin/force-start-next-round', async (req, res) => {
  try {
    const { adminId } = req.body;
    const admin = await withSelfHeal(() =>
      db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } }),
    );
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // 1. Find the current active round (if any)
    const currentActive = await withSelfHeal(() =>
      db.giveawayRound.findFirst({
        where: { status: 'active' },
        orderBy: { roundNumber: 'desc' },
      }),
    );

    let previousRoundInfo: { roundNumber: number; hadWinners: boolean } | null = null;
    if (currentActive) {
      // Mark as completed — preserves the round and its participants
      await withSelfHeal(() =>
        db.giveawayRound.update({
          where: { id: currentActive.id },
          data: {
            status: 'completed',
            // If no winners were selected, leave winnersJson as null
            // (admin can add winners later via /admin/select-winners-manual)
          },
        }),
      );
      previousRoundInfo = {
        roundNumber: currentActive.roundNumber,
        hadWinners: !!currentActive.winnersJson,
      };
    }

    // 2. Find the highest round number (across all statuses) and increment
    const lastRound = await withSelfHeal(() =>
      db.giveawayRound.findFirst({ orderBy: { roundNumber: 'desc' } }),
    );
    const nextNumber = (lastRound?.roundNumber || 0) + 1;
    const now = new Date();
    const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const newRound = await withSelfHeal(() =>
      db.giveawayRound.create({
        data: { roundNumber: nextNumber, startDate: now, endDate, status: 'active' },
      }),
    );

    const message = previousRoundInfo
      ? `Round ${nextNumber} started. Previous Round ${previousRoundInfo.roundNumber} marked as completed${previousRoundInfo.hadWinners ? '' : ' (no winners were selected — you can add them later via Change Winners)'}.`
      : `Round ${nextNumber} started fresh (no previous round was active).`;

    return res.json({
      success: true,
      message,
      previousRound: previousRoundInfo,
      round: {
        id: newRound.id,
        roundNumber: newRound.roundNumber,
        startDate: newRound.startDate,
        endDate: newRound.endDate,
        status: newRound.status,
      },
    });
  } catch (error) {
    console.error('Giveaway force-start-next-round error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * GET /api/giveaway/admin/find-round?adminId=...&roundNumber=...
 * ADMIN ONLY — finds a completed round by round number, returns its ID.
 * Used by Change Winners to find the round ID when it's missing from pastWinners.
 */
router.get('/giveaway/admin/find-round', async (req, res) => {
  try {
    const adminId = (req.query['adminId'] as string) || '';
    const roundNumber = parseInt((req.query['roundNumber'] as string) || '0');
    if (!adminId || !roundNumber) return res.status(400).json({ error: 'adminId and roundNumber are required' });

    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const round = await db.giveawayRound.findFirst({
      where: { roundNumber },
      select: { id: true, roundNumber: true, status: true, winnersJson: true, endDate: true },
    });

    if (!round) return res.status(404).json({ error: `Round ${roundNumber} not found` });

    return res.json({ round });
  } catch (error) {
    console.error('Giveaway find round error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/giveaway/admin/restore-participants
 * ADMIN ONLY — Recreates participant records for a round from a list of player codes.
 * Used when participants were deleted by the old reset (deleteMany) and need to be
 * restored so the system knows they already used their free entry.
 *
 * Body: { adminId, roundId, playerCodes: string[] }
 */
router.post('/giveaway/admin/restore-participants', async (req, res) => {
  try {
    const { adminId, roundId, playerCodes } = req.body;
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!roundId || !playerCodes || !Array.isArray(playerCodes) || playerCodes.length === 0) {
      return res.status(400).json({ error: 'roundId and playerCodes array are required' });
    }

    // Look up users by player codes
    const users = await db.user.findMany({
      where: { playerCode: { in: playerCodes.map((c: string) => c.toUpperCase().trim()) } },
      select: { id: true, playerCode: true, name: true, phone: true },
    });

    if (users.length === 0) {
      return res.status(400).json({ error: 'No users found with those player codes' });
    }

    // Create participant records (skip if already exists).
    // Post-premium-removal: all entries are either referral-funded or paid.
    // For restored historical participants we default isPremium=false
    // (referral-funded) since we have no way to know how they originally
    // entered. The admin can use "Change Winners" if they need to correct
    // anything.
    let created = 0;
    let skipped = 0;
    for (const user of users) {
      const existing = await db.giveawayParticipant.findUnique({
        where: { giveawayRoundId_userId: { giveawayRoundId: roundId, userId: user.id } },
      });
      if (existing) {
        skipped++;
        continue;
      }
      await db.giveawayParticipant.create({
        data: {
          giveawayRoundId: roundId,
          userId: user.id,
          phone: user.phone,
          name: user.name,
          isPremium: false, // referral-funded entry (default for restored participants)
        },
      });
      created++;
    }

    return res.json({
      success: true,
      message: `Restored ${created} participants (${skipped} already existed) for this round.`,
      created,
      skipped,
      totalParticipants: created + skipped,
    });
  } catch (error) {
    console.error('Giveaway restore participants error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/giveaway/admin/restore-round
 * ADMIN ONLY — Recreates a completed round with specific winners.
 * Used to restore rounds that were accidentally deleted by the old reset.
 *
 * Body: { adminId, roundNumber, winnerPlayerCodes: string[], endDate? }
 *   - roundNumber: e.g. 1 for Round 1
 *   - winnerPlayerCodes: array of player codes like ['KP1015', 'KP1025', 'KP1017']
 *   - endDate: optional ISO date string (defaults to 15 days ago)
 */
router.post('/giveaway/admin/restore-round', async (req, res) => {
  try {
    const { adminId, roundNumber, winnerPlayerCodes, endDate } = req.body;
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!roundNumber || !winnerPlayerCodes || !Array.isArray(winnerPlayerCodes) || winnerPlayerCodes.length === 0) {
      return res.status(400).json({ error: 'roundNumber and winnerPlayerCodes array are required' });
    }

    // Check if a round with this number already exists
    const existing = await db.giveawayRound.findFirst({ where: { roundNumber: parseInt(roundNumber) } });
    // If the round exists (with or without winners), we OVERWRITE the winners.
    // This lets the admin change winners even when participants were deleted
    // (Change Winners requires participants, but Restore works by player code).

    // SAFETY: refuse to "restore" the currently-active round. Restore is for
    // recovering completed historical rounds. Restoring the active round would
    // freeze it with whatever winners the admin typed — locking out real
    // participants and skipping the proper select-winners flow that creates
    // the next active round.
    if (existing && existing.status === 'active') {
      return res.status(400).json({
        error: 'Cannot restore the active round. Use "Select Winners" instead — it will close this round AND open the next one.',
      });
    }

    // Look up user IDs for the player codes
    const users = await db.user.findMany({
      where: { playerCode: { in: winnerPlayerCodes.map((c: string) => c.toUpperCase().trim()) } },
      select: { id: true, playerCode: true, name: true },
    });

    if (users.length !== winnerPlayerCodes.length) {
      const found = users.map(u => u.playerCode);
      const missing = winnerPlayerCodes.filter((c: string) => !found.includes(c.toUpperCase().trim()));
      return res.status(400).json({ error: `Could not find users with codes: ${missing.join(', ')}` });
    }

    // Preserve the order of winnerPlayerCodes
    const winnerIds = winnerPlayerCodes.map((code: string) => {
      const user = users.find(u => u.playerCode === code.toUpperCase().trim());
      return user?.id;
    }).filter(Boolean);

    const winnersJson = JSON.stringify(winnerIds);

    // If the round exists (without winners), update it with winners + mark completed
    if (existing) {
      await db.giveawayRound.update({
        where: { id: existing.id },
        data: { status: 'completed', winnersJson },
      });
      return res.json({
        success: true,
        message: `Round ${roundNumber} winners restored.`,
        round: {
          id: existing.id,
          roundNumber: existing.roundNumber,
          winners: users.map((u, i) => ({
            rank: i + 1,
            prize: PRIZES[i]?.name || 'Prize',
            playerCode: u.playerCode,
            name: u.name,
          })),
        },
      });
    }

    // Round doesn't exist — create a new completed round with winners
    const now = new Date();
    const roundEndDate = endDate ? new Date(endDate) : new Date(now.getTime() - ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const roundStartDate = new Date(roundEndDate.getTime() - ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const round = await db.giveawayRound.create({
      data: {
        roundNumber: parseInt(roundNumber),
        startDate: roundStartDate,
        endDate: roundEndDate,
        status: 'completed',
        winnersJson,
      },
    });

    return res.json({
      success: true,
      message: `Round ${roundNumber} restored with ${winnerIds.length} winners.`,
      round: {
        id: round.id,
        roundNumber: round.roundNumber,
        winners: users.map((u, i) => ({
          rank: i + 1,
          prize: PRIZES[i]?.name || 'Prize',
          playerCode: u.playerCode,
          name: u.name,
        })),
      },
    });
  } catch (error) {
    console.error('Giveaway restore round error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
