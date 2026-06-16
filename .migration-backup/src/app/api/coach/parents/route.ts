import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/coach/parents?academyId=xxx
 * Get parent contacts for an academy
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');

    if (!academyId) {
      return NextResponse.json({ error: 'academyId is required' }, { status: 400 });
    }

    const parents = await db.parentContact.findMany({
      where: { academyId },
      include: {
        user: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ parents });
  } catch (error) {
    console.error('Coach parents GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch parents' }, { status: 500 });
  }
}

/**
 * POST /api/coach/parents
 * Add or update a parent contact
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { academyId, userId, parentName, parentPhone, relation } = body;

    if (!academyId || !userId || !parentName || !parentPhone) {
      return NextResponse.json(
        { error: 'academyId, userId, parentName, and parentPhone are required' },
        { status: 400 }
      );
    }

    // Verify academy
    const academy = await db.academy.findUnique({ where: { id: academyId } });
    if (!academy) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    const parent = await db.parentContact.upsert({
      where: {
        userId_academyId: { userId, academyId },
      },
      create: {
        academyId,
        userId,
        parentName,
        parentPhone,
        relation: relation || 'guardian',
      },
      update: {
        parentName,
        parentPhone,
        relation: relation || 'guardian',
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json({ parent }, { status: 201 });
  } catch (error) {
    console.error('Coach parents POST error:', error);
    return NextResponse.json({ error: 'Failed to create parent contact' }, { status: 500 });
  }
}
