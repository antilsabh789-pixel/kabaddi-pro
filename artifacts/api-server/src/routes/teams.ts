import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

async function generateTeamCode(): Promise<string> {
  const last = await db.team.findFirst({ where: { teamCode: { not: null } }, orderBy: { teamCode: 'desc' }, select: { teamCode: true } });
  let nextNum = 2001;
  if (last?.teamCode) { const m = last.teamCode.match(/KT(\d+)/); if (m) nextNum = parseInt(m[1]) + 1; }
  return `KT${nextNum}`;
}

function generateShortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 3) return (words[0].charAt(0) + words[1].charAt(0) + words[2].charAt(0)).toUpperCase();
  if (words.length === 2) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

router.get('/teams', async (req, res) => {
  try {
    const search = (req.query['search'] as string) || '';
    const userId = (req.query['userId'] as string) || '';
    const filter = (req.query['filter'] as string) || 'all';
    const limit = parseInt((req.query['limit'] as string) || '20');

    const where: Record<string, unknown> = {};
    if (search) where.OR = [{ name: { contains: search } }, { teamCode: { contains: search } }];
    if (filter === 'my' && userId) where.members = { some: { userId } };

    const teams = await db.team.findMany({
      where,
      take: limit,
      include: { members: { include: { user: { select: { id: true, name: true, avatar: true, profile: true } } } }, _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ teams });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/teams', async (req, res) => {
  try {
    const { name, color, logo, captainId, shortName } = req.body;
    if (!name || !captainId) return res.status(400).json({ error: 'name and captainId are required' });

    const teamCode = await generateTeamCode();
    const team = await db.team.create({
      data: { name, color: color || '#DC2626', logo: logo || null, shortName: shortName || generateShortName(name), teamCode, captainId },
    });
    await db.teamMember.create({ data: { teamId: team.id, userId: captainId, role: 'captain' } });
    return res.json({ team });
  } catch (error) {
    console.error('Team create error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/teams/search', async (req, res) => {
  try {
    const q = (req.query['q'] as string) || '';
    const limit = parseInt((req.query['limit'] as string) || '10');
    if (!q) return res.json({ teams: [] });
    const teams = await db.team.findMany({
      where: { OR: [{ name: { contains: q } }, { teamCode: { contains: q } }] },
      take: limit,
      include: { _count: { select: { members: true } } },
    });
    return res.json({ teams: teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName, color: t.color, teamCode: t.teamCode, memberCount: t._count.members })) });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/teams/compare', async (req, res) => {
  try {
    const teamId1 = req.query['teamId1'] as string;
    const teamId2 = req.query['teamId2'] as string;
    if (!teamId1 || !teamId2) return res.status(400).json({ error: 'teamId1 and teamId2 are required' });

    const [t1, t2] = await Promise.all([
      db.team.findUnique({ where: { id: teamId1 }, include: { members: { include: { user: { include: { profile: true } } } } } }),
      db.team.findUnique({ where: { id: teamId2 }, include: { members: { include: { user: { include: { profile: true } } } } } }),
    ]);
    if (!t1 || !t2) return res.status(404).json({ error: 'One or both teams not found' });
    return res.json({ teams: [t1, t2] });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const team = await db.team.findUnique({ where: { id }, include: { members: { include: { user: { include: { profile: true } } } } } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const homeMatches = await db.match.findMany({ where: { homeTeamId: id, status: 'completed' }, select: { homeScore: true, awayScore: true } });
    const awayMatches = await db.match.findMany({ where: { awayTeamId: id, status: 'completed' }, select: { homeScore: true, awayScore: true } });

    let wins = 0, losses = 0, totalPoints = 0;
    for (const m of homeMatches) { totalPoints += m.homeScore; if (m.homeScore > m.awayScore) wins++; else if (m.homeScore < m.awayScore) losses++; }
    for (const m of awayMatches) { totalPoints += m.awayScore; if (m.awayScore > m.homeScore) wins++; else if (m.awayScore < m.homeScore) losses++; }

    const recentMatches = await db.match.findMany({
      where: { OR: [{ homeTeamId: id }, { awayTeamId: id }], status: 'completed' },
      include: { homeTeam: { select: { id: true, name: true, shortName: true, color: true } }, awayTeam: { select: { id: true, name: true, shortName: true, color: true } } },
      orderBy: { completedAt: 'desc' }, take: 5,
    });

    return res.json({ team, stats: { wins, losses, draws: 0, totalMatches: wins + losses, totalPoints }, recentMatches });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/teams/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, logo, shortName } = req.body;
    const team = await db.team.update({ where: { id }, data: { name, color, logo, shortName } });
    return res.json({ team });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/teams/:id', async (req, res) => {
  try {
    await db.team.delete({ where: { id: req.params['id'] } });
    return res.json({ message: 'Team deleted' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/teams/join', async (req, res) => {
  try {
    const { teamId, userId, teamCode } = req.body;
    if (!userId || (!teamId && !teamCode)) return res.status(400).json({ error: 'userId and (teamId or teamCode) required' });

    let resolvedTeamId = teamId;
    if (!resolvedTeamId && teamCode) {
      const team = await db.team.findFirst({ where: { teamCode } });
      if (!team) return res.status(404).json({ error: 'Team not found with that code' });
      resolvedTeamId = team.id;
    }

    const existing = await db.teamMember.findFirst({ where: { teamId: resolvedTeamId, userId } });
    if (existing) return res.status(409).json({ error: 'Already a member of this team' });

    const member = await db.teamMember.create({ data: { teamId: resolvedTeamId, userId, role: 'player' } });
    return res.json({ member });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/teams/leave', async (req, res) => {
  try {
    const { teamId, userId } = req.body;
    if (!teamId || !userId) return res.status(400).json({ error: 'teamId and userId required' });
    await db.teamMember.deleteMany({ where: { teamId, userId } });
    return res.json({ message: 'Left team' });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/team-suggestions', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    const teams = await db.team.findMany({ where: { members: { none: { userId: userId || '' } } }, take: 5, include: { _count: { select: { members: true } } } });
    return res.json({ teams: teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName, color: t.color, teamCode: t.teamCode, memberCount: t._count.members })) });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/teams-leaderboard', async (req, res) => {
  try {
    const limit = parseInt((req.query['limit'] as string) || '20');
    const teams = await db.team.findMany({
      take: limit,
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ teams });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
