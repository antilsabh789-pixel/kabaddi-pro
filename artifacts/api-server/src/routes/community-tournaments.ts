import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

// ─── GET /api/community-tournaments ───────────────────────────────
// Returns all community-posted tournaments, newest first.
// Optional query: ?search=<text>

router.get('/community-tournaments', async (req, res) => {
  try {
    const search = (req.query['search'] as string || '').trim();

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { venue: { contains: search, mode: 'insensitive' } },
        { playerName: { contains: search, mode: 'insensitive' } },
        { coachName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tournaments = await db.communityTournament.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return res.json({ tournaments });
  } catch (error) {
    console.error('Community tournaments fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/community-tournaments ──────────────────────────────
// Anyone can post a tournament. Only `name` is required.
// Optional: postedBy (userId) and postedByName for tracking.

router.post('/community-tournaments', async (req, res) => {
  try {
    const {
      name,
      date,
      venue,
      prizeMoney,
      weightCategory,
      playerName,
      coachName,
      organizerPhone,
      organizerPhone2,
      postedBy,
      postedByName,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tournament name is required' });
    }

    // Basic phone validation (if provided)
    const phoneRegex = /^[+]?[\d\s-]{7,15}$/;
    if (organizerPhone && !phoneRegex.test(organizerPhone.trim())) {
      return res.status(400).json({ error: 'Invalid organizer phone number' });
    }
    if (organizerPhone2 && !phoneRegex.test(organizerPhone2.trim())) {
      return res.status(400).json({ error: 'Invalid second organizer phone number' });
    }

    const tournament = await db.communityTournament.create({
      data: {
        name: name.trim(),
        date: date?.trim() || null,
        venue: venue?.trim() || null,
        prizeMoney: prizeMoney?.trim() || null,
        weightCategory: weightCategory?.trim() || null,
        playerName: playerName?.trim() || null,
        coachName: coachName?.trim() || null,
        organizerPhone: organizerPhone?.trim() || null,
        organizerPhone2: organizerPhone2?.trim() || null,
        postedBy: postedBy || null,
        postedByName: postedByName?.trim() || null,
      },
    });

    return res.status(201).json({ tournament });
  } catch (error) {
    console.error('Community tournament create error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/community-tournaments/:id ────────────────────────
// Allows deletion by the poster or anyone (lightweight — community-policed).

router.delete('/community-tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tournament = await db.communityTournament.findUnique({ where: { id } });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    await db.communityTournament.delete({ where: { id } });
    return res.json({ message: 'Tournament deleted' });
  } catch (error) {
    console.error('Community tournament delete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
