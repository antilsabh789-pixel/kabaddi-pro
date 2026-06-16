import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * POST /api/academies/[id]/players
 * Add a player to an academy
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: academyId } = await params;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Verify academy exists
    const academy = await db.academy.findUnique({ where: { id: academyId } });
    if (!academy) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    // Verify user exists
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if already a player
    const existing = await db.academyPlayer.findUnique({
      where: {
        academyId_userId: { academyId, userId },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Player already in this academy' },
        { status: 409 }
      );
    }

    const player = await db.academyPlayer.create({
      data: { academyId, userId },
      include: {
        user: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
    });

    return NextResponse.json({ player }, { status: 201 });
  } catch (error) {
    console.error('Add player to academy error:', error);
    return NextResponse.json(
      { error: 'Failed to add player' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/academies/[id]/players
 * Remove a player from an academy (deregister)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: academyId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    const existing = await db.academyPlayer.findUnique({
      where: {
        academyId_userId: { academyId, userId },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Player not found in this academy' },
        { status: 404 }
      );
    }

    await db.academyPlayer.delete({
      where: {
        academyId_userId: { academyId, userId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove player from academy error:', error);
    return NextResponse.json(
      { error: 'Failed to remove player' },
      { status: 500 }
    );
  }
}
