import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/notifications?userId=xxx — Get notifications for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const notifications = await db.notification.findMany({
      where: { userId },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    const unreadCount = await db.notification.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        matchId: n.matchId,
        createdAt: n.createdAt,
        fromUser: n.fromUser,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/notifications — Create a notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, fromUserId, type, title, message, matchId } = body;

    if (!userId || !fromUserId || !type || !title || !message) {
      return NextResponse.json({ error: 'userId, fromUserId, type, title, and message are required' }, { status: 400 });
    }

    const notification = await db.notification.create({
      data: {
        userId,
        fromUserId,
        type,
        title,
        message,
        matchId: matchId || null,
      },
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error('Notifications POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/notifications — Mark all notifications as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    await db.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notifications PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
