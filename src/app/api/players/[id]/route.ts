import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Return player with masked phone for privacy
    const player = {
      ...user,
      phone: user.phone ? `****${user.phone.slice(-2)}` : null,
      playerCode: user.playerCode, // Ensure playerCode is explicitly included
    };

    return NextResponse.json({ player, profile: user.profile });
  } catch (error) {
    console.error('Player fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { gender, weight, practiceGround, position, jerseyNumber, weightCategory, playerCode } = body;

    // If playerCode is being set, check for uniqueness
    if (playerCode) {
      const existing = await db.user.findFirst({
        where: { playerCode, NOT: { id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Player code already taken' }, { status: 409 });
      }
    }

    const user = await db.user.update({
      where: { id },
      data: { gender, weight, practiceGround, playerCode },
    });

    if (position || jerseyNumber !== undefined || weightCategory) {
      await db.playerProfile.upsert({
        where: { userId: id },
        update: { position, jerseyNumber, weightCategory },
        create: { userId: id, position, jerseyNumber, weightCategory },
      });
    }

    return NextResponse.json({ player: user });
  } catch (error) {
    console.error('Player update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
