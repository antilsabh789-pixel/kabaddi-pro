import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/follow?userId=xxx — Get followers/following counts and lists
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'counts'; // counts | followers | following | search
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (type === 'counts') {
      const [followerCount, followingCount] = await Promise.all([
        db.follow.count({ where: { followingId: userId } }),
        db.follow.count({ where: { followerId: userId } }),
      ]);
      return NextResponse.json({ followerCount, followingCount });
    }

    if (type === 'followers') {
      const follows = await db.follow.findMany({
        where: { followingId: userId },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
            select: { id: true, name: true, avatar: true, phone: true, gender: true },
          },
        },
      });
      return NextResponse.json({
        followers: follows.map((f) => ({
          id: f.follower.id,
          name: f.follower.name,
          avatar: f.follower.avatar,
          phone: f.follower.phone,
          gender: f.follower.gender,
          followedAt: f.createdAt,
        })),
      });
    }

    if (type === 'following') {
      const follows = await db.follow.findMany({
        where: { followerId: userId },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: { id: true, name: true, avatar: true, phone: true, gender: true },
          },
        },
      });
      return NextResponse.json({
        following: follows.map((f) => ({
          id: f.following.id,
          name: f.following.name,
          avatar: f.following.avatar,
          phone: f.following.phone,
          gender: f.following.gender,
          followedAt: f.createdAt,
        })),
      });
    }

    // Search players to follow
    if (type === 'search') {
      const players = await db.user.findMany({
        where: {
          ...(search
            ? {
                OR: [
                  { name: { contains: search } },
                  { phone: { contains: search } },
                ],
              }
            : {}),
          id: { not: userId },
        },
        take: limit,
        select: {
          id: true,
          name: true,
          avatar: true,
          phone: true,
          gender: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Check which ones the current user is already following
      const existingFollows = await db.follow.findMany({
        where: {
          followerId: userId,
          followingId: { in: players.map((p) => p.id) },
        },
        select: { followingId: true },
      });
      const followingIds = new Set(existingFollows.map((f) => f.followingId));

      return NextResponse.json({
        players: players.map((p) => ({
          ...p,
          isFollowing: followingIds.has(p.id),
        })),
      });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    console.error('Follow GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/follow — Follow or unfollow a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { followerId, followingId, action } = body; // action: 'follow' | 'unfollow'

    if (!followerId || !followingId) {
      return NextResponse.json({ error: 'followerId and followingId are required' }, { status: 400 });
    }

    if (followerId === followingId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    if (action === 'follow') {
      await db.follow.upsert({
        where: {
          followerId_followingId: { followerId, followingId },
        },
        create: { followerId, followingId },
        update: {},
      });
      return NextResponse.json({ success: true, isFollowing: true });
    }

    if (action === 'unfollow') {
      await db.follow.deleteMany({
        where: { followerId, followingId },
      });
      return NextResponse.json({ success: true, isFollowing: false });
    }

    return NextResponse.json({ error: 'Invalid action. Use "follow" or "unfollow"' }, { status: 400 });
  } catch (error) {
    console.error('Follow POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
