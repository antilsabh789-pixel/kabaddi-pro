import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/teams/compare?teamAId=...&teamBId=...
 * Returns head-to-head comparison stats for two teams.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamAId = searchParams.get('teamAId');
    const teamBId = searchParams.get('teamBId');

    if (!teamAId || !teamBId) {
      return NextResponse.json(
        { error: 'Both teamAId and teamBId are required' },
        { status: 400 }
      );
    }

    if (teamAId === teamBId) {
      return NextResponse.json(
        { error: 'Cannot compare a team with itself' },
        { status: 400 }
      );
    }

    // Fetch team details
    const [teamA, teamB] = await Promise.all([
      db.team.findUnique({
        where: { id: teamAId },
        select: { id: true, name: true, shortName: true, color: true, logo: true },
      }),
      db.team.findUnique({
        where: { id: teamBId },
        select: { id: true, name: true, shortName: true, color: true, logo: true },
      }),
    ]);

    if (!teamA || !teamB) {
      return NextResponse.json(
        { error: 'One or both teams not found' },
        { status: 404 }
      );
    }

    // Fetch all completed matches involving both teams
    const h2hMatches = await db.match.findMany({
      where: {
        status: 'completed',
        OR: [
          { homeTeamId: teamAId, awayTeamId: teamBId },
          { homeTeamId: teamBId, awayTeamId: teamAId },
        ],
      },
      include: {
        homeTeam: {
          select: { id: true, name: true, shortName: true, color: true },
        },
        awayTeam: {
          select: { id: true, name: true, shortName: true, color: true },
        },
        events: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    // Fetch ALL completed matches for each team (for overall stats)
    const [allMatchesA, allMatchesB] = await Promise.all([
      db.match.findMany({
        where: {
          status: 'completed',
          OR: [{ homeTeamId: teamAId }, { awayTeamId: teamAId }],
        },
        include: { events: true },
      }),
      db.match.findMany({
        where: {
          status: 'completed',
          OR: [{ homeTeamId: teamBId }, { awayTeamId: teamBId }],
        },
        include: { events: true },
      }),
    ]);

    // Compute stats for a team from their matches
    function computeTeamStats(
      teamId: string,
      matches: typeof allMatchesA
    ) {
      let wins = 0;
      let losses = 0;
      let draws = 0;
      let raidPoints = 0;
      let tacklePoints = 0;
      let bonusPoints = 0;
      let allOuts = 0;
      let totalScore = 0;

      for (const match of matches) {
        const isHome = match.homeTeamId === teamId;
        const myScore = isHome ? match.homeScore : match.awayScore;
        const oppScore = isHome ? match.awayScore : match.homeScore;

        totalScore += myScore;

        if (myScore > oppScore) wins++;
        else if (myScore < oppScore) losses++;
        else draws++;

        // Aggregate events for this team in this match
        for (const evt of match.events) {
          if (evt.teamId !== teamId) continue;
          switch (evt.eventType) {
            case 'raid_point':
            case 'super_raid':
            case 'do_or_die_raid':
              raidPoints += evt.value;
              break;
            case 'bonus_point':
              bonusPoints += evt.value;
              break;
            case 'tackle_point':
            case 'super_tackle':
              tacklePoints += evt.value;
              break;
            case 'all_out':
              allOuts += 1;
              break;
          }
        }
      }

      const totalMatches = matches.length;
      const avgScore = totalMatches > 0 ? totalScore / totalMatches : 0;
      const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

      // Consistency: inverse of standard deviation of scores (normalized 0-100)
      let consistency = 50;
      if (totalMatches > 1) {
        const scores: number[] = [];
        for (const match of matches) {
          const isHome = match.homeTeamId === teamId;
          scores.push(isHome ? match.homeScore : match.awayScore);
        }
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        // Lower stdDev = higher consistency; cap at 100
        consistency = Math.max(0, Math.min(100, 100 - stdDev * 2));
      }

      return {
        totalMatches,
        wins,
        losses,
        draws,
        raidPoints,
        tacklePoints,
        bonusPoints,
        allOuts,
        avgScore: Math.round(avgScore * 10) / 10,
        winRate: Math.round(winRate * 10) / 10,
        consistency: Math.round(consistency * 10) / 10,
      };
    }

    const teamAStats = computeTeamStats(teamAId, allMatchesA);
    const teamBStats = computeTeamStats(teamBId, allMatchesB);

    // Build encounters list
    const encounters = h2hMatches.map((match) => {
      const isHomeWin = match.homeScore > match.awayScore;
      const isDraw = match.homeScore === match.awayScore;
      let winner: 'home' | 'away' | 'draw' = 'draw';
      if (!isDraw) winner = isHomeWin ? 'home' : 'away';

      return {
        id: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        status: match.status,
        completedAt: match.completedAt?.toISOString() || null,
        winner,
      };
    });

    return NextResponse.json({
      teamA: teamAStats,
      teamB: teamBStats,
      encounters,
    });
  } catch (error) {
    console.error('Team comparison error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
