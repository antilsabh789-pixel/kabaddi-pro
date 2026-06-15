import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/teams/search?teamCode=KT2001
 * GET /api/teams/search?name=Jaipur
 * 
 * Searches for teams by team code (exact match) or name (partial match).
 * Returns team info including members with their profiles.
 * Used in match setup to find opponent teams by team code.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamCode = searchParams.get('teamCode');
    const name = searchParams.get('name');
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    if (!teamCode && !name) {
      return NextResponse.json({ error: 'teamCode or name is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = {};

    if (teamCode) {
      // Team code is unique — search by exact or partial match
      where.teamCode = { contains: teamCode };
    } else if (name) {
      // Search by name (partial match)
      where.OR = [
        { name: { contains: name } },
        { shortName: { contains: name } },
      ];
    }

    const teams = await db.team.findMany({
      where,
      take: limit,
      include: {
        members: {
          select: {
            isCaptain: true,
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                avatar: true,
                playerCode: true,
                profile: {
                  select: {
                    jerseyNumber: true,
                    position: true,
                    overallRating: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const results = teams.map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      teamCode: team.teamCode,
      color: team.color,
      logo: team.logo,
      memberCount: team.members.length,
      members: team.members.map((m) => ({
        id: m.user.id,
        name: m.user.name || 'Player',
        phone: m.user.phone,
        avatar: m.user.avatar ?? undefined,
        jerseyNumber: m.user.profile?.jerseyNumber ?? undefined,
        position: m.user.profile?.position ?? undefined,
        playerCode: m.user.playerCode ?? undefined,
        isCaptain: m.isCaptain,
        overallRating: m.user.profile?.overallRating ?? 0,
      })),
    }));

    return NextResponse.json({ teams: results });
  } catch (error) {
    console.error('Team search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
