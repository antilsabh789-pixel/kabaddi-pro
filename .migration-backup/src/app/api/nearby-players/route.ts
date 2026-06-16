import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Earth radius in km for Haversine formula
const EARTH_RADIUS_KM = 6371;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * GET /api/nearby-players?lat=28.6&lng=77.2&radius=10&position=raider&excludeUserId=xxx
 * Finds players near the given coordinates using PlayerLocation table
 */
export async function GET(req: NextRequest) {
  try {
    const latParam = req.nextUrl.searchParams.get('lat');
    const lngParam = req.nextUrl.searchParams.get('lng');
    const radiusParam = req.nextUrl.searchParams.get('radius') || '25';
    const position = req.nextUrl.searchParams.get('position');
    const excludeUserId = req.nextUrl.searchParams.get('excludeUserId');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50');

    if (!latParam || !lngParam) {
      return NextResponse.json(
        { error: 'lat and lng query parameters are required' },
        { status: 400 }
      );
    }

    const userLat = parseFloat(latParam);
    const userLng = parseFloat(lngParam);
    const radiusKm = parseFloat(radiusParam);

    if (isNaN(userLat) || isNaN(userLng) || isNaN(radiusKm)) {
      return NextResponse.json(
        { error: 'Invalid lat, lng, or radius values' },
        { status: 400 }
      );
    }

    // Fetch all player locations with user + profile info
    const playerLocations = await db.playerLocation.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            gender: true,
            weight: true,
            playerCode: true,
            profile: {
              select: {
                position: true,
                overallRating: true,
                totalMatches: true,
                totalPoints: true,
                weightCategory: true,
                successfulRaids: true,
                successfulTackles: true,
              },
            },
          },
        },
      },
    });

    // Filter by position if specified
    let filtered = playerLocations;
    if (position && position !== 'all') {
      filtered = filtered.filter((pl) => {
        const playerPos = pl.user.profile?.position?.toLowerCase();
        if (position === 'raider') {
          return playerPos === 'raider' || playerPos === 'left raider' || playerPos === 'right raider';
        }
        if (position === 'defender') {
          return playerPos === 'defender' || playerPos === 'left corner' || playerPos === 'right corner'
            || playerPos === 'left cover' || playerPos === 'right cover';
        }
        if (position === 'all-rounder') {
          return playerPos === 'all-rounder';
        }
        return true;
      });
    }

    // Exclude the requesting user
    if (excludeUserId) {
      filtered = filtered.filter((pl) => pl.userId !== excludeUserId);
    }

    // Calculate distance and filter by radius
    const nearby = filtered
      .map((pl) => {
        const distance = haversineDistance(userLat, userLng, pl.lat, pl.lng);
        return {
          id: pl.user.id,
          name: pl.user.name,
          avatar: pl.user.avatar,
          gender: pl.user.gender,
          weight: pl.user.weight,
          playerCode: pl.user.playerCode,
          position: pl.user.profile?.position || null,
          overallRating: pl.user.profile?.overallRating || 0,
          totalMatches: pl.user.profile?.totalMatches || 0,
          totalPoints: pl.user.profile?.totalPoints || 0,
          weightCategory: pl.user.profile?.weightCategory || null,
          successfulRaids: pl.user.profile?.successfulRaids || 0,
          successfulTackles: pl.user.profile?.successfulTackles || 0,
          distance: Math.round(distance * 10) / 10,
          city: pl.city,
          area: pl.area,
        };
      })
      .filter((p) => p.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return NextResponse.json({ players: nearby });
  } catch (error) {
    console.error('Nearby players error:', error);
    return NextResponse.json({ error: 'Failed to find nearby players' }, { status: 500 });
  }
}
