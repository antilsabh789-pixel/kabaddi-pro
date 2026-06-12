import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const team = await db.team.findUnique({
      where: { id },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Team fetch error:', error);
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
    const { name, shortName, color, logo, captainId } = body;

    const team = await db.team.update({
      where: { id },
      data: { name, shortName, color, logo },
    });

    // If captainId is provided, update the isCaptain flag on team members
    if (captainId !== undefined) {
      // Reset all members' isCaptain to false
      await db.teamMember.updateMany({
        where: { teamId: id },
        data: { isCaptain: false },
      });
      // Set the new captain
      if (captainId) {
        await db.teamMember.updateMany({
          where: { teamId: id, userId: captainId },
          data: { isCaptain: true },
        });
      }
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Team update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.teamMember.deleteMany({ where: { teamId: id } });
    await db.tournamentEntry.deleteMany({ where: { teamId: id } });
    await db.team.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
