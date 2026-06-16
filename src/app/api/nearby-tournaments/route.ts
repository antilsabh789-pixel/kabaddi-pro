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
 * GET /api/nearby-tournaments?lat=28.6&lng=77.2&radius=50&status=upcoming
 * Finds tournaments near the given coordinates
 */
export async function GET(req: NextRequest) {
  try {
    const latParam = req.nextUrl.searchParams.get('lat');
    const lngParam = req.nextUrl.searchParams.get('lng');
    const radiusParam = req.nextUrl.searchParams.get('radius') || '50';
    const status = req.nextUrl.searchParams.get('status');
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

    // Build where clause for status filter
    const where: Record<string, unknown> = {};
    if (status && status !== 'all') {
      where.status = status;
    } else {
      where.status = { in: ['upcoming', 'ongoing'] };
    }

    // Fetch tournaments with their grounds
    const tournaments = await db.tournament.findMany({
      where,
      include: {
        entries: { select: { id: true, teamId: true } },
        matches: {
          take: 1,
          select: {
            ground: {
              select: { id: true, lat: true, lng: true, name: true, city: true, address: true },
            },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // Strategy: Use venue text to match grounds, or use the ground from matches
    // Also fetch all grounds to cross-reference
    const grounds = await db.ground.findMany({
      where: { lat: { not: null }, lng: { not: null } },
      select: { id: true, name: true, city: true, lat: true, lng: true },
    });

    const result = tournaments
      .map((tournament) => {
        // Try to find distance from match ground
        let distance: number | null = null;
        let groundName: string | null = tournament.venue || null;
        let groundCity: string | null = null;

        if (tournament.matches[0]?.ground?.lat && tournament.matches[0]?.ground?.lng) {
          const g = tournament.matches[0].ground;
          distance = haversineDistance(userLat, userLng, g.lat, g.lng);
          groundName = g.name;
          groundCity = g.city;
        } else if (tournament.venue) {
          // Try to match venue text to a known ground
          const matchedGround = grounds.find(
            (g) =>
              g.name.toLowerCase().includes(tournament.venue!.toLowerCase()) ||
              tournament.venue!.toLowerCase().includes(g.name.toLowerCase()) ||
              (g.city && tournament.venue!.toLowerCase().includes(g.city.toLowerCase()))
          );
          if (matchedGround && matchedGround.lat && matchedGround.lng) {
            distance = haversineDistance(userLat, userLng, matchedGround.lat, matchedGround.lng);
            groundName = matchedGround.name;
            groundCity = matchedGround.city;
          }
        }

        return {
          id: tournament.id,
          name: tournament.name,
          tournamentCode: tournament.tournamentCode,
          status: tournament.status,
          type: tournament.type,
          gender: tournament.gender,
          weightCategory: tournament.weightCategory,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          venue: tournament.venue,
          groundName,
          groundCity,
          teamCount: tournament.entries.length,
          distance: distance !== null ? Math.round(distance * 10) / 10 : null,
        };
      })
      .filter((t) => t.distance !== null && t.distance <= radiusKm)
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
      .slice(0, limit);

    return NextResponse.json({ tournaments: result });
  } catch (error) {
    console.error('Nearby tournaments error:', error);
    return NextResponse.json({ error: 'Failed to find nearby tournaments' }, { status: 500 });
  }
}
