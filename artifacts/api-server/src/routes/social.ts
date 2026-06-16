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

router.get('/follow', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    const targetId = req.query['targetId'] as string;
    if (!userId || !targetId) return res.status(400).json({ error: 'userId and targetId required' });
    const follow = await db.follow.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: targetId } } });
    const followerCount = await db.follow.count({ where: { followingId: targetId } });
    return res.json({ isFollowing: !!follow, followerCount });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/follow', async (req, res) => {
  try {
    const { userId, targetId, action } = req.body;
    if (!userId || !targetId) return res.status(400).json({ error: 'userId and targetId required' });

    if (action === 'unfollow') {
      await db.follow.deleteMany({ where: { followerId: userId, followingId: targetId } });
    } else {
      const existing = await db.follow.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: targetId } } });
      if (!existing) await db.follow.create({ data: { followerId: userId, followingId: targetId } });
    }

    const followerCount = await db.follow.count({ where: { followingId: targetId } });
    return res.json({ success: true, isFollowing: action !== 'unfollow', followerCount });
  } catch (error) {
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
    const referrals = await db.referral.findMany({ where: { referrerId: userId }, include: { referred: { select: { id: true, name: true, createdAt: true } } } });
    return res.json({ referrals, count: referrals.length });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/referrals', async (req, res) => {
  try {
    const { referrerId, referredId, referralCode } = req.body;
    if (!referrerId || !referralCode) return res.status(400).json({ error: 'referrerId and referralCode required' });
    const referral = await db.referral.create({ data: { referrerId, referredId: referredId || null, referralCode } });
    return res.json({ referral });
  } catch (error) {
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
