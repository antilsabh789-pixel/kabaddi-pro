import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { db } from '../lib/db';

const router = Router();

// ─── Constants ──────────────────────────────────────────────────────

const CONTEST_DURATION_DAYS = 30;
const CONTEST_PRIZE = '1kg High Protein Oats Pack';

// ─── Self-healing: auto-create tables if migration hasn't run ──────

/**
 * Try to CREATE the referral contest tables on-the-fly if they don't
 * exist. This handles the case where the Railway deployment hasn't had
 * `prisma migrate deploy` run yet — the API will self-heal instead of
 * returning 500 errors.
 *
 * Returns true if ANY DDL statement succeeded (i.e. we should retry).
 */
async function selfHealReferralContestTables(): Promise<boolean> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "ReferralContestRound" (
      "id" TEXT NOT NULL,
      "roundNumber" INTEGER NOT NULL,
      "startDate" TIMESTAMP(3) NOT NULL,
      "endDate" TIMESTAMP(3) NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "winnersJson" TEXT,
      "winnerCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ReferralContestRound_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralContestRound_roundNumber_key" ON "ReferralContestRound"("roundNumber")`,
    `CREATE INDEX IF NOT EXISTS "ReferralContestRound_status_idx" ON "ReferralContestRound"("status")`,
    `CREATE TABLE IF NOT EXISTS "ReferralContestParticipant" (
      "id" TEXT NOT NULL,
      "roundId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReferralContestParticipant_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralContestParticipant_roundId_userId_key" ON "ReferralContestParticipant"("roundId", "userId")`,
    `CREATE INDEX IF NOT EXISTS "ReferralContestParticipant_roundId_idx" ON "ReferralContestParticipant"("roundId")`,
  ];
  let createdAny = false;
  for (const sql of statements) {
    try {
      await db.$executeRawUnsafe(sql);
      createdAny = true;
    } catch {
      // swallow — we'll let the retry fail with the original error if needed
    }
  }
  return createdAny;
}

/**
 * Wrap a DB operation with self-healing.
 * If the first attempt throws P2021 (table missing) or a "does not exist"
 * error, we try to CREATE the tables and retry ONCE.
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
    const healed = await selfHealReferralContestTables();
    if (!healed) throw err;
    return await op();
  }
}

function sanitizeDbError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const code = err.code;
    const meta = err.meta as Record<string, unknown> | undefined;
    switch (code) {
      case 'P2021': {
        const table = meta?.table ? ` (table: ${String(meta.table)})` : '';
        return `DB table missing (Prisma ${code})${table}. Will self-heal on next request.`;
      }
      case 'P2022': {
        const column = meta?.column ? `: ${String(meta.column)}` : '';
        return `DB column missing (Prisma ${code})${column}.`;
      }
      case 'P2002': {
        const target = meta?.target ? ` (target: ${JSON.stringify(meta.target)})` : '';
        return `DB unique constraint failed (Prisma ${code})${target}.`;
      }
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
 * Find the active referral contest round, auto-rolling if it has ended.
 * If no round exists yet, create round #1 starting now.
 * If the latest round's endDate has passed and it's still 'active',
 * mark it 'completed' (without winners — admin can back-fill) and
 * create round #N+1 starting now.
 */
async function getOrCreateActiveContestRound() {
  const latest = await withSelfHeal(() =>
    db.referralContestRound.findFirst({
      orderBy: { roundNumber: 'desc' },
    })
  );

  if (!latest) {
    // Create round #1
    const now = new Date();
    const round = await withSelfHeal(() =>
      db.referralContestRound.create({
        data: {
          roundNumber: 1,
          startDate: now,
          endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
          status: 'active',
        },
      })
    );
    return round;
  }

  // If the latest round is active but its endDate has passed, roll it.
  if (latest.status === 'active' && new Date(latest.endDate) < new Date()) {
    await withSelfHeal(() =>
      db.referralContestRound.update({
        where: { id: latest.id },
        data: { status: 'completed' },
      })
    );

    const now = new Date();
    const nextRound = await withSelfHeal(() =>
      db.referralContestRound.create({
        data: {
          roundNumber: latest.roundNumber + 1,
          startDate: now,
          endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
          status: 'active',
        },
      })
    );
    return nextRound;
  }

  // If latest is completed but no active round exists (shouldn't happen, but be safe)
  if (latest.status === 'completed') {
    const activeRound = await withSelfHeal(() =>
      db.referralContestRound.findFirst({
        where: { status: 'active' },
      })
    );
    if (activeRound) return activeRound;

    const now = new Date();
    const round = await withSelfHeal(() =>
      db.referralContestRound.create({
        data: {
          roundNumber: latest.roundNumber + 1,
          startDate: now,
          endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
          status: 'active',
        },
      })
    );
    return round;
  }

  return latest;
}

/**
 * Count successful referrals (signed_up + completedAt within window) for a user.
 *
 * A "successful referral" = a Referral row where:
 *   - referrerId = this user (they shared the code)
 *   - referredId IS NOT NULL (someone actually used the code)
 *   - status = 'signed_up' (the code was consumed at signup)
 *   - completedAt is within [startDate, endDate] (the referred user signed up during this round window)
 *
 * completedAt is set to new Date() at the exact moment the new user signs up
 * (see auth.ts line 333 and social.ts line 565), so this correctly attributes
 * referrals to the round in which the new user signed up — NOT the round in
 * which the code was generated.
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
 * Get the top N referrers in a window, FILTERED to only include users who
 * have entered the contest (ReferralContestParticipant row exists for this round).
 *
 * Returns array of:
 * { userId, name, avatar, playerCode, referralCount, rank, enteredAt }
 */
async function getTopReferrers(startDate: Date, endDate: Date, limit: number, roundId?: string) {
  // If roundId is provided, only count referrals from users who entered the contest.
  let participantUserIds: string[] | null = null;
  let participantMap = new Map<string, Date>(); // userId -> enteredAt

  if (roundId) {
    const participants = await withSelfHeal(() =>
      db.referralContestParticipant.findMany({
        where: { roundId },
        select: { userId: true, enteredAt: true },
      })
    );
    participantUserIds = participants.map((p) => p.userId);
    participants.forEach((p) => participantMap.set(p.userId, p.enteredAt));
    if (participantUserIds.length === 0) return [];
  }

  // Group by referrerId using Prisma's groupBy.
  const grouped = await withSelfHeal(() =>
    db.referral.groupBy({
      by: ['referrerId'],
      where: {
        referredId: { not: null },
        status: 'signed_up',
        completedAt: { gte: startDate, lte: endDate },
        ...(participantUserIds ? { referrerId: { in: participantUserIds } } : {}),
      },
      _count: { referrerId: true },
      orderBy: { _count: { referrerId: 'desc' } },
      take: limit,
    })
  );

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
      enteredAt: participantMap.get(g.referrerId) || null,
    };
  });
}

/**
 * Count the number of participants who have entered the current round.
 * This is the "X participants" number shown in the UI.
 */
async function countParticipants(roundId: string): Promise<number> {
  return withSelfHeal(() =>
    db.referralContestParticipant.count({ where: { roundId } })
  );
}

// ─── Public endpoints ──────────────────────────────────────────────

/**
 * POST /api/referral-contest/enter
 * Body: { userId }
 *
 * Enters the user into the current contest round. Once entered, their
 * referrals (within the round window) are counted toward winning.
 *
 * Idempotent: if already entered, returns success without duplicating.
 */
router.post('/referral-contest/enter', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Verify user exists
    const user = await withSelfHeal(() => db.user.findUnique({ where: { id: userId } }));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const round = await getOrCreateActiveContestRound();

    // Check if already entered (idempotent)
    const existing = await withSelfHeal(() =>
      db.referralContestParticipant.findUnique({
        where: { roundId_userId: { roundId: round.id, userId } },
      })
    );
    if (existing) {
      return res.json({
        success: true,
        alreadyEntered: true,
        round: {
          id: round.id,
          roundNumber: round.roundNumber,
          endDate: round.endDate,
        },
      });
    }

    // Create the participant entry
    await withSelfHeal(() =>
      db.referralContestParticipant.create({
        data: { roundId: round.id, userId },
      })
    );

    return res.json({
      success: true,
      alreadyEntered: false,
      round: {
        id: round.id,
        roundNumber: round.roundNumber,
        endDate: round.endDate,
      },
    });
  } catch (error) {
    console.error('Referral contest enter error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * GET /api/referral-contest/status?userId=
 * Returns the current contest round + the user's entry status + their
 * referral count (only counted if entered) + leaderboard (only participants) + past winners.
 */
router.get('/referral-contest/status', async (req, res) => {
  try {
    const userId = (req.query['userId'] as string) || '';
    const round = await getOrCreateActiveContestRound();

    const now = new Date();
    const hasEnded = now > round.endDate;

    // Check if user has entered this round
    let hasEntered = false;
    let enteredAt: string | null = null;
    if (userId) {
      const participant = await withSelfHeal(() =>
        db.referralContestParticipant.findUnique({
          where: { roundId_userId: { roundId: round.id, userId } },
        })
      );
      if (participant) {
        hasEntered = true;
        enteredAt = participant.enteredAt.toISOString();
      }
    }

    // Top 10 leaderboard for this round — ONLY participants
    const leaderboard = await getTopReferrers(round.startDate, round.endDate, 10, round.id);

    // Total participants (users who tapped "Enter Contest")
    const totalParticipants = await countParticipants(round.id);

    // User's stats — only count referrals if they've entered
    let myRank: number | null = null;
    let myReferralCount = 0;
    if (userId && hasEntered) {
      myReferralCount = await countReferralsInWindow(userId, round.startDate, round.endDate);
      if (myReferralCount > 0) {
        // Rank = 1 + number of participants with strictly more referrals in this window
        const lbEntry = leaderboard.find((e) => e.userId === userId);
        if (lbEntry) {
          myRank = lbEntry.rank;
        } else {
          // User is outside top 10 — compute their rank by counting participants
          // with more referrals than them.
          const allParticipants = await withSelfHeal(() =>
            db.referralContestParticipant.findMany({
              where: { roundId: round.id },
              select: { userId: true },
            })
          );
          const allParticipantIds = allParticipants.map((p) => p.userId);
          if (allParticipantIds.length > 0) {
            const allGroups = await withSelfHeal(() =>
              db.referral.groupBy({
                by: ['referrerId'],
                where: {
                  referredId: { not: null },
                  status: 'signed_up',
                  completedAt: { gte: round.startDate, lte: round.endDate },
                  referrerId: { in: allParticipantIds },
                },
                _count: { referrerId: true },
              })
            );
            const usersWithMore = allGroups.filter(
              (g) => g._count.referrerId > myReferralCount
            ).length;
            myRank = usersWithMore + 1;
          }
        }
      } else {
        // User has entered but 0 referrals — rank is the total number of participants
        // with > 0 referrals + 1.
        const allParticipants = await withSelfHeal(() =>
          db.referralContestParticipant.findMany({
            where: { roundId: round.id },
            select: { userId: true },
          })
        );
        const allParticipantIds = allParticipants.map((p) => p.userId);
        if (allParticipantIds.length > 0) {
          const allGroups = await withSelfHeal(() =>
            db.referral.groupBy({
              by: ['referrerId'],
              where: {
                referredId: { not: null },
                status: 'signed_up',
                completedAt: { gte: round.startDate, lte: round.endDate },
                referrerId: { in: allParticipantIds },
              },
              _count: { referrerId: true },
            })
          );
          // Rank = number of participants with at least 1 referral + 1
          myRank = allGroups.length + 1;
        }
      }
    }

    // Past winners (last 5 completed rounds)
    const pastRounds = await withSelfHeal(() =>
      db.referralContestRound.findMany({
        where: { status: 'completed', winnersJson: { not: null } },
        orderBy: { roundNumber: 'desc' },
        take: 5,
      })
    );
    const pastWinners = [];
    for (const r of pastRounds) {
      let winnerIds: string[] = [];
      try {
        winnerIds = JSON.parse(r.winnersJson || '[]');
      } catch { /* ignore */ }
      if (winnerIds.length === 0) continue;
      const winners = await withSelfHeal(() =>
        db.user.findMany({
          where: { id: { in: winnerIds } },
          select: { id: true, name: true, avatar: true, playerCode: true },
        })
      );
      // Count referrals for the winner in that round's window
      for (const w of winners) {
        const cnt = await withSelfHeal(() =>
          db.referral.count({
            where: {
              referrerId: w.id,
              referredId: { not: null },
              status: 'signed_up',
              completedAt: { gte: r.startDate, lte: r.endDate },
            },
          })
        );
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
      hasEntered,
      enteredAt,
      myRank,
      myReferralCount,
      leaderboard,
      pastWinners,
      totalParticipants,
    });
  } catch (error) {
    console.error('Referral contest status error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * GET /api/referral-contest/leaderboard?roundId=&limit=
 * Returns the top N referrers for a specific round (defaults to current).
 * Only participants are included.
 */
router.get('/referral-contest/leaderboard', async (req, res) => {
  try {
    const roundId = (req.query['roundId'] as string) || '';
    const limit = Math.min(parseInt((req.query['limit'] as string) || '50'), 200);

    let round;
    if (roundId) {
      round = await withSelfHeal(() => db.referralContestRound.findUnique({ where: { id: roundId } }));
    } else {
      round = await getOrCreateActiveContestRound();
    }

    if (!round) return res.status(404).json({ error: 'Round not found' });

    const leaderboard = await getTopReferrers(round.startDate, round.endDate, limit, round.id);
    const totalParticipants = await countParticipants(round.id);
    return res.json({ round, leaderboard, totalParticipants });
  } catch (error) {
    console.error('Referral contest leaderboard error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

// ─── Admin endpoints ───────────────────────────────────────────────

/**
 * POST /api/referral-contest/admin/select-winners
 * Body: { adminId }
 * Auto-picks the top referrer (among participants) as the winner of the
 * current round, marks the round completed, and creates the next round.
 */
router.post('/referral-contest/admin/select-winners', async (req, res) => {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    const admin = await withSelfHeal(() => db.user.findUnique({ where: { id: adminId } }));
    if (!admin?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const round = await getOrCreateActiveContestRound();
    const top = await getTopReferrers(round.startDate, round.endDate, 1, round.id);

    if (top.length === 0 || top[0].referralCount === 0) {
      return res.status(400).json({
        error: 'No eligible participants with referrals yet. Users must tap "Enter Contest" and have at least 1 successful referral to win.'
      });
    }

    const winnerIds = [top[0].userId];
    await withSelfHeal(() =>
      db.referralContestRound.update({
        where: { id: round.id },
        data: {
          status: 'completed',
          winnersJson: JSON.stringify(winnerIds),
          winnerCount: winnerIds.length,
        },
      })
    );

    // Create next round
    const now = new Date();
    const nextRound = await withSelfHeal(() =>
      db.referralContestRound.create({
        data: {
          roundNumber: round.roundNumber + 1,
          startDate: now,
          endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
          status: 'active',
        },
      })
    );

    return res.json({
      success: true,
      winner: top[0],
      prize: CONTEST_PRIZE,
      completedRound: round.roundNumber,
      nextRound: nextRound.roundNumber,
    });
  } catch (error) {
    console.error('Referral contest select-winners error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
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

    const admin = await withSelfHeal(() => db.user.findUnique({ where: { id: adminId } }));
    if (!admin?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const round = await getOrCreateActiveContestRound();
    await withSelfHeal(() =>
      db.referralContestRound.update({
        where: { id: round.id },
        data: { status: 'completed' },
      })
    );

    const now = new Date();
    const nextRound = await withSelfHeal(() =>
      db.referralContestRound.create({
        data: {
          roundNumber: round.roundNumber + 1,
          startDate: now,
          endDate: new Date(now.getTime() + CONTEST_DURATION_DAYS * 24 * 60 * 60 * 1000),
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
    console.error('Referral contest force-start-next-round error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

/**
 * GET /api/referral-contest/admin/all-rounds?adminId=
 * Returns all contest rounds with winners + participant counts.
 */
router.get('/referral-contest/admin/all-rounds', async (req, res) => {
  try {
    const adminId = (req.query['adminId'] as string) || '';
    const admin = await withSelfHeal(() => db.user.findUnique({ where: { id: adminId } }));
    if (!admin?.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const rounds = await withSelfHeal(() =>
      db.referralContestRound.findMany({
        orderBy: { roundNumber: 'desc' },
        take: 50,
        include: { _count: { select: { participants: true } } },
      })
    );

    const formatted = await Promise.all(rounds.map(async (r) => {
      let winnerIds: string[] = [];
      try { winnerIds = JSON.parse(r.winnersJson || '[]'); } catch { /* ignore */ }
      let winners: Array<{ id: string; name: string | null; avatar: string | null; playerCode: string | null; referralCount: number }> = [];
      if (winnerIds.length > 0) {
        const users = await withSelfHeal(() =>
          db.user.findMany({
            where: { id: { in: winnerIds } },
            select: { id: true, name: true, avatar: true, playerCode: true },
          })
        );
        for (const u of users) {
          const cnt = await withSelfHeal(() =>
            db.referral.count({
              where: {
                referrerId: u.id,
                referredId: { not: null },
                status: 'signed_up',
                completedAt: { gte: r.startDate, lte: r.endDate },
              },
            })
          );
          winners.push({ ...u, referralCount: cnt });
        }
      }
      return {
        id: r.id,
        roundNumber: r.roundNumber,
        startDate: r.startDate,
        endDate: r.endDate,
        status: r.status,
        winners,
        participantCount: r._count.participants,
      };
    }));

    return res.json({ rounds: formatted });
  } catch (error) {
    console.error('Referral contest admin all-rounds error:', error);
    return res.status(500).json({ error: sanitizeDbError(error) });
  }
});

export default router;
