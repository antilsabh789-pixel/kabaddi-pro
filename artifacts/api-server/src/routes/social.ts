import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

// ── Notifications ─────────────────────────────────────────────────────────────

router.get('/notifications', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const notifications = await db.notification.findMany({
      where: { userId },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { fromUser: { select: { id: true, name: true, avatar: true } } },
    });
    const unreadCount = await db.notification.count({ where: { userId, isRead: false } });
    return res.json({ notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notifications', async (req, res) => {
  try {
    const { userId, type, title, message, fromUserId, matchId } = req.body;
    if (!userId || !type || !title) return res.status(400).json({ error: 'userId, type, title required' });
    if (!fromUserId) return res.status(400).json({ error: 'fromUserId required' });
    const notification = await db.notification.create({ data: { userId, type, title, message: message || '', fromUserId, matchId: matchId || null } });
    return res.json({ notification });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/notifications', async (req, res) => {
  try {
    const { userId, notificationId, markAllRead } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (markAllRead) {
      await db.notification.updateMany({ where: { userId }, data: { isRead: true } });
    } else if (notificationId) {
      await db.notification.update({ where: { id: notificationId }, data: { isRead: true } });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Follow ────────────────────────────────────────────────────────────────────

/**
 * GET /api/follow
 *
 * Multiple modes selected by `type` query param:
 *
 *   (default, no type)         — single-target check: returns { isFollowing, followerCount }
 *                                requires userId + targetId
 *   type=counts                — returns { followerCount, followingCount } for userId
 *   type=followers             — returns { followers: [...] } — users who follow userId
 *   type=following             — returns { following: [...] } — users userId is following
 *
 * The followers/following list returns the same shape FollowerEntry expects on the
 * frontend: id, name, avatar, phone (last 4 masked), gender, playerCode, followedAt,
 * profile { position, jerseyNumber, overallRating, totalPoints, totalMatches }.
 */
router.get('/follow', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    const targetId = req.query['targetId'] as string;
    const type = (req.query['type'] as string) || '';

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // ── Counts mode ────────────────────────────────────────────────────────
    if (type === 'counts') {
      const [followerCount, followingCount] = await Promise.all([
        db.follow.count({ where: { followingId: userId } }),
        db.follow.count({ where: { followerId: userId } }),
      ]);
      return res.json({ followerCount, followingCount });
    }

    // ── Followers list (users who follow userId) ───────────────────────────
    if (type === 'followers') {
      const follows = await db.follow.findMany({
        where: { followingId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
            select: {
              id: true, name: true, avatar: true, phone: true, gender: true, playerCode: true,
              profile: { select: { position: true, jerseyNumber: true, overallRating: true, totalPoints: true, totalMatches: true } },
            },
          },
        },
      });
      const followers = follows.map((f) => ({
        id: f.follower.id,
        name: f.follower.name,
        avatar: f.follower.avatar,
        phone: f.follower.phone ? `****${f.follower.phone.slice(-4)}` : '',
        gender: f.follower.gender,
        playerCode: f.follower.playerCode,
        followedAt: f.createdAt.toISOString(),
        profile: f.follower.profile,
      }));
      return res.json({ followers });
    }

    // ── Following list (users userId is following) ─────────────────────────
    if (type === 'following') {
      const follows = await db.follow.findMany({
        where: { followerId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: {
              id: true, name: true, avatar: true, phone: true, gender: true, playerCode: true,
              profile: { select: { position: true, jerseyNumber: true, overallRating: true, totalPoints: true, totalMatches: true } },
            },
          },
        },
      });
      const following = follows.map((f) => ({
        id: f.following.id,
        name: f.following.name,
        avatar: f.following.avatar,
        phone: f.following.phone ? `****${f.following.phone.slice(-4)}` : '',
        gender: f.following.gender,
        playerCode: f.following.playerCode,
        followedAt: f.createdAt.toISOString(),
        profile: f.following.profile,
      }));
      return res.json({ following });
    }

    // ── Search mode: find players by name/playerCode (excludes users the
    //    current user is already following, so the result set is "suggested
    //    players to follow"). Used by FollowScreen's "Follow Back" check and
    //    SocialFeedScreen's "Suggested Players" rail. ──────────────────────
    if (type === 'search') {
      const search = ((req.query['search'] as string) || '').trim();
      // Pull the user's existing followings so we can exclude them.
      const myFollows = await db.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      const excludeIds = [userId, ...myFollows.map((f) => f.followingId)];

      // If a search term is provided, filter by name or playerCode (case-insensitive).
      // Otherwise return the most recently joined players as suggestions.
      const where = search
        ? {
            AND: [
              { id: { notIn: excludeIds } },
              { role: 'player' },
              { isAdmin: false },
              {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { playerCode: { contains: search, mode: 'insensitive' as const } },
                ],
              },
            ],
          }
        : {
            AND: [
              { id: { notIn: excludeIds } },
              { role: 'player' },
              { isAdmin: false },
            ],
          };

      const players = await db.user.findMany({
        where,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, avatar: true, phone: true, gender: true, playerCode: true,
          profile: { select: { position: true, jerseyNumber: true, overallRating: true, totalPoints: true, totalMatches: true } },
        },
      });

      const masked = players.map((p) => ({
        ...p,
        phone: p.phone ? `****${p.phone.slice(-4)}` : '',
      }));
      return res.json({ players: masked });
    }

    // ── Default: single-target check ──────────────────────────────────────
    if (!targetId) return res.status(400).json({ error: 'targetId or type is required' });
    const follow = await db.follow.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: targetId } } });
    const followerCount = await db.follow.count({ where: { followingId: targetId } });
    return res.json({ isFollowing: !!follow, followerCount });
  } catch (error) {
    console.error('GET /follow error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/follow
 * Body: { userId, targetId, action } OR { followerId, followingId, action }
 * The frontend uses followerId/followingId, the original handler used userId/targetId.
 * Accept BOTH aliases so existing callers keep working.
 *
 * action: 'follow' (default) | 'unfollow'
 */
router.post('/follow', async (req, res) => {
  try {
    // Accept both alias sets
    const userId = req.body.userId || req.body.followerId;
    const targetId = req.body.targetId || req.body.followingId;
    const action = req.body.action || 'follow';

    if (!userId || !targetId) return res.status(400).json({ error: 'userId (or followerId) and targetId (or followingId) are required' });

    if (action === 'unfollow') {
      await db.follow.deleteMany({ where: { followerId: userId, followingId: targetId } });
    } else {
      const existing = await db.follow.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: targetId } } });
      if (!existing) await db.follow.create({ data: { followerId: userId, followingId: targetId } });
    }

    const followerCount = await db.follow.count({ where: { followingId: targetId } });
    const isFollowing = action !== 'unfollow';
    return res.json({ success: true, isFollowing, followerCount });
  } catch (error) {
    console.error('POST /follow error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Activities ────────────────────────────────────────────────────────────────

router.get('/activities', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    const limit = parseInt((req.query['limit'] as string) || '20');
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const activities = await db.activity.findMany({ where: { userId }, take: limit, orderBy: { createdAt: 'desc' } });
    return res.json({ activities });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/activities', async (req, res) => {
  try {
    const { userId, type, title, description, metadata } = req.body;
    if (!userId || !type) return res.status(400).json({ error: 'userId and type required' });
    const activity = await db.activity.create({ data: { userId, type, title: title || type, description: description || '', metadata: metadata ? JSON.stringify(metadata) : null } });
    return res.json({ activity });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Challenges ────────────────────────────────────────────────────────────────

router.get('/challenges', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const challenges = await db.challenge.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      include: { fromUser: { select: { id: true, name: true, avatar: true, playerCode: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ challenges });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/challenges', async (req, res) => {
  try {
    const { fromUserId, toUserId, fromTeamId, toTeamId, message } = req.body;
    if (!fromUserId || !fromTeamId || !toTeamId) return res.status(400).json({ error: 'fromUserId, fromTeamId, toTeamId required' });
    const challenge = await db.challenge.create({ data: { fromUserId, toUserId: toUserId || null, fromTeamId, toTeamId, message: message || null, status: 'pending' }, include: { fromUser: { select: { id: true, name: true } } } });
    return res.json({ challenge });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/challenges', async (req, res) => {
  try {
    const { challengeId, status } = req.body;
    if (!challengeId || !status) return res.status(400).json({ error: 'challengeId and status required' });
    const challenge = await db.challenge.update({ where: { id: challengeId }, data: { status } });
    return res.json({ challenge });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Broadcast ─────────────────────────────────────────────────────────────────

router.get('/broadcast', async (req, res) => {
  try {
    const matchId = req.query['matchId'] as string;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: { select: { name: true, shortName: true, color: true } }, awayTeam: { select: { name: true, shortName: true, color: true } }, events: { orderBy: { timestamp: 'desc' }, take: 10 } },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    return res.json({ match });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/broadcast', async (req, res) => {
  try {
    const { matchId, type, data } = req.body;
    return res.json({ success: true, matchId, type });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Polls ─────────────────────────────────────────────────────────────────────

router.get('/polls', async (req, res) => {
  try {
    const polls = await db.poll.findMany({ include: { votes: true, options: true }, orderBy: { createdAt: 'desc' }, take: 10 });
    return res.json({ polls });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/polls', async (req, res) => {
  try {
    const { question, options, type, endsAt, matchId, seasonId } = req.body;
    if (!question) return res.status(400).json({ error: 'question is required' });
    const poll = await db.poll.create({
      data: {
        question,
        type: type || 'poll',
        endsAt: endsAt ? new Date(endsAt) : null,
        matchId: matchId || null,
        seasonId: seasonId || null,
        options: options && Array.isArray(options) ? { create: options.map((o: string) => ({ label: o })) } : undefined,
      },
      include: { options: true },
    });
    return res.json({ poll });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/polls/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, optionId } = req.body;
    if (!userId || !optionId) return res.status(400).json({ error: 'userId and optionId required' });

    const existing = await db.pollVote.findFirst({ where: { pollId: id, userId } });
    if (existing) return res.status(409).json({ error: 'Already voted' });

    const vote = await db.pollVote.create({ data: { pollId: id, userId, optionId } });
    const poll = await db.poll.findUnique({ where: { id }, include: { votes: true, options: true } });
    return res.json({ vote, poll });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Referrals ─────────────────────────────────────────────────────────────────

router.get('/referrals', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const referrals = await db.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: { select: { id: true, name: true, avatar: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Successful referral = someone actually signed up using the code (referredId is not null)
    const successfulReferrals = referrals.filter(r => r.referredId !== null).length;
    const totalPremiumDaysEarned = referrals
      .filter(r => r.referredId !== null)
      .reduce((sum, r) => sum + (r.premiumDays || 0), 0);

    // The user's "current" shareable code = the most recent unused code.
    // If they don't have any unused code (all previous ones were successfully used),
    // auto-generate a new one so they can keep referring.
    let referralCode = referrals.find(r => r.referredId === null)?.referralCode || '';
    if (!referralCode) {
      // Generate a fresh unused code for the user
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const newCode = `KABADDI-${code}`;
      try {
        await db.referral.create({
          data: { referrerId: userId, referralCode: newCode, premiumDays: 7 },
        });
        referralCode = newCode;
      } catch {
        // unique constraint collision — try once more with a different suffix
        const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        const retry = `KABADDI-${suffix}`;
        await db.referral.create({
          data: { referrerId: userId, referralCode: retry, premiumDays: 7 },
        });
        referralCode = retry;
      }
    }

    const formattedReferrals = referrals.map(r => ({
      id: r.id,
      status: r.referredId ? 'signed_up' : r.status,
      premiumDays: r.premiumDays,
      referredName: r.referred?.name || 'Pending signup',
      referredAvatar: r.referred?.avatar || null,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    }));

    return res.json({
      referralCode,
      successfulReferrals,
      totalReferrals: referrals.length,
      totalPremiumDaysEarned,
      referrals: formattedReferrals,
      // Keep `count` for backward compat with any old callers
      count: referrals.length,
    });
  } catch (error) {
    console.error('Referrals fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/referrals
 * Apply a referral code — the current user (userId) is "claiming" the code shared by someone else.
 *
 * Body: { referralCode, userId }
 *   - referralCode: the code shared by the referrer (e.g. "KABADDI-ABC123")
 *   - userId: the user who is applying the code (the referred person)
 *
 * Behavior:
 *   1. Look up the Referral record by referralCode where referredId is null (an unused code)
 *   2. Make sure the applier is NOT the referrer (can't refer yourself)
 *   3. Set referredId = userId, status = 'signed_up', completedAt = now
 *   4. Grant premiumDays (default 7) to BOTH the referrer and the referred user
 *
 * Returns: { success, premiumDaysGranted }
 */
router.post('/referrals', async (req, res) => {
  try {
    const { referralCode, userId } = req.body;
    if (!referralCode || !userId) {
      return res.status(400).json({ error: 'referralCode and userId are required' });
    }

    const code = String(referralCode).toUpperCase().trim();

    // Find the unused referral record matching this code
    const referral = await db.referral.findFirst({
      where: { referralCode: code, referredId: null },
    });

    if (!referral) {
      return res.status(404).json({
        error: 'Invalid or already-used referral code',
      });
    }

    // Can't refer yourself
    if (referral.referrerId === userId) {
      return res.status(400).json({ error: 'You cannot use your own referral code' });
    }

    // Check if this user has already been referred by someone else (one referral per user)
    const existingReferred = await db.referral.findFirst({
      where: { referredId: userId },
    });
    if (existingReferred) {
      return res.status(409).json({ error: 'You have already used a referral code' });
    }

    // Mark the referral as completed
    await db.referral.update({
      where: { id: referral.id },
      data: {
        referredId: userId,
        status: 'signed_up',
        completedAt: new Date(),
      },
    });

    // Grant premium days to BOTH the referrer and the referred user.
    // IMPORTANT: Don't stomp existing premium — extend from the later of (now, existing expiry).
    const premiumDays = referral.premiumDays || 7;
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    const [referrer, referredUser] = await Promise.all([
      db.user.findUnique({ where: { id: referral.referrerId }, select: { isPremium: true, premiumExpiry: true, premiumPlan: true } }),
      db.user.findUnique({ where: { id: userId }, select: { isPremium: true, premiumExpiry: true, premiumPlan: true } }),
    ]);

    const referrerExpiry = referrer?.premiumExpiry ? new Date(referrer.premiumExpiry) : null;
    const referrerBase = (referrer?.isPremium && referrerExpiry && referrerExpiry > now) ? referrerExpiry : now;
    const referrerNewExpiry = new Date(referrerBase.getTime() + premiumDays * dayMs);

    const referredExpiry = referredUser?.premiumExpiry ? new Date(referredUser.premiumExpiry) : null;
    const referredBase = (referredUser?.isPremium && referredExpiry && referredExpiry > now) ? referredExpiry : now;
    const referredNewExpiry = new Date(referredBase.getTime() + premiumDays * dayMs);

    await Promise.all([
      db.user.update({
        where: { id: referral.referrerId },
        data: {
          isPremium: true,
          premiumExpiry: referrerNewExpiry,
          premiumPlan: (referrer?.isPremium && referrerExpiry && referrerExpiry > now && referrer?.premiumPlan && referrer.premiumPlan !== 'referral') ? referrer.premiumPlan : 'referral',
        },
      }),
      db.user.update({
        where: { id: userId },
        data: {
          isPremium: true,
          premiumExpiry: referredNewExpiry,
          premiumPlan: (referredUser?.isPremium && referredExpiry && referredExpiry > now && referredUser?.premiumPlan && referredUser.premiumPlan !== 'referral') ? referredUser.premiumPlan : 'referral',
        },
      }),
    ]);

    return res.json({
      success: true,
      premiumDaysGranted: premiumDays,
    });
  } catch (error) {
    console.error('Referral apply error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/referrals/generate-code
 * Generate (or return existing) referral code for the current user.
 * Creates a new Referral record with referredId=null (an unused code the user can share).
 *
 * Body: { userId }
 * Returns: { referralCode }
 */
router.post('/referrals/generate-code', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Look for an existing unused code first (so the user doesn't end up with many unused codes)
    const existing = await db.referral.findFirst({
      where: { referrerId: userId, referredId: null },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return res.json({ referralCode: existing.referralCode });
    }

    // Generate a new unique code: KABADDI-<6 random chars>
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const referralCode = `KABADDI-${code}`;

    // Ensure uniqueness (extremely unlikely to collide, but be safe)
    const collision = await db.referral.findUnique({ where: { referralCode } });
    if (collision) {
      // Retry once with a longer suffix
      const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
      const retryCode = `KABADDI-${suffix}`;
      await db.referral.create({
        data: { referrerId: userId, referralCode: retryCode, premiumDays: 7 },
      });
      return res.json({ referralCode: retryCode });
    }

    await db.referral.create({
      data: { referrerId: userId, referralCode, premiumDays: 7 },
    });

    return res.json({ referralCode });
  } catch (error) {
    console.error('Generate referral code error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Achievements ──────────────────────────────────────────────────────────────

router.get('/achievements', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const achievements = await db.userAchievement.findMany({ where: { userId }, include: { achievement: true }, orderBy: { unlockedAt: 'desc' } });
    return res.json({ achievements });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
