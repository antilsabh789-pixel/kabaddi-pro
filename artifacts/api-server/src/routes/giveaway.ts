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
 *
 * IMPORTANT: Only counts participations where isPremium=FALSE (i.e. referral-funded entries).
 * Participations where the user was premium at entry time (e.g. they bought a ₹2 daily premium)
 * do NOT consume referral entries — those were "free" entries earned by being premium that day.
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
 * - Premium members (ANY active plan: daily ₹2, weekly, monthly, yearly, lifetime):
 *   free entry, every round. The premium status is checked AT THE MOMENT of participation.
 *   Once the GiveawayParticipant record is created, it is PERMANENT — even if the user's
 *   premium expires minutes later, they remain a participant in this round and can win.
 *   This ensures users who buy a ₹2 daily premium specifically to enter the giveaway
 *   are not penalized if the daily plan expires before the round ends (15 days later).
 *
 * - Non-premium members: must have at least 1 successful referral that hasn't been "used" yet.
 *   Each successful referral = 1 participation entry (across all rounds, not per-round).
 *
 * The `isPremium` field on the GiveawayParticipant record is a SNAPSHOT of the user's
 * premium status at participation time. It is NOT updated when premium expires.
 */
router.post('/giveaway/participate', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, name: true, isPremium: true, premiumExpiry: true, premiumPlan: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const round = await getOrCreateActiveRound();

    // Check if already participating in this round
    const existing = await db.giveawayParticipant.findUnique({
      where: { giveawayRoundId_userId: { giveawayRoundId: round.id, userId } },
    });
    if (existing) return res.status(409).json({ error: 'Already participating in this round' });

    // Premium is "active" if the user has isPremium=true AND (no expiry OR expiry is in the future).
    // This covers ALL premium plans — daily ₹2, weekly, monthly, yearly, lifetime.
    // The check happens HERE, at participation time. The result is snapshotted into the
    // GiveawayParticipant record (isPremium field) and never changes after that.
    const isPremiumActive = !!(user.isPremium && (!user.premiumExpiry || new Date(user.premiumExpiry) > new Date()));

    // Enforce the participation rule
    if (!isPremiumActive) {
      const successfulReferrals = await countSuccessfulReferrals(userId);
      const participationsUsed = await countPastParticipations(userId);
      const entriesRemaining = Math.max(0, successfulReferrals - participationsUsed);

      if (entriesRemaining <= 0) {
        if (successfulReferrals === 0) {
          return res.status(403).json({
            error: 'Premium membership OR at least 1 successful referral is required to participate. Buy a ₹2 daily premium or share your referral code with friends!',
            blockReason: 'no_referrals',
            successfulReferrals,
            entriesRemaining: 0,
          });
        } else {
          return res.status(403).json({
            error: `You've used all ${successfulReferrals} of your referral entries. Refer more friends, or buy a ₹2 daily premium to participate in this round.`,
            blockReason: 'no_entries_remaining',
            successfulReferrals,
            entriesRemaining: 0,
          });
        }
      }
    }

    // Create the participant record — isPremium is a SNAPSHOT at this moment.
    // Even if the user's premium expires 1 minute later, this record stays
    // and they remain eligible to win when the round ends.
    await db.giveawayParticipant.create({
      data: {
        giveawayRoundId: round.id,
        userId: user.id,
        phone: user.phone,
        name: user.name,
        isPremium: isPremiumActive, // snapshot — permanent
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
      premiumPlan: user.premiumPlan,
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
 *
 * IMPORTANT: Winners are selected from ALL participants of the round, regardless of
 * their CURRENT premium status. A user who bought a ₹2 daily premium, participated,
 * and then had their premium expire is STILL eligible to win — their participation
 * was locked in at the moment they entered. We do NOT re-check premium status here.
 */
router.post('/giveaway/admin/select-winners', async (req, res) => {
  try {
    const { adminId } = req.body;
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const round = await getOrCreateActiveRound();
    // Fetch ALL participants — no premium-status filter. Once a user is in, they're in.
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

/**
 * POST /api/giveaway/admin/reset
 * ADMIN ONLY — Resets the entire giveaway system:
 *   1. Marks ALL existing rounds as 'completed'
 *   2. Deletes ALL participants from ALL rounds
 *   3. Creates a fresh Round 1 with 15-day countdown starting now
 *   4. Clears all past winners
 */
router.post('/giveaway/admin/reset', async (req, res) => {
  try {
    const { adminId } = req.body;
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // 1. Mark all rounds as completed
    await db.giveawayRound.updateMany({
      where: { status: 'active' },
      data: { status: 'completed' },
    });

    // 2. Delete ALL participants
    await db.giveawayParticipant.deleteMany({});

    // 3. Create fresh Round 1
    const now = new Date();
    const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const newRound = await db.giveawayRound.create({
      data: { roundNumber: 1, startDate: now, endDate, status: 'active' },
    });

    return res.json({
      success: true,
      message: 'Giveaway reset successfully. New Round 1 started with 0 participants.',
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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
