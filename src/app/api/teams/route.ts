import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Generate a unique team code in format KT2001, KT2002, etc.
 */
async function generateTeamCode(): Promise<string> {
  const lastTeam = await db.team.findFirst({
    where: { teamCode: { not: null } },
    orderBy: { teamCode: 'desc' },
    select: { teamCode: true },
  });

  let nextNum = 2001; // Start from KT2001
  if (lastTeam?.teamCode) {
    const match = lastTeam.teamCode.match(/KT(\d+)/);
    if (match) {
      nextNum = parseInt(match[1]) + 1;
    }
  }

  return `KT${nextNum}`;
}

/**
 * Auto-generate short name from team name (first letters of each word, max 3 chars)
 */
function generateShortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 3) {
    return (words[0].charAt(0) + words[1].charAt(0) + words[2].charAt(0)).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const userId = searchParams.get('userId') || '';
    const filter = searchParams.get('filter') || 'all'; // 'my' or 'all'
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { teamCode: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by user's teams if filter is 'my'
    if (filter === 'my' && userId) {
      where.members = {
        some: { userId },
      };
    }

    const teams = await db.team.findMany({
      where,
      take: limit,
      include: { members: { include: { user: { include: { profile: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error('Teams fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, shortName, color, logo, memberIds, captainId } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return NextResponse.json(
        { error: 'Team name must be at least 3 characters' },
        { status: 400 }
      );
    }
    if (name.trim().length > 30) {
      return NextResponse.json(
        { error: 'Team name must be 30 characters or less' },
        { status: 400 }
      );
    }

    // Check free tier limit (1 team for free users)
    if (captainId) {
      const captainUser = await db.user.findUnique({
        where: { id: captainId },
        select: { isPremium: true },
      });

      if (captainUser && !captainUser.isPremium) {
        const existingTeamCount = await db.teamMember.count({
          where: { userId: captainId, isCaptain: true },
        });
        if (existingTeamCount >= 1) {
          return NextResponse.json(
            { error: 'Free users can create only 1 team. Upgrade to Premium for unlimited teams.' },
            { status: 403 }
          );
        }
      }
    }

    // Auto-generate team code
    const teamCode = await generateTeamCode();

    // Auto-generate short name if not provided
    const finalShortName = shortName?.trim()
      ? shortName.trim().slice(0, 3).toUpperCase()
      : generateShortName(name);

    const team = await db.team.create({
      data: {
        name: name.trim(),
        shortName: finalShortName,
        teamCode,
        color: color || '#DC2626',
        logo,
      },
    });

    if (memberIds && memberIds.length > 0) {
      await db.teamMember.createMany({
        data: memberIds.map((userId: string) => ({
          teamId: team.id,
          userId,
          isCaptain: captainId === userId,
        })),
      });
    }

    // Return the team with members
    const teamWithMembers = await db.team.findUnique({
      where: { id: team.id },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });

    return NextResponse.json({ team: teamWithMembers }, { status: 201 });
  } catch (error) {
    console.error('Team create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
