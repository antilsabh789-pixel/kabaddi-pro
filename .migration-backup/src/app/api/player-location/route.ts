import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/player-location - Save or update the current user's location
 * Body: { userId: string, lat: number, lng: number, city?: string, area?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, lat, lng, city, area } = await req.json();

    if (!userId || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'userId, lat, and lng are required' },
        { status: 400 }
      );
    }

    const latNum = parseFloat(String(lat));
    const lngNum = parseFloat(String(lng));

    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json(
        { error: 'Invalid lat or lng values' },
        { status: 400 }
      );
    }

    // Upsert: create or update the player's location
    const location = await db.playerLocation.upsert({
      where: { userId },
      update: {
        lat: latNum,
        lng: lngNum,
        city: city || null,
        area: area || null,
      },
      create: {
        userId,
        lat: latNum,
        lng: lngNum,
        city: city || null,
        area: area || null,
      },
    });

    return NextResponse.json({ location });
  } catch (error) {
    console.error('Player location save error:', error);
    return NextResponse.json({ error: 'Failed to save location' }, { status: 500 });
  }
}
