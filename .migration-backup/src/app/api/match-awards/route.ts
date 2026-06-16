import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    // Find recent matches with MOTM
    const motmMatches = await db.match.findMany({
      where: {
        status: 'completed',
        motmUserId: { not: null },
      },
      take: limit,
      orderBy: { completedAt: 'desc' },
      include: {
        homeTeam: { select: { id: true, name: true, color: true } },
        awayTeam: { select: { id: true, name: true, color: true } },
        tournament: { select: { id: true, name: true } },
      },
    });

    const awards = await Promise.all(
      motmMatches
        .filter((m) => m.motmUserId)
        .map(async (m) => {
          const motmUser = await db.user.findUnique({
            where: { id: m.motmUserId! },
            select: { id: true, name: true, avatar: true },
          });

          // Get team name for the MOTM user
          const teamMembership = await db.teamMember.findFirst({
            where: { userId: m.motmUserId! },
            include: { team: { select: { name: true } } },
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
            teamName: teamMembership?.team.name || null,
            points,
            matchInfo: `${m.homeTeam.name} ${m.homeScore} - ${m.awayScore} ${m.awayTeam.name}`,
            tournamentName: m.tournament?.name || null,
            completedAt: m.completedAt,
            homeTeamColor: m.homeTeam.color,
            awayTeamColor: m.awayTeam.color,
          };
        })
    );

    return NextResponse.json({ awards });
  } catch (error) {
    console.error('Match awards fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
