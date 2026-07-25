import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

/**
 * Admin-only routes for managing users.
 *
 * All routes require `adminId` in the body/query and verify the user is an admin
 * before performing any action.
 */

/**
 * POST /api/admin/gift-premium
 * Body: { adminId, playerCode, plan }
 *
 * Grants premium to the user matching `playerCode` (e.g. "KP1001").
 * `plan` must be one of: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime'
 *
 * Premium expiry logic mirrors /api/premium:
 *   - If the user already has active premium, EXTEND from their current expiry
 *     (not from now) so they don't lose paid days.
 *   - Lifetime sets expiry to null (never expires).
 *   - premiumPlan is set to the gifted plan, BUT if the user already has a
 *     'better' plan (e.g. they're a paying yearly subscriber and you gift them
 *     a daily), we keep their existing plan label so analytics stay accurate.
 *
 * Returns: { success, user: { id, name, playerCode, phone, isPremium, premiumExpiry, premiumPlan } }
 */
router.post('/admin/gift-premium', async (req, res) => {
  try {
    const { adminId, playerCode, plan } = req.body;

    // Validate inputs
    if (!adminId || !playerCode || !plan) {
      return res.status(400).json({ error: 'adminId, playerCode, and plan are required' });
    }

    const validPlans = ['daily', 'weekly', 'monthly', 'yearly', 'lifetime'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: `plan must be one of: ${validPlans.join(', ')}` });
    }

    // Verify the caller is an admin
    const admin = await db.user.findUnique({
      where: { id: adminId },
      select: { isAdmin: true, name: true },
    });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Find the target user by playerCode (case-insensitive via toUpperCase)
    const code = String(playerCode).trim().toUpperCase();
    const targetUser = await db.user.findUnique({
      where: { playerCode: code },
      select: {
        id: true, name: true, playerCode: true, phone: true,
        isPremium: true, premiumExpiry: true, premiumPlan: true,
      },
    });

    if (!targetUser) {
      return res.status(404).json({
        error: `No user found with player code "${code}". Make sure the code is correct (e.g. KP1001).`,
      });
    }

    // Don't let admin gift premium to themselves (they already have it)
    if (targetUser.id === adminId) {
      return res.status(400).json({ error: 'You already have premium access as an admin.' });
    }

    // Compute the new premium expiry
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    let newExpiry: Date | null;
    switch (plan) {
      case 'daily':   newExpiry = new Date(now.getTime() + 1 * dayMs); break;
      case 'weekly':  newExpiry = new Date(now.getTime() + 7 * dayMs); break;
      case 'monthly': newExpiry = new Date(now.getTime() + 30 * dayMs); break;
      case 'yearly':  newExpiry = new Date(now.getTime() + 365 * dayMs); break;
      case 'lifetime': newExpiry = null; break;
      default:        newExpiry = new Date(now.getTime() + 30 * dayMs);
    }

    // If the user already has active premium AND the new plan isn't lifetime,
    // EXTEND from their current expiry (don't stomp their remaining days).
    let effectiveExpiry = newExpiry;
    if (targetUser.isPremium && targetUser.premiumExpiry && plan !== 'lifetime') {
      const currentExpiry = new Date(targetUser.premiumExpiry);
      if (currentExpiry > now && newExpiry) {
        // Add the gifted duration to their CURRENT expiry (not to now)
        const extensionMs = newExpiry.getTime() - now.getTime();
        effectiveExpiry = new Date(currentExpiry.getTime() + extensionMs);
      }
    }

    // Decide the premiumPlan label to store.
    // If the user is a paying subscriber with a 'better' plan, keep their label.
    // Otherwise, use the gifted plan. We rank plans so we don't downgrade the label.
    const planRank: Record<string, number> = { daily: 1, weekly: 2, monthly: 3, yearly: 4, lifetime: 5, referral: 1, streak: 1 };
    const currentRank = targetUser.premiumPlan ? (planRank[targetUser.premiumPlan] || 0) : 0;
    const giftedRank = planRank[plan] || 0;
    const effectivePlan = currentRank > giftedRank ? targetUser.premiumPlan : plan;

    // Apply the premium
    const updated = await db.user.update({
      where: { id: targetUser.id },
      data: {
        isPremium: true,
        premiumExpiry: effectiveExpiry,
        premiumPlan: effectivePlan,
      },
      select: {
        id: true, name: true, playerCode: true, phone: true,
        isPremium: true, premiumExpiry: true, premiumPlan: true,
      },
    });

    // Log this as an activity on the target user (for audit trail)
    try {
      await db.activity.create({
        data: {
          userId: targetUser.id,
          type: 'premium_gifted',
          title: 'Premium Gifted by Admin',
          description: `${plan} premium gifted by admin (${admin.name || 'Unknown'})`,
          metadata: JSON.stringify({ plan, adminId, adminName: admin.name || null, giftedAt: now.toISOString() }),
        },
      });
    } catch {
      // Non-critical — don't fail the gift if activity logging fails
    }

    return res.json({
      success: true,
      message: `Premium gifted to ${updated.name || updated.playerCode || 'user'}`,
      user: {
        id: updated.id,
        name: updated.name,
        playerCode: updated.playerCode,
        phone: updated.phone ? `****${updated.phone.slice(-4)}` : null,
        isPremium: updated.isPremium,
        premiumExpiry: updated.premiumExpiry,
        premiumPlan: updated.premiumPlan,
      },
    });
  } catch (error) {
    console.error('Admin gift-premium error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/lookup-player?adminId=...&playerCode=...
 * Looks up a user by player code (for the admin panel to preview before gifting).
 * Returns limited info (name, playerCode, current premium status) — NO phone.
 */
router.get('/admin/lookup-player', async (req, res) => {
  try {
    const adminId = (req.query['adminId'] as string) || '';
    const playerCode = (req.query['playerCode'] as string) || '';

    if (!adminId || !playerCode) {
      return res.status(400).json({ error: 'adminId and playerCode are required' });
    }

    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const code = String(playerCode).trim().toUpperCase();
    const user = await db.user.findUnique({
      where: { playerCode: code },
      select: {
        id: true, name: true, playerCode: true, phone: true, avatar: true,
        isPremium: true, premiumExpiry: true, premiumPlan: true,
        gender: true, weight: true, practiceGround: true, location: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: `No user found with player code "${code}"` });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        playerCode: user.playerCode,
        phone: user.phone, // Admin can see full phone for prize contact
        avatar: user.avatar,
        isPremium: user.isPremium,
        premiumExpiry: user.premiumExpiry,
        premiumPlan: user.premiumPlan,
        gender: user.gender,
        weight: user.weight,
        practiceGround: user.practiceGround,
        location: user.location,
        memberSince: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Admin lookup-player error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/players?adminId=...&page=1&limit=50&search=...
 *
 * Returns ALL registered users EXCEPT admins — regardless of role (player,
 * coach, etc.). The coach role is being deprecated; everyone is now treated
 * as a player. Admin sees full phone (for prize contact) + premium status +
 * member-since date.
 *
 * Query params:
 *   adminId (required) — must be an admin
 *   page    (default 1)
 *   limit   (default 50, max 200)
 *   search  (optional) — case-insensitive match on name / playerCode / phone
 *   role    (optional) — filter by role ('player' | 'coach' | 'all'). Defaults
 *            to 'all' so no one is hidden from the admin.
 *
 * Response: {
 *   players: [{ id, name, playerCode, phone, avatar, gender, isPremium,
 *               premiumExpiry, premiumPlan, role, location, practiceGround, memberSince }],
 *   total: number,
 *   page: number,
 *   limit: number,
 *   totalPages: number,
 * }
 */
router.get('/admin/players', async (req, res) => {
  try {
    const adminId = (req.query['adminId'] as string) || '';
    const page = Math.max(1, parseInt((req.query['page'] as string) || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt((req.query['limit'] as string) || '50', 10)));
    const search = ((req.query['search'] as string) || '').trim();
    const roleFilter = ((req.query['role'] as string) || 'all').toLowerCase();

    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Build the where clause: everyone EXCEPT admins (so players + coaches +
    // any future role all show up). Optionally narrow by an explicit role
    // filter if the admin wants to see only one role.
    const where: Record<string, unknown> = {
      isAdmin: false,
    };
    if (roleFilter === 'player' || roleFilter === 'coach') {
      where.role = roleFilter;
    }
    // roleFilter === 'all' (default) → no role filter, everyone shows up

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { playerCode: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        select: {
          id: true, name: true, playerCode: true, phone: true, avatar: true,
          isPremium: true, premiumExpiry: true, premiumPlan: true,
          role: true, showCoachBadge: true,
          gender: true, weight: true, practiceGround: true, location: true,
          createdAt: true, provisional: true,
        },
        orderBy: { createdAt: 'desc' }, // newest first
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const players = users.map((u) => ({
      id: u.id,
      name: u.name,
      playerCode: u.playerCode,
      phone: u.phone, // admin can see full phone for prize contact
      avatar: u.avatar,
      isPremium: u.isPremium,
      premiumExpiry: u.premiumExpiry,
      premiumPlan: u.premiumPlan,
      role: u.role,
      showCoachBadge: u.showCoachBadge,
      gender: u.gender,
      weight: u.weight,
      practiceGround: u.practiceGround,
      location: u.location,
      memberSince: u.createdAt,
      provisional: u.provisional,
    }));

    return res.json({
      players,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Admin players list error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/migrate-coaches-to-players
 * ADMIN ONLY — One-time migration: set role='player' for every user whose
 * role is currently 'coach'. The coach role is being deprecated; everyone is
 * now a normal player (the Coach Corner feature is available to all).
 *
 * Body: { adminId }
 * Returns: { success, migratedCount }
 */
router.post('/admin/migrate-coaches-to-players', async (req, res) => {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await db.user.updateMany({
      where: { role: 'coach', isAdmin: false },
      data: {
        role: 'player',
        // Preserve the coach identity cosmetically — the user asked for a
        // "Coach Badge" toggle in the profile. Former coaches get the badge
        // auto-enabled so they don't lose their identity; they can toggle it
        // off in their profile editor if they don't want it.
        showCoachBadge: true,
      },
    });

    return res.json({
      success: true,
      migratedCount: result.count,
      message: result.count === 0
        ? 'No coaches to migrate — everyone is already a player.'
        : `Migrated ${result.count} coach${result.count === 1 ? '' : 'es'} to player role.`,
    });
  } catch (error) {
    console.error('Migrate coaches to players error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Ad Settings ────────────────────────────────────────────────────────────

router.get('/ads/config', async (req, res) => {
  try {
    const keys = ['ads_enabled', 'adsense_publisher_id', 'home_banner_slot', 'feed_native_slot', 'profile_banner_slot'];
    const settings = await db.appSetting.findMany({ where: { key: { in: keys } } });
    const map = new Map(settings.map(s => [s.key, s.value]));
    return res.json({
      adsEnabled: map.get('ads_enabled') === 'true',
      publisherId: map.get('adsense_publisher_id') || null,
      homeBannerSlot: map.get('home_banner_slot') || null,
      feedNativeSlot: map.get('feed_native_slot') || null,
      profileBannerSlot: map.get('profile_banner_slot') || null,
    });
  } catch (error) {
    console.error('Ads config fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/admin/ads/config', async (req, res) => {
  try {
    const { adminId, adsEnabled, publisherId, homeBannerSlot, feedNativeSlot, profileBannerSlot } = req.body;
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });
    const admin = await db.user.findUnique({ where: { id: adminId }, select: { isAdmin: true } });
    if (!admin || !admin.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const updates: { key: string; value: string }[] = [];
    if (adsEnabled !== undefined) updates.push({ key: 'ads_enabled', value: adsEnabled ? 'true' : 'false' });
    if (publisherId !== undefined) updates.push({ key: 'adsense_publisher_id', value: String(publisherId).trim() });
    if (homeBannerSlot !== undefined) updates.push({ key: 'home_banner_slot', value: String(homeBannerSlot).trim() });
    if (feedNativeSlot !== undefined) updates.push({ key: 'feed_native_slot', value: String(feedNativeSlot).trim() });
    if (profileBannerSlot !== undefined) updates.push({ key: 'profile_banner_slot', value: String(profileBannerSlot).trim() });

    for (const u of updates) {
      await db.appSetting.upsert({ where: { key: u.key }, create: { key: u.key, value: u.value }, update: { value: u.value } });
    }
    return res.json({ success: true, message: `Updated ${updates.length} setting(s)` });
  } catch (error) {
    console.error('Ads config update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
