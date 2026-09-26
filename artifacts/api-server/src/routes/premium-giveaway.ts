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
 * Build the full leaderboard of ALL participants for a round, ranked by
 * referral count (chances) DESC, then enteredAt ASC. Includes users with
 * 0 referrals (they still entered, but have 0 chances to win).
 */
async function getAllParticipantsLeaderboard(startDate: Date, endDate: Date, roundId: string) {
  const entries = await withSelfHeal(() =>
    db.premiumGiveawayEntry.findMany({
      where: { roundId },
      select: { userId: true, enteredAt: true },
    })
  );
  if (entries.length === 0) return [];

  const userIds = entries.map((e) => e.userId);
  const enteredAtMap = new Map<string, Date>();
  entries.forEach((e) => enteredAtMap.set(e.userId, e.enteredAt));

  // Count referrals (within window) per participant.
  const grouped = await withSelfHeal(() =>
    db.referral.groupBy({
      by: ['referrerId'],
      where: {
        referredId: { not: null },
        status: 'signed_up',
        completedAt: { gte: startDate, lte: endDate },
        referrerId: { in: userIds },
      },
      _count: { referrerId: true },
    })
  );
  const countMap = new Map<string, number>();
  grouped.forEach((g) => countMap.set(g.referrerId, g._count.referrerId));

  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatar: true, playerCode: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const rows = userIds.map((userId) => {
    const user = userMap.get(userId);
    const enteredAt = enteredAtMap.get(userId);
    return {
      userId,
      name: user?.name || 'Unknown',
      avatar: user?.avatar || null,
      playerCode: user?.playerCode || null,
      referralCount: countMap.get(userId) || 0,
      enteredAt: enteredAt ? enteredAt.toISOString() : null,
      _enteredAt: enteredAt ? enteredAt.getTime() : 0,
    };
  });

  rows.sort((a, b) => {
    if (b.referralCount !== a.referralCount) return b.referralCount - a.referralCount;
    return a._enteredAt - b._enteredAt;
  });

  return rows.map((r, index) => {
    const { _enteredAt, ...rest } = r;
    return { ...rest, rank: index + 1 };
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

    // Look up the user (if provided) to check premium status.
    let isPremiumUser = false;
    let hasEntered = false;
    let enteredAt: string | null = null;
    let myReferralCount = 0;
    let myRank: number | null = null;

    if (userId) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { isPremium: true, premiumExpiry: true, isAdmin: true },
      });
      if (user) {
        isPremiumUser = userHasActivePremium(user);

        const entry = await withSelfHeal(() =>
          db.premiumGiveawayEntry.findUnique({
            where: { roundId_userId: { roundId: round.id, userId } },
          })
        );
        if (entry) {
          hasEntered = true;
          enteredAt = entry.enteredAt.toISOString();
          myReferralCount = await countReferralsInWindow(userId, round.startDate, round.endDate);
        }
      }
    }

    const leaderboard = await getAllParticipantsLeaderboard(round.startDate, round.endDate, round.id);
    const totalParticipants = await countParticipants(round.id);

    if (hasEntered) {
      const lbEntry = leaderboard.find((e) => e.userId === userId);
      if (lbEntry) myRank = lbEntry.rank;
    }

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
      hasEntered,
      enteredAt,
      myReferralCount,
      myRank,
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
 * Premium-only. Creates a PremiumGiveawayEntry row. Idempotent.
 * The user's "chances" = their referral count (computed live, not frozen).
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

    if (!userHasActivePremium(user)) {
      return res.status(403).json({
        error: 'Premium membership required to participate in this giveaway. Buy premium (₹2 for 1 day) to enter.',
        blockReason: 'not_premium',
      });
    }

    const round = await getOrCreateActiveRound();

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

    // Only participants with >= 1 referral are eligible to win.
    const eligible = leaderboard.filter((e) => e.referralCount > 0);
    if (eligible.length === 0) {
      return res.status(400).json({
        error: 'No eligible participants with referrals yet. Premium users must enter AND have at least 1 successful referral to win.',
      });
    }

    // Weighted random draw. Build a pool where each participant appears
    // referralCount times, then shuffle and pick unique winners.
    const pool: string[] = [];
    eligible.forEach((e) => {
      for (let i = 0; i < e.referralCount; i++) pool.push(e.userId);
    });
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Pick unique winners (a user can only win one rank).
    const winnerIds: string[] = [];
    const seen = new Set<string>();
    for (const id of pool) {
      if (!seen.has(id)) {
        seen.add(id);
        winnerIds.push(id);
        if (winnerIds.length >= WINNER_COUNT) break;
      }
    }

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
