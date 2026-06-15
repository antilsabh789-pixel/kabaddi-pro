import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getEventPoints } from '@/lib/store';

/**
 * Update tournament standings (TournamentEntry) after a match result.
 * League format: W=2pts, D=1pt, L=0pts + score diff.
 */
async function updateTournamentStandings(
  tournamentId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number
) {
  const isHomeWin = homeScore > awayScore;
  const isDraw = homeScore === awayScore;

  // Update home team entry
  const homeEntry = await db.tournamentEntry.findUnique({
    where: { tournamentId_teamId: { tournamentId, teamId: homeTeamId } },
  });
  if (homeEntry) {
    await db.tournamentEntry.update({
      where: { id: homeEntry.id },
      data: {
        played: homeEntry.played + 1,
        won: homeEntry.won + (isHomeWin ? 1 : 0),
        lost: homeEntry.lost + (!isHomeWin && !isDraw ? 1 : 0),
        drawn: homeEntry.drawn + (isDraw ? 1 : 0),
        scoreDiff: homeEntry.scoreDiff + (homeScore - awayScore),
        points: homeEntry.points + (isHomeWin ? 2 : isDraw ? 1 : 0),
      },
    });
  }

  // Update away team entry
  const awayEntry = await db.tournamentEntry.findUnique({
    where: { tournamentId_teamId: { tournamentId, teamId: awayTeamId } },
  });
  if (awayEntry) {
    await db.tournamentEntry.update({
      where: { id: awayEntry.id },
      data: {
        played: awayEntry.played + 1,
        won: awayEntry.won + (!isHomeWin && !isDraw ? 1 : 0),
        lost: awayEntry.lost + (isHomeWin ? 1 : 0),
        drawn: awayEntry.drawn + (isDraw ? 1 : 0),
        scoreDiff: awayEntry.scoreDiff + (awayScore - homeScore),
        points: awayEntry.points + (!isHomeWin && !isDraw ? 2 : isDraw ? 1 : 0),
      },
    });
  }
}

/**
 * Aggregate match events and update PlayerProfile stats for all players in a match.
 * Updates both overall stats AND category-specific (practice/tournament) stats separately.
 */
async function updatePlayerStatsFromMatch(matchId: string, isPractice: boolean) {
  const events = await db.matchEvent.findMany({
    where: { matchId, playerId: { not: null } },
  });

  // Aggregate per player
  const statsMap: Record<string, {
    raidPoints: number;
    bonusPoints: number;
    tacklePoints: number;
    superRaids: number;
    superTackles: number;
    doOrDieRaids: number;
    totalRaids: number;
    totalTackles: number;
  }> = {};

  for (const evt of events) {
    const pid = evt.playerId!;
    if (!statsMap[pid]) {
      statsMap[pid] = {
        raidPoints: 0, bonusPoints: 0, tacklePoints: 0,
        superRaids: 0, superTackles: 0, doOrDieRaids: 0,
        totalRaids: 0, totalTackles: 0,
      };
    }
    const s = statsMap[pid];
    switch (evt.eventType) {
      case 'raid_point':
        s.raidPoints += evt.value;
        s.totalRaids += 1;
        break;
      case 'bonus_point':
        s.bonusPoints += evt.value;
        s.totalRaids += 1;
        break;
      case 'tackle_point':
        s.tacklePoints += evt.value;
        s.totalTackles += 1;
        break;
      case 'super_raid':
        s.superRaids += 1;
        s.raidPoints += evt.value;
        s.totalRaids += 1;
        break;
      case 'super_tackle':
        s.superTackles += 1;
        s.tacklePoints += evt.value;
        s.totalTackles += 1;
        break;
      case 'do_or_die_raid':
        s.doOrDieRaids += 1;
        s.raidPoints += evt.value;
        s.totalRaids += 1;
        break;
      default:
        break;
    }
  }

  const prefix = isPractice ? 'practice' : 'tournament';
  const matchesKey = isPractice ? 'practiceMatches' : 'tournamentMatches';
  const totalPointsKey = isPractice ? 'practiceTotalPoints' : 'tournamentTotalPoints';

  // Update each player's profile
  for (const [userId, s] of Object.entries(statsMap)) {
    const totalPts = s.raidPoints + s.tacklePoints + s.bonusPoints;
    const existing = await db.playerProfile.findUnique({ where: { userId } });

    if (existing) {
      // Build update data for overall stats
      const overallTotalRaids = existing.totalRaids + s.totalRaids;
      const overallSuccessfulRaids = existing.successfulRaids + s.raidPoints + s.bonusPoints;
      const overallTotalTackles = existing.totalTackles + s.totalTackles;
      const overallSuccessfulTackles = existing.successfulTackles + s.tacklePoints;
      const overallBonusPoints = existing.bonusPoints + s.bonusPoints;
      const overallSuperTackles = existing.superTackles + s.superTackles;
      const overallRaidPoints = existing.raidPoints + s.raidPoints;
      const overallTacklePoints = existing.tacklePoints + s.tacklePoints;

      // Build update data for category-specific stats
      const categoryMatches = (existing as unknown as Record<string, number>)[matchesKey] + 1;
      const categoryTotalRaids = (existing as unknown as Record<string, number>)[`${prefix}TotalRaids`] + s.totalRaids;
      const categorySuccessfulRaids = (existing as unknown as Record<string, number>)[`${prefix}SuccessfulRaids`] + s.raidPoints + s.bonusPoints;
      const categoryTotalTackles = (existing as unknown as Record<string, number>)[`${prefix}TotalTackles`] + s.totalTackles;
      const categorySuccessfulTackles = (existing as unknown as Record<string, number>)[`${prefix}SuccessfulTackles`] + s.tacklePoints;
      const categoryRaidPoints = (existing as unknown as Record<string, number>)[`${prefix}RaidPoints`] + s.raidPoints;
      const categoryTacklePoints = (existing as unknown as Record<string, number>)[`${prefix}TacklePoints`] + s.tacklePoints;
      const categoryBonusPoints = (existing as unknown as Record<string, number>)[`${prefix}BonusPoints`] + s.bonusPoints;
      const categorySuperTackles = (existing as unknown as Record<string, number>)[`${prefix}SuperTackles`] + s.superTackles;
      const categoryTotalPoints = (existing as unknown as Record<string, number>)[totalPointsKey] + totalPts;

      // Calculate overall rating: tournament avg * 0.7 + practice avg * 0.3
      const tMatches = isPractice ? (existing as unknown as Record<string, number>)['tournamentMatches'] : categoryMatches;
      const tPoints = isPractice ? (existing as unknown as Record<string, number>)['tournamentTotalPoints'] : categoryTotalPoints;
      const pMatches = isPractice ? categoryMatches : (existing as unknown as Record<string, number>)['practiceMatches'];
      const pPoints = isPractice ? categoryTotalPoints : (existing as unknown as Record<string, number>)['practiceTotalPoints'];

      const tAvg = tMatches > 0 ? tPoints / tMatches : 0;
      const pAvg = pMatches > 0 ? pPoints / pMatches : 0;
      const overallRating = pMatches > 0 && tMatches > 0
        ? (tAvg * 0.7 + pAvg * 0.3)
        : tMatches > 0 ? tAvg : pAvg;

      await db.playerProfile.update({
        where: { userId },
        data: {
          // Overall stats
          totalRaids: overallTotalRaids,
          successfulRaids: overallSuccessfulRaids,
          totalTackles: overallTotalTackles,
          successfulTackles: overallSuccessfulTackles,
          bonusPoints: overallBonusPoints,
          superTackles: overallSuperTackles,
          raidPoints: overallRaidPoints,
          tacklePoints: overallTacklePoints,
          totalMatches: existing.totalMatches + 1,
          totalPoints: existing.totalPoints + totalPts,
          overallRating: Math.round(overallRating * 10) / 10,

          // Category-specific stats
          [matchesKey]: categoryMatches,
          [`${prefix}TotalRaids`]: categoryTotalRaids,
          [`${prefix}SuccessfulRaids`]: categorySuccessfulRaids,
          [`${prefix}TotalTackles`]: categoryTotalTackles,
          [`${prefix}SuccessfulTackles`]: categorySuccessfulTackles,
          [`${prefix}RaidPoints`]: categoryRaidPoints,
          [`${prefix}TacklePoints`]: categoryTacklePoints,
          [`${prefix}BonusPoints`]: categoryBonusPoints,
          [`${prefix}SuperTackles`]: categorySuperTackles,
          [totalPointsKey]: categoryTotalPoints,
        },
      });
    } else {
      // Create profile with both overall and category-specific stats
      const overallRating = totalPts; // First match, rating = total points

      await db.playerProfile.create({
        data: {
          userId,
          totalRaids: s.totalRaids,
          successfulRaids: s.raidPoints + s.bonusPoints,
          totalTackles: s.totalTackles,
          successfulTackles: s.tacklePoints,
          bonusPoints: s.bonusPoints,
          superTackles: s.superTackles,
          raidPoints: s.raidPoints,
          tacklePoints: s.tacklePoints,
          totalMatches: 1,
          totalPoints: totalPts,
          overallRating: Math.round(overallRating * 10) / 10,

          // Category-specific stats
          [matchesKey]: 1,
          [`${prefix}TotalRaids`]: s.totalRaids,
          [`${prefix}SuccessfulRaids`]: s.raidPoints + s.bonusPoints,
          [`${prefix}TotalTackles`]: s.totalTackles,
          [`${prefix}SuccessfulTackles`]: s.tacklePoints,
          [`${prefix}RaidPoints`]: s.raidPoints,
          [`${prefix}TacklePoints`]: s.tacklePoints,
          [`${prefix}BonusPoints`]: s.bonusPoints,
          [`${prefix}SuperTackles`]: s.superTackles,
          [totalPointsKey]: totalPts,
        },
      });
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const tournamentId = searchParams.get('tournamentId') || '';
    const matchId = searchParams.get('id') || '';
    const userId = searchParams.get('userId') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Single match detail
    if (matchId) {
      const match = await db.match.findUnique({
        where: { id: matchId },
        include: {
          homeTeam: true,
          awayTeam: true,
          tournament: { select: { id: true, name: true } },
          events: { orderBy: { timestamp: 'desc' } },
          scorers: { include: { user: true } },
        },
      });

      if (!match) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
      }

      // Include MOTM user details if available
      let motmUser = null;
      if (match.motmUserId) {
        const user = await db.user.findUnique({
          where: { id: match.motmUserId },
          select: { id: true, name: true, avatar: true },
        });
        motmUser = user;
      }

      return NextResponse.json({ match: { ...match, motmUser } });
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tournamentId) where.tournamentId = tournamentId;

    // Filter by userId (matches where user was a scorer)
    if (userId) {
      where.scorers = { some: { userId } };
    }

    const matches = await db.match.findMany({
      where,
      take: limit,
      skip: offset,
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: { select: { id: true, name: true } },
        events: { orderBy: { timestamp: 'desc' }, take: 10 },
        scorers: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ matches });
  } catch (error) {
    console.error('Matches fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      homeTeamId,
      awayTeamId,
      isPractice,
      gender,
      weightCategory,
      halfDuration,
      playersPerSide,
      tournamentId,
      homeScore,
      awayScore,
      events,
      venue,
    } = body;

    // Create or find teams by name if IDs not provided
    let homeId = homeTeamId;
    let awayId = awayTeamId;

    if (!homeId && body.homeTeamName) {
      const homeTeam = await db.team.create({
        data: { name: body.homeTeamName, color: body.homeTeamColor || '#DC2626' },
      });
      homeId = homeTeam.id;
    }

    if (!awayId && body.awayTeamName) {
      const awayTeam = await db.team.create({
        data: { name: body.awayTeamName, color: body.awayTeamColor || '#1E293B' },
      });
      awayId = awayTeam.id;
    }

    const match = await db.match.create({
      data: {
        homeTeamId: homeId,
        awayTeamId: awayId,
        isPractice: isPractice || false,
        gender,
        weightCategory: weightCategory || null,
        halfDuration: halfDuration || 20,
        playersPerSide: playersPerSide || 7,
        tournamentId,
        homeScore: homeScore || 0,
        awayScore: awayScore || 0,
        venue,
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Save events if provided
    if (events && events.length > 0) {
      await db.matchEvent.createMany({
        data: events.map((e: { eventType: string; teamId: string; half: number; playerId?: string; value?: number; details?: string }) => ({
          matchId: match.id,
          eventType: e.eventType,
          teamId: e.teamId,
          half: e.half,
          playerId: e.playerId,
          value: e.value ?? getEventPoints(e.eventType as Parameters<typeof getEventPoints>[0]),
          details: e.details,
        })),
      });

      // Calculate MOTM: player with most points from match events
      const matchEvents = await db.matchEvent.findMany({
        where: { matchId: match.id, playerId: { not: null } },
      });

      // Aggregate points per player
      const playerPoints: Record<string, number> = {};
      for (const evt of matchEvents) {
        if (evt.playerId) {
          playerPoints[evt.playerId] = (playerPoints[evt.playerId] || 0) + evt.value;
        }
      }

      // Find the player with the most points
      let motmUserId: string | null = null;
      let maxPoints = 0;
      for (const [playerId, points] of Object.entries(playerPoints)) {
        if (points > maxPoints) {
          maxPoints = points;
          motmUserId = playerId;
        }
      }

      // Update match with MOTM
      if (motmUserId) {
        await db.match.update({
          where: { id: match.id },
          data: { motmUserId },
        });
      }

      // Update player stats from match events (pass isPractice to track separately)
      await updatePlayerStatsFromMatch(match.id, isPractice || false);
    }

    // Update tournament standings if match is part of a tournament
    if (tournamentId) {
      await updateTournamentStandings(tournamentId, homeId, awayId, homeScore || 0, awayScore || 0);
    }

    // Return the match with MOTM info
    const fullMatch = await db.match.findUnique({
      where: { id: match.id },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: { select: { id: true, name: true } },
      },
    });

    let motmUser = null;
    if (fullMatch?.motmUserId) {
      motmUser = await db.user.findUnique({
        where: { id: fullMatch.motmUserId },
        select: { id: true, name: true, avatar: true },
      });
    }

    return NextResponse.json({ match: { ...fullMatch, motmUser } }, { status: 201 });
  } catch (error) {
    console.error('Match create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
