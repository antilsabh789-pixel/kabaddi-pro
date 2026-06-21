import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const gender = (req.query['gender'] as string) || 'all';
    const userWhere: Record<string, unknown> = {};
    if (gender && gender !== 'all') userWhere.gender = gender;

    const [totalPlayers, totalTeams, totalTournaments, totalMatches, liveMatchCount, completedMatchCount, upcomingMatchCount, aggregateStats] = await Promise.all([
      db.user.count({ where: userWhere }),
      db.team.count(),
      db.tournament.count({ where: { status: { in: ['ongoing', 'upcoming'] } } }),
      db.match.count(),
      db.match.count({ where: { status: 'live' } }),
      db.match.count({ where: { status: 'completed' } }),
      db.match.count({ where: { status: 'upcoming' } }),
      db.playerProfile.aggregate({
        _sum: { raidPoints: true, tacklePoints: true, bonusPoints: true, totalPoints: true, totalRaids: true, successfulRaids: true, totalTackles: true, successfulTackles: true, superTackles: true },
      }),
    ]);

    const liveMatches = await db.match.findMany({
      where: { status: 'live' },
      include: { homeTeam: { select: { name: true, shortName: true, color: true } }, awayTeam: { select: { name: true, shortName: true, color: true } }, tournament: { select: { name: true } } },
      take: 5,
    });

    const raidSuccessRate = (aggregateStats._sum.totalRaids ?? 0) > 0
      ? Math.round(((aggregateStats._sum.successfulRaids ?? 0) / (aggregateStats._sum.totalRaids ?? 1)) * 100) : 0;
    const tackleSuccessRate = (aggregateStats._sum.totalTackles ?? 0) > 0
      ? Math.round(((aggregateStats._sum.successfulTackles ?? 0) / (aggregateStats._sum.totalTackles ?? 1)) * 100) : 0;

    return res.json({
      totalPlayers, totalTeams, totalTournaments, totalMatches, liveMatchCount, completedMatchCount, upcomingMatchCount,
      totalRaidPoints: aggregateStats._sum.raidPoints ?? 0,
      totalTacklePoints: aggregateStats._sum.tacklePoints ?? 0,
      raidSuccessRate, tackleSuccessRate,
      liveMatches,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leaderboard', async (req, res) => {
  try {
    const category = (req.query['category'] as string) || 'raiders';
    const gender = (req.query['gender'] as string) || 'all';
    const limit = parseInt((req.query['limit'] as string) || '20');
    const mode = (req.query['mode'] as string) || 'tournament';
    const isPractice = mode === 'practice';
    const prefix = isPractice ? 'practice' : 'tournament';

    const userWhere: Record<string, unknown> = {};
    if (gender && gender !== 'all') userWhere.gender = gender;

    const profileWhere: Record<string, unknown> = { [`${prefix}Matches`]: { gt: 0 } };

    let orderBy: Record<string, string>;
    switch (category) {
      case 'raiders': orderBy = { [`${prefix}RaidPoints`]: 'desc' }; break;
      case 'defenders': orderBy = { [`${prefix}TacklePoints`]: 'desc' }; break;
      case 'allrounders': orderBy = { [`${prefix}TotalPoints`]: 'desc' }; break;
      case 'mvp': case 'rating': orderBy = { overallRating: 'desc' }; break;
      default: orderBy = { [`${prefix}RaidPoints`]: 'desc' };
    }

    const profiles = await db.playerProfile.findMany({
      where: { user: userWhere, ...profileWhere },
      orderBy,
      take: limit,
      include: { user: { select: { id: true, name: true, avatar: true, gender: true, playerCode: true } } },
    });

    const entries = profiles.map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      name: p.user.name,
      avatar: p.user.avatar,
      playerCode: p.user.playerCode,
      gender: p.user.gender,
      raidPoints: isPractice ? p.practiceRaidPoints : p.tournamentRaidPoints,
      tacklePoints: isPractice ? p.practiceTacklePoints : p.tournamentTacklePoints,
      totalPoints: isPractice ? p.practiceTotalPoints : p.tournamentTotalPoints,
      matches: isPractice ? p.practiceMatches : p.tournamentMatches,
      overallRating: p.overallRating,
    }));

    return res.json({ entries });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leaderboard-seasons', async (req, res) => {
  try {
    const seasons = await db.leaderboardSeason.findMany({ orderBy: { startDate: 'desc' }, take: 10 });
    return res.json({ seasons });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/percentile-rankings', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const profile = await db.playerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const [totalPlayers, aboveRaid, aboveTackle, aboveTotal] = await Promise.all([
      db.playerProfile.count(),
      db.playerProfile.count({ where: { raidPoints: { lt: profile.raidPoints } } }),
      db.playerProfile.count({ where: { tacklePoints: { lt: profile.tacklePoints } } }),
      db.playerProfile.count({ where: { totalPoints: { lt: profile.totalPoints } } }),
    ]);

    return res.json({
      raidPercentile: totalPlayers > 1 ? Math.round((aboveRaid / (totalPlayers - 1)) * 100) : 100,
      tacklePercentile: totalPlayers > 1 ? Math.round((aboveTackle / (totalPlayers - 1)) * 100) : 100,
      totalPercentile: totalPlayers > 1 ? Math.round((aboveTotal / (totalPlayers - 1)) * 100) : 100,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const q = ((req.query['q'] as string) || '').trim();
    const type = (req.query['type'] as string) || 'all';
    if (!q || q.length < 1) return res.json({ players: [], teams: [], tournaments: [], matches: [] });

    const filterType = ['all', 'players', 'teams', 'tournaments', 'matches'].includes(type) ? type : 'all';

    const [players, teams, tournaments, matches] = await Promise.all([
      (filterType === 'all' || filterType === 'players')
        ? db.user.findMany({ where: { OR: [{ name: { contains: q } }, { playerCode: { contains: q } }] }, take: 5, include: { profile: { select: { position: true } }, teams: { include: { team: { select: { name: true } } }, take: 1 } } })
        : [],
      (filterType === 'all' || filterType === 'teams')
        ? db.team.findMany({ where: { OR: [{ name: { contains: q } }, { teamCode: { contains: q } }] }, take: 5, include: { _count: { select: { members: true } } } })
        : [],
      (filterType === 'all' || filterType === 'tournaments')
        ? db.tournament.findMany({ where: { OR: [{ name: { contains: q } }, { tournamentCode: { contains: q } }] }, take: 5 })
        : [],
      (filterType === 'all' || filterType === 'matches')
        ? db.match.findMany({ where: { OR: [{ homeTeam: { name: { contains: q } } }, { awayTeam: { name: { contains: q } } }] }, take: 5, include: { homeTeam: { select: { name: true, shortName: true, color: true } }, awayTeam: { select: { name: true, shortName: true, color: true } } } })
        : [],
    ]);

    return res.json({
      players: (players as typeof players).map((p: any) => ({ id: p.id, name: p.name, playerCode: p.playerCode, avatar: p.avatar, position: p.profile?.position || null, teamNames: p.teams?.map((t: any) => t.team.name) || [] })),
      teams: (teams as typeof teams).map((t: any) => ({ id: t.id, name: t.name, shortName: t.shortName, color: t.color, teamCode: t.teamCode, memberCount: t._count?.members || 0 })),
      tournaments: (tournaments as typeof tournaments).map((t: any) => ({ id: t.id, name: t.name, type: t.type, status: t.status, tournamentCode: t.tournamentCode })),
      matches: (matches as typeof matches).map((m: any) => ({ id: m.id, homeTeamName: m.homeTeam?.name, awayTeamName: m.awayTeam?.name, homeScore: m.homeScore, awayScore: m.awayScore, status: m.status })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nearby-players', async (req, res) => {
  try {
    const lat = parseFloat((req.query['lat'] as string) || '0');
    const lng = parseFloat((req.query['lng'] as string) || '0');
    const radius = parseFloat((req.query['radius'] as string) || '50');
    const limit = parseInt((req.query['limit'] as string) || '10');

    const locations = await db.playerLocation.findMany({ include: { user: { select: { id: true, name: true, avatar: true, playerCode: true, profile: true } } }, take: limit });
    const nearby = locations.filter((l) => {
      const d = Math.sqrt(Math.pow(l.lat - lat, 2) + Math.pow(l.lng - lng, 2)) * 111;
      return d <= radius;
    });
    return res.json({ players: nearby.map((l) => ({ ...l.user, distance: Math.round(Math.sqrt(Math.pow(l.lat - lat, 2) + Math.pow(l.lng - lng, 2)) * 111), city: l.city })) });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nearby-teams', async (req, res) => {
  try {
    const limit = parseInt((req.query['limit'] as string) || '10');
    const teams = await db.team.findMany({ take: limit, include: { _count: { select: { members: true } } } });
    return res.json({ teams });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nearby-tournaments', async (req, res) => {
  try {
    const limit = parseInt((req.query['limit'] as string) || '10');
    const tournaments = await db.tournament.findMany({ where: { status: { in: ['upcoming', 'ongoing'] } }, take: limit, include: { organizer: { select: { id: true, name: true } } } });
    return res.json({ tournaments });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/nearby-grounds', async (req, res) => {
  try {
    const limit = parseInt((req.query['limit'] as string) || '10');
    const grounds = await db.ground.findMany({ take: limit });
    return res.json({ grounds });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/grounds', async (req, res) => {
  try {
    const grounds = await db.ground.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ grounds });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/grounds', async (req, res) => {
  try {
    const { name, address, city, state, latitude, longitude } = req.body;
    const lat = latitude ?? req.body.lat ?? null;
    const lng = longitude ?? req.body.lng ?? null;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const ground = await db.ground.create({ data: { name, address: address || null, city: city || null, state: state || null, lat, lng } });
    return res.json({ ground });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
