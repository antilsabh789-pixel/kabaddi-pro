import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/match-comments?matchId=xxx
 * Returns comments for a specific match.
 *
 * POST /api/match-comments
 * Creates a new comment.
 * Body: { matchId: string, userId: string, comment: string }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    const comments = await db.matchComment.findMany({
      where: { matchId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = comments.map((c) => ({
      id: c.id,
      matchId: c.matchId,
      userId: c.userId,
      comment: c.comment,
      userName: c.user.name || 'Anonymous',
      userAvatar: c.user.avatar,
      createdAt: c.createdAt.toISOString(),
    }));

    return NextResponse.json({ comments: formatted });
  } catch (error) {
    console.error('Match comments GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, userId, comment } = body;

    if (!matchId || !userId || !comment) {
      return NextResponse.json(
        { error: 'matchId, userId, and comment are required' },
        { status: 400 }
      );
    }

    if (typeof comment !== 'string' || comment.trim().length === 0) {
      return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 });
    }

    if (comment.length > 500) {
      return NextResponse.json({ error: 'Comment too long (max 500 chars)' }, { status: 400 });
    }

    const newComment = await db.matchComment.create({
      data: {
        matchId,
        userId,
        comment: comment.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    return NextResponse.json({
      comment: {
        id: newComment.id,
        matchId: newComment.matchId,
        userId: newComment.userId,
        comment: newComment.comment,
        userName: newComment.user.name || 'Anonymous',
        userAvatar: newComment.user.avatar,
        createdAt: newComment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Match comments POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
