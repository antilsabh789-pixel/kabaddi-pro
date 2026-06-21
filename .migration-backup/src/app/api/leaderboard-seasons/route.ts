import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId'); // optional, defaults to current

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();

    // If no seasonId, find or create current season
    let currentSeason = seasonId
      ? await db.leaderboardSeason.findUnique({ where: { id: seasonId } })
      : await db.leaderboardSeason.findFirst({
          where: { month: currentMonth, year: currentYear },
        });

    if (!currentSeason && !seasonId) {
      // Auto-create current month's season
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);
      const seasonName = startOfMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

      currentSeason = await db.leaderboardSeason.create({
        data: {
          name: seasonName,
          month: currentMonth,
          year: currentYear,
          startDate: startOfMonth,
          endDate: endOfMonth,
          status: 'active',
        },
      });
    }

    if (!currentSeason) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    // Get entries for the selected season
    const entries = await db.leaderboardSeasonEntry.findMany({
      where: { leaderboardSeasonId: currentSeason.id },
      orderBy: { totalPoints: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, playerCode: true },
        },
      },
    });

    // Add rank based on sort order
    const rankedEntries = entries.map((entry, index) => ({
      rank: index + 1,
      id: entry.id,
      userId: entry.userId,
      name: entry.user.name || 'Unknown',
      avatar: entry.user.avatar,
      playerCode: entry.user.playerCode,
      totalPoints: entry.totalPoints,
      raidPoints: entry.raidPoints,
      tacklePoints: entry.tacklePoints,
      matchesPlayed: entry.matchesPlayed,
    }));

    // Calculate days remaining in the season
    const daysRemaining = Math.max(0, Math.ceil(
      (new Date(currentSeason.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ));

    // Get past seasons for selector
    const allSeasons = await db.leaderboardSeason.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const pastSeasons = allSeasons.map(s => ({
      id: s.id,
      name: s.name,
      month: s.month,
      year: s.year,
      status: s.status,
      isCurrent: s.id === currentSeason!.id,
    }));

    return NextResponse.json({
      currentSeason: {
        id: currentSeason.id,
        name: currentSeason.name,
        month: currentSeason.month,
        year: currentSeason.year,
        status: currentSeason.status,
        startDate: currentSeason.startDate,
        endDate: currentSeason.endDate,
        daysRemaining,
      },
      entries: rankedEntries,
      seasons: pastSeasons,
    });
  } catch (error) {
    console.error('Leaderboard seasons error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
