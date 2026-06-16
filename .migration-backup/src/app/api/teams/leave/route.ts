import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/teams/leave - Leave a team
 * Body: { teamId: string, userId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, userId } = body;

    if (!teamId || !userId) {
      return NextResponse.json(
        { error: 'Team ID and user ID are required' },
        { status: 400 }
      );
    }

    // Find the membership
    const membership = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 404 }
      );
    }

    // If the user is captain, they need to transfer captaincy first
    if (membership.isCaptain) {
      // Check if there are other members to transfer to
      const otherMembers = await db.teamMember.findMany({
        where: { teamId, userId: { not: userId } },
      });

      if (otherMembers.length > 0) {
        return NextResponse.json(
          { error: 'Transfer captaincy to another member before leaving the team.' },
          { status: 400 }
        );
      }

      // If no other members, just delete the team
      await db.teamMember.deleteMany({ where: { teamId } });
      await db.tournamentEntry.deleteMany({ where: { teamId } });
      await db.team.delete({ where: { id: teamId } });
      return NextResponse.json({ success: true, teamDeleted: true });
    }

    // Remove the member
    await db.teamMember.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ success: true, teamDeleted: false });
  } catch (error) {
    console.error('Team leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
