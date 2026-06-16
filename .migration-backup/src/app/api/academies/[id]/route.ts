import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/academies/[id]
 * Get academy details with players
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const academy = await db.academy.findUnique({
      where: { id },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, avatar: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        attendance: {
          where: {
            date: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        },
      },
    });

    if (!academy) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    return NextResponse.json({ academy });
  } catch (error) {
    console.error('Academy GET by ID error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch academy' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/academies/[id]
 * Update academy details
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, location, groundName, sundayHoliday, practiceSchedule } = body;

    const existing = await db.academy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    const academy = await db.academy.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(location !== undefined && { location }),
        ...(groundName !== undefined && { groundName }),
        ...(sundayHoliday !== undefined && { sundayHoliday }),
        ...(practiceSchedule !== undefined && { practiceSchedule }),
      },
    });

    return NextResponse.json({ academy });
  } catch (error) {
    console.error('Academy PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update academy' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/academies/[id]
 * Delete an academy
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.academy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    await db.academy.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Academy DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete academy' },
      { status: 500 }
    );
  }
}
