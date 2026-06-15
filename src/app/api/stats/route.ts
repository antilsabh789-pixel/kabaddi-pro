import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gender = searchParams.get('gender') || 'all';

    const userWhere: Record<string, unknown> = {};
    if (gender && gender !== 'all') userWhere.gender = gender;

    // ── Count stats ──────────────────────────────────────────────
    const totalPlayers = await db.user.count({ where: userWhere });
    const totalTeams = await db.team.count();
    const totalTournaments = await db.tournament.count({
      where: { status: { in: ['ongoing', 'upcoming'] } },
    });
    const totalMatches = await db.match.count();
    const liveMatchCount = await db.match.count({ where: { status: 'live' } });
    const completedMatchCount = await db.match.count({ where: { status: 'completed' } });
    const upcomingMatchCount = await db.match.count({ where: { status: 'upcoming' } });

    // ── Aggregate player stats ───────────────────────────────────
    const aggregateStats = await db.playerProfile.aggregate({
      _sum: {
        raidPoints: true,
        tacklePoints: true,
        bonusPoints: true,
        totalPoints: true,
        totalRaids: true,
        successfulRaids: true,
        totalTackles: true,
        successfulTackles: true,
        superTackles: true,
      },
      where: userWhere.gender ? { user: userWhere } : undefined,
    });

    const totalRaidPoints = aggregateStats._sum.raidPoints ?? 0;
    const totalTacklePoints = aggregateStats._sum.tacklePoints ?? 0;
    const totalBonusPoints = aggregateStats._sum.bonusPoints ?? 0;
    const grandTotalPoints = aggregateStats._sum.totalPoints ?? 0;
    const grandTotalRaids = aggregateStats._sum.totalRaids ?? 0;
    const grandSuccessfulRaids = aggregateStats._sum.successfulRaids ?? 0;
    const grandTotalTackles = aggregateStats._sum.totalTackles ?? 0;
    const grandSuccessfulTackles = aggregateStats._sum.successfulTackles ?? 0;
    const grandSuperTackles = aggregateStats._sum.superTackles ?? 0;

    // Raid success rate
    const raidSuccessRate = grandTotalRaids > 0
      ? Math.round((grandSuccessfulRaids / grandTotalRaids) * 100)
      : 0;

    // Tackle success rate
    const tackleSuccessRate = grandTotalTackles > 0
      ? Math.round((grandSuccessfulTackles / grandTotalTackles) * 100)
      : 0;

    // ── Live matches with full team details + tournament ─────────
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
      weightCategory: m.weightCategory,
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

    // ── Recent completed matches (last 10) ───────────────────────
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
      weightCategory: m.weightCategory,
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

    // ── Upcoming matches (next 10) ───────────────────────────────
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
      weightCategory: m.weightCategory,
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

    // ── Top Raiders ──────────────────────────────────────────────
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
      raidPoints: p.raidPoints,
      user: {
        id: p.user.id,
        name: p.user.name || 'Unknown',
        avatar: p.user.avatar,
        playerCode: p.user.playerCode,
      },
    }));

    // ── Top Defenders ────────────────────────────────────────────
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
      tacklePoints: p.tacklePoints,
      user: {
        id: p.user.id,
        name: p.user.name || 'Unknown',
        avatar: p.user.avatar,
        playerCode: p.user.playerCode,
      },
    }));

    // ── Top Scorers (overall) ────────────────────────────────────
    const topScorersRaw = await db.playerProfile.findMany({
      where: { user: userWhere },
      orderBy: { totalPoints: 'desc' },
      take: 5,
      include: { user: true },
    });

    const topScorers = topScorersRaw.map((p) => ({
      id: p.id,
      userId: p.userId,
      totalPoints: p.totalPoints,
      raidPoints: p.raidPoints,
      tacklePoints: p.tacklePoints,
      bonusPoints: p.bonusPoints,
      totalMatches: p.totalMatches,
      user: {
        id: p.user.id,
        name: p.user.name || 'Unknown',
        avatar: p.user.avatar,
        playerCode: p.user.playerCode,
      },
    }));

    // ── Recent MOTM awards ───────────────────────────────────────
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

    // ── Position breakdown ────────────────────────────────────────
    const raiderCount = await db.playerProfile.count({
      where: { position: 'raider', user: userWhere },
    });
    const defenderCount = await db.playerProfile.count({
      where: { position: 'defender', user: userWhere },
    });
    const allRounderCount = await db.playerProfile.count({
      where: { position: 'all-rounder', user: userWhere },
    });

    return NextResponse.json({
      stats: {
        totalMatches,
        totalPlayers,
        totalTournaments,
        totalTeams,
        liveMatchCount,
        completedMatchCount,
        upcomingMatchCount,
        // Aggregate stats
        totalRaidPoints,
        totalTacklePoints,
        totalBonusPoints,
        grandTotalPoints,
        raidSuccessRate,
        tackleSuccessRate,
        grandTotalRaids,
        grandSuccessfulRaids,
        grandTotalTackles,
        grandSuccessfulTackles,
        grandSuperTackles,
        // Position breakdown
        raiderCount,
        defenderCount,
        allRounderCount,
      },
      liveMatches,
      recentMatches,
      upcomingMatches,
      topRaiders,
      topDefenders,
      topScorers,
      recentMotmAwards,
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    // Return a valid empty-state response instead of error
    return NextResponse.json({
      stats: {
        totalMatches: 0,
        totalPlayers: 0,
        totalTournaments: 0,
        totalTeams: 0,
        liveMatchCount: 0,
        completedMatchCount: 0,
        upcomingMatchCount: 0,
        totalRaidPoints: 0,
        totalTacklePoints: 0,
        totalBonusPoints: 0,
        grandTotalPoints: 0,
        raidSuccessRate: 0,
        tackleSuccessRate: 0,
        grandTotalRaids: 0,
        grandSuccessfulRaids: 0,
        grandTotalTackles: 0,
        grandSuccessfulTackles: 0,
        grandSuperTackles: 0,
        raiderCount: 0,
        defenderCount: 0,
        allRounderCount: 0,
      },
      liveMatches: [],
      recentMatches: [],
      upcomingMatches: [],
      topRaiders: [],
      topDefenders: [],
      topScorers: [],
      recentMotmAwards: [],
    });
  }
}
