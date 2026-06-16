import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/teams/join - Join a team by code
 * Body: { teamCode: string, userId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamCode, userId } = body;

    if (!teamCode || !userId) {
      return NextResponse.json(
        { error: 'Team code and user ID are required' },
        { status: 400 }
      );
    }

    // Find team by code
    const team = await db.team.findFirst({
      where: { teamCode: { equals: teamCode } },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found. Check the code and try again.' },
        { status: 404 }
      );
    }

    // Check if already a member
    const existingMember = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: team.id, userId } },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'You are already a member of this team' },
        { status: 409 }
      );
    }

    // Add user to team
    await db.teamMember.create({
      data: {
        teamId: team.id,
        userId,
        isCaptain: false,
      },
    });

    // Return updated team
    const updatedTeam = await db.team.findUnique({
      where: { id: team.id },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });

    return NextResponse.json({ team: updatedTeam });
  } catch (error) {
    console.error('Team join error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/teams/join?code=KT2001 - Preview team info before joining
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { error: 'Team code is required' },
        { status: 400 }
      );
    }

    const team = await db.team.findFirst({
      where: { teamCode: { equals: code } },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found' },
        { status: 404 }
      );
    }

    // Return preview info (limited data)
    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        color: team.color,
        teamCode: team.teamCode,
        memberCount: team.members.length,
        captainName: team.members.find((m) => m.isCaptain)?.user.name || 'Unknown',
      },
    });
  } catch (error) {
    console.error('Team lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
