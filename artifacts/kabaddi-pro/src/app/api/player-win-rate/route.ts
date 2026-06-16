import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/player-win-rate?playerId=xxx
 * Returns a player's win/loss/draw record against each team they've played against
 */
export async function GET(req: NextRequest) {
  try {
    const playerId = req.nextUrl.searchParams.get('playerId');

    if (!playerId) {
      return NextResponse.json(
        { error: 'playerId query parameter is required' },
        { status: 400 }
      );
    }

    // Find all teams the player is a member of
    const playerTeams = await db.teamMember.findMany({
      where: { userId: playerId },
      select: { teamId: true },
    });
    const playerTeamIds = new Set(playerTeams.map((pt) => pt.teamId));

    if (playerTeamIds.size === 0) {
      return NextResponse.json({ stats: [], summary: { totalMatches: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, overallWinRate: 0 } });
    }

    // Find all completed matches where the player's team participated
    const matches = await db.match.findMany({
      where: {
        status: 'completed',
        OR: [
          { homeTeamId: { in: Array.from(playerTeamIds) } },
          { awayTeamId: { in: Array.from(playerTeamIds) } },
        ],
      },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
        homeScore: true,
        awayScore: true,
      },
    });

    // Group by opposing team
    const teamStats = new Map<string, { teamId: string; matches: number; wins: number; losses: number; draws: number }>();

    for (const match of matches) {
      const isHome = playerTeamIds.has(match.homeTeamId);
      const playerTeamId = isHome ? match.homeTeamId : match.awayTeamId;
      const opponentTeamId = isHome ? match.awayTeamId : match.homeTeamId;
      const playerScore = isHome ? match.homeScore : match.awayScore;
      const opponentScore = isHome ? match.awayScore : match.homeScore;

      if (!teamStats.has(opponentTeamId)) {
        teamStats.set(opponentTeamId, { teamId: opponentTeamId, matches: 0, wins: 0, losses: 0, draws: 0 });
      }

      const stats = teamStats.get(opponentTeamId)!;
      stats.matches++;
      if (playerScore > opponentScore) stats.wins++;
      else if (playerScore < opponentScore) stats.losses++;
      else stats.draws++;
    }

    // Fetch team details for opponents
    const opponentTeamIds = Array.from(teamStats.keys());
    const teams = await db.team.findMany({
      where: { id: { in: opponentTeamIds } },
      select: {
        id: true,
        name: true,
        shortName: true,
        logo: true,
        color: true,
      },
    });

    const teamMap = new Map(teams.map((t) => [t.id, t]));

    // Build response sorted by most played against
    const result = Array.from(teamStats.values())
      .map((stats) => {
        const team = teamMap.get(stats.teamId);
        const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
        return {
          teamId: stats.teamId,
          teamName: team?.name || 'Unknown',
          teamShortName: team?.shortName || null,
          teamLogo: team?.logo || null,
          teamColor: team?.color || null,
          matchesPlayed: stats.matches,
          wins: stats.wins,
          losses: stats.losses,
          draws: stats.draws,
          winRate,
        };
      })
      .sort((a, b) => b.matchesPlayed - a.matchesPlayed);

    // Calculate overall summary
    const totalMatches = result.reduce((sum, r) => sum + r.matchesPlayed, 0);
    const totalWins = result.reduce((sum, r) => sum + r.wins, 0);
    const totalLosses = result.reduce((sum, r) => sum + r.losses, 0);
    const totalDraws = result.reduce((sum, r) => sum + r.draws, 0);
    const overallWinRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

    return NextResponse.json({
      stats: result,
      summary: {
        totalMatches,
        totalWins,
        totalLosses,
        totalDraws,
        overallWinRate,
      },
    });
  } catch (error) {
    console.error('Player win rate error:', error);
    return NextResponse.json({ error: 'Failed to get player win rate' }, { status: 500 });
  }
}
