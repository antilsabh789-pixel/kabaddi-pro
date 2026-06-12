import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/match-events?matchId=xxx
 * Returns events for a specific match, formatted for the commentary ticker.
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
        homeTeam: { select: { id: true, name: true, color: true } },
        awayTeam: { select: { id: true, name: true, color: true } },
        events: {
          orderBy: { timestamp: 'asc' },
          take: 50,
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

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
      },
      events,
    });
  } catch (error) {
    console.error('Match events fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
