import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

async function updateTournamentStandings(tournamentId: string, homeTeamId: string, awayTeamId: string, homeScore: number, awayScore: number) {
  const isHomeWin = homeScore > awayScore;
  const isDraw = homeScore === awayScore;

  const homeEntry = await db.tournamentEntry.findUnique({ where: { tournamentId_teamId: { tournamentId, teamId: homeTeamId } } });
  if (homeEntry) {
    await db.tournamentEntry.update({
      where: { id: homeEntry.id },
      data: { played: homeEntry.played + 1, won: homeEntry.won + (isHomeWin ? 1 : 0), lost: homeEntry.lost + (!isHomeWin && !isDraw ? 1 : 0), drawn: homeEntry.drawn + (isDraw ? 1 : 0), scoreDiff: homeEntry.scoreDiff + (homeScore - awayScore), points: homeEntry.points + (isHomeWin ? 2 : isDraw ? 1 : 0) },
    });
  }

  const awayEntry = await db.tournamentEntry.findUnique({ where: { tournamentId_teamId: { tournamentId, teamId: awayTeamId } } });
  if (awayEntry) {
    await db.tournamentEntry.update({
      where: { id: awayEntry.id },
      data: { played: awayEntry.played + 1, won: awayEntry.won + (!isHomeWin && !isDraw ? 1 : 0), lost: awayEntry.lost + (isHomeWin ? 1 : 0), drawn: awayEntry.drawn + (isDraw ? 1 : 0), scoreDiff: awayEntry.scoreDiff + (awayScore - homeScore), points: awayEntry.points + (!isHomeWin && !isDraw ? 2 : isDraw ? 1 : 0) },
    });
  }
}

router.get('/matches', async (req, res) => {
  try {
    const status = (req.query['status'] as string) || '';
    const tournamentId = (req.query['tournamentId'] as string) || '';
    const teamId = (req.query['teamId'] as string) || '';
    const userId = (req.query['userId'] as string) || '';
    const isPractice = (req.query['isPractice'] as string) || '';
    const limit = parseInt((req.query['limit'] as string) || '20');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tournamentId) where.tournamentId = tournamentId;
    if (teamId) where.OR = [{ homeTeamId: teamId }, { awayTeamId: teamId }];
    if (isPractice === 'true') where.isPractice = true;
    if (isPractice === 'false') where.isPractice = false;
    // Filter by user participation — matches where the user has at least one event
    if (userId) {
      where.events = { some: { OR: [{ playerId: userId }, { playerPhone: userId }] } };
    }

    const matches = await db.match.findMany({
      where,
      take: limit,
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, color: true, logo: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, color: true, logo: true } },
        tournament: { select: { id: true, name: true } },
        events: { orderBy: { timestamp: 'asc' } },
        scorers: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ matches });
  } catch (error) {
    console.error('Matches fetch error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/matches', async (req, res) => {
  try {
    const {
      homeTeamName, awayTeamName, homeTeamColor, awayTeamColor,
      homeScore, awayScore, gender, isPractice, weightCategory,
      liveStreamUrl, halfDuration, playersPerSide, events,
    } = req.body;

    // Create the match record
    const match = await db.match.create({
      data: {
        homeTeamId: homeTeamName || 'home',
        awayTeamId: awayTeamName || 'away',
        homeScore: homeScore || 0,
        awayScore: awayScore || 0,
        isPractice: isPractice ?? true,
        status: 'completed',
        gender: gender || null,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // ─── Update player stats from events ──────────────────────────
    // For each event with a playerId, update the player's profile stats.
    // If isPractice=true, update practice fields. If false, update tournament fields.
    const isPracticeMatch = isPractice ?? true;
    const prefix = isPracticeMatch ? 'practice' : 'tournament';

    // ─── Resolve synthetic player IDs to real user IDs ─────────────
    // When a scorer adds a player by phone number (without selecting from search),
    // the frontend generates a synthetic ID like 'phone_+91XXXXXXXXXX'.
    // - If the phone matches a registered user → resolve to their real userId
    // - If NOT registered → store stats under the phone number (keyed as
    //   'phone_<number>') and save playerPhone on the events. When that player
    //   later signs up with the same phone, the register flow will CLAIM these
    //   pending stats and link them to the new user account.
    const syntheticIds = new Set<string>();
    for (const evt of (events || [])) {
      if (evt.playerId && typeof evt.playerId === 'string' && evt.playerId.startsWith('phone_')) {
        syntheticIds.add(evt.playerId);
      }
    }
    const phoneToUserId = new Map<string, string>();
    if (syntheticIds.size > 0) {
      // Extract phone numbers from the synthetic IDs (format: phone_<phone_number>)
      const phonesToLookup = Array.from(syntheticIds).map((id) => id.slice('phone_'.length));
      const users = await db.user.findMany({
        where: { phone: { in: phonesToLookup } },
        select: { id: true, phone: true },
      });
      for (const u of users) {
        phoneToUserId.set(`phone_${u.phone}`, u.id);
      }
    }

    // Aggregate stats per player from events.
    // Key is either a real userId (resolved) or 'phone_<number>' for unregistered.
    // Unregistered players' stats are saved as pending — claimed on signup.
    const playerStats: Record<string, {
      raidPoints: number;
      tacklePoints: number;
      bonusPoints: number;
      superTackles: number;
      totalRaids: number;
      successfulRaids: number;
      totalTackles: number;
      successfulTackles: number;
      totalPoints: number;
      isPending: boolean; // true if stats are pending (unregistered player)
      phone: string | null; // phone number for pending stats
    }> = {};

    for (const evt of (events || [])) {
      if (!evt.playerId) continue;
      // Resolve synthetic phone_ IDs
      let resolvedKey = evt.playerId;
      let isPending = false;
      let phone: string | null = null;
      if (typeof evt.playerId === 'string' && evt.playerId.startsWith('phone_')) {
        const realUserId = phoneToUserId.get(evt.playerId);
        if (realUserId) {
          resolvedKey = realUserId;
        } else {
          // Not registered — keep as phone_-prefixed key, mark as pending
          resolvedKey = evt.playerId;
          isPending = true;
          phone = evt.playerId.slice('phone_'.length);
        }
      }
      if (!playerStats[resolvedKey]) {
        playerStats[resolvedKey] = {
          raidPoints: 0, tacklePoints: 0, bonusPoints: 0, superTackles: 0,
          totalRaids: 0, successfulRaids: 0, totalTackles: 0, successfulTackles: 0,
          totalPoints: 0,
          isPending, phone,
        };
      }
      const ps = playerStats[resolvedKey];
      const val = evt.value || 0;

      switch (evt.eventType) {
        case 'raid_point':
          ps.raidPoints += val;
          ps.totalRaids += 1;
          ps.successfulRaids += 1;
          ps.totalPoints += val;
          break;
        case 'bonus_point':
          ps.bonusPoints += val;
          ps.totalPoints += val;
          break;
        case 'tackle_point':
          ps.tacklePoints += val;
          ps.totalTackles += 1;
          ps.successfulTackles += 1;
          ps.totalPoints += val;
          break;
        case 'super_tackle':
          ps.tacklePoints += val;
          ps.superTackles += 1;
          ps.totalPoints += val;
          break;
        case 'do_or_die_raid':
          break;
        case 'empty_raid':
          ps.totalRaids += 1;
          break;
      }
    }

    // Save events to DB (store resolved playerId for registered, or playerPhone for unregistered)
    for (const evt of (events || [])) {
      let resolvedPlayerId: string | null = evt.playerId || null;
      let playerPhone: string | null = null;
      if (resolvedPlayerId && typeof resolvedPlayerId === 'string' && resolvedPlayerId.startsWith('phone_')) {
        const realUserId = phoneToUserId.get(resolvedPlayerId);
        if (realUserId) {
          resolvedPlayerId = realUserId;
        } else {
          // Unregistered — save the phone number for later claim
          playerPhone = resolvedPlayerId.slice('phone_'.length);
          resolvedPlayerId = null;
        }
      }
      await db.matchEvent.create({
        data: {
          matchId: match.id,
          eventType: evt.eventType,
          teamId: evt.teamId || '',
          playerId: resolvedPlayerId,
          playerPhone,
          value: evt.value || 0,
          details: evt.details || null,
          half: evt.half || 1,
        },
      });
    }

    // Update player profiles with aggregated stats.
    // For registered players: update their PlayerProfile directly.
    // For unregistered (pending) players: skip for now — stats are stored on
    // the MatchEvents (with playerPhone) and will be claimed when they sign up.
    for (const [playerKey, stats] of Object.entries(playerStats)) {
      if (stats.isPending) {
        // Pending — will be claimed on signup. Skip profile update.
        continue;
      }
      const playerId = playerKey;
      // Ensure profile exists
      await db.playerProfile.upsert({
        where: { userId: playerId },
        update: {},
        create: { userId: playerId },
      });

      // Update the appropriate stats (practice or tournament)
      const updateData: Record<string, number> = {};
      updateData[`${prefix}Matches`] = { increment: 1 };
      if (stats.totalRaids > 0) updateData[`${prefix}TotalRaids`] = { increment: stats.totalRaids };
      if (stats.successfulRaids > 0) updateData[`${prefix}SuccessfulRaids`] = { increment: stats.successfulRaids };
      if (stats.totalTackles > 0) updateData[`${prefix}TotalTackles`] = { increment: stats.totalTackles };
      if (stats.successfulTackles > 0) updateData[`${prefix}SuccessfulTackles`] = { increment: stats.successfulTackles };
      if (stats.raidPoints > 0) updateData[`${prefix}RaidPoints`] = { increment: stats.raidPoints };
      if (stats.tacklePoints > 0) updateData[`${prefix}TacklePoints`] = { increment: stats.tacklePoints };
      if (stats.bonusPoints > 0) updateData[`${prefix}BonusPoints`] = { increment: stats.bonusPoints };
      if (stats.superTackles > 0) updateData[`${prefix}SuperTackles`] = { increment: stats.superTackles };
      if (stats.totalPoints > 0) updateData[`${prefix}TotalPoints`] = { increment: stats.totalPoints };

      await db.playerProfile.update({
        where: { userId: playerId },
        data: updateData,
      });
    }

    return res.json({ match, playerStatsUpdated: Object.keys(playerStats).length });
  } catch (error) {
    console.error('Match create error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/matches', async (req, res) => {
  try {
    const { matchId, homeScore, awayScore, status, events, scorerUpdates, ...rest } = req.body;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });

    const existingMatch = await db.match.findUnique({ where: { id: matchId } });
    if (!existingMatch) return res.status(404).json({ error: 'Match not found' });

    const updateData: Record<string, unknown> = { ...rest };
    if (homeScore !== undefined) updateData.homeScore = homeScore;
    if (awayScore !== undefined) updateData.awayScore = awayScore;
    if (status !== undefined) updateData.status = status;
    if (status === 'completed') updateData.completedAt = new Date();
    if (status === 'live' && !existingMatch.startedAt) updateData.startedAt = new Date();

    const match = await db.match.update({ where: { id: matchId }, data: updateData, include: { homeTeam: true, awayTeam: true, events: true } });

    if (status === 'completed' && existingMatch.tournamentId && homeScore !== undefined && awayScore !== undefined) {
      await updateTournamentStandings(existingMatch.tournamentId, existingMatch.homeTeamId, existingMatch.awayTeamId, homeScore, awayScore);
    }

    return res.json({ match });
  } catch (error) {
    console.error('Match update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/match-events', async (req, res) => {
  try {
    const matchId = req.query['matchId'] as string;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const events = await db.matchEvent.findMany({ where: { matchId }, orderBy: { timestamp: 'asc' } });
    return res.json({ events });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/match-events', async (req, res) => {
  try {
    const { matchId, type, teamId, playerId, points, description, half } = req.body;
    if (!matchId || !type) return res.status(400).json({ error: 'matchId and type are required' });

    const event = await db.matchEvent.create({
      data: { matchId, eventType: type, teamId: teamId || '', playerId: playerId || null, value: points || 0, details: description || null, half: half || 1 },
    });

    if (points && playerId) {
      await db.playerProfile.upsert({
        where: { userId: playerId },
        update: {},
        create: { userId: playerId },
      });
    }

    return res.json({ event });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/match-report', async (req, res) => {
  try {
    const matchId = req.query['matchId'] as string;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { include: { members: { include: { user: { include: { profile: true } } } } } },
        awayTeam: { include: { members: { include: { user: { include: { profile: true } } } } } },
        events: { orderBy: { timestamp: 'asc' } },
        scorers: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        tournament: true,
      },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    return res.json({ match });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/match-awards', async (req, res) => {
  try {
    const matchId = req.query['matchId'] as string;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const match = await db.match.findUnique({ where: { id: matchId }, select: { id: true, motmUserId: true } });
    if (!match) return res.status(404).json({ error: 'Match not found' });
    const awards = [];
    if (match.motmUserId) {
      const user = await db.user.findUnique({ where: { id: match.motmUserId }, select: { id: true, name: true, avatar: true } });
      if (user) awards.push({ matchId, userId: user.id, awardType: 'motm', user });
    }
    return res.json({ awards });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/match-awards', async (req, res) => {
  try {
    const { matchId, userId, awardType } = req.body;
    if (!matchId || !userId || !awardType) return res.status(400).json({ error: 'matchId, userId, awardType required' });
    if (awardType === 'motm') {
      await db.match.update({ where: { id: matchId }, data: { motmUserId: userId } });
    }
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, avatar: true } });
    return res.json({ award: { matchId, userId, awardType, user } });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/match-comments', async (req, res) => {
  try {
    const matchId = req.query['matchId'] as string;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const comments = await db.matchComment.findMany({
      where: { matchId },
      include: { user: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return res.json({ comments });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/match-comments', async (req, res) => {
  try {
    const { matchId, userId, content } = req.body;
    if (!matchId || !userId || !content) return res.status(400).json({ error: 'matchId, userId, content required' });
    const comment = await db.matchComment.create({ data: { matchId, userId, comment: content }, include: { user: { select: { id: true, name: true, avatar: true } } } });
    return res.json({ comment });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/match-photos', async (req, res) => {
  try {
    const matchId = req.query['matchId'] as string;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });
    const photos = await db.matchPhoto.findMany({ where: { matchId }, include: { user: { select: { id: true, name: true } } } });
    return res.json({ photos });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/match-photos', async (req, res) => {
  try {
    const { matchId, userId, url, caption } = req.body;
    if (!matchId || !userId || !url) return res.status(400).json({ error: 'matchId, userId, url required' });
    const photo = await db.matchPhoto.create({ data: { matchId, userId, url, caption: caption || null } });
    return res.json({ photo });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/match-transfer', async (req, res) => {
  try {
    const { matchId, recipientPhone, recipientCode } = req.body;
    if (!matchId) return res.status(400).json({ error: 'matchId is required' });

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: true, awayTeam: true, events: true, scorers: { include: { user: true } } },
    });
    if (!match) return res.status(404).json({ error: 'Match not found' });

    let recipient = null;
    if (recipientPhone) recipient = await db.user.findUnique({ where: { phone: recipientPhone } });
    else if (recipientCode) recipient = await db.user.findFirst({ where: { playerCode: recipientCode } });

    return res.json({ match, recipient: recipient ? { id: recipient.id, name: recipient.name, playerCode: recipient.playerCode } : null });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/head-to-head', async (req, res) => {
  try {
    const teamId1 = req.query['teamId1'] as string;
    const teamId2 = req.query['teamId2'] as string;
    if (!teamId1 || !teamId2) return res.status(400).json({ error: 'teamId1 and teamId2 required' });

    const matches = await db.match.findMany({
      where: { status: 'completed', OR: [{ AND: [{ homeTeamId: teamId1 }, { awayTeamId: teamId2 }] }, { AND: [{ homeTeamId: teamId2 }, { awayTeamId: teamId1 }] }] },
      include: { homeTeam: { select: { name: true, shortName: true, color: true } }, awayTeam: { select: { name: true, shortName: true, color: true } } },
      orderBy: { completedAt: 'desc' },
    });

    let t1wins = 0, t2wins = 0, draws = 0;
    for (const m of matches) {
      if (m.homeTeamId === teamId1) { if (m.homeScore > m.awayScore) t1wins++; else if (m.homeScore < m.awayScore) t2wins++; else draws++; }
      else { if (m.awayScore > m.homeScore) t1wins++; else if (m.awayScore < m.homeScore) t2wins++; else draws++; }
    }

    return res.json({ matches, summary: { team1Wins: t1wins, team2Wins: t2wins, draws, total: matches.length } });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
