import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Generate a unique player code in format KP1001, KP1002, etc.
 */
async function generatePlayerCode(): Promise<string> {
  // Find the highest existing player code number
  const lastUser = await db.user.findFirst({
    where: { playerCode: { not: null } },
    orderBy: { playerCode: 'desc' },
    select: { playerCode: true },
  });

  let nextNum = 1001; // Start from KP1001
  if (lastUser?.playerCode) {
    const match = lastUser.playerCode.match(/KP(\d+)/);
    if (match) {
      nextNum = parseInt(match[1]) + 1;
    }
  }

  return `KP${nextNum}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    const users = await db.user.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { phone: { contains: search } },
              { playerCode: { contains: search } },
            ],
          }
        : undefined,
      take: limit,
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });

    // Return players but hide phone number for privacy
    const players = users.map((user) => ({
      id: user.id,
      name: user.name,
      playerCode: user.playerCode,
      avatar: user.avatar,
      gender: user.gender,
      // Phone is masked for privacy - only show last 2 digits
      phone: user.phone ? `****${user.phone.slice(-2)}` : null,
      profile: user.profile
        ? {
            position: user.profile.position,
            jerseyNumber: user.profile.jerseyNumber,
            overallRating: user.profile.overallRating,
          }
        : null,
    }));

    return NextResponse.json({ players });
  } catch (error) {
    console.error('Players fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, gender, weight, practiceGround } = body;

    // Auto-generate a unique player code
    const playerCode = await generatePlayerCode();

    const user = await db.user.create({
      data: {
        name: name || null,
        phone: phone || `quick_${Date.now()}`,
        playerCode,
        password: `quick_${Date.now()}`, // placeholder password for quick-add
        gender,
        weight,
        practiceGround,
        role: 'player',
      },
    });

    await db.playerProfile.create({
      data: { userId: user.id },
    });

    return NextResponse.json({
      player: {
        id: user.id,
        name: user.name,
        playerCode: user.playerCode,
        avatar: user.avatar,
        phone: user.phone ? `****${user.phone.slice(-2)}` : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Player create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
