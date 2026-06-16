import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
 * GET /api/nearby-grounds?lat=28.6&lng=77.2&radius=25&limit=30
 * Finds grounds near the user's location using Haversine distance
 */
export async function GET(req: NextRequest) {
  try {
    const latParam = req.nextUrl.searchParams.get('lat');
    const lngParam = req.nextUrl.searchParams.get('lng');
    const radiusParam = req.nextUrl.searchParams.get('radius') || '25';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '30');

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

    // Fetch all grounds with coordinates
    const grounds = await db.ground.findMany({
      where: {
        lat: { not: null },
        lng: { not: null },
      },
      include: {
        _count: { select: { matches: true } },
      },
    });

    // Calculate distances and filter by radius
    const nearbyGrounds = grounds
      .filter((g) => g.lat !== null && g.lng !== null)
      .map((g) => ({
        id: g.id,
        name: g.name,
        address: g.address,
        city: g.city,
        state: g.state,
        surface: g.surface,
        amenities: g.amenities,
        distance: Math.round(haversineDistance(userLat, userLng, g.lat!, g.lng!) * 10) / 10,
        matchCount: g._count.matches,
        lat: g.lat,
        lng: g.lng,
      }))
      .filter((g) => g.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return NextResponse.json({ grounds: nearbyGrounds });
  } catch (error) {
    console.error('Nearby grounds error:', error);
    return NextResponse.json({ error: 'Failed to find nearby grounds' }, { status: 500 });
  }
}
