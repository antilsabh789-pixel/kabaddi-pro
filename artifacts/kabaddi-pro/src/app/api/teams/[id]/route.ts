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

    // Compute team stats from matches
    const homeMatches = await db.match.findMany({
      where: { homeTeamId: id, status: 'completed' },
      select: { homeScore: true, awayScore: true },
    });
    const awayMatches = await db.match.findMany({
      where: { awayTeamId: id, status: 'completed' },
      select: { homeScore: true, awayScore: true },
    });

    let wins = 0;
    let losses = 0;
    let totalPoints = 0;

    for (const m of homeMatches) {
      totalPoints += m.homeScore;
      if (m.homeScore > m.awayScore) wins++;
      else if (m.homeScore < m.awayScore) losses++;
    }
    for (const m of awayMatches) {
      totalPoints += m.awayScore;
      if (m.awayScore > m.homeScore) wins++;
      else if (m.awayScore < m.homeScore) losses++;
    }

    const totalMatches = homeMatches.length + awayMatches.length;

    // Recent matches
    const recentMatches = await db.match.findMany({
      where: {
        OR: [{ homeTeamId: id }, { awayTeamId: id }],
        status: 'completed',
      },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, color: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, color: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      team,
      stats: { totalMatches, wins, losses, totalPoints },
      recentMatches,
    });
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
    const { name, shortName, color, logo, captainId, addMemberId, removeMemberId } = body;

    // Add member to team
    if (addMemberId) {
      // Check if already a member
      const existing = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: id, userId: addMemberId } },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Player is already in this team' },
          { status: 409 }
        );
      }
      await db.teamMember.create({
        data: { teamId: id, userId: addMemberId, isCaptain: false },
      });
    }

    // Remove member from team
    if (removeMemberId) {
      // Don't allow removing the captain directly
      const member = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId: id, userId: removeMemberId } },
      });
      if (member?.isCaptain) {
        return NextResponse.json(
          { error: 'Cannot remove the captain. Transfer captaincy first.' },
          { status: 400 }
        );
      }
      await db.teamMember.deleteMany({
        where: { teamId: id, userId: removeMemberId },
      });
    }

    // Update team info
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (shortName !== undefined) updateData.shortName = shortName;
    if (color !== undefined) updateData.color = color;
    if (logo !== undefined) updateData.logo = logo;

    if (Object.keys(updateData).length > 0) {
      await db.team.update({
        where: { id },
        data: updateData,
      });
    }

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

    // Return updated team
    const team = await db.team.findUnique({
      where: { id },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });

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
