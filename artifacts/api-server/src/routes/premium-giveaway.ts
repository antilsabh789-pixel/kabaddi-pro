import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { db } from '../lib/db';

const router = Router();

// ─── Constants ──────────────────────────────────────────────────────

const ROUND_DURATION_DAYS = 15;

// 10 prizes. Ranks 4–10 all get "Water Bottle Shaker".
const PRIZES = [
  { rank: 1, name: '1kg Protein Powder Box', icon: '🥇' },
  { rank: 2, name: 'Mat Shoes', icon: '🥈' },
  { rank: 3, name: 'Kabaddi Kit', icon: '🥉' },
  { rank: 4, name: 'Water Bottle Shaker', icon: '🏅' },
  { rank: 5, name: 'Water Bottle Shaker', icon: '🏅' },
  { rank: 6, name: 'Water Bottle Shaker', icon: '🏅' },
  { rank: 7, name: 'Water Bottle Shaker', icon: '🏅' },
  { rank: 8, name: 'Water Bottle Shaker', icon: '🏅' },
  { rank: 9, name: 'Water Bottle Shaker', icon: '🏅' },
  { rank: 10, name: 'Water Bottle Shaker', icon: '🏅' },
];

const WINNER_COUNT = 10;

// ─── Self-healing: auto-create tables if migration hasn't run ──────

async function selfHealTables(): Promise<boolean> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "PremiumGiveawayRound" (
      "id" TEXT NOT NULL,
      "roundNumber" INTEGER NOT NULL,
      "startDate" TIMESTAMP(3) NOT NULL,
      "endDate" TIMESTAMP(3) NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "winnersJson" TEXT,
      "winnerCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PremiumGiveawayRound_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PremiumGiveawayRound_roundNumber_key" ON "PremiumGiveawayRound"("roundNumber")`,
    `CREATE INDEX IF NOT EXISTS "PremiumGiveawayRound_status_idx" ON "PremiumGiveawayRound"("status")`,
    `CREATE TABLE IF NOT EXISTS "PremiumGiveawayEntry" (
      "id" TEXT NOT NULL,
      "roundId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PremiumGiveawayEntry_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PremiumGiveawayEntry_roundId_userId_key" ON "PremiumGiveawayEntry"("roundId", "userId")`,
    `CREATE INDEX IF NOT EXISTS "PremiumGiveawayEntry_roundId_idx" ON "PremiumGiveawayEntry"("roundId")`,
  ];
  let createdAny = false;
  for (const sql of statements) {
    try {
      await db.$executeRawUnsafe(sql);
      createdAny = true;
    } catch { /* swallow */ }
  }
  return createdAny;
}

async function withSelfHeal<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    const isTableMissing =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2021';
    const msg = err instanceof Error ? err.message : String(err);
    const msgLooksMissing = /does not exist/i.test(msg);
    if (!isTableMissing && !msgLooksMissing) throw err;
    const healed = await selfHealTables();
    if (!healed) throw err;
    return await op();
  }
}

function sanitizeDbError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const code = err.code;
    const meta = err.meta as Record<string, unknown> | undefined;
    switch (code) {
      case 'P2021':
        return `DB table missing (Prisma ${code}). Will self-heal on next request.`;
      case 'P2022':
        return `DB column missing (Prisma ${code})${meta?.column ? `: ${String(meta.column)}` : ''}.`;
      case 'P2002':
        return `DB unique constraint failed (Prisma ${code}).`;
      default:
        return `DB error (Prisma ${code}).`;
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/relation ".*" does not exist/i.test(msg)) {
    return 'DB table missing (raw Postgres). Will self-heal on next request.';
  }
  return msg.slice(0, 180);
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Check if a user has active premium. Admins always count as premium.
 * Premium is "active" if isPremium=true AND (premiumExpiry is null [lifetime]
 * OR premiumExpiry is in the future).
 */
function userHasActivePremium(user: { isPremium: boolean; premiumExpiry: Date | null; isAdmin: boolean }): boolean {
  if (user.isAdmin) return true;
  if (!user.isPremium) return false;
  if (!user.premiumExpiry) return true; // lifetime
  return new Date(user.premiumExpiry) > new Date();
}

/**
 * Find the active premium giveaway round, auto-rolling if it has ended.
 * If no round exists yet, create round #1 starting now (15-day window).
 * If the latest round's endDate has passed and it's still 'active',
 * mark it 'completed' and create round #N+1.
 */
async function getOrCreateActiveRound() {
  const latest = await withSelfHeal(() =>
    db.premiumGiveawayRound.findFirst({
      orderBy: { roundNumber: 'desc' },
    })
  );

  if (!latest) {
    const now = new Date();
    return withSelfHeal(() =>
      db.premiumGiveawayRound.create({
        data: {
          roundNumber: 1,
          startDate: now,
          endDate: new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000),
          status: 'active',
        },
      })
    );
  }

  // Auto-roll if the active round's endDate has passed.
  if (latest.status === 'active' && new Date(latest.endDate) < new Date()) {
    await withSelfHeal(() =>
      db.premiumGiveawayRound.update({
        where: { id: latest.id },
        data: { status: 'completed' },
      })
    );
    const now = new Date();
    return withSelfHeal(() =>
      db.premiumGiveawayRound.create({
        data: {
          roundNumber: latest.roundNumber + 1,
          startDate: now,
          endDate: new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000),
          status: 'active',
        },
      })
    );
  }

  return latest;
}

/**
 * Count successful referrals (signed_up + completedAt within window) for a user.
 * 1 referral = 1 chance in the weighted draw.
 */
async function countReferralsInWindow(referrerId: string, startDate: Date, endDate: Date): Promise<number> {
  return withSelfHeal(() =>
    db.referral.count({
      where: {
        referrerId,
        referredId: { not: null },
        status: 'signed_up',
        completedAt: { gte: startDate, lte: endDate },
      },
    })
  );
}

/**
 * Build a simple list of ALL participants for a round, ordered by entry
 * time (earliest first). This is NOT a ranked leaderboard — the giveaway
 * is a random draw. We no longer return referralCount — the giveaway is
 * simple: you enter, and winners are randomly selected (equal probability).
 */
async function getAllParticipantsLeaderboard(startDate: Date, endDate: Date, roundId: string) {
  const entries = await withSelfHeal(() =>
    db.premiumGiveawayEntry.findMany({
      where: { roundId },
      select: { userId: true, enteredAt: true },
      orderBy: { enteredAt: 'asc' },
    })
  );
  if (entries.length === 0) return [];

  const userIds = entries.map((e) => e.userId);
  const enteredAtMap = new Map<string, Date>();
  entries.forEach((e) => enteredAtMap.set(e.userId, e.enteredAt));

  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatar: true, playerCode: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  // Return a simple participant list — no referralCount, no ranking.
  // The `rank` field is just a sequence number for display purposes.
  return entries.map((entry, index) => {
    const user = userMap.get(entry.userId);
    const enteredAt = enteredAtMap.get(entry.userId);
    return {
      userId: entry.userId,
      name: user?.name || 'Unknown',
      avatar: user?.avatar || null,
      playerCode: user?.playerCode || null,
      enteredAt: enteredAt ? enteredAt.toISOString() : null,
      rank: index + 1,
    };
  });
}

async function countParticipants(roundId: string): Promise<number> {
  return withSelfHeal(() =>
    db.premiumGiveawayEntry.count({ where: { roundId } })
  );
}

// ─── Public endpoints ──────────────────────────────────────────────

/**
 * GET /api/premium-giveaway/status?userId=
 * Returns: current round, prizes, user's premium status, entry status,
 * referral count (chances), full participant leaderboard, past winners.
 */
router.get('/premium-giveaway/status', async (req, res) => {
  try {
    const userId = (req.query['userId'] as string) || '';
    const round = await getOrCreateActiveRound();
    const now = new Date();
    const hasEnded = now > round.endDate;

    // Look up the user (if provided) to check eligibility.
    let isPremiumUser = false;
    let hasReferral = false;  // does the user have >= 1 referral in this window?
    let canEnter = false;     // isPremiumUser OR hasReferral
    let blockReason: string | null = null;
    let hasEntered = false;
    let enteredAt: string | null = null;

    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { isPremium: true, premiumExpiry: true, isAdmin: true },
      });
      if (user) {
        isPremiumUser = userHasActivePremium(user);
        const referralCount = await countReferralsInWindow(userId, round.startDate, round.endDate);
        hasReferral = referralCount > 0;
        canEnter = isPremiumUser || hasReferral;
        if (!canEnter) {
          blockReason = 'need_premium_or_referral';
        }

        const entry = await withSelfHeal(() =>
          db.premiumGiveawayEntry.findUnique({
            where: { roundId_userId: { roundId: round.id, userId } },
          })
        );
        if (entry) {
          hasEntered = true;
          enteredAt = entry.enteredAt.toISOString();
        }
      }
    }

    const leaderboard = await getAllParticipantsLeaderboard(round.startDate, round.endDate, round.id);
    const totalParticipants = await countParticipants(round.id);

    // Past winners (last 10 completed rounds) — each round has up to 10 winners.
    const pastRounds = await withSelfHeal(() =>
      db.premiumGiveawayRound.findMany({
        where: { status: 'completed', winnersJson: { not: null } },
        orderBy: { roundNumber: 'desc' },
        take: 10,
      })
    );
    const pastWinners: Array<{
      roundNumber: number;
      rank: number;
      userId: string;
      name: string;
      avatar: string | null;
      playerCode: string | null;
      referralCount: number;
      prize: string;
    }> = [];
    for (const r of pastRounds) {
      let winnerIds: string[] = [];
      try { winnerIds = JSON.parse(r.winnersJson || '[]'); } catch { /* ignore */ }
      if (winnerIds.length === 0) continue;
      const winners = await db.user.findMany({
        where: { id: { in: winnerIds } },
        select: { id: true, name: true, avatar: true, playerCode: true },
      });
      const winnerMap = new Map(winners.map((w) => [w.id, w]));
      for (let i = 0; i < winnerIds.length; i++) {
        const w = winnerMap.get(winnerIds[i]);
        if (!w) continue;
        const cnt = await countReferralsInWindow(winnerIds[i], r.startDate, r.endDate);
        pastWinners.push({
          roundNumber: r.roundNumber,
          rank: i + 1,
          userId: winnerIds[i],
          name: w.name || 'Unknown',
          avatar: w.avatar,
          playerCode: w.playerCode,
          referralCount: cnt,
          prize: PRIZES[i]?.name || 'Prize',
        });
      }
    }

    return res.json({
      round: {
        id: round.id,
        roundNumber: round.roundNumber,
        startDate: round.startDate,
        endDate: round.endDate,
        status: round.status,
        hasEnded,
        durationDays: ROUND_DURATION_DAYS,
      },
      prizes: PRIZES,
      isPremiumUser,
      hasReferral,
      canEnter,
      blockReason,
      hasEntered,
      enteredAt,
      leaderboard,
      totalParticipants,
      pastWinners,
    });
  } catch (error) {
    console.error('Premium giveaway status error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * POST /api/premium-giveaway/enter
 * Body: { userId }
 * Eligibility: user must be premium OR have at least 1 successful referral
 * in this round's window. Creates a PremiumGiveawayEntry row. Idempotent.
 */
router.post('/premium-giveaway/enter', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isPremium: true, premiumExpiry: true, isAdmin: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const round = await getOrCreateActiveRound();
    const isPremium = userHasActivePremium(user);
    const referralCount = await countReferralsInWindow(userId, round.startDate, round.endDate);
    const hasReferral = referralCount > 0;

    // Two ways to participate: premium OR referral
    if (!isPremium && !hasReferral) {
      return res.status(403).json({
        error: 'You need premium membership OR at least 1 successful referral to enter this giveaway.',
        blockReason: 'need_premium_or_referral',
      });
    }

    // Idempotent — if already entered, return success.
    const existing = await withSelfHeal(() =>
      db.premiumGiveawayEntry.findUnique({
        where: { roundId_userId: { roundId: round.id, userId } },
      })
    );
    if (existing) {
      return res.json({
        success: true,
        alreadyEntered: true,
        round: { id: round.id, roundNumber: round.roundNumber, endDate: round.endDate },
      });
    }

    await withSelfHeal(() =>
      db.premiumGiveawayEntry.create({
        data: { roundId: round.id, userId },
      })
    );

    return res.json({
      success: true,
      alreadyEntered: false,
      round: { id: round.id, roundNumber: round.roundNumber, endDate: round.endDate },
    });
  } catch (error) {
    console.error('Premium giveaway enter error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * GET /api/premium-giveaway/leaderboard?roundId=
 * Returns the FULL leaderboard of ALL participants for a specific round.
 */
router.get('/premium-giveaway/leaderboard', async (req, res) => {
  try {
    const roundId = (req.query['roundId'] as string) || '';
    let round;
    if (roundId) {
      round = await withSelfHeal(() => db.premiumGiveawayRound.findUnique({ where: { id: roundId } }));
    } else {
      round = await getOrCreateActiveRound();
    }
    if (!round) return res.status(404).json({ error: 'Round not found' });

    const leaderboard = await getAllParticipantsLeaderboard(round.startDate, round.endDate, round.id);
    const totalParticipants = await countParticipants(round.id);
    return res.json({ round, leaderboard, totalParticipants });
  } catch (error) {
    console.error('Premium giveaway leaderboard error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

// ─── Admin endpoints ───────────────────────────────────────────────

/**
 * POST /api/premium-giveaway/admin/select-winners
 * Body: { adminId }
 * Performs a weighted random draw — each participant's weight = referral
 * count (chances). Picks 10 unique winners, marks the round completed,
 * creates the next round.
 */
router.post('/premium-giveaway/admin/select-winners', async (req, res) => {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    const admin = await db.user.findUnique({ where: { id: adminId } });
    if (!admin?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const round = await getOrCreateActiveRound();
    const leaderboard = await getAllParticipantsLeaderboard(round.startDate, round.endDate, round.id);

    // ALL participants are eligible — this is a simple random draw, not
    // weighted. Every participant has equal probability of winning.
    if (leaderboard.length === 0) {
      return res.status(400).json({
        error: 'No participants yet. Users must enter the giveaway before winners can be drawn.',
      });
    }

    // Simple random draw — Fisher-Yates shuffle the participant list and
    // pick the first N unique winners. Each participant has 1 entry.
    const pool: string[] = leaderboard.map((e) => e.userId);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const winnerIds: string[] = pool.slice(0, Math.min(WINNER_COUNT, pool.length));

    await withSelfHeal(() =>
      db.premiumGiveawayRound.update({
        where: { id: round.id },
        data: {
          status: 'completed',
          winnersJson: JSON.stringify(winnerIds),
          winnerCount: winnerIds.length,
        },
      })
    );

    // Create next round.
    const now = new Date();
    const nextRound = await withSelfHeal(() =>
      db.premiumGiveawayRound.create({
        data: {
          roundNumber: round.roundNumber + 1,
          startDate: now,
          endDate: new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000),
          status: 'active',
        },
      })
    );

    // Build winner details for the response.
    const winners = await db.user.findMany({
      where: { id: { in: winnerIds } },
      select: { id: true, name: true, avatar: true, playerCode: true },
    });
    const winnerMap = new Map(winners.map((w) => [w.id, w]));
    const winnerDetails = winnerIds.map((id, i) => {
      const w = winnerMap.get(id);
      return {
        rank: i + 1,
        userId: id,
        name: w?.name || 'Unknown',
        playerCode: w?.playerCode || null,
        prize: PRIZES[i]?.name || 'Prize',
      };
    });

    return res.json({
      success: true,
      winners: winnerDetails,
      completedRound: round.roundNumber,
      nextRound: nextRound.roundNumber,
    });
  } catch (error) {
    console.error('Premium giveaway select-winners error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * POST /api/premium-giveaway/admin/force-start-next-round
 * Body: { adminId }
 * Marks current round completed (without winners) and creates next round.
 */
router.post('/premium-giveaway/admin/force-start-next-round', async (req, res) => {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    const admin = await db.user.findUnique({ where: { id: adminId } });
    if (!admin?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const round = await getOrCreateActiveRound();
    await withSelfHeal(() =>
      db.premiumGiveawayRound.update({
        where: { id: round.id },
        data: { status: 'completed' },
      })
    );

    const now = new Date();
    const nextRound = await withSelfHeal(() =>
      db.premiumGiveawayRound.create({
        data: {
          roundNumber: round.roundNumber + 1,
          startDate: now,
          endDate: new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000),
          status: 'active',
        },
      })
    );

    return res.json({
      success: true,
      completedRound: round.roundNumber,
      nextRound: nextRound.roundNumber,
    });
  } catch (error) {
    console.error('Premium giveaway force-start-next-round error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

export default router;
