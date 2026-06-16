import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/player-stats
 * Save match stats for multiple players after a match ends.
 * Body: { isPractice: boolean, players: { [playerId]: { raidPoints, tacklePoints, bonusPoints, totalRaids, successfulRaids, totalTackles, successfulTackles, superTackles } } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { isPractice, players } = body as {
      isPractice: boolean;
      players: Record<string, {
        raidPoints: number;
        tacklePoints: number;
        bonusPoints: number;
        totalRaids: number;
        successfulRaids: number;
        totalTackles: number;
        successfulTackles: number;
        superTackles: number;
      }>;
    };

    if (!players || typeof players !== 'object') {
      return NextResponse.json({ error: 'players object is required' }, { status: 400 });
    }

    for (const [playerId, stats] of Object.entries(players)) {
      const existing = await db.playerProfile.findUnique({ where: { userId: playerId } });

      if (existing) {
        const totalPts = (stats.raidPoints || 0) + (stats.tacklePoints || 0) + (stats.bonusPoints || 0);

        // Overall stats (combined)
        const updateData: Record<string, unknown> = {
          totalRaids: existing.totalRaids + (stats.totalRaids || 0),
          successfulRaids: existing.successfulRaids + (stats.successfulRaids || 0),
          totalTackles: existing.totalTackles + (stats.totalTackles || 0),
          successfulTackles: existing.successfulTackles + (stats.successfulTackles || 0),
          bonusPoints: existing.bonusPoints + (stats.bonusPoints || 0),
          superTackles: existing.superTackles + (stats.superTackles || 0),
          raidPoints: existing.raidPoints + (stats.raidPoints || 0),
          tacklePoints: existing.tacklePoints + (stats.tacklePoints || 0),
          totalMatches: existing.totalMatches + 1,
          totalPoints: existing.totalPoints + totalPts,
        };

        // Category-specific stats
        if (isPractice) {
          updateData.practiceMatches = existing.practiceMatches + 1;
          updateData.practiceTotalRaids = existing.practiceTotalRaids + (stats.totalRaids || 0);
          updateData.practiceSuccessfulRaids = existing.practiceSuccessfulRaids + (stats.successfulRaids || 0);
          updateData.practiceRaidPoints = existing.practiceRaidPoints + (stats.raidPoints || 0);
          updateData.practiceTotalTackles = existing.practiceTotalTackles + (stats.totalTackles || 0);
          updateData.practiceSuccessfulTackles = existing.practiceSuccessfulTackles + (stats.successfulTackles || 0);
          updateData.practiceTacklePoints = existing.practiceTacklePoints + (stats.tacklePoints || 0);
          updateData.practiceBonusPoints = existing.practiceBonusPoints + (stats.bonusPoints || 0);
          updateData.practiceSuperTackles = existing.practiceSuperTackles + (stats.superTackles || 0);
          updateData.practiceTotalPoints = existing.practiceTotalPoints + totalPts;
        } else {
          updateData.tournamentMatches = existing.tournamentMatches + 1;
          updateData.tournamentTotalRaids = existing.tournamentTotalRaids + (stats.totalRaids || 0);
          updateData.tournamentSuccessfulRaids = existing.tournamentSuccessfulRaids + (stats.successfulRaids || 0);
          updateData.tournamentRaidPoints = existing.tournamentRaidPoints + (stats.raidPoints || 0);
          updateData.tournamentTotalTackles = existing.tournamentTotalTackles + (stats.totalTackles || 0);
          updateData.tournamentSuccessfulTackles = existing.tournamentSuccessfulTackles + (stats.successfulTackles || 0);
          updateData.tournamentTacklePoints = existing.tournamentTacklePoints + (stats.tacklePoints || 0);
          updateData.tournamentBonusPoints = existing.tournamentBonusPoints + (stats.bonusPoints || 0);
          updateData.tournamentSuperTackles = existing.tournamentSuperTackles + (stats.superTackles || 0);
          updateData.tournamentTotalPoints = existing.tournamentTotalPoints + totalPts;
        }

        // Rating: tournament avg * 0.7 + practice avg * 0.3
        const tMatches = isPractice ? existing.tournamentMatches : updateData.tournamentMatches as number;
        const tPoints = isPractice ? existing.tournamentTotalPoints : updateData.tournamentTotalPoints as number;
        const pMatches = isPractice ? updateData.practiceMatches as number : existing.practiceMatches;
        const pPoints = isPractice ? updateData.practiceTotalPoints as number : existing.practiceTotalPoints;

        const tAvg = tMatches > 0 ? tPoints / tMatches : 0;
        const pAvg = pMatches > 0 ? pPoints / pMatches : 0;
        const newRating = pMatches > 0 && tMatches > 0
          ? (tAvg * 0.7 + pAvg * 0.3)
          : tMatches > 0 ? tAvg : pAvg;
        updateData.overallRating = Math.round(newRating * 10) / 10;

        await db.playerProfile.update({
          where: { userId: playerId },
          data: updateData,
        });
      } else {
        const totalPts = (stats.raidPoints || 0) + (stats.tacklePoints || 0) + (stats.bonusPoints || 0);

        const createData: Record<string, unknown> = {
          userId: playerId,
          totalRaids: stats.totalRaids || 0,
          successfulRaids: stats.successfulRaids || 0,
          totalTackles: stats.totalTackles || 0,
          successfulTackles: stats.successfulTackles || 0,
          bonusPoints: stats.bonusPoints || 0,
          superTackles: stats.superTackles || 0,
          raidPoints: stats.raidPoints || 0,
          tacklePoints: stats.tacklePoints || 0,
          totalMatches: 1,
          totalPoints: totalPts,
          overallRating: totalPts,
        };

        // Category-specific stats
        if (isPractice) {
          createData.practiceMatches = 1;
          createData.practiceTotalRaids = stats.totalRaids || 0;
          createData.practiceSuccessfulRaids = stats.successfulRaids || 0;
          createData.practiceRaidPoints = stats.raidPoints || 0;
          createData.practiceTotalTackles = stats.totalTackles || 0;
          createData.practiceSuccessfulTackles = stats.successfulTackles || 0;
          createData.practiceTacklePoints = stats.tacklePoints || 0;
          createData.practiceBonusPoints = stats.bonusPoints || 0;
          createData.practiceSuperTackles = stats.superTackles || 0;
          createData.practiceTotalPoints = totalPts;
        } else {
          createData.tournamentMatches = 1;
          createData.tournamentTotalRaids = stats.totalRaids || 0;
          createData.tournamentSuccessfulRaids = stats.successfulRaids || 0;
          createData.tournamentRaidPoints = stats.raidPoints || 0;
          createData.tournamentTotalTackles = stats.totalTackles || 0;
          createData.tournamentSuccessfulTackles = stats.successfulTackles || 0;
          createData.tournamentTacklePoints = stats.tacklePoints || 0;
          createData.tournamentBonusPoints = stats.bonusPoints || 0;
          createData.tournamentSuperTackles = stats.superTackles || 0;
          createData.tournamentTotalPoints = totalPts;
        }

        await db.playerProfile.create({
          data: createData,
        });
      }
    }

    return NextResponse.json({ success: true, updated: Object.keys(players).length });
  } catch (error) {
    console.error('Player stats save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/player-stats?leaderboard=true&gender=all&position=all&limit=20
 * Get tournament-based leaderboard
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isLeaderboard = searchParams.get('leaderboard') === 'true';
    const gender = searchParams.get('gender') || 'all';
    const position = searchParams.get('position') || 'all';
    const limit = parseInt(searchParams.get('limit') || '20');
    const userId = searchParams.get('userId');

    // Single player stats
    if (userId) {
      const profile = await db.playerProfile.findUnique({
        where: { userId },
        include: { user: true },
      });
      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }
      return NextResponse.json({ profile });
    }

    // Leaderboard — sorted by tournamentTotalPoints
    if (isLeaderboard) {
      const userWhere: Record<string, unknown> = {};
      if (gender && gender !== 'all') userWhere.gender = gender;

      const profileWhere: Record<string, unknown> = {};
      if (position && position !== 'all') profileWhere.position = position;
      profileWhere.tournamentMatches = { gt: 0 };

      const profiles = await db.playerProfile.findMany({
        where: {
          user: userWhere,
          ...profileWhere,
        },
        orderBy: [
          { tournamentTotalPoints: 'desc' },
          { tournamentRaidPoints: 'desc' },
        ],
        take: limit,
        include: { user: true },
      });

      const leaderboard = profiles.map((p, idx) => ({
        rank: idx + 1,
        userId: p.userId,
        name: p.user.name || 'Unknown',
        avatar: p.user.avatar,
        position: p.position,
        gender: p.user.gender,
        tournamentMatches: p.tournamentMatches,
        tournamentTotalPoints: p.tournamentTotalPoints,
        tournamentRaidPoints: p.tournamentRaidPoints,
        tournamentTacklePoints: p.tournamentTacklePoints,
        tournamentBonusPoints: p.tournamentBonusPoints,
        tournamentSuccessfulRaids: p.tournamentSuccessfulRaids,
        tournamentSuccessfulTackles: p.tournamentSuccessfulTackles,
        tournamentSuperTackles: p.tournamentSuperTackles,
        overallRating: p.overallRating,
        avgPointsPerMatch: p.tournamentMatches > 0
          ? Math.round((p.tournamentTotalPoints / p.tournamentMatches) * 10) / 10
          : 0,
        raidSuccessRate: p.tournamentTotalRaids > 0
          ? Math.round((p.tournamentSuccessfulRaids / p.tournamentTotalRaids) * 100)
          : 0,
        tackleSuccessRate: p.tournamentTotalTackles > 0
          ? Math.round((p.tournamentSuccessfulTackles / p.tournamentTotalTackles) * 100)
          : 0,
      }));

      return NextResponse.json({ leaderboard });
    }

    return NextResponse.json({ error: 'Specify userId or leaderboard=true' }, { status: 400 });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
