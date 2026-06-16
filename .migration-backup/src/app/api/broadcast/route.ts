import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId') || '';

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400 }
      );
    }

    // Fetch match details with teams
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logo: true,
            color: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logo: true,
            color: true,
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Fetch recent events (last 20)
    const recentEvents = await db.matchEvent.findMany({
      where: { matchId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    // Build match stats summary from events
    const allEvents = await db.matchEvent.findMany({
      where: { matchId },
    });

    const homeEventCounts: Record<string, number> = {};
    const awayEventCounts: Record<string, number> = {};
    let homeRaidPoints = 0;
    let awayRaidPoints = 0;
    let homeTacklePoints = 0;
    let awayTacklePoints = 0;
    let homeAllOuts = 0;
    let awayAllOuts = 0;

    for (const evt of allEvents) {
      if (evt.teamId === match.homeTeamId) {
        homeEventCounts[evt.eventType] = (homeEventCounts[evt.eventType] || 0) + 1;
        if (evt.eventType === 'raid_point' || evt.eventType === 'bonus_point' || evt.eventType === 'super_raid' || evt.eventType === 'do_or_die_raid') {
          homeRaidPoints += evt.value;
        }
        if (evt.eventType === 'tackle' || evt.eventType === 'super_tackle') {
          homeTacklePoints += evt.value;
        }
        if (evt.eventType === 'all_out') {
          homeAllOuts += 1;
        }
      } else if (evt.teamId === match.awayTeamId) {
        awayEventCounts[evt.eventType] = (awayEventCounts[evt.eventType] || 0) + 1;
        if (evt.eventType === 'raid_point' || evt.eventType === 'bonus_point' || evt.eventType === 'super_raid' || evt.eventType === 'do_or_die_raid') {
          awayRaidPoints += evt.value;
        }
        if (evt.eventType === 'tackle' || evt.eventType === 'super_tackle') {
          awayTacklePoints += evt.value;
        }
        if (evt.eventType === 'all_out') {
          awayAllOuts += 1;
        }
      }
    }

    const statsSummary = {
      home: {
        teamId: match.homeTeamId,
        teamName: match.homeTeam.name,
        totalPoints: match.homeScore,
        raidPoints: homeRaidPoints,
        tacklePoints: homeTacklePoints,
        allOuts: homeAllOuts,
        eventCounts: homeEventCounts,
      },
      away: {
        teamId: match.awayTeamId,
        teamName: match.awayTeam.name,
        totalPoints: match.awayScore,
        raidPoints: awayRaidPoints,
        tacklePoints: awayTacklePoints,
        allOuts: awayAllOuts,
        eventCounts: awayEventCounts,
      },
      totalEvents: allEvents.length,
    };

    // Fetch active poll for this match
    const activePoll = await db.poll.findFirst({
      where: { matchId, status: 'active' },
      include: {
        options: {
          include: {
            team: { select: { id: true, name: true, shortName: true } },
            _count: { select: { votes: true } },
          },
        },
        _count: { select: { votes: true } },
      },
    });

    let pollData = null;
    if (activePoll) {
      pollData = {
        id: activePoll.id,
        question: activePoll.question,
        type: activePoll.type,
        endsAt: activePoll.endsAt,
        totalVotes: activePoll._count.votes,
        options: activePoll.options.map((opt) => ({
          id: opt.id,
          label: opt.label,
          icon: opt.icon,
          teamId: opt.teamId,
          team: opt.team,
          voteCount: opt._count.votes,
          percentage: activePoll._count.votes > 0
            ? Math.round((opt._count.votes / activePoll._count.votes) * 100)
            : 0,
        })),
      };
    }

    const broadcastData = {
      match: {
        id: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        half: match.half,
        halfDuration: match.halfDuration,
        status: match.status,
        startedAt: match.startedAt,
        completedAt: match.completedAt,
        isPractice: match.isPractice,
        venue: match.venue,
      },
      recentEvents: recentEvents.reverse(),
      statsSummary,
      activePoll: pollData,
    };

    return NextResponse.json(broadcastData);
  } catch (error) {
    console.error('Broadcast fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
