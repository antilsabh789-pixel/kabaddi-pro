import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/head-to-head?homeTeamId=xxx&awayTeamId=yyy
 * Returns head-to-head record between two teams.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const homeTeamId = searchParams.get('homeTeamId');
    const awayTeamId = searchParams.get('awayTeamId');

    if (!homeTeamId || !awayTeamId) {
      return NextResponse.json({ error: 'homeTeamId and awayTeamId are required' }, { status: 400 });
    }

    // Find all completed matches between these two teams
    const matches = await db.match.findMany({
      where: {
        status: 'completed',
        OR: [
          { homeTeamId, awayTeamId },
          { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
        ],
      },
      include: {
        homeTeam: { select: { id: true, name: true, color: true } },
        awayTeam: { select: { id: true, name: true, color: true } },
        tournament: { select: { id: true, name: true } },
      },
      orderBy: { completedAt: 'desc' },
    });

    let homeWins = 0;
    let awayWins = 0;
    let draws = 0;

    const matchResults = matches.map((m) => {
      const isHomeTeamHome = m.homeTeamId === homeTeamId;
      const homeScore = m.homeScore;
      const awayScore = m.awayScore;

      let winner: 'home' | 'away' | 'draw';
      if (homeScore > awayScore) {
        winner = 'home';
        if (isHomeTeamHome) homeWins++; else awayWins++;
      } else if (awayScore > homeScore) {
        winner = 'away';
        if (isHomeTeamHome) awayWins++; else homeWins++;
      } else {
        winner = 'draw';
        draws++;
      }

      return {
        id: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeTeamColor: m.homeTeam.color,
        awayTeamColor: m.awayTeam.color,
        homeScore,
        awayScore,
        winner,
        resultForHome: winner === 'draw'
          ? 'draw'
          : (isHomeTeamHome && winner === 'home') || (!isHomeTeamHome && winner === 'away')
            ? 'win'
            : 'loss',
        completedAt: m.completedAt,
        tournamentName: m.tournament?.name || null,
      };
    });

    return NextResponse.json({
      totalMatches: matches.length,
      homeWins,
      awayWins,
      draws,
      matchResults,
    });
  } catch (error) {
    console.error('Head-to-head fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
