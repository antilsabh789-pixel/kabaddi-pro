import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    // Fetch match data with all related info
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logo: true, color: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logo: true, color: true } },
        events: {
          orderBy: { timestamp: 'asc' },
        },
        scorers: {
          include: {
            user: { select: { id: true, name: true, playerCode: true } },
          },
        },
        tournament: { select: { id: true, name: true } },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Process events into a summary
    const eventsByType: Record<string, { home: number; away: number }> = {};

    for (const event of match.events) {
      if (!eventsByType[event.eventType]) {
        eventsByType[event.eventType] = { home: 0, away: 0 };
      }
      if (event.teamId === match.homeTeamId) {
        eventsByType[event.eventType].home += event.value;
      } else {
        eventsByType[event.eventType].away += event.value;
      }
    }

    // Half scores - calculate from events
    const firstHalfEvents = match.events.filter(e => e.half === 1);
    const secondHalfEvents = match.events.filter(e => e.half === 2);

    let homeFirstHalf = 0;
    let awayFirstHalf = 0;
    let homeSecondHalf = 0;
    let awaySecondHalf = 0;

    for (const event of firstHalfEvents) {
      if (event.eventType === 'raid_point' || event.eventType === 'bonus_point' ||
          event.eventType === 'tackle_point' || event.eventType === 'super_raid' ||
          event.eventType === 'super_tackle' || event.eventType === 'all_out' ||
          event.eventType === 'do_or_die_raid') {
        if (event.teamId === match.homeTeamId) {
          homeFirstHalf += event.value;
        } else {
          awayFirstHalf += event.value;
        }
      }
    }

    for (const event of secondHalfEvents) {
      if (event.eventType === 'raid_point' || event.eventType === 'bonus_point' ||
          event.eventType === 'tackle_point' || event.eventType === 'super_raid' ||
          event.eventType === 'super_tackle' || event.eventType === 'all_out' ||
          event.eventType === 'do_or_die_raid') {
        if (event.teamId === match.homeTeamId) {
          homeSecondHalf += event.value;
        } else {
          awaySecondHalf += event.value;
        }
      }
    }

    // Top performers - aggregate points per player
    const playerPoints: Record<string, { name: string; points: number; teamId: string; teamName: string }> = {};

    for (const event of match.events) {
      if (!event.playerId) continue;
      if (!['raid_point', 'bonus_point', 'super_raid'].includes(event.eventType)) continue;

      if (!playerPoints[event.playerId]) {
        playerPoints[event.playerId] = {
          name: event.playerId, // fallback
          points: 0,
          teamId: event.teamId,
          teamName: event.teamId === match.homeTeamId ? match.homeTeam.name : match.awayTeam.name,
        };
      }
      playerPoints[event.playerId].points += event.value;
    }

    // Try to get player names from scorers
    for (const scorer of match.scorers) {
      if (playerPoints[scorer.userId]) {
        playerPoints[scorer.userId].name = scorer.user.name || 'Unknown';
      }
    }

    const topPerformers = Object.values(playerPoints)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // Build the scorecard data
    const scorecard = {
      matchId: match.id,
      date: match.startedAt ? new Date(match.startedAt).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      }) : 'N/A',
      venue: match.venue || 'N/A',
      tournament: match.tournament?.name || null,
      gender: match.gender,
      weightCategory: match.weightCategory,
      status: match.status,
      isPractice: match.isPractice,
      halfDuration: match.halfDuration,
      playersPerSide: match.playersPerSide,
      homeTeam: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        shortName: match.homeTeam.shortName,
        color: match.homeTeam.color,
        logo: match.homeTeam.logo,
        score: match.homeScore,
        firstHalfScore: homeFirstHalf,
        secondHalfScore: homeSecondHalf,
      },
      awayTeam: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        shortName: match.awayTeam.shortName,
        color: match.awayTeam.color,
        logo: match.awayTeam.logo,
        score: match.awayScore,
        firstHalfScore: awayFirstHalf,
        secondHalfScore: awaySecondHalf,
      },
      eventsSummary: eventsByType,
      topPerformers,
      totalEvents: match.events.length,
    };

    return NextResponse.json({ scorecard });
  } catch (error) {
    console.error('Scorecard PDF error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
