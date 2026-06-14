import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/academies/[id]/attendance?date=YYYY-MM-DD
 * Get attendance for a specific date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: academyId } = await params;
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    // Get academy with players
    const academy = await db.academy.findUnique({
      where: { id: academyId },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, avatar: true },
            },
          },
        },
        attendance: {
          where: {
            date: {
              gte: new Date(date.setHours(0, 0, 0, 0)),
              lte: new Date(date.setHours(23, 59, 59, 999)),
            },
          },
        },
      },
    });

    if (!academy) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    // Create a map of attendance records
    const attendanceMap = new Map(
      academy.attendance.map((a) => [a.userId, a.isPresent])
    );

    // Combine player info with attendance
    const result = academy.players.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      phone: p.user.phone,
      avatar: p.user.avatar,
      isPresent: attendanceMap.get(p.userId) ?? false,
    }));

    return NextResponse.json({
      date: dateStr,
      academyId,
      attendance: result,
      totalPlayers: result.length,
      presentCount: result.filter((r) => r.isPresent).length,
    });
  } catch (error) {
    console.error('Attendance GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/academies/[id]/attendance
 * Mark attendance for one or more players
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: academyId } = await params;
    const body = await request.json();
    const { date, records } = body as {
      date?: string;
      records: { userId: string; isPresent: boolean }[];
    };

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: 'records array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Verify academy exists
    const academy = await db.academy.findUnique({ where: { id: academyId } });
    if (!academy) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    const attendanceDate = date ? new Date(date) : new Date();
    const dateStart = new Date(attendanceDate);
    dateStart.setHours(0, 0, 0, 0);

    // Upsert attendance records
    const results = await Promise.all(
      records.map(async ({ userId, isPresent }) => {
        try {
          return await db.attendance.upsert({
            where: {
              academyId_userId_date: {
                academyId,
                userId,
                date: dateStart,
              },
            },
            create: {
              academyId,
              userId,
              date: dateStart,
              isPresent,
            },
            update: {
              isPresent,
            },
          });
        } catch {
          // Skip invalid records
          return null;
        }
      })
    );

    const valid = results.filter(Boolean);

    return NextResponse.json({
      success: true,
      date: date || new Date().toISOString().split('T')[0],
      recordsUpdated: valid.length,
    });
  } catch (error) {
    console.error('Attendance POST error:', error);
    return NextResponse.json(
      { error: 'Failed to mark attendance' },
      { status: 500 }
    );
  }
}
