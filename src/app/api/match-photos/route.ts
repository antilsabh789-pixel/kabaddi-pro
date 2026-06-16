import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/match-photos?matchId=xxx
 * Returns photos for a specific match.
 *
 * POST /api/match-photos
 * Creates a new photo entry.
 * Body: { matchId: string, userId: string, url: string, caption?: string }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');

    if (!matchId) {
      return NextResponse.json({ error: 'matchId is required' }, { status: 400 });
    }

    const photos = await db.matchPhoto.findMany({
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
      orderBy: { createdAt: 'desc' },
    });

    const formatted = photos.map((p) => ({
      id: p.id,
      matchId: p.matchId,
      userId: p.userId,
      url: p.url,
      caption: p.caption,
      userName: p.user.name || 'Anonymous',
      userAvatar: p.user.avatar,
      createdAt: p.createdAt.toISOString(),
    }));

    return NextResponse.json({ photos: formatted });
  } catch (error) {
    console.error('Match photos GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId, userId, url, caption } = body;

    if (!matchId || !userId || !url) {
      return NextResponse.json(
        { error: 'matchId, userId, and url are required' },
        { status: 400 }
      );
    }

    if (typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const newPhoto = await db.matchPhoto.create({
      data: {
        matchId,
        userId,
        url: url.trim(),
        caption: caption?.trim() || null,
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
      photo: {
        id: newPhoto.id,
        matchId: newPhoto.matchId,
        userId: newPhoto.userId,
        url: newPhoto.url,
        caption: newPhoto.caption,
        userName: newPhoto.user.name || 'Anonymous',
        userAvatar: newPhoto.user.avatar,
        createdAt: newPhoto.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Match photos POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
