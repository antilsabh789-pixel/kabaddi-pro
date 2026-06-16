import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const season = await db.season.findUnique({
      where: { id },
      include: {
        seasonTeams: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                shortName: true,
                logo: true,
                color: true,
              },
            },
          },
          orderBy: { rank: 'asc' },
        },
        seasonMatches: {
          include: {
            match: {
              include: {
                homeTeam: { select: { id: true, name: true, shortName: true, logo: true, color: true } },
                awayTeam: { select: { id: true, name: true, shortName: true, logo: true, color: true } },
              },
            },
          },
          orderBy: { matchDay: 'asc' },
        },
        sponsors: true,
      },
    });

    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    // Compute standings from seasonTeams
    const standings = season.seasonTeams
      .map((st) => ({
        rank: st.rank,
        teamId: st.team.id,
        teamName: st.team.name,
        shortName: st.team.shortName,
        logo: st.team.logo,
        color: st.team.color,
        wins: st.wins,
        losses: st.losses,
        draws: st.draws,
        points: st.points,
        played: st.wins + st.losses + st.draws,
        scoreDiff: 0,
      }))
      .sort((a, b) => b.points - a.points);

    const formatted = {
      id: season.id,
      name: season.name,
      year: season.year,
      startDate: season.startDate,
      endDate: season.endDate,
      status: season.status,
      description: season.description,
      createdAt: season.createdAt,
      updatedAt: season.updatedAt,
      teams: season.seasonTeams.map((st) => ({
        id: st.id,
        teamId: st.team.id,
        teamName: st.team.name,
        shortName: st.team.shortName,
        logo: st.team.logo,
        color: st.team.color,
        wins: st.wins,
        losses: st.losses,
        draws: st.draws,
        points: st.points,
        rank: st.rank,
      })),
      matches: season.seasonMatches.map((sm) => ({
        id: sm.id,
        matchDay: sm.matchDay,
        matchId: sm.match.id,
        homeTeam: sm.match.homeTeam,
        awayTeam: sm.match.awayTeam,
        homeScore: sm.match.homeScore,
        awayScore: sm.match.awayScore,
        status: sm.match.status,
        startedAt: sm.match.startedAt,
        completedAt: sm.match.completedAt,
      })),
      standings,
      sponsors: season.sponsors,
    };

    return NextResponse.json({ season: formatted });
  } catch (error) {
    console.error('Season fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, endDate } = body;

    const existing = await db.season.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (status) data.status = status;
    if (endDate) data.endDate = new Date(endDate);

    const season = await db.season.update({
      where: { id },
      data,
      include: {
        seasonTeams: { include: { team: true } },
      },
    });

    return NextResponse.json({ season });
  } catch (error) {
    console.error('Season update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
