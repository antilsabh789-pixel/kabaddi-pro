import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: seasonId } = await params;
    const body = await request.json();
    const { teamId } = body;

    if (!teamId) {
      return NextResponse.json(
        { error: 'teamId is required' },
        { status: 400 }
      );
    }

    // Verify season exists
    const season = await db.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    // Verify team exists
    const team = await db.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if team is already in this season
    const existing = await db.seasonTeam.findUnique({
      where: { seasonId_teamId: { seasonId, teamId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Team is already part of this season', seasonTeam: existing },
        { status: 409 }
      );
    }

    const seasonTeam = await db.seasonTeam.create({
      data: {
        seasonId,
        teamId,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
      },
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
    });

    return NextResponse.json({ seasonTeam }, { status: 201 });
  } catch (error) {
    console.error('Add team to season error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
