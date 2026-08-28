import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

// ─── Constants ──────────────────────────────────────────────────────

const CONTEST_DURATION_DAYS = 30;
const CONTEST_PRIZE = '1kg High Protein Oats Pack';

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Find the active referral contest round, auto-rolling if it has ended.
 * If no round exists yet, create round #1 starting now.
 * If the latest round's endDate has passed and it's still 'active',
 * mark it 'completed' (without winners — admin can back-fill) and
 * create round #N+1 starting now.
 */
async function getOrCreateActiveContestRound() {
  const latest = await db.referralContestRound.findFirst({
    orderBy: { roundNumber: 'desc' },
  });

  if (!latest) {
    // Create round #1
    const now = new Date();
    const round = await db.referralContestRound.create({
      data: {
        roundNumber: 1,
        startDate: now,
        endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
        status: 'active',
      },
    });
    return round;
  }

  // If the latest round is active but its endDate has passed, roll it.
  if (latest.status === 'active' && new Date(latest.endDate) < new Date()) {
    await db.referralContestRound.update({
      where: { id: latest.id },
      data: { status: 'completed' },
    });

    const now = new Date();
    const nextRound = await db.referralContestRound.create({
      data: {
        roundNumber: latest.roundNumber + 1,
        startDate: now,
        endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
        status: 'active',
      },
    });
    return nextRound;
  }

  // If latest is completed but no active round exists (shouldn't happen, but be safe)
  if (latest.status === 'completed') {
    const activeRound = await db.referralContestRound.findFirst({
      where: { status: 'active' },
    });
    if (activeRound) return activeRound;

    const now = new Date();
    const round = await db.referralContestRound.create({
      data: {
        roundNumber: latest.roundNumber + 1,
        startDate: now,
        endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
        status: 'active',
      },
    });
    return round;
  }

  return latest;
}

/**
 * Count successful referrals (signed_up + completedAt within window) for a user.
 */
async function countReferralsInWindow(referrerId: string, startDate: Date, endDate: Date): Promise<number> {
  return db.referral.count({
    where: {
      referrerId,
      referredId: { not: null },
      status: 'signed_up',
      completedAt: { gte: startDate, lte: endDate },
    },
  });
}

/**
 * Get the top N referrers in a window. Returns array of
 * { userId, name, avatar, playerCode, referralCount, rank }
 */
async function getTopReferrers(startDate: Date, endDate: Date, limit: number = 10) {
  // Group by referrerId using Prisma's groupBy
  const grouped = await db.referral.groupBy({
    by: ['referrerId'],
    where: {
      referredId: { not: null },
      status: 'signed_up',
      completedAt: { gte: startDate, lte: endDate },
    },
    _count: { referrerId: true },
    orderBy: { _count: { referrerId: 'desc' } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const userIds = grouped.map((g) => g.referrerId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatar: true, playerCode: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return grouped.map((g, index) => {
    const user = userMap.get(g.referrerId);
    return {
      userId: g.referrerId,
      name: user?.name || 'Unknown',
      avatar: user?.avatar || null,
      playerCode: user?.playerCode || null,
      referralCount: g._count.referrerId,
      rank: index + 1,
    };
  });
}

// ─── Public endpoints ──────────────────────────────────────────────

/**
 * GET /api/referral-contest/status?userId=
 * Returns the current contest round + the user's rank + their referral
 * count for this window + past winners.
 */
router.get('/referral-contest/status', async (req, res) => {
  try {
    const userId = (req.query['userId'] as string) || '';
    const round = await getOrCreateActiveContestRound();

    const now = new Date();
    const hasEnded = now > round.endDate;

    // Top 10 leaderboard for this round
    const leaderboard = await getTopReferrers(round.startDate, round.endDate, 10);

    // User's stats
    let myRank: number | null = null;
    let myReferralCount = 0;
    if (userId) {
      myReferralCount = await countReferralsInWindow(userId, round.startDate, round.endDate);
      if (myReferralCount > 0) {
        // Rank = 1 + number of users with strictly more referrals in this window
        // We can derive this from the leaderboard if user is in top 10, otherwise
        // we need to count users with > myReferralCount.
        const lbEntry = leaderboard.find((e) => e.userId === userId);
        if (lbEntry) {
          myRank = lbEntry.rank;
        } else {
          // Count distinct referrers with more referrals than the user.
          // Use raw grouping — we need the count of referrers whose group
          // _count > myReferralCount. Prisma doesn't support HAVING directly,
          // so we fetch the top 500 groups and filter in JS.
          const allGroups = await db.referral.groupBy({
            by: ['referrerId'],
            where: {
              referredId: { not: null },
              status: 'signed_up',
              completedAt: { gte: round.startDate, lte: round.endDate },
            },
            _count: { referrerId: true },
          });
          const usersWithMore = allGroups.filter(
            (g) => g._count.referrerId > myReferralCount
          ).length;
          myRank = usersWithMore + 1;
        }
      }
    }

    // Past winners (last 5 completed rounds)
    const pastRounds = await db.referralContestRound.findMany({
      where: { status: 'completed', winnersJson: { not: null } },
      orderBy: { roundNumber: 'desc' },
      take: 5,
    });
    const pastWinners = [];
    for (const r of pastRounds) {
      let winnerIds: string[] = [];
      try {
        winnerIds = JSON.parse(r.winnersJson || '[]');
      } catch { /* ignore */ }
      if (winnerIds.length === 0) continue;
      const winners = await db.user.findMany({
        where: { id: { in: winnerIds } },
        select: { id: true, name: true, avatar: true, playerCode: true },
      });
      // Count referrals for the winner in that round's window
      for (const w of winners) {
        const cnt = await db.referral.count({
          where: {
            referrerId: w.id,
            referredId: { not: null },
            status: 'signed_up',
            completedAt: { gte: r.startDate, lte: r.endDate },
          },
        });
        pastWinners.push({
          roundNumber: r.roundNumber,
          userId: w.id,
          name: w.name || 'Unknown',
          avatar: w.avatar,
          playerCode: w.playerCode,
          referralCount: cnt,
          prize: CONTEST_PRIZE,
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
        prize: CONTEST_PRIZE,
        durationDays: CONTEST_DURATION_DAYS,
      },
      myRank,
      myReferralCount,
      leaderboard,
      pastWinners,
      totalParticipants: leaderboard.length, // users with at least 1 referral
    });
  } catch (error) {
    console.error('Referral contest status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/referral-contest/leaderboard?roundId=&limit=
 * Returns the top N referrers for a specific round (defaults to current).
 */
router.get('/referral-contest/leaderboard', async (req, res) => {
  try {
    const roundId = (req.query['roundId'] as string) || '';
    const limit = Math.min(parseInt((req.query['limit'] as string) || '50'), 200);

    let round;
    if (roundId) {
      round = await db.referralContestRound.findUnique({ where: { id: roundId } });
    } else {
      round = await getOrCreateActiveContestRound();
    }

    if (!round) return res.status(404).json({ error: 'Round not found' });

    const leaderboard = await getTopReferrers(round.startDate, round.endDate, limit);
    return res.json({ round, leaderboard });
  } catch (error) {
    console.error('Referral contest leaderboard error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Admin endpoints ───────────────────────────────────────────────

/**
 * POST /api/referral-contest/admin/select-winners
 * Body: { adminId }
 * Auto-picks the top referrer as the winner of the current round,
 * marks the round completed, and creates the next round.
 */
router.post('/referral-contest/admin/select-winners', async (req, res) => {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    const admin = await db.user.findUnique({ where: { id: adminId } });
    if (!admin?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const round = await getOrCreateActiveContestRound();
    const top = await getTopReferrers(round.startDate, round.endDate, 1);

    if (top.length === 0 || top[0].referralCount === 0) {
      return res.status(400).json({ error: 'No eligible participants with referrals yet' });
    }

    const winnerIds = [top[0].userId];
    await db.referralContestRound.update({
      where: { id: round.id },
      data: {
        status: 'completed',
        winnersJson: JSON.stringify(winnerIds),
        winnerCount: winnerIds.length,
      },
    });

    // Create next round
    const now = new Date();
    const nextRound = await db.referralContestRound.create({
      data: {
        roundNumber: round.roundNumber + 1,
        startDate: now,
        endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
        status: 'active',
      },
    });

    return res.json({
      success: true,
      winner: top[0],
      prize: CONTEST_PRIZE,
      completedRound: round.roundNumber,
      nextRound: nextRound.roundNumber,
    });
  } catch (error) {
    console.error('Referral contest select-winners error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/referral-contest/admin/force-start-next-round
 * Body: { adminId }
 * Marks current round completed (without winner) and creates next round.
 */
router.post('/referral-contest/admin/force-start-next-round', async (req, res) => {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    const admin = await db.user.findUnique({ where: { id: adminId } });
    if (!admin?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const round = await getOrCreateActiveContestRound();
    await db.referralContestRound.update({
      where: { id: round.id },
      data: { status: 'completed' },
    });

    const now = new Date();
    const nextRound = await db.referralContestRound.create({
      data: {
        roundNumber: round.roundNumber + 1,
        startDate: now,
        endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
        status: 'active',
      },
    });

    return res.json({
      success: true,
      completedRound: round.roundNumber,
      nextRound: nextRound.roundNumber,
    });
  } catch (error) {
    console.error('Referral contest force-start-next-round error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/referral-contest/admin/all-rounds?adminId=
 * Returns all contest rounds with winners, for the admin panel.
 */
router.get('/referral-contest/admin/all-rounds', async (req, res) => {
  try {
    const adminId = (req.query['adminId'] as string) || '';
    const admin = await db.user.findUnique({ where: { id: adminId } });
    if (!admin?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const rounds = await db.referralContestRound.findMany({
      orderBy: { roundNumber: 'desc' },
      take: 50,
    });

    const formatted = await Promise.all(rounds.map(async (r) => {
      let winnerIds: string[] = [];
      try { winnerIds = JSON.parse(r.winnersJson || '[]'); } catch { /* ignore */ }
      let winners: Array<{ id: string; name: string | null; avatar: string | null; playerCode: string | null; referralCount: number }> = [];
      if (winnerIds.length > 0) {
        const users = await db.user.findMany({
          where: { id: { in: winnerIds } },
          select: { id: true, name: true, avatar: true, playerCode: true },
        });
        for (const u of users) {
          const cnt = await db.referral.count({
            where: {
              referrerId: u.id,
              referredId: { not: null },
              status: 'signed_up',
              completedAt: { gte: r.startDate, lte: r.endDate },
            },
          });
          winners.push({ ...u, referralCount: cnt });
        }
      }
      const participantCount = await db.referral.groupBy({
        by: ['referrerId'],
        where: {
          referredId: { not: null },
          status: 'signed_up',
          completedAt: { gte: r.startDate, lte: r.endDate },
        },
        _count: { referrerId: true },
      });
      return {
        id: r.id,
        roundNumber: r.roundNumber,
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
        winners,
        participantCount: participantCount.length,
      };
    }));

    return res.json({ rounds: formatted });
  } catch (error) {
    console.error('Referral contest admin all-rounds error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
