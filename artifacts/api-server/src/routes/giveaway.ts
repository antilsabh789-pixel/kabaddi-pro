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
 *
 * FREE-ENTRY ADJUSTMENT: Every user gets 1 LIFETIME FREE entry (no premium, no referral required).
 * If the user's first-ever participation was non-premium, it was the "free entry" and does NOT
 * consume a referral slot. We subtract 1 from the count in that case.
 */
async function countPastParticipations(userId: string): Promise<number> {
  const nonPremiumCount = await db.giveawayParticipant.count({
    where: { userId, isPremium: false },
  });

  // Check if the user's FIRST participation was non-premium (i.e. it was the free entry).
  // If so, that participation did NOT consume a referral slot — subtract it.
  const firstParticipation = await db.giveawayParticipant.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { isPremium: true },
  });

  if (firstParticipation && !firstParticipation.isPremium) {
    return Math.max(0, nonPremiumCount - 1);
  }
  return nonPremiumCount;
}

/**
 * Count ALL past participations by this user (premium + non-premium).
 * Used to determine if the user has used their 1 lifetime free entry.
 * If totalParticipations > 0, the free entry has been used.
 */
async function countAllPastParticipations(userId: string): Promise<number> {
  return db.giveawayParticipant.count({
    where: { userId },
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
    let freeEntryAvailable = false;
    let hasUsedFreeEntry = false;

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

      // FREE ENTRY: Every user gets 1 lifetime free entry (no premium, no referral needed).
      // The free entry is available if the user has NEVER participated in ANY round before.
      const totalPastParticipations = await countAllPastParticipations(userId);
      hasUsedFreeEntry = totalPastParticipations > 0;
      freeEntryAvailable = !hasUsedFreeEntry;

      // Participation rules (evaluated in priority order):
      // 1. Already in this round → blocked
      // 2. Free entry available → allowed (no other requirements)
      // 3. Premium active → allowed (free entry every round)
      // 4. Referral entries remaining → allowed
      // 5. Otherwise → blocked
      if (hasParticipated) {
        canParticipate = false;
        blockReason = 'already_participated';
      } else if (freeEntryAvailable) {
        canParticipate = true;
        blockReason = '';
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
      isPremiumActive,
      successfulReferrals,
      participationsUsed,
      entriesRemaining,
      freeEntryAvailable, // true if user hasn't used their 1 lifetime free entry
      hasUsedFreeEntry,
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

    // FREE ENTRY: Every user gets 1 lifetime free entry (no premium, no referral needed).
    // Check if the user has EVER participated before. If not, this is their free entry.
    const totalPastParticipations = await countAllPastParticipations(userId);
    const freeEntryAvailable = totalPastParticipations === 0;

    // Enforce the participation rule:
    // 1. Free entry available → allow (no other requirements)
    // 2. Premium active → allow (free entry every round)
    // 3. Referral entries remaining → allow
    // 4. Otherwise → block
    if (!freeEntryAvailable && !isPremiumActive) {
      const successfulReferrals = await countSuccessfulReferrals(userId);
      const participationsUsed = await countPastParticipations(userId);
      const entriesRemaining = Math.max(0, successfulReferrals - participationsUsed);

      if (entriesRemaining <= 0) {
        if (successfulReferrals === 0) {
          return res.status(403).json({
            error: 'Your free entry has been used. Refer a friend or buy a ₹2 daily premium to participate again!',
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
      freeEntryAvailable: false, // just used it
      // countPastParticipations already includes the participation we just created,
      // so no extra `- 1` needed here — the math mirrors /status exactly.
      entriesRemaining: isPremiumActive ? null : Math.max(0, (await countSuccessfulReferrals(userId)) - (await countPastParticipations(userId))),
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
    return res.status(500).json({ error: 'Internal server error' });
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
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // 1. Mark the current active round as 'completed' (don't delete it!)
    //    This preserves its participants and winnersJson for the Past Winners section.
    await db.giveawayRound.updateMany({
      where: { status: 'active' },
      data: { status: 'completed' },
    });

    // 2. Create a new round with the next round number + 15-day countdown
    const lastRound = await db.giveawayRound.findFirst({ orderBy: { roundNumber: 'desc' } });
    const nextNumber = (lastRound?.roundNumber || 0) + 1;
    const now = new Date();
    const endDate = new Date(now.getTime() + ROUND_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const newRound = await db.giveawayRound.create({
      data: { roundNumber: nextNumber, startDate: now, endDate, status: 'active' },
    });

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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
