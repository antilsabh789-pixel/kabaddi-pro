import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

// ── Academies ─────────────────────────────────────────────────────────────────

router.get('/academies', async (req, res) => {
  try {
    const coachUserId = req.query['coachUserId'] as string;
    if (!coachUserId) return res.status(400).json({ error: 'coachUserId is required' });

    const academies = await db.academy.findMany({
      where: { coachUserId },
      include: { players: { include: { user: { select: { id: true, name: true, phone: true, avatar: true } } } }, _count: { select: { players: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ academies });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/academies', async (req, res) => {
  try {
    const { name, location, groundName, coachUserId, sundayHoliday, practiceSchedule } = req.body;
    if (!name || !coachUserId) return res.status(400).json({ error: 'name and coachUserId are required' });

    const user = await db.user.findUnique({ where: { id: coachUserId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const academy = await db.academy.create({
      data: { name, location: location || null, groundName: groundName || null, coachUserId, sundayHoliday: sundayHoliday ?? false, practiceSchedule: practiceSchedule || 'one-time' },
    });
    return res.json({ academy });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/academies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const academy = await db.academy.findUnique({
      where: { id },
      include: { players: { include: { user: { select: { id: true, name: true, phone: true, avatar: true } } }, orderBy: { joinedAt: 'asc' } } },
    });
    if (!academy) return res.status(404).json({ error: 'Academy not found' });
    return res.json({ academy });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/academies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, groundName, sundayHoliday, practiceSchedule } = req.body;
    const academy = await db.academy.update({
      where: { id },
      data: { name, location: location ?? undefined, groundName: groundName ?? undefined, sundayHoliday: sundayHoliday ?? undefined, practiceSchedule: practiceSchedule ?? undefined },
    });
    return res.json({ academy });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/academies/:id', async (req, res) => {
  try {
    await db.academy.delete({ where: { id: req.params['id'] } });
    return res.json({ message: 'Academy deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/academies/:id/players', async (req, res) => {
  try {
    const { id: academyId } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const existing = await db.academyPlayer.findFirst({ where: { academyId, userId } });
    if (existing) return res.status(409).json({ error: 'Player already in academy' });

    const academyPlayer = await db.academyPlayer.create({ data: { academyId, userId }, include: { user: { select: { id: true, name: true, avatar: true } } } });
    return res.json({ academyPlayer });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/academies/:id/attendance', async (req, res) => {
  try {
    const { id: academyId } = req.params;
    const date = req.query['date'] as string;

    const where: Record<string, unknown> = { academyId };
    if (date) {
      const startOfDay = new Date(date); startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date); endOfDay.setUTCHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }

    const attendance = await db.attendance.findMany({ where, include: { user: { select: { id: true, name: true, avatar: true } } } });
    return res.json({ attendance });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Coach-specific sub-routes ─────────────────────────────────────────────────

router.get('/coach/analytics', async (req, res) => {
  try {
    const academyId = req.query['academyId'] as string;
    if (!academyId) return res.status(400).json({ error: 'academyId is required' });

    const academy = await db.academy.findUnique({ where: { id: academyId }, include: { players: { include: { user: { select: { id: true, name: true, avatar: true } } } } } });
    if (!academy) return res.status(404).json({ error: 'Academy not found' });

    const userIds = academy.players.map((p) => p.userId);
    const profiles = await db.playerProfile.findMany({ where: { userId: { in: userIds } } });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const performanceData = academy.players.map((p) => {
      const profile = profileMap.get(p.userId);
      return { name: p.user.name || 'Unknown', totalPoints: profile?.totalPoints || 0, totalMatches: profile?.totalMatches || 0, overallRating: profile?.overallRating || 0 };
    });

    return res.json({ academy, performanceData, playerCount: academy.players.length });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/coach/attendance', async (req, res) => {
  try {
    const academyId = req.query['academyId'] as string;
    const date = req.query['date'] as string;
    if (!academyId) return res.status(400).json({ error: 'academyId is required' });

    const where: Record<string, unknown> = { academyId };
    if (date) {
      const startOfDay = new Date(date); startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date); endOfDay.setUTCHours(23, 59, 59, 999);
      where.date = { gte: startOfDay, lte: endOfDay };
    }

    const attendance = await db.attendance.findMany({ where, include: { user: { select: { id: true, name: true, avatar: true } } } });
    return res.json({ attendance });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/coach/attendance', async (req, res) => {
  try {
    const { academyId, userId, date, isPresent, note } = req.body;
    if (!academyId || !userId || !date) return res.status(400).json({ error: 'academyId, userId, date required' });

    const dateObj = new Date(date);
    const existing = await db.attendance.findFirst({ where: { academyId, userId, date: { gte: new Date(dateObj.toISOString().split('T')[0]), lt: new Date(new Date(dateObj.getTime() + 86400000).toISOString().split('T')[0]) } } });

    let record;
    if (existing) {
      record = await db.attendance.update({ where: { id: existing.id }, data: { isPresent: isPresent ?? true } });
    } else {
      record = await db.attendance.create({ data: { academyId, userId, date: dateObj, isPresent: isPresent ?? true } });
    }
    return res.json({ attendance: record });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/coach/fees', async (req, res) => {
  try {
    const academyId = req.query['academyId'] as string;
    const month = (req.query['month'] as string) || new Date().toISOString().slice(0, 7);
    if (!academyId) return res.status(400).json({ error: 'academyId is required' });
    const feeRecords = await db.feeRecord.findMany({ where: { academyId, month }, include: { user: { select: { id: true, name: true, avatar: true } } } });
    return res.json({ feeRecords });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/coach/fees', async (req, res) => {
  try {
    const { academyId, userId, month, amount, isPaid, notes } = req.body;
    if (!academyId || !userId || !month) return res.status(400).json({ error: 'academyId, userId, month required' });
    const existing = await db.feeRecord.findFirst({ where: { academyId, userId, month } });
    let record;
    const status = isPaid ? 'paid' : 'pending';
    if (existing) {
      record = await db.feeRecord.update({ where: { id: existing.id }, data: { amount: amount ?? existing.amount, status: isPaid !== undefined ? status : existing.status, notes: notes ?? existing.notes, paidAt: isPaid ? new Date() : existing.paidAt } });
    } else {
      record = await db.feeRecord.create({ data: { academyId, userId, month, amount: amount || 0, status, notes: notes || null, paidAt: isPaid ? new Date() : null } });
    }
    return res.json({ feeRecord: record });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/coach/parents', async (req, res) => {
  try {
    const academyId = req.query['academyId'] as string;
    if (!academyId) return res.status(400).json({ error: 'academyId is required' });
    const parents = await db.parentContact.findMany({ where: { academyId }, include: { user: { select: { id: true, name: true, avatar: true } } } });
    return res.json({ parents });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/coach/parents', async (req, res) => {
  try {
    const { academyId, userId, parentName, phone, relationship } = req.body;
    if (!academyId || !userId || !parentName || !phone) return res.status(400).json({ error: 'academyId, userId, parentName, phone required' });
    const parent = await db.parentContact.create({ data: { academyId, userId, parentName, parentPhone: phone, relation: relationship || 'guardian' } });
    return res.json({ parent });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/coach/rewards', async (req, res) => {
  try {
    const academyId = req.query['academyId'] as string;
    if (!academyId) return res.status(400).json({ error: 'academyId is required' });
    const rewards = await db.studentReward.findMany({ where: { academyId }, include: { user: { select: { id: true, name: true, avatar: true } } }, orderBy: { createdAt: 'desc' } });
    return res.json({ rewards });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/coach/rewards', async (req, res) => {
  try {
    const { academyId, userId, type, title, description, points } = req.body;
    if (!academyId || !userId || !type) return res.status(400).json({ error: 'academyId, userId, type required' });
    const reward = await db.studentReward.create({ data: { academyId, userId, type, title: title || type, description: description || null, points: points || 0 } });
    return res.json({ reward });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
