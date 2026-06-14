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

    // Try to update the user — if not found, still proceed with profile upsert
    let user;
    try {
      user = await db.user.update({
        where: { id },
        data: { gender, weight, practiceGround, playerCode },
      });
    } catch (updateError: unknown) {
      // Check if it's a "record not found" error (P2025)
      const prismaError = updateError as { code?: string };
      if (prismaError.code === 'P2025') {
        // User record doesn't exist in DB — create it with available data
        // We need at least a phone number; use a fallback
        try {
          user = await db.user.create({
            data: {
              id,
              phone: `fallback_${id}`,
              playerCode: playerCode || `KP${Date.now().toString().slice(-6)}`,
              gender: gender || null,
              weight: weight || null,
              practiceGround: practiceGround || null,
              password: 'fallback_no_auth',
            },
          });
        } catch {
          // If create also fails (e.g. id conflict), just skip user update
          user = null;
        }
      } else {
        throw updateError;
      }
    }

    // Always upsert the player profile with position, jerseyNumber, weightCategory
    if (position || jerseyNumber !== undefined || weightCategory) {
      await db.playerProfile.upsert({
        where: { userId: id },
        update: {
          ...(position && { position }),
          ...(jerseyNumber !== undefined && { jerseyNumber }),
          ...(weightCategory && { weightCategory }),
        },
        create: { userId: id, position, jerseyNumber, weightCategory },
      });
    }

    // Fetch the updated profile to return in response
    const updatedProfile = await db.playerProfile.findUnique({
      where: { userId: id },
    });

    return NextResponse.json({
      player: user,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error('Player update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
