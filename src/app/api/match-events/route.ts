import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/match-events?matchId=xxx
 * Returns events for a specific match, formatted for the commentary ticker.
 * Also returns player roster for each team.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: {
          select: {
            id: true, name: true, color: true,
            members: {
              select: {
                isCaptain: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                    playerCode: true,
                    profile: {
                      select: {
                        jerseyNumber: true,
                        position: true,
                        overallRating: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        awayTeam: {
          select: {
            id: true, name: true, color: true,
            members: {
              select: {
                isCaptain: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                    playerCode: true,
                    profile: {
                      select: {
                        jerseyNumber: true,
                        position: true,
                        overallRating: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        events: {
          orderBy: { timestamp: 'asc' },
          take: 50,
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Format players for each team
    const formatPlayers = (
      members: typeof match.homeTeam.members,
      teamId: string,
    ) =>
      members.map((m) => ({
        id: m.user.id,
        name: m.user.name || 'Player',
        avatar: m.user.avatar ?? undefined,
        jerseyNumber: m.user.profile?.jerseyNumber ?? undefined,
        position: m.user.profile?.position ?? undefined,
        playerCode: m.user.playerCode ?? undefined,
        isCaptain: m.isCaptain,
        teamId,
      }));

    const homePlayers = formatPlayers(match.homeTeam.members, match.homeTeamId);
    const awayPlayers = formatPlayers(match.awayTeam.members, match.awayTeamId);

    // Format events for the ticker
    const events = match.events.map((evt) => ({
      id: evt.id,
      matchId: evt.matchId,
      teamId: evt.teamId,
      playerId: evt.playerId ?? undefined,
      eventType: evt.eventType,
      value: evt.value,
      details: evt.details ?? undefined,
      half: evt.half,
      timestamp: new Date(evt.timestamp).getTime(),
    }));

    return NextResponse.json({
      match: {
        id: match.id,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        homeTeamColor: match.homeTeam.color ?? '#DC2626',
        awayTeamColor: match.awayTeam.color ?? '#1E293B',
        currentHalf: match.half,
        halfDuration: match.halfDuration,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        playersPerSide: match.playersPerSide,
        homePlayers,
        awayPlayers,
      },
      events,
    });
  } catch (error) {
    console.error('Match events fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
