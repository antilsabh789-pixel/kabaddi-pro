import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/activities?userId=xxx — Get social feed (activities from followed users + own)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get IDs of users the current user follows
    const following = await db.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    // Include own activities + followed users' activities
    const userIds = [userId, ...followingIds];

    const activities = await db.activity.findMany({
      where: { userId: { in: userIds } },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, gender: true },
        },
      },
    });

    return NextResponse.json({
      activities: activities.map((a) => ({
        id: a.id,
        userId: a.userId,
        userName: a.user.name,
        userAvatar: a.user.avatar,
        userGender: a.user.gender,
        type: a.type,
        title: a.title,
        description: a.description,
        matchId: a.matchId,
        tournamentId: a.tournamentId,
        metadata: a.metadata,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('Activities GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/activities — Create an activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, type, title, description, matchId, tournamentId, metadata } = body;

    if (!userId || !type || !title || !description) {
      return NextResponse.json({ error: 'userId, type, title, and description are required' }, { status: 400 });
    }

    const activity = await db.activity.create({
      data: {
        userId,
        type,
        title,
        description,
        matchId: matchId || null,
        tournamentId: tournamentId || null,
        metadata: metadata || null,
      },
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error('Activities POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
