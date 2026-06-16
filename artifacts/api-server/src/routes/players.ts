import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

router.get('/players', async (req, res) => {
  try {
    const search = (req.query['search'] as string) || '';
    const limit = parseInt((req.query['limit'] as string) || '20');
    const searchBy = (req.query['searchBy'] as string) || 'all';

    const searchConditions = search ? (
      searchBy === 'phone_code'
        ? { OR: [{ phone: { contains: search } }, { playerCode: { contains: search } }] }
        : { OR: [{ name: { contains: search } }, { phone: { contains: search } }, { playerCode: { contains: search } }] }
    ) : undefined;

    const users = await db.user.findMany({
      where: searchConditions,
      take: limit,
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });

    const players = users.map((user) => ({
      id: user.id,
      name: user.name,
      playerCode: user.playerCode,
      avatar: user.avatar,
      gender: user.gender,
      phone: user.phone ? `****${user.phone.slice(-2)}` : null,
      profile: user.profile ? { position: user.profile.position, jerseyNumber: user.profile.jerseyNumber, overallRating: user.profile.overallRating } : null,
    }));

    return res.json({ players });
  } catch (error) {
    console.error('Players fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/players/search', async (req, res) => {
  try {
    const q = (req.query['q'] as string) || '';
    const limit = parseInt((req.query['limit'] as string) || '10');
    if (!q) return res.json({ players: [] });

    const users = await db.user.findMany({
      where: { OR: [{ name: { contains: q } }, { playerCode: { contains: q } }, { phone: { contains: q } }] },
      take: limit,
      include: { profile: true },
    });

    const players = users.map((u) => ({
      id: u.id,
      name: u.name,
      playerCode: u.playerCode,
      avatar: u.avatar,
      gender: u.gender,
      profile: u.profile ? { position: u.profile.position, jerseyNumber: u.profile.jerseyNumber, overallRating: u.profile.overallRating } : null,
    }));

    return res.json({ players });
  } catch (error) {
    console.error('Player search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await db.user.findUnique({
      where: { id },
      include: { profile: true, teams: { include: { team: { select: { name: true, shortName: true } } }, take: 3 } },
    });
    if (!user) return res.status(404).json({ error: 'Player not found' });
    const teamNames = user.teams.map((tm) => tm.team.name || tm.team.shortName || '').filter(Boolean);
    const { teams, password, ...playerData } = user;
    const player = { ...playerData, phone: playerData.phone ? `****${playerData.phone.slice(-2)}` : null };
    return res.json({ player, profile: user.profile, teamNames });
  } catch (error) {
    console.error('Player fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { gender, weight, practiceGround, position, jerseyNumber, weightCategory, playerCode } = req.body;

    if (playerCode) {
      const existing = await db.user.findFirst({ where: { playerCode, NOT: { id } } });
      if (existing) return res.status(409).json({ error: 'Player code already taken' });
    }

    let user;
    try {
      const updateData: Record<string, unknown> = {};
      if (gender !== undefined) updateData.gender = gender;
      if (weight !== undefined) updateData.weight = weight;
      if (practiceGround !== undefined) updateData.practiceGround = practiceGround;
      if (playerCode !== undefined) updateData.playerCode = playerCode;
      user = await db.user.update({ where: { id }, data: updateData });
    } catch {
      user = await db.user.findUnique({ where: { id } });
      if (!user) return res.status(404).json({ error: 'Player not found' });
    }

    const profileData: Record<string, unknown> = {};
    if (position !== undefined) profileData.position = position;
    if (jerseyNumber !== undefined) profileData.jerseyNumber = jerseyNumber ? parseInt(String(jerseyNumber)) : null;
    if (weightCategory !== undefined) profileData.weightCategory = weightCategory;

    const profile = await db.playerProfile.upsert({
      where: { userId: id },
      update: profileData,
      create: { userId: id, ...profileData },
    });

    const { password: _, ...userWithoutPassword } = user;
    return res.json({ user: userWithoutPassword, profile });
  } catch (error) {
    console.error('Player update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/player-stats', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    const mode = (req.query['mode'] as string) || 'overall';
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const profile = await db.playerProfile.findUnique({ where: { userId } });
    if (!profile) return res.status(404).json({ error: 'Player profile not found' });

    const matchCount = mode === 'tournament' ? profile.tournamentMatches : mode === 'practice' ? profile.practiceMatches : profile.totalMatches;
    const raidPts = mode === 'tournament' ? profile.tournamentRaidPoints : mode === 'practice' ? profile.practiceRaidPoints : profile.raidPoints;
    const tacklePts = mode === 'tournament' ? profile.tournamentTacklePoints : mode === 'practice' ? profile.practiceTacklePoints : profile.tacklePoints;
    const totalPts = mode === 'tournament' ? profile.tournamentTotalPoints : mode === 'practice' ? profile.practiceTotalPoints : profile.totalPoints;
    const totalRaids = mode === 'tournament' ? profile.tournamentTotalRaids : mode === 'practice' ? profile.practiceTotalRaids : profile.totalRaids;
    const successRaids = mode === 'tournament' ? profile.tournamentSuccessfulRaids : mode === 'practice' ? profile.practiceSuccessfulRaids : profile.successfulRaids;
    const totalTackles = mode === 'tournament' ? profile.tournamentTotalTackles : mode === 'practice' ? profile.practiceTotalTackles : profile.totalTackles;
    const successTackles = mode === 'tournament' ? profile.tournamentSuccessfulTackles : mode === 'practice' ? profile.practiceSuccessfulTackles : profile.successfulTackles;
    const bonusPts = mode === 'tournament' ? profile.tournamentBonusPoints : mode === 'practice' ? profile.practiceBonusPoints : profile.bonusPoints;
    const superTackles = mode === 'tournament' ? profile.tournamentSuperTackles : mode === 'practice' ? profile.practiceSuperTackles : profile.superTackles;

    return res.json({
      profile: {
        ...profile,
        matchCount,
        raidPoints: raidPts,
        tacklePoints: tacklePts,
        totalPoints: totalPts,
        totalRaids,
        successfulRaids: successRaids,
        totalTackles,
        successfulTackles: successTackles,
        bonusPoints: bonusPts,
        superTackles,
        raidSuccessRate: totalRaids > 0 ? Math.round((successRaids / totalRaids) * 100) : 0,
        tackleSuccessRate: totalTackles > 0 ? Math.round((successTackles / totalTackles) * 100) : 0,
      },
    });
  } catch (error) {
    console.error('Player stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/player-win-rate', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const matches = await db.matchScorer.findMany({
      where: { userId },
      include: { match: { select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, status: true } } },
    });

    const completedMatches = matches.filter((m) => m.match.status === 'completed');
    let wins = 0, losses = 0, draws = 0;

    for (const ms of completedMatches) {
      const isHome = ms.teamId === ms.match.homeTeamId;
      const playerScore = isHome ? ms.match.homeScore : ms.match.awayScore;
      const oppScore = isHome ? ms.match.awayScore : ms.match.homeScore;
      if (playerScore > oppScore) wins++;
      else if (playerScore < oppScore) losses++;
      else draws++;
    }

    const total = wins + losses + draws;
    return res.json({ wins, losses, draws, total, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 });
  } catch (error) {
    console.error('Player win rate error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/popular-players', async (req, res) => {
  try {
    const limit = parseInt((req.query['limit'] as string) || '10');
    const gender = (req.query['gender'] as string) || 'all';
    const currentUserId = (req.query['userId'] as string) || '';

    const where: Record<string, unknown> = {};
    if (gender && gender !== 'all') where.gender = gender;

    const users = await db.user.findMany({
      where: { ...where, profile: { totalMatches: { gt: 0 } } },
      include: {
        profile: true,
        followers: { select: { followerId: true } },
        teams: { include: { team: { select: { name: true } } }, take: 2 },
      },
      orderBy: { followers: { _count: 'desc' } },
      take: limit,
    });

    const players = users.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      name: u.name,
      avatar: u.avatar,
      playerCode: u.playerCode,
      gender: u.gender,
      followerCount: u.followers.length,
      isFollowing: currentUserId ? u.followers.some((f) => f.followerId === currentUserId) : false,
      position: u.profile?.position ?? null,
      overallRating: u.profile?.overallRating ?? 0,
      totalPoints: u.profile?.totalPoints ?? 0,
      totalMatches: u.profile?.totalMatches ?? 0,
      raidPoints: u.profile?.raidPoints ?? 0,
      tacklePoints: u.profile?.tacklePoints ?? 0,
      teamNames: u.teams.map((tm) => tm.team.name).filter(Boolean),
    }));

    return res.json({ players });
  } catch (error) {
    console.error('Popular players error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/total-players', async (req, res) => {
  try {
    const count = await db.user.count();
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/player-location', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const location = await db.playerLocation.findUnique({ where: { userId } });
    return res.json({ location });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/player-location', async (req, res) => {
  try {
    const { userId, latitude, longitude, city, state } = req.body;
    if (!userId || latitude === undefined || longitude === undefined) return res.status(400).json({ error: 'userId, latitude, longitude required' });
    const location = await db.playerLocation.upsert({
      where: { userId },
      update: { latitude, longitude, city: city || null, state: state || null, updatedAt: new Date() },
      create: { userId, latitude, longitude, city: city || null, state: state || null },
    });
    return res.json({ location });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
