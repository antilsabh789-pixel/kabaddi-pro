import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const seasons = await db.season.findMany({
      where,
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
        _count: {
          select: {
            seasonMatches: true,
            sponsors: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = seasons.map((season) => ({
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
      matchCount: season._count.seasonMatches,
      sponsorCount: season._count.sponsors,
    }));

    return NextResponse.json({ seasons: formatted });
  } catch (error) {
    console.error('Seasons fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, year, startDate, endDate, description } = body;

    if (!name || !year || !startDate) {
      return NextResponse.json(
        { error: 'name, year, and startDate are required' },
        { status: 400 }
      );
    }

    const season = await db.season.create({
      data: {
        name,
        year: parseInt(String(year)),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        description: description || null,
        status: 'upcoming',
      },
      include: {
        seasonTeams: { include: { team: true } },
      },
    });

    return NextResponse.json({ season }, { status: 201 });
  } catch (error) {
    console.error('Season create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
