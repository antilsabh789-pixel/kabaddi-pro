import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gender = searchParams.get('gender') || 'all';

    const userWhere: Record<string, unknown> = {};
    if (gender && gender !== 'all') userWhere.gender = gender;

    // Count stats
    const totalPlayers = await db.user.count({ where: userWhere });
    const totalTeams = await db.team.count();
    const totalTournaments = await db.tournament.count({
      where: { status: { in: ['ongoing', 'upcoming'] } },
    });
    const totalMatches = await db.match.count();
    const liveMatchCount = await db.match.count({ where: { status: 'live' } });
    const completedMatchCount = await db.match.count({ where: { status: 'completed' } });
    const upcomingMatchCount = await db.match.count({ where: { status: 'upcoming' } });

    // Live matches with full team details + tournament
    const liveMatchesRaw = await db.match.findMany({
      where: { status: 'live' },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: { select: { id: true, name: true } },
      },
      take: 10,
      orderBy: { startedAt: 'desc' },
    });

    const liveMatches = liveMatchesRaw.map((m) => ({
      id: m.id,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      half: m.half,
      status: m.status,
      gender: m.gender,
      homeTeam: {
        id: m.homeTeam.id,
        name: m.homeTeam.name,
        shortName: m.homeTeam.shortName,
        color: m.homeTeam.color,
        logo: m.homeTeam.logo,
      },
      awayTeam: {
        id: m.awayTeam.id,
        name: m.awayTeam.name,
        shortName: m.awayTeam.shortName,
        color: m.awayTeam.color,
        logo: m.awayTeam.logo,
      },
      tournament: m.tournament,
    }));

    // Recent completed matches (last 10)
    const recentMatchesRaw = await db.match.findMany({
      where: { status: 'completed' },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: { select: { id: true, name: true } },
      },
      take: 10,
      orderBy: { completedAt: 'desc' },
    });

    const recentMatches = recentMatchesRaw.map((m) => ({
      id: m.id,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      half: m.half,
      status: m.status,
      gender: m.gender,
      homeTeam: {
        id: m.homeTeam.id,
        name: m.homeTeam.name,
        shortName: m.homeTeam.shortName,
        color: m.homeTeam.color,
      },
      awayTeam: {
        id: m.awayTeam.id,
        name: m.awayTeam.name,
        shortName: m.awayTeam.shortName,
        color: m.awayTeam.color,
      },
      tournament: m.tournament,
      startedAt: m.startedAt,
      completedAt: m.completedAt,
    }));

    // Upcoming matches (next 10)
    const upcomingMatchesRaw = await db.match.findMany({
      where: { status: 'upcoming' },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: { select: { id: true, name: true } },
      },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    const upcomingMatches = upcomingMatchesRaw.map((m) => ({
      id: m.id,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      half: m.half,
      status: m.status,
      gender: m.gender,
      homeTeam: {
        id: m.homeTeam.id,
        name: m.homeTeam.name,
        shortName: m.homeTeam.shortName,
        color: m.homeTeam.color,
      },
      awayTeam: {
        id: m.awayTeam.id,
        name: m.awayTeam.name,
        shortName: m.awayTeam.shortName,
        color: m.awayTeam.color,
      },
      tournament: m.tournament,
      startedAt: m.startedAt,
      completedAt: m.completedAt,
    }));

    // Top Raiders - with user details for awards display
    const topRaidersRaw = await db.playerProfile.findMany({
      where: { user: userWhere },
      orderBy: { successfulRaids: 'desc' },
      take: 5,
      include: { user: true },
    });

    const topRaiders = topRaidersRaw.map((p) => ({
      id: p.id,
      userId: p.userId,
      totalRaids: p.totalRaids,
      successfulRaids: p.successfulRaids,
      bonusPoints: p.bonusPoints,
      user: {
        id: p.user.id,
        name: p.user.name || 'Unknown',
        avatar: p.user.avatar,
      },
    }));

    // Top Defenders - with user details for awards display
    const topDefendersRaw = await db.playerProfile.findMany({
      where: { user: userWhere },
      orderBy: { successfulTackles: 'desc' },
      take: 5,
      include: { user: true },
    });

    const topDefenders = topDefendersRaw.map((p) => ({
      id: p.id,
      userId: p.userId,
      totalTackles: p.totalTackles,
      successfulTackles: p.successfulTackles,
      superTackles: p.superTackles,
      user: {
        id: p.user.id,
        name: p.user.name || 'Unknown',
        avatar: p.user.avatar,
      },
    }));

    // Recent MOTM awards
    const motmMatches = await db.match.findMany({
      where: {
        status: 'completed',
        motmUserId: { not: null },
      },
      take: 5,
      orderBy: { completedAt: 'desc' },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        tournament: { select: { name: true } },
      },
    });

    const recentMotmAwards = await Promise.all(
      motmMatches
        .filter((m) => m.motmUserId)
        .map(async (m) => {
          const motmUser = await db.user.findUnique({
            where: { id: m.motmUserId! },
            select: { id: true, name: true, avatar: true },
          });
          // Count points for MOTM from match events
          const events = await db.matchEvent.findMany({
            where: { matchId: m.id, playerId: m.motmUserId! },
          });
          const points = events.reduce((sum, e) => sum + e.value, 0);
          return {
            matchId: m.id,
            userId: m.motmUserId!,
            userName: motmUser?.name || 'Unknown',
            userAvatar: motmUser?.avatar,
            points,
            matchInfo: `${m.homeTeam.name} vs ${m.awayTeam.name}`,
            tournamentName: m.tournament?.name || null,
            completedAt: m.completedAt,
          };
        })
    );

    return NextResponse.json({
      stats: {
        totalMatches,
        totalPlayers,
        totalTournaments,
        totalTeams,
        liveMatchCount,
        completedMatchCount,
        upcomingMatchCount,
      },
      liveMatches,
      recentMatches,
      upcomingMatches,
      topRaiders,
      topDefenders,
      recentMotmAwards,
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
