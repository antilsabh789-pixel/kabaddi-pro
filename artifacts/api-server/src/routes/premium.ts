import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

router.get('/premium', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await db.user.findUnique({ where: { id: userId }, select: { isPremium: true, premiumExpiry: true, premiumPlan: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let expired = false;
    if (user.isPremium && user.premiumExpiry && new Date(user.premiumExpiry) < new Date()) {
      expired = true;
      await db.user.update({ where: { id: userId }, data: { isPremium: false, premiumExpiry: null, premiumPlan: null } });
    }

    return res.json({ isPremium: expired ? false : user.isPremium, premiumExpiry: expired ? null : user.premiumExpiry, premiumPlan: expired ? null : user.premiumPlan, expired });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/premium', async (req, res) => {
  try {
    const { userId, plan, action } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    if (action === 'activate') {
      const now = new Date();
      let premiumExpiry: Date | null = null;
      switch (plan) {
        case 'daily': premiumExpiry = new Date(now.getTime() + 86400000); break;
        case 'weekly': premiumExpiry = new Date(now.getTime() + 7 * 86400000); break;
        case 'monthly': premiumExpiry = new Date(now.getTime() + 30 * 86400000); break;
        case 'yearly': premiumExpiry = new Date(now.getTime() + 365 * 86400000); break;
        case 'lifetime': premiumExpiry = null; break;
        default: premiumExpiry = new Date(now.getTime() + 30 * 86400000);
      }

      const existingUser = await db.user.findUnique({ where: { id: userId }, select: { isPremium: true, premiumExpiry: true, premiumPlan: true } });
      let effectiveExpiry = premiumExpiry;
      if (existingUser?.isPremium && existingUser.premiumExpiry && plan !== 'lifetime') {
        const currentExpiry = new Date(existingUser.premiumExpiry);
        if (currentExpiry > now && premiumExpiry) {
          const extensionMs = premiumExpiry.getTime() - now.getTime();
          effectiveExpiry = new Date(currentExpiry.getTime() + extensionMs);
        }
      }

      const user = await db.user.update({ where: { id: userId }, data: { isPremium: true, premiumExpiry: effectiveExpiry, premiumPlan: plan || 'monthly' } });
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ success: true, user: userWithoutPassword });
    }

    if (action === 'deactivate') {
      const user = await db.user.update({ where: { id: userId }, data: { isPremium: false, premiumExpiry: null, premiumPlan: null } });
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ success: true, user: userWithoutPassword });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
