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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { teamCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const teams = await db.team.findMany({
      where,
      take: limit,
      include: { members: { include: { user: true } } },
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

    // Auto-generate team code
    const teamCode = await generateTeamCode();

    const team = await db.team.create({
      data: {
        name,
        shortName,
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

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error('Team create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
