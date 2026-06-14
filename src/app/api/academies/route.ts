import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/academies?coachUserId=xxx
 * List academies for a coach
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachUserId = searchParams.get('coachUserId');

    if (!coachUserId) {
      return NextResponse.json(
        { error: 'coachUserId query parameter is required' },
        { status: 400 }
      );
    }

    const academies = await db.academy.findMany({
      where: { coachUserId },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, avatar: true },
            },
          },
        },
        _count: {
          select: { players: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ academies });
  } catch (error) {
    console.error('Academies GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch academies' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academies
 * Create a new academy
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, location, groundName, coachUserId, sundayHoliday, practiceSchedule } = body;

    if (!name || !coachUserId) {
      return NextResponse.json(
        { error: 'name and coachUserId are required' },
        { status: 400 }
      );
    }

    // Verify user exists and is a coach
    const user = await db.user.findUnique({
      where: { id: coachUserId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const academy = await db.academy.create({
      data: {
        name,
        location: location || null,
        groundName: groundName || null,
        coachUserId,
        sundayHoliday: sundayHoliday ?? false,
        practiceSchedule: practiceSchedule || 'one-time',
      },
      include: {
        players: true,
      },
    });

    return NextResponse.json({ academy }, { status: 201 });
  } catch (error) {
    console.error('Academy POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create academy' },
      { status: 500 }
    );
  }
}
