import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

/**
 * GET /api/premium
 *
 * As of the "all-free" refactor, every feature in the app is free for all
 * users. There is no premium tier anymore. To keep the existing frontend
 * code path working without a flag-day rewrite, we simply report
 * `isPremium: true` for every user (and no expiry).
 *
 * The frontend reads this on app load and writes it into the Zustand store,
 * which in turn causes every `currentUser.isPremium` check across the app
 * to evaluate to `true`. This effectively unlocks:
 *   - PremiumLock-wrapped screens (Compare Teams, Advanced Stats, Match
 *     Highlights, Polls, Season, Coach Dashboard, Player Profile stats, etc.)
 *   - The "PRO" crown badge on the profile
 *   - Free-entry-every-round logic in the giveaway (which we override
 *     separately — see /api/giveaway routes for the new ₹2-OR-referral rule)
 */
router.get('/premium', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Touch the user row so we 404 cleanly if the id is stale, but we no
    // longer read or write isPremium / premiumExpiry / premiumPlan here.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      isPremium: true,
      premiumExpiry: null,
      premiumPlan: 'lifetime',
      expired: false,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/premium
 *
 * Kept for backwards-compatibility with any client code that still calls
 * `action: 'activate' | 'deactivate'`. Now a no-op — everyone is premium
 * by default and there's nothing to activate or deactivate.
 */
router.post('/premium', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, phone: true, playerCode: true, role: true, isAdmin: true, avatar: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Do NOT touch isPremium/premiumExpiry/premiumPlan — leave whatever the
    // user already has. The frontend treats everyone as unlocked now.
    return res.json({ success: true, user: { ...user, isPremium: true } });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
