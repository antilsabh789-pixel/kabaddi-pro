import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Generate a 6-character alphanumeric transfer code
 */
function generateTransferCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * POST /api/match-transfer
 * Save live match state and generate a transfer code.
 * Body: { matchState: ActiveMatch JSON, scorerUserId?, scorerName?, matchId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchState, scorerUserId, scorerName, matchId } = body;

    if (!matchState) {
      return NextResponse.json(
        { error: 'Match state is required' },
        { status: 400 }
      );
    }

    // Generate unique transfer code
    let transferCode = generateTransferCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.matchTransfer.findUnique({
        where: { transferCode },
      });
      if (!existing) break;
      transferCode = generateTransferCode();
      attempts++;
    }

    // Cancel any previous active transfers by this scorer for the same match
    if (scorerUserId) {
      const activeTransfers = await db.matchTransfer.findMany({
        where: {
          scorerUserId,
          status: 'active',
        },
      });
      for (const t of activeTransfers) {
        // Check if the matchState contains the same team IDs
        try {
          const state = JSON.parse(t.matchState);
          const newState = typeof matchState === 'string' ? JSON.parse(matchState) : matchState;
          if (state.homeTeamId === newState.homeTeamId && state.awayTeamId === newState.awayTeamId) {
            await db.matchTransfer.update({
              where: { id: t.id },
              data: { status: 'cancelled' },
            });
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    // Expire old transfers (older than 30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    await db.matchTransfer.updateMany({
      where: {
        status: 'active',
        createdAt: { lt: thirtyMinAgo },
      },
      data: { status: 'expired' },
    });

    // Create transfer record
    const transfer = await db.matchTransfer.create({
      data: {
        transferCode,
        matchId: matchId || null,
        matchState: typeof matchState === 'string' ? matchState : JSON.stringify(matchState),
        scorerUserId: scorerUserId || null,
        scorerName: scorerName || null,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min expiry
      },
    });

    return NextResponse.json({
      transferCode: transfer.transferCode,
      expiresAt: transfer.expiresAt,
      createdAt: transfer.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Match transfer create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/match-transfer?code=XXXXXX
 * Load match state from a transfer code.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.toUpperCase().trim();

    if (!code) {
      return NextResponse.json(
        { error: 'Transfer code is required' },
        { status: 400 }
      );
    }

    const transfer = await db.matchTransfer.findUnique({
      where: { transferCode: code },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Invalid transfer code. Please check and try again.' },
        { status: 404 }
      );
    }

    // Check if expired
    if (transfer.status === 'expired' || new Date() > transfer.expiresAt) {
      await db.matchTransfer.update({
        where: { id: transfer.id },
        data: { status: 'expired' },
      });
      return NextResponse.json(
        { error: 'This transfer code has expired. Please request a new one.' },
        { status: 410 }
      );
    }

    // Check if already claimed
    if (transfer.status === 'claimed') {
      return NextResponse.json(
        { error: 'This transfer code has already been used by another scorer.' },
        { status: 410 }
      );
    }

    // Check if cancelled
    if (transfer.status === 'cancelled') {
      return NextResponse.json(
        { error: 'This transfer code has been cancelled.' },
        { status: 410 }
      );
    }

    // Return match state (without claiming yet)
    let matchState;
    try {
      matchState = JSON.parse(transfer.matchState);
    } catch {
      matchState = null;
    }

    return NextResponse.json({
      transferCode: transfer.transferCode,
      matchState,
      scorerName: transfer.scorerName,
      createdAt: transfer.createdAt,
      expiresAt: transfer.expiresAt,
    });
  } catch (error) {
    console.error('Match transfer fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/match-transfer
 * Claim a transfer code (mark as claimed by the receiving scorer).
 * Body: { code: string, receiverUserId?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, receiverUserId } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Transfer code is required' },
        { status: 400 }
      );
    }

    const transfer = await db.matchTransfer.findUnique({
      where: { transferCode: code.toUpperCase().trim() },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Invalid transfer code' },
        { status: 404 }
      );
    }

    if (transfer.status !== 'active') {
      return NextResponse.json(
        { error: `Transfer code is ${transfer.status}` },
        { status: 410 }
      );
    }

    if (new Date() > transfer.expiresAt) {
      await db.matchTransfer.update({
        where: { id: transfer.id },
        data: { status: 'expired' },
      });
      return NextResponse.json(
        { error: 'Transfer code has expired' },
        { status: 410 }
      );
    }

    // Claim it
    await db.matchTransfer.update({
      where: { id: transfer.id },
      data: {
        status: 'claimed',
        receiverUserId: receiverUserId || null,
        claimedAt: new Date(),
      },
    });

    let matchState;
    try {
      matchState = JSON.parse(transfer.matchState);
    } catch {
      matchState = null;
    }

    return NextResponse.json({
      success: true,
      matchState,
      transferCode: transfer.transferCode,
    });
  } catch (error) {
    console.error('Match transfer claim error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/match-transfer?code=XXXXXX
 * Cancel a transfer code.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code')?.toUpperCase().trim();

    if (!code) {
      return NextResponse.json(
        { error: 'Transfer code is required' },
        { status: 400 }
      );
    }

    const transfer = await db.matchTransfer.findUnique({
      where: { transferCode: code },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: 'Transfer code not found' },
        { status: 404 }
      );
    }

    await db.matchTransfer.update({
      where: { id: transfer.id },
      data: { status: 'cancelled' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Match transfer cancel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
