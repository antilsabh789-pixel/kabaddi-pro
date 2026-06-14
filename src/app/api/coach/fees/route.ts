import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/coach/fees?academyId=xxx&month=2025-01
 * Get fee records for an academy
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    if (!academyId) {
      return NextResponse.json({ error: 'academyId is required' }, { status: 400 });
    }

    const feeRecords = await db.feeRecord.findMany({
      where: { academyId, month },
      include: {
        user: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get all academy players to include those without fee records
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
      },
    });

    if (!academy) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    // Create a map of existing fee records
    const feeMap = new Map(feeRecords.map((f) => [f.userId, f]));

    // Combine all players with their fee records
    const allRecords = academy.players.map((p) => {
      const fee = feeMap.get(p.userId);
      return {
        userId: p.userId,
        name: p.user.name,
        phone: p.user.phone,
        avatar: p.user.avatar,
        feeId: fee?.id || null,
        amount: fee?.amount || 0,
        status: fee?.status || 'pending',
        paidAt: fee?.paidAt || null,
        notes: fee?.notes || null,
      };
    });

    const totalExpected = allRecords.reduce((sum, r) => sum + r.amount, 0);
    const collected = allRecords.filter((r) => r.status === 'paid').reduce((sum, r) => sum + r.amount, 0);
    const pending = allRecords.filter((r) => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);
    const overdue = allRecords.filter((r) => r.status === 'overdue').reduce((sum, r) => sum + r.amount, 0);

    return NextResponse.json({
      month,
      academyId,
      records: allRecords,
      summary: {
        totalExpected,
        collected,
        pending,
        overdue,
        totalStudents: allRecords.length,
        paidCount: allRecords.filter((r) => r.status === 'paid').length,
        pendingCount: allRecords.filter((r) => r.status === 'pending').length,
        overdueCount: allRecords.filter((r) => r.status === 'overdue').length,
      },
    });
  } catch (error) {
    console.error('Coach fees GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch fees' }, { status: 500 });
  }
}

/**
 * POST /api/coach/fees
 * Create a new fee record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { academyId, userId, month, amount, status, notes } = body;

    if (!academyId || !userId || !month || !amount) {
      return NextResponse.json(
        { error: 'academyId, userId, month, and amount are required' },
        { status: 400 }
      );
    }

    // Verify academy
    const academy = await db.academy.findUnique({ where: { id: academyId } });
    if (!academy) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    const feeRecord = await db.feeRecord.upsert({
      where: {
        academyId_userId_month: { academyId, userId, month },
      },
      create: {
        academyId,
        userId,
        month,
        amount,
        status: status || 'pending',
        notes: notes || null,
      },
      update: {
        amount,
        status: status || 'pending',
        notes: notes || null,
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json({ feeRecord }, { status: 201 });
  } catch (error) {
    console.error('Coach fees POST error:', error);
    return NextResponse.json({ error: 'Failed to create fee record' }, { status: 500 });
  }
}

/**
 * PUT /api/coach/fees
 * Update a fee record (e.g., mark as paid)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { feeId, status, amount, notes } = body;

    if (!feeId) {
      return NextResponse.json({ error: 'feeId is required' }, { status: 400 });
    }

    const existing = await db.feeRecord.findUnique({ where: { id: feeId } });
    if (!existing) {
      return NextResponse.json({ error: 'Fee record not found' }, { status: 404 });
    }

    const feeRecord = await db.feeRecord.update({
      where: { id: feeId },
      data: {
        ...(status !== undefined && {
          status,
          paidAt: status === 'paid' ? new Date() : null,
        }),
        ...(amount !== undefined && { amount }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json({ feeRecord });
  } catch (error) {
    console.error('Coach fees PUT error:', error);
    return NextResponse.json({ error: 'Failed to update fee record' }, { status: 500 });
  }
}
