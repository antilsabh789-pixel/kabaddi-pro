import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/coach/attendance?academyId=xxx&date=2025-01-15
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const academyId = searchParams.get('academyId')
    const date = searchParams.get('date')

    if (!academyId) {
      return NextResponse.json({ error: 'academyId is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { academyId }

    if (date) {
      // Filter by specific date - parse the date string and match the day
      const startOfDay = new Date(date)
      startOfDay.setUTCHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setUTCHours(23, 59, 59, 999)
      where.date = { gte: startOfDay, lte: endOfDay }
    }

    const records = await db.attendance.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: records })
  } catch (error) {
    console.error('[Attendance GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch attendance' }, { status: 500 })
  }
}

// POST /api/coach/attendance
// Body: { academyId, date, records: [{ userId, isPresent }] }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { academyId, date, records } = body

    if (!academyId || !date || !Array.isArray(records)) {
      return NextResponse.json(
        { error: 'academyId, date, and records array are required' },
        { status: 400 }
      )
    }

    const dateObj = new Date(date)
    dateObj.setUTCHours(0, 0, 0, 0)

    // Bulk upsert attendance records for the given date
    const results = await Promise.all(
      records.map(({ userId, isPresent }: { userId: string; isPresent: boolean }) =>
        db.attendance.upsert({
          where: {
            academyId_userId_date: {
              academyId,
              userId,
              date: dateObj,
            },
          },
          update: { isPresent },
          create: {
            academyId,
            userId,
            date: dateObj,
            isPresent,
          },
        })
      )
    )

    return NextResponse.json({ success: true, data: results, count: results.length })
  } catch (error) {
    console.error('[Attendance POST] Error:', error)
    return NextResponse.json({ error: 'Failed to mark attendance' }, { status: 500 })
  }
}
