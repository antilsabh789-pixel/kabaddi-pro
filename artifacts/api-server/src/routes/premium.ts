import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

/**
 * GET /api/premium
 *
 * Returns the user's REAL premium status from the DB:
 *   - isPremium: boolean (active premium, considering expiry)
 *   - premiumExpiry: ISO string | null (null = lifetime or no expiry)
 *   - premiumPlan: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'referral' | 'streak' | null
 *   - expired: boolean (true if premiumExpiry is in the past)
 *
 * Admins always report isPremium: true / premiumPlan: 'lifetime'.
 */
router.get('/premium', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isPremium: true, premiumExpiry: true, premiumPlan: true, isAdmin: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Admins always count as lifetime premium.
    if (user.isAdmin) {
      return res.json({
        isPremium: true,
        premiumExpiry: null,
        premiumPlan: 'lifetime',
        expired: false,
      });
    }

    // Real premium status check: if there's an expiry date in the past, treat as expired.
    let isPremium = user.isPremium;
    let expired = false;
    if (isPremium && user.premiumExpiry && user.premiumPlan !== 'lifetime') {
      if (user.premiumExpiry.getTime() < Date.now()) {
        isPremium = false;
        expired = true;
      }
    }

    return res.json({
      isPremium,
      premiumExpiry: user.premiumExpiry,
      premiumPlan: user.premiumPlan,
      expired,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/premium
 *
 * Backwards-compat endpoint. Kept so older clients don't break, but no longer
 * used to activate premium (premium is now activated via /api/payments/verify
 * after a successful Cashfree payment, OR via /api/referrals which grants 7
 * premium days, OR via streak milestone claims).
 */
router.post('/premium', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, playerCode: true, role: true, isAdmin: true, avatar: true, isPremium: true, premiumExpiry: true, premiumPlan: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      success: true,
      user: {
        ...user,
        // Treat admin as always-premium for client-side gating.
        isPremium: user.isAdmin ? true : user.isPremium,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
