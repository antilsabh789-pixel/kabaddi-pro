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
 * We track this by writing `isPremium=false` on referral-funded entries and
 * `isPremium=true` on ₹2-fee-funded entries (the legacy field name is reused
 * as a "paid entry" flag — it has nothing to do with the old premium tier
 * anymore).
 */
async function countReferralEntriesUsed(userId: string): Promise<number> {
  return db.giveawayParticipant.count({
    where: { userId, isPremium: false },
  });
}

/**
 * Count ALL past participations by this user (referral + paid).
 */
async function countAllPastParticipations(userId: string): Promise<number> {
  return db.giveawayParticipant.count({
    where: { userId },
  });
}

/**
 * GET /api/giveaway/status
 * Returns the current active round, time remaining, participant count, prizes,
 * and the user's eligibility info (referral entries remaining, whether they can pay ₹2).
 *
 * NEW RULE (post-premium removal):
 *   - Every user gets ONE FREE entry the first time they ever participate.
 *   - After that, each round requires EITHER:
 *       (a) at least 1 unused successful referral, OR
 *       (b) a ₹2 entry fee (paid via Cashfree through /giveaway/create-entry-order).
 *   - There is no more "premium tier" — premium status is irrelevant for giveaway entry.
 */
router.get('/giveaway/status', async (req, res) => {
  try {
    const userId = (req.query['userId'] as string) || '';
    const round = await getOrCreateActiveRound();
    const participantCount = await db.giveawayParticipant.count({
      where: { giveawayRoundId: round.id },
    });

    let hasParticipated = false;
    let successfulReferrals = 0;
    let referralEntriesUsed = 0;
    let referralEntriesRemaining = 0;
    let canParticipate = false;
    let blockReason = '';
    let freeEntryAvailable = false;
    let hasUsedFreeEntry = false;
    const entryFeeInr = GIVEAWAY_ENTRY_FEE_INR;

    if (userId) {
      const existing = await db.giveawayParticipant.findUnique({
        where: { giveawayRoundId_userId: { giveawayRoundId: round.id, userId } },
      });
      hasParticipated = !!existing;

      successfulReferrals = await countSuccessfulReferrals(userId);
      referralEntriesUsed = await countReferralEntriesUsed(userId);
      referralEntriesRemaining = Math.max(0, successfulReferrals - referralEntriesUsed);

      // Every user gets 1 LIFETIME FREE entry (no referral, no ₹2 fee).
      const totalPastParticipations = await countAllPastParticipations(userId);
      hasUsedFreeEntry = totalPastParticipations > 0;
      freeEntryAvailable = !hasUsedFreeEntry;

      // Participation rules (evaluated in priority order):
      // 1. Already in this round → blocked
      // 2. Free entry available → allowed (no other requirements)
      // 3. Referral entries remaining → allowed (referral path)
      // 4. Otherwise → still allowed via ₹2 fee (frontend will offer the option).
      //    The backend never blocks a logged-in user from entering because they can
      //    always pay ₹2. We only set blockReason for the UI to know which CTA to show.
      if (hasParticipated) {
        canParticipate = false;
        blockReason = 'already_participated';
      } else if (freeEntryAvailable) {
        canParticipate = true;
        blockReason = '';
      } else if (referralEntriesRemaining > 0) {
        canParticipate = true;
        blockReason = ''; // referral path available
      } else {
        // No referral entries left — user must pay ₹2. Backend still reports
        // canParticipate=true because the ₹2 path is always open. The frontend
        // uses blockReason to decide which button to show (Pay ₹2 vs Participate).
        canParticipate = true;
        blockReason = 'payment_required';
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
      canParticipate,
      blockReason, // '', 'already_participated', 'payment_required'
      entryFeeInr, // '2.00' — shown in the UI
      pastWinners,
    });
  } catch (error) {
    console.error('Giveaway status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/giveaway/participate
 * User joins the current giveaway round using a REFERRAL entry (or their one-time free entry).
 *
 * Rules (post-premium removal):
 *   - If the user has never participated in ANY round before → FREE entry (lifetime, one-time).
 *   - Else if the user has at least 1 unused successful referral → consume one referral entry.
 *   - Else → REJECT with blockReason='payment_required'. The frontend should redirect to
 *     /giveaway/create-entry-order to collect the ₹2 fee instead.
 *
 * The `isPremium` field on GiveawayParticipant is now used as a "paid entry" flag:
 *   - isPremium=false → referral-funded entry (free entry counts as referral-funded here)
 *   - isPremium=true  → ₹2-fee-funded entry (set by /giveaway/verify-entry-payment)
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

    // FREE ENTRY: 1 lifetime free entry for brand-new users.
    const totalPastParticipations = await countAllPastParticipations(userId);
    const freeEntryAvailable = totalPastParticipations === 0;

    if (!freeEntryAvailable) {
      // Need a referral entry — if none left, reject and tell the client to pay ₹2.
      const successfulReferrals = await countSuccessfulReferrals(userId);
      const referralEntriesUsed = await countReferralEntriesUsed(userId);
      const referralEntriesRemaining = Math.max(0, successfulReferrals - referralEntriesUsed);

      if (referralEntriesRemaining <= 0) {
        return res.status(403).json({
          error: 'No referral entries left. Pay a ₹2 entry fee to participate in this round.',
          blockReason: 'payment_required',
          successfulReferrals,
          referralEntriesRemaining: 0,
          entryFeeInr: GIVEAWAY_ENTRY_FEE_INR,
        });
      }
    }

    // Create the participant record. isPremium=false means "referral-funded entry"
    // (which includes the one-time free entry — both are non-paid).
    await db.giveawayParticipant.create({
      data: {
        giveawayRoundId: round.id,
        userId: user.id,
        phone: user.phone,
        name: user.name,
        isPremium: false,
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
      freeEntryAvailable: false, // just used it (either the lifetime free one or a referral slot)
      referralEntriesRemaining,
      entryFundedBy: freeEntryAvailable ? 'free_entry' : 'referral',
    });
  } catch (error) {
    console.error('Giveaway participate error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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
        return_url: returnUrl || `${process.env['APP_URL'] || ''}/?giveaway_payment=success&order_id={order_id}`,
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
      console.error('Cashfree giveaway order creation failed:', err);
      return res.status(502).json({ error: 'Payment gateway error', details: err });
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

    if (!cfResponse.ok) return res.status(502).json({ error: 'Could not verify payment with gateway' });
    const cfOrder = await cfResponse.json() as { order_status?: string };

    if (cfOrder.order_status !== 'PAID') {
      return res.json({ success: false, status: cfOrder.order_status });
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
