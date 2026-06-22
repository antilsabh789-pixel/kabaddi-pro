import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

const ROUND_DURATION_DAYS = 15;
const PRIZES = [
  { rank: 1, name: '1kg Protein Powder', icon: '🥇' },
  { rank: 2, name: 'Kabaddi Kit', icon: '🥈' },
  { rank: 3, name: 'Shaker Water Bottle (Kabaddi Pro Branded)', icon: '🥉' },
];

/**
 * Get or create the active giveaway round.
 */
async function getOrCreateActiveRound() {
  const now = new Date();
  let round = await db.giveawayRound.findFirst({
    where: { status: 'active' },
    orderBy: { roundNumber: 'desc' },
  });

  if (!round) {
    const lastRound = await db.giveawayRound.findFirst({ orderBy: { roundNumber: 'desc' } });
    const nextNumber = (lastRound?.roundNumber || 0) + 1;
    const startDate = now;
    const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
    round = await db.giveawayRound.create({
      data: { roundNumber: nextNumber, startDate, endDate, status: 'active' },
    });
  } else if (round.endDate < now) {
    // Round has ended but status wasn't updated. Update it.
    await db.giveawayRound.update({ where: { id: round.id }, data: { status: 'completed' } });
    // Create a new round
    const nextNumber = round.roundNumber + 1;
    const startDate = now;
    const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
    round = await db.giveawayRound.create({
      data: { roundNumber: nextNumber, startDate, endDate, status: 'active' },
    });
  }

  return round;
}

/**
 * Count a user's SUCCESSFUL referrals (where someone actually signed up using their code).
 * Each successful referral = 1 giveaway participation entry for non-premium users.
 */
async function countSuccessfulReferrals(userId: string): Promise<number> {
  // A referral is "successful" when referredId is not null (someone signed up using the code)
  return db.referral.count({
    where: { referrerId: userId, referredId: { not: null } },
  });
}

/**
 * Count how many giveaway rounds a non-premium user has ALREADY used their referral entries on.
 * This is across ALL rounds (past + current), so a user with 3 referrals who has participated
 * in 2 rounds has 1 entry remaining.
 */
async function countPastParticipations(userId: string): Promise<number> {
  return db.giveawayParticipant.count({
    where: { userId, isPremium: false },
  });
}

/**
 * GET /api/giveaway/status
 * Returns the current active round, time remaining, participant count, prizes,
 * and the user's eligibility info (premium status, referral entries, remaining entries).
 */
router.get('/giveaway/status', async (req, res) => {
  try {
    const userId = (req.query['userId'] as string) || '';
    const round = await getOrCreateActiveRound();
    const participantCount = await db.giveawayParticipant.count({
      where: { giveawayRoundId: round.id },
    });

    let hasParticipated = false;
    let isPremiumActive = false;
    let successfulReferrals = 0;
    let participationsUsed = 0;
    let entriesRemaining = 0;
    let canParticipate = false;
    let blockReason = '';

    if (userId) {
      const existing = await db.giveawayParticipant.findUnique({
        where: { giveawayRoundId_userId: { giveawayRoundId: round.id, userId } },
      });
      hasParticipated = !!existing;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { isPremium: true, premiumExpiry: true },
      });
      isPremiumActive = !!(user?.isPremium && (!user.premiumExpiry || new Date(user.premiumExpiry) > new Date()));

      successfulReferrals = await countSuccessfulReferrals(userId);
      participationsUsed = await countPastParticipations(userId);
      entriesRemaining = Math.max(0, successfulReferrals - participationsUsed);

      // Participation rules:
      // - Premium members: can participate in every round (no referral required)
      // - Non-premium members: each successful referral = 1 participation entry
      //   (used across all rounds, not per-round)
      if (hasParticipated) {
        canParticipate = false;
        blockReason = 'already_participated';
      } else if (isPremiumActive) {
        canParticipate = true;
        blockReason = '';
      } else if (entriesRemaining > 0) {
        canParticipate = true;
        blockReason = '';
      } else {
        canParticipate = false;
        blockReason = successfulReferrals === 0 ? 'no_referrals' : 'no_entries_remaining';
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
      },
      prizes: PRIZES,
      participantCount,
      hasParticipated,
      // Eligibility info for the current user
      isPremiumActive,
      successfulReferrals,
      participationsUsed,
      entriesRemaining,
      canParticipate,
      blockReason, // '', 'already_participated', 'no_referrals', 'no_entries_remaining'
      pastWinners,
    });
  } catch (error) {
    console.error('Giveaway status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/giveaway/participate
 * User joins the current giveaway round.
 *
 * Rules:
 * - Premium members: free entry, every round
 * - Non-premium members: must have at least 1 successful referral that hasn't been "used" yet.
 *   Each successful referral = 1 participation entry (across all rounds, not per-round).
 */
router.post('/giveaway/participate', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, name: true, isPremium: true, premiumExpiry: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const round = await getOrCreateActiveRound();

    // Check if already participating in this round
    const existing = await db.giveawayParticipant.findUnique({
      where: { giveawayRoundId_userId: { giveawayRoundId: round.id, userId } },
    });
    if (existing) return res.status(409).json({ error: 'Already participating in this round' });

    const isPremiumActive = !!(user.isPremium && (!user.premiumExpiry || new Date(user.premiumExpiry) > new Date()));

    // Enforce the new participation rule
    if (!isPremiumActive) {
      const successfulReferrals = await countSuccessfulReferrals(userId);
      const participationsUsed = await countPastParticipations(userId);
      const entriesRemaining = Math.max(0, successfulReferrals - participationsUsed);

      if (entriesRemaining <= 0) {
        if (successfulReferrals === 0) {
          return res.status(403).json({
            error: 'Premium membership OR at least 1 successful referral is required to participate. Share your referral code with friends — when they sign up, you earn 1 giveaway entry!',
            blockReason: 'no_referrals',
            successfulReferrals,
            entriesRemaining: 0,
          });
        } else {
          return res.status(403).json({
            error: `You've used all ${successfulReferrals} of your referral entries. Refer more friends to earn more entries, or upgrade to Premium for unlimited participation.`,
            blockReason: 'no_entries_remaining',
            successfulReferrals,
            entriesRemaining: 0,
          });
        }
      }
    }

    await db.giveawayParticipant.create({
      data: {
        giveawayRoundId: round.id,
        userId: user.id,
        phone: user.phone,
        name: user.name,
        isPremium: isPremiumActive,
      },
    });

    const participantCount = await db.giveawayParticipant.count({
      where: { giveawayRoundId: round.id },
    });

    return res.json({
      success: true,
      participantCount,
      // Return updated eligibility so frontend can refresh state without a separate fetch
      isPremiumActive,
      entriesRemaining: isPremiumActive ? null : Math.max(0, (await countSuccessfulReferrals(userId)) - (await countPastParticipations(userId)) - 1),
    });
  } catch (error) {
    console.error('Giveaway participate error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
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
    const participants = await db.giveawayParticipant.findMany({
      where: { giveawayRoundId: round.id },
      include: {
        user: { select: { id: true, playerCode: true, name: true, phone: true, isPremium: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/giveaway/admin/select-winners
 * ADMIN ONLY — Randomly selects 3 winners from the current round.
 */
router.post('/giveaway/admin/select-winners', async (req, res) => {
  try {
    const { adminId } = req.body;
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const round = await getOrCreateActiveRound();
    const participants = await db.giveawayParticipant.findMany({
      where: { giveawayRoundId: round.id },
      include: { user: { select: { id: true, playerCode: true, name: true, phone: true } } },
    });

    if (participants.length < 3) {
      return res.status(400).json({ error: `Need at least 3 participants. Current: ${participants.length}` });
    }

    // Shuffle and pick 3
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, 3);

    const winnerIds = winners.map(w => w.user.id);
    const winnersJson = JSON.stringify(winnerIds);

    await db.giveawayRound.update({
      where: { id: round.id },
      data: { status: 'completed', winnersJson },
    });

    // Create next round
    const nextNumber = round.roundNumber + 1;
    const now = new Date();
    const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
    await db.giveawayRound.create({
      data: { roundNumber: nextNumber, startDate: now, endDate, status: 'active' },
    });

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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
