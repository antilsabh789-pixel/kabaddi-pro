import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/players/search?phone=9876543210&limit=5
 * GET /api/players/search?name=Rahul&limit=5
 * 
 * Searches for existing users by phone number or name.
 * Returns player info including team membership, jersey number, and phone.
 * This is used when adding a player mid-match — phone number is the primary identifier
 * that links a player to their account so they can see match records when they sign up.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const name = searchParams.get('name');
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    if (!phone && !name) {
      return NextResponse.json({ error: 'Phone or name search query is required' }, { status: 400 });
    }

    // Build the where clause (SQLite doesn't support mode: 'insensitive')
    const where: Record<string, unknown> = {};

    if (phone) {
      // Search by phone number (partial match)
      where.phone = { contains: phone };
    } else if (name) {
      // Search by name (partial match)
      where.name = { contains: name };
    }

    const users = await db.user.findMany({
      where,
      take: limit,
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
          },
        },
        teams: {
          select: {
            teamId: true,
            isCaptain: true,
          },
        },
      },
    });

    const players = users.map((user) => ({
      id: user.id,
      name: user.name || 'Player',
      phone: user.phone,
      avatar: user.avatar ?? undefined,
      jerseyNumber: user.profile?.jerseyNumber ?? undefined,
      position: user.profile?.position ?? undefined,
      playerCode: user.playerCode ?? undefined,
      teamId: user.teams.length > 0 ? user.teams[0].teamId : undefined,
      isCaptain: user.teams.length > 0 ? user.teams[0].isCaptain : false,
    }));

    return NextResponse.json({ players });
  } catch (error) {
    console.error('Player search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
