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
    const { name, location, groundName, coachUserId, sundayHoliday, practiceSchedule, offDays } = req.body;
    if (!name || !coachUserId) return res.status(400).json({ error: 'name and coachUserId are required' });

    const user = await db.user.findUnique({ where: { id: coachUserId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // offDays: array of weekday names like ['sun','mon']. Empty array = all days working.
    const offDaysStr = Array.isArray(offDays) ? JSON.stringify(offDays) : '[]';

    const academy = await db.academy.create({
      data: { name, location: location || null, groundName: groundName || null, coachUserId, sundayHoliday: sundayHoliday ?? false, practiceSchedule: practiceSchedule || 'one-time', offDays: offDaysStr },
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
      include: { players: { include: { user: { select: { id: true, name: true, phone: true, avatar: true, provisional: true } } }, orderBy: { joinedAt: 'asc' } } },
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
    const { name, location, groundName, sundayHoliday, practiceSchedule, offDays } = req.body;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (groundName !== undefined) updateData.groundName = groundName;
    if (sundayHoliday !== undefined) updateData.sundayHoliday = sundayHoliday;
    if (practiceSchedule !== undefined) updateData.practiceSchedule = practiceSchedule;
    if (offDays !== undefined) {
      // offDays: array of weekday names like ['sun','mon']. Empty array = all days working.
      updateData.offDays = Array.isArray(offDays) ? JSON.stringify(offDays) : '[]';
    }
    const academy = await db.academy.update({ where: { id }, data: updateData });
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

/**
 * DELETE /api/academies/:id/players?userId=...
 * Remove a player from an academy.
 */
router.delete('/academies/:id/players', async (req, res) => {
  try {
    const { id: academyId } = req.params;
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    await db.academyPlayer.deleteMany({ where: { academyId, userId: userId as string } });
    return res.json({ success: true });
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

    const academy = await db.academy.findUnique({
      where: { id: academyId },
      include: { players: { include: { user: { select: { id: true, name: true, avatar: true } } } } },
    });
    if (!academy) return res.status(404).json({ error: 'Academy not found' });

    const userIds = academy.players.map((p) => p.userId);
    const profiles = await db.playerProfile.findMany({ where: { userId: { in: userIds } } });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    // Build performance data with rich stats from PlayerProfile.
    // The frontend Analytics tab reads this array to render bar charts + tables.
    const performanceData = academy.players.map((p) => {
      const profile = profileMap.get(p.userId);
      const totalPoints = profile?.totalPoints || 0;
      const totalMatches = profile?.totalMatches || 0;
      const raidPoints = profile?.raidPoints || 0;
      const tacklePoints = profile?.tacklePoints || 0;
      const overallRating = profile?.overallRating || 0;
      return {
        userId: p.userId,
        name: p.user.name || 'Unknown',
        avatar: p.user.avatar,
        totalPoints,
        totalMatches,
        raidPoints,
        tacklePoints,
        overallRating,
      };
    });

    // Sort by totalPoints desc so the top performers show first
    performanceData.sort((a, b) => b.totalPoints - a.totalPoints);

    // Aggregate academy totals for the summary cards
    const academyTotals = {
      totalPoints: performanceData.reduce((sum, p) => sum + p.totalPoints, 0),
      totalMatches: performanceData.reduce((sum, p) => sum + p.totalMatches, 0),
      totalRaidPoints: performanceData.reduce((sum, p) => sum + p.raidPoints, 0),
      totalTacklePoints: performanceData.reduce((sum, p) => sum + p.tacklePoints, 0),
      avgRating: performanceData.length > 0
        ? Math.round((performanceData.reduce((sum, p) => sum + p.overallRating, 0) / performanceData.length) * 10) / 10
        : 0,
    };

    return res.json({
      academy,
      performanceData,
      playerCount: academy.players.length,
      academyTotals,
    });
  } catch (error) {
    console.error('Analytics error:', error);
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
    const { academyId, userId, date, isPresent, note, session } = req.body;
    if (!academyId || !userId || !date) return res.status(400).json({ error: 'academyId, userId, date required' });

    const dateObj = new Date(date);
    const startOfDay = new Date(dateObj.toISOString().split('T')[0] + 'T00:00:00.000Z');
    const endOfDay = new Date(dateObj.toISOString().split('T')[0] + 'T23:59:59.999Z');
    const sessionKey = session || 'default';

    const existing = await db.attendance.findFirst({
      where: { academyId, userId, date: { gte: startOfDay, lte: endOfDay }, session: sessionKey },
    });

    let record;
    if (existing) {
      record = await db.attendance.update({
        where: { id: existing.id },
        data: { isPresent: isPresent ?? true, note: note ?? existing.note },
      });
    } else {
      record = await db.attendance.create({
        data: { academyId, userId, date: dateObj, isPresent: isPresent ?? true, note: note || null, session: sessionKey },
      });
    }
    return res.json({ attendance: record });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/coach/attendance/player?academyId=...&userId=...&days=30
 * Returns a single player's attendance history for the last N days (default 30).
 * Used by the coach dashboard's per-player PnL-style attendance chart.
 *
 * Response: {
 *   player: { id, name, avatar, phone },
 *   history: [{ date: 'YYYY-MM-DD', sessions: [{ session: 'morning'|'evening'|'default', isPresent: boolean }] }],
 *   summary: { totalDays, presentDays, absentDays, attendanceRate }
 * }
 */
router.get('/coach/attendance/player', async (req, res) => {
  try {
    const academyId = req.query['academyId'] as string;
    const userId = req.query['userId'] as string;
    const days = Math.min(90, Math.max(7, parseInt((req.query['days'] as string) || '30', 10)));

    if (!academyId || !userId) return res.status(400).json({ error: 'academyId and userId are required' });

    // Fetch the player's user record for name/avatar/phone
    const player = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatar: true, phone: true },
    });
    if (!player) return res.status(404).json({ error: 'Player not found' });

    // Compute the date range: last N days ending today (UTC, date-only)
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    start.setUTCHours(0, 0, 0, 0);

    const records = await db.attendance.findMany({
      where: {
        academyId,
        userId,
        date: { gte: start, lte: now },
      },
      orderBy: { date: 'asc' },
    });

    // Group by date → sessions[]
    const byDate = new Map<string, { session: string; isPresent: boolean }[]>();
    for (const r of records) {
      const dateKey = r.date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push({ session: r.session || 'default', isPresent: r.isPresent });
    }

    // Build the history array with one entry per day in the range (fill gaps)
    const history: { date: string; sessions: { session: string; isPresent: boolean }[] }[] = [];
    let presentDays = 0;
    let absentDays = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const dateKey = d.toISOString().split('T')[0];
      const sessions = byDate.get(dateKey) || [];
      history.push({ date: dateKey, sessions });
      if (sessions.length > 0) {
        // Count a day as present if ANY session was present, absent only if ALL sessions absent
        const anyPresent = sessions.some(s => s.isPresent);
        if (anyPresent) presentDays++;
        else absentDays++;
      }
    }

    const totalDays = presentDays + absentDays;
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    return res.json({
      player,
      history,
      summary: {
        totalDays,
        presentDays,
        absentDays,
        attendanceRate,
        daysChecked: days,
      },
    });
  } catch (error) {
    console.error('Player attendance history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/coach/fees', async (req, res) => {
  try {
    const academyId = req.query['academyId'] as string;
    const month = (req.query['month'] as string) || new Date().toISOString().slice(0, 7);
    if (!academyId) return res.status(400).json({ error: 'academyId is required' });
    const feeRecords = await db.feeRecord.findMany({
      where: { academyId, month },
      include: { user: { select: { id: true, name: true, avatar: true, phone: true } } },
    });
    return res.json({ feeRecords });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/coach/fees/status?academyId=...
 * Returns EVERY player in the academy with their LATEST fee record (most recent
 * by paidAt), the days left until expiry, and an `isExpired` flag. Used by the
 * coach dashboard's fee-status list with red dots for expired players.
 *
 * Response: {
 *   players: [{
 *     userId, name, avatar, phone,
 *     feeRecord: { id, amount, status, paidAt, expiryDate, period, month } | null,
 *     daysLeft: number | null,    // null if never paid; positive = days left; negative = days expired
 *     isExpired: boolean,          // true if paid but expiryDate < now
 *   }]
 * }
 */
router.get('/coach/fees/status', async (req, res) => {
  try {
    const academyId = req.query['academyId'] as string;
    if (!academyId) return res.status(400).json({ error: 'academyId is required' });

    const academy = await db.academy.findUnique({
      where: { id: academyId },
      include: {
        players: {
          include: { user: { select: { id: true, name: true, avatar: true, phone: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!academy) return res.status(404).json({ error: 'Academy not found' });

    // Fetch ALL fee records for this academy (we'll pick the latest per user)
    const allFees = await db.feeRecord.findMany({
      where: { academyId },
      orderBy: { paidAt: 'desc' },
    });
    // Map userId → latest fee record (first occurrence is latest due to orderBy)
    const latestFeeByUser = new Map<string, typeof allFees[number]>();
    for (const f of allFees) {
      if (!latestFeeByUser.has(f.userId)) latestFeeByUser.set(f.userId, f);
    }

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const players = academy.players.map((p) => {
      const fee = latestFeeByUser.get(p.userId) || null;
      let daysLeft: number | null = null;
      let isExpired = false;
      if (fee && fee.expiryDate) {
        daysLeft = Math.ceil((new Date(fee.expiryDate).getTime() - now.getTime()) / dayMs);
        isExpired = daysLeft < 0;
      } else if (fee && fee.status === 'pending') {
        // Pending fee with no expiry → treat as expired so coach sees red dot
        isExpired = true;
      }
      return {
        userId: p.userId,
        name: p.user.name,
        avatar: p.user.avatar,
        phone: p.user.phone,
        feeRecord: fee ? {
          id: fee.id,
          amount: fee.amount,
          status: fee.status,
          paidAt: fee.paidAt,
          expiryDate: fee.expiryDate,
          period: fee.period,
          month: fee.month,
        } : null,
        daysLeft,
        isExpired,
      };
    });

    return res.json({ players });
  } catch (error) {
    console.error('Fees status error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/coach/fees', async (req, res) => {
  try {
    const { academyId, userId, month, amount, isPaid, notes, period } = req.body;
    if (!academyId || !userId || !month) return res.status(400).json({ error: 'academyId, userId, month required' });

    // Determine the period + compute expiryDate when paid.
    // period: 'monthly' (default), 'yearly', 'weekly', 'daily', 'custom'.
    const periodKey = period || 'monthly';
    const dayMs = 24 * 60 * 60 * 1000;
    let durationDays = 30; // monthly default
    if (periodKey === 'yearly') durationDays = 365;
    else if (periodKey === 'weekly') durationDays = 7;
    else if (periodKey === 'daily') durationDays = 1;
    else if (periodKey === 'monthly') durationDays = 30;

    const now = new Date();
    const existing = await db.feeRecord.findFirst({ where: { academyId, userId, month } });
    let record;
    const status = isPaid ? 'paid' : 'pending';
    if (existing) {
      // If marking as paid NOW (was pending or already paid), stamp paidAt + expiryDate.
      const shouldStampPaid = isPaid && (!existing.paidAt || existing.status !== 'paid');
      const paidAt = shouldStampPaid ? now : existing.paidAt;
      const expiryDate = paidAt ? new Date(paidAt.getTime() + durationDays * dayMs) : null;
      record = await db.feeRecord.update({
        where: { id: existing.id },
        data: {
          amount: amount ?? existing.amount,
          status: isPaid !== undefined ? status : existing.status,
          notes: notes ?? existing.notes,
          paidAt,
          expiryDate,
          period: periodKey,
        },
      });
    } else {
      const paidAt = isPaid ? now : null;
      const expiryDate = paidAt ? new Date(paidAt.getTime() + durationDays * dayMs) : null;
      record = await db.feeRecord.create({
        data: { academyId, userId, month, amount: amount || 0, status, notes: notes || null, paidAt, expiryDate, period: periodKey },
      });
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

// ─── Announcements ───────────────────────────────────────────────────────────

/**
 * POST /api/coach/announcements
 * Body: { academyId, coachUserId, title, message }
 *
 * Creates an announcement for the academy. ALL players in the academy get a
 * Notification row so it appears in their bell icon + notification panel.
 *
 * Returns: { announcement }
 */
router.post('/coach/announcements', async (req, res) => {
  try {
    const { academyId, coachUserId, title, message } = req.body;
    if (!academyId || !coachUserId || !title || !message) {
      return res.status(400).json({ error: 'academyId, coachUserId, title, and message are required' });
    }

    // Verify the coach owns this academy
    const academy = await db.academy.findUnique({
      where: { id: academyId },
      select: { id: true, coachUserId: true, name: true },
    });
    if (!academy) return res.status(404).json({ error: 'Academy not found' });
    if (academy.coachUserId !== coachUserId) {
      return res.status(403).json({ error: 'Only the academy coach can post announcements' });
    }

    // Create the announcement
    const announcement = await db.academyAnnouncement.create({
      data: {
        academyId,
        coachUserId,
        title: String(title).slice(0, 200),
        message: String(message).slice(0, 2000),
      },
      include: {
        coachUser: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Fan-out: create a Notification for EVERY player in the academy so it
    // appears in their bell icon + notification panel. We do this in bulk
    // with createMany for efficiency.
    const players = await db.academyPlayer.findMany({
      where: { academyId },
      select: { userId: true },
    });

    if (players.length > 0) {
      const coachName = announcement.coachUser.name || 'Your Coach';
      const notifTitle = `📢 ${academy.name}: ${announcement.title}`;
      const notifMessage = String(message).slice(0, 200);
      await db.notification.createMany({
        data: players.map((p) => ({
          userId: p.userId,
          type: 'academy_announcement',
          title: notifTitle,
          message: notifMessage,
          fromUserId: coachUserId,
        })),
      });
    }

    return res.json({
      announcement: {
        id: announcement.id,
        academyId: announcement.academyId,
        title: announcement.title,
        message: announcement.message,
        createdAt: announcement.createdAt,
        coach: announcement.coachUser,
      },
      notifiedPlayers: players.length,
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/coach/announcements?academyId=...
 * Returns all announcements for an academy (most recent first).
 */
router.get('/coach/announcements', async (req, res) => {
  try {
    const academyId = req.query['academyId'] as string;
    if (!academyId) return res.status(400).json({ error: 'academyId is required' });

    const announcements = await db.academyAnnouncement.findMany({
      where: { academyId },
      include: {
        coachUser: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({
      announcements: announcements.map((a) => ({
        id: a.id,
        academyId: a.academyId,
        title: a.title,
        message: a.message,
        createdAt: a.createdAt,
        coach: a.coachUser,
      })),
    });
  } catch (error) {
    console.error('Fetch announcements error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/coach/announcements/:id
 * Body: { coachUserId }
 * Deletes an announcement. Only the coach who created it can delete.
 */
router.delete('/coach/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { coachUserId } = req.body;
    if (!coachUserId) return res.status(400).json({ error: 'coachUserId is required' });

    const announcement = await db.academyAnnouncement.findUnique({ where: { id } });
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    if (announcement.coachUserId !== coachUserId) {
      return res.status(403).json({ error: 'Only the coach who posted this can delete it' });
    }

    await db.academyAnnouncement.delete({ where: { id } });
    return res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/announcements?userId=...
 * Returns ALL announcements for academies the given user is a member of.
 * Used by the player's Home tab / announcement feed so players see what
 * their coaches have posted.
 */
router.get('/announcements', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Find all academies this user is a member of
    const memberships = await db.academyPlayer.findMany({
      where: { userId },
      select: { academyId: true },
    });
    const academyIds = memberships.map((m) => m.academyId);

    if (academyIds.length === 0) {
      return res.json({ announcements: [] });
    }

    const announcements = await db.academyAnnouncement.findMany({
      where: { academyId: { in: academyIds } },
      include: {
        academy: { select: { id: true, name: true } },
        coachUser: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return res.json({
      announcements: announcements.map((a) => ({
        id: a.id,
        academyId: a.academyId,
        academyName: a.academy.name,
        title: a.title,
        message: a.message,
        createdAt: a.createdAt,
        coach: a.coachUser,
      })),
    });
  } catch (error) {
    console.error('Fetch player announcements error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
