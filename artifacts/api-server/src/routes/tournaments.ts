import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

async function generateTournamentCode(): Promise<string> {
  const last = await db.tournament.findFirst({ where: { tournamentCode: { not: null } }, orderBy: { tournamentCode: 'desc' }, select: { tournamentCode: true } });
  let nextNum = 3001;
  if (last?.tournamentCode) { const m = last.tournamentCode.match(/TC(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
  return `TC${nextNum}`;
}

router.get('/tournaments', async (req, res) => {
  try {
    const status = (req.query['status'] as string) || '';
    const gender = (req.query['gender'] as string) || '';
    const search = (req.query['search'] as string) || '';
    const organizerId = (req.query['organizerId'] as string) || '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (gender && gender !== 'all') where.gender = gender;
    if (organizerId) where.organizerId = organizerId;
    if (search) {
      const searchOr = [{ name: { contains: search } }, { tournamentCode: { contains: search } }];
      if (status || (gender && gender !== 'all')) {
        const filters: Record<string, unknown>[] = [];
        if (status) filters.push({ status });
        if (gender && gender !== 'all') filters.push({ gender });
        delete where.status; delete where.gender;
        where.AND = [...filters, { OR: searchOr }];
      } else {
        where.OR = searchOr;
      }
    }

    const tournaments = await db.tournament.findMany({
      where,
      include: { entries: { include: { team: { select: { id: true, name: true, shortName: true, logo: true, color: true } } } }, organizer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ tournaments });
  } catch (error) {
    console.error('Tournaments fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tournaments', async (req, res) => {
  try {
    const body = req.body;
    const { name, type, startDate, endDate, location, organizerId, gender, description, maxTeams, format } = body;
    if (!name || !organizerId) return res.status(400).json({ error: 'name and organizerId are required' });

    const tournamentCode = await generateTournamentCode();
    const tournament = await db.tournament.create({
      data: { name, type: type || 'knockout', startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, venue: location || null, organizerId, gender: gender || null, tournamentCode, status: 'upcoming' },
    });
    return res.json({ tournament });
  } catch (error) {
    console.error('Tournament create error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tournament = await db.tournament.findUnique({
      where: { id },
      include: {
        entries: { include: { team: { include: { members: { include: { user: { include: { profile: true } } } } } } } },
        matches: { include: { homeTeam: true, awayTeam: true, events: true, scorers: { include: { user: true } } } },
        organizer: true,
      },
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
    return res.json({ tournament });
  } catch (error) {
    console.error('Tournament fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { addTeamIds, removeTeamIds, ...updateData } = req.body;

    if (!addTeamIds && !removeTeamIds) {
      const validFields = ['name', 'type', 'status', 'gender', 'weightCategory', 'startDate', 'endDate', 'venue', 'organizerId'];
      const safeUpdate: Record<string, unknown> = {};
      for (const f of validFields) {
        if (updateData[f] !== undefined) {
          if (f === 'startDate' || f === 'endDate') safeUpdate[f] = updateData[f] ? new Date(updateData[f] as string) : null;
          else safeUpdate[f] = updateData[f];
        }
      }
      if (updateData['location']) safeUpdate['venue'] = updateData['location'];
      const tournament = await db.tournament.update({ where: { id }, data: safeUpdate });
      return res.json({ tournament });
    }

    const tournament = await db.tournament.findUnique({ where: { id }, include: { entries: true } });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const existingTeamIds = new Set(tournament.entries.map((e) => e.teamId));

    if (addTeamIds && Array.isArray(addTeamIds) && addTeamIds.length > 0) {
      const teams = await db.team.findMany({ where: { id: { in: addTeamIds } } });
      if (teams.length !== addTeamIds.length) return res.status(400).json({ error: 'Some teams not found' });
      const newTeams = addTeamIds.filter((tid: string) => !existingTeamIds.has(tid));
      if (newTeams.length > 0) {
        await db.tournamentEntry.createMany({ data: newTeams.map((teamId: string) => ({ tournamentId: id, teamId })) });
      }
    }

    if (removeTeamIds && Array.isArray(removeTeamIds)) {
      await db.tournamentEntry.deleteMany({ where: { tournamentId: id, teamId: { in: removeTeamIds } } });
    }

    const updated = await db.tournament.findUnique({
      where: { id },
      include: { entries: { include: { team: { select: { id: true, name: true, shortName: true } } } } },
    });
    return res.json({ tournament: updated });
  } catch (error) {
    console.error('Tournament update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/tournaments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.tournament.delete({ where: { id } });
    return res.json({ message: 'Tournament deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/tournaments/generate-bracket', async (req, res) => {
  try {
    const { tournamentId } = req.body;
    if (!tournamentId) return res.status(400).json({ error: 'tournamentId is required' });

    const tournament = await db.tournament.findUnique({
      where: { id: tournamentId },
      include: { entries: { include: { team: true } } },
    });
    if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

    const teams = tournament.entries.map((e) => e.team);
    if (teams.length < 2) return res.status(400).json({ error: 'Need at least 2 teams' });

    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const matches = [];
    for (let i = 0; i < shuffled.length - 1; i += 2) {
      const match = await db.match.create({
        data: { homeTeamId: shuffled[i].id, awayTeamId: shuffled[i + 1].id, tournamentId, status: 'upcoming', homeScore: 0, awayScore: 0 },
      });
      matches.push(match);
    }
    return res.json({ matches });
  } catch (error) {
    console.error('Generate bracket error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
