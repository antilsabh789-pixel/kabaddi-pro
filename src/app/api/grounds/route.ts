import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/grounds - List/search grounds
export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search');
    const city = req.nextUrl.searchParams.get('city');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { address: { contains: search } },
        { city: { contains: search } },
      ];
    }
    if (city) {
      where.city = { contains: city };
    }

    const grounds = await db.ground.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { matches: true } },
      },
    });

    return NextResponse.json({ grounds });
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
        lat: lat || null,
        lng: lng || null,
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
