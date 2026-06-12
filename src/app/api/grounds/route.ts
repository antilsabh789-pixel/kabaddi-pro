import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/grounds - List/search grounds with filters
export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search');
    const city = req.nextUrl.searchParams.get('city');
    const surface = req.nextUrl.searchParams.get('surface');
    const amenity = req.nextUrl.searchParams.get('amenity');
    const sort = req.nextUrl.searchParams.get('sort') || 'newest';
    const lat = req.nextUrl.searchParams.get('lat');
    const lng = req.nextUrl.searchParams.get('lng');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    if (search) {
      andConditions.push({
        OR: [
          { name: { contains: search } },
          { address: { contains: search } },
          { city: { contains: search } },
          { state: { contains: search } },
        ],
      });
    }
    if (city) {
      andConditions.push({ city: { contains: city } });
    }
    if (surface) {
      andConditions.push({ surface });
    }
    if (amenity) {
      // Search for the amenity in the JSON amenities string
      andConditions.push({ amenities: { contains: amenity } });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Determine sort order
    let orderBy: Record<string, string>;
    if (sort === 'popular') {
      orderBy = {};
      // We'll sort by match count after fetching
    } else if (sort === 'nearest' && lat && lng) {
      // Sort by proximity - we'll sort after fetching
      orderBy = {};
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const grounds = await db.ground.findMany({
      where,
      orderBy: sort === 'newest' ? { createdAt: 'desc' } : undefined,
      take: sort === 'newest' ? limit : limit * 3, // Fetch more for post-sorting
      include: {
        _count: { select: { matches: true } },
        matches: {
          where: { status: { in: ['completed', 'upcoming', 'live'] } },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            homeScore: true,
            awayScore: true,
            homeTeam: { select: { name: true, shortName: true, color: true } },
            awayTeam: { select: { name: true, shortName: true, color: true } },
            tournament: { select: { name: true } },
            completedAt: true,
            createdAt: true,
          },
        },
      },
    });

    let result = grounds;

    // Sort by popularity (match count)
    if (sort === 'popular') {
      result = grounds.sort((a, b) => b._count.matches - a._count.matches).slice(0, limit);
    }

    // Sort by nearest (using lat/lng)
    if (sort === 'nearest' && lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      result = grounds
        .filter((g) => g.lat !== null && g.lng !== null)
        .sort((a, b) => {
          const distA = Math.sqrt(Math.pow((a.lat! - userLat) ** 2 + (a.lng! - userLng) ** 2));
          const distB = Math.sqrt(Math.pow((b.lat! - userLat) ** 2 + (b.lng! - userLng) ** 2));
          return distA - distB;
        })
        .slice(0, limit);
    }

    return NextResponse.json({ grounds: result });
  } catch (error) {
    console.error('Grounds GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch grounds' }, { status: 500 });
  }
}

// POST /api/grounds - Add a new ground
export async function POST(req: NextRequest) {
  try {
    const { name, address, city, state, lat, lng, surface, amenities, addedBy } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Ground name is required' }, { status: 400 });
    }

    const ground = await db.ground.create({
      data: {
        name,
        address: address || null,
        city: city || null,
        state: state || null,
        lat: lat ? parseFloat(String(lat)) : null,
        lng: lng ? parseFloat(String(lng)) : null,
        surface: surface || null,
        amenities: amenities ? JSON.stringify(amenities) : null,
        addedBy: addedBy || null,
      },
    });

    return NextResponse.json({ ground });
  } catch (error) {
    console.error('Grounds POST error:', error);
    return NextResponse.json({ error: 'Failed to create ground' }, { status: 500 });
  }
}
