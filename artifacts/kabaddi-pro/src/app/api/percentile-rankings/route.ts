import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get the user's profile
    const userProfile = await db.playerProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      return NextResponse.json({ error: 'Player profile not found' }, { status: 404 });
    }

    // Get all player profiles for comparison
    const allProfiles = await db.playerProfile.findMany({
      where: { totalMatches: { gt: 0 } },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    const totalPlayers = allProfiles.length;

    if (totalPlayers === 0) {
      return NextResponse.json({ percentiles: {}, overallPercentile: 0, totalPlayers: 0 });
    }

    // Calculate percentile for each stat
    // Percentile = (number of players below you / total players) * 100
    const calcPercentile = (getValue: (p: typeof allProfiles[0]) => number): number => {
      const userValue = getValue(userProfile as unknown as typeof allProfiles[0]);
      const below = allProfiles.filter(p => getValue(p) < userValue).length;
      return Math.round((below / totalPlayers) * 100);
    };

    const raidPointsPercentile = calcPercentile(p => p.raidPoints);
    const tacklePointsPercentile = calcPercentile(p => p.tacklePoints);
    const totalPointsPercentile = calcPercentile(p => p.totalPoints);
    const successRatePercentile = calcPercentile(p => {
      const totalRaids = p.totalRaids || 1;
      const totalTackles = p.totalTackles || 1;
      const raidRate = (p.successfulRaids / totalRaids) * 100;
      const tackleRate = (p.successfulTackles / totalTackles) * 100;
      return (raidRate + tackleRate) / 2;
    });
    const superTacklesPercentile = calcPercentile(p => p.superTackles);

    // Overall percentile (average of all)
    const overallPercentile = Math.round(
      (raidPointsPercentile + tacklePointsPercentile + totalPointsPercentile + successRatePercentile + superTacklesPercentile) / 5
    );

    // Distribution data for chart (how many players fall in each percentile bucket)
    const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const distribution = buckets.slice(0, -1).map((low, i) => {
      const high = buckets[i + 1];
      const count = allProfiles.filter(p => {
        const totalPts = p.totalPoints;
        const lowBound = low === 0 ? 0 : allProfiles.sort((a, b) => a.totalPoints - b.totalPoints)[Math.floor((low / 100) * totalPlayers)]?.totalPoints || 0;
        const highBound = allProfiles.sort((a, b) => a.totalPoints - b.totalPoints)[Math.floor((high / 100) * totalPlayers)]?.totalPoints || 0;
        return totalPts >= lowBound && totalPts < highBound;
      }).length;
      return { range: `${low}-${high}%`, count };
    });

    // Stats for display
    const totalRaids = userProfile.totalRaids || 1;
    const totalTackles = userProfile.totalTackles || 1;

    const percentiles = {
      raidPoints: {
        value: userProfile.raidPoints,
        percentile: raidPointsPercentile,
        label: 'Raid Points',
      },
      tacklePoints: {
        value: userProfile.tacklePoints,
        percentile: tacklePointsPercentile,
        label: 'Tackle Points',
      },
      totalPoints: {
        value: userProfile.totalPoints,
        percentile: totalPointsPercentile,
        label: 'Total Points',
      },
      successRate: {
        value: Math.round(((userProfile.successfulRaids / totalRaids + userProfile.successfulTackles / totalTackles) / 2) * 100),
        percentile: successRatePercentile,
        label: 'Success Rate',
        suffix: '%',
      },
      superTackles: {
        value: userProfile.superTackles,
        percentile: superTacklesPercentile,
        label: 'Super Tackles',
      },
    };

    return NextResponse.json({
      percentiles,
      overallPercentile,
      totalPlayers,
      distribution,
      userName: userProfile.user?.name || null,
    });
  } catch (error) {
    console.error('Percentile rankings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
