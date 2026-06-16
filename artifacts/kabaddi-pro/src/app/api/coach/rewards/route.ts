import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/coach/rewards?academyId=xxx
 * Get rewards for an academy
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');

    if (!academyId) {
      return NextResponse.json({ error: 'academyId is required' }, { status: 400 });
    }

    const rewards = await db.studentReward.findMany({
      where: { academyId },
      include: {
        user: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get points leaderboard
    const leaderboard = await db.studentReward.groupBy({
      by: ['userId'],
      where: { academyId },
      _sum: { points: true },
      _count: { id: true },
      orderBy: { _sum: { points: 'desc' } },
    });

    // Enrich leaderboard with user info
    const userIds = leaderboard.map((l) => l.userId);
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatar: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichedLeaderboard = leaderboard.map((l) => ({
      userId: l.userId,
      name: userMap.get(l.userId)?.name || 'Unknown',
      avatar: userMap.get(l.userId)?.avatar || null,
      totalPoints: l._sum.points || 0,
      rewardCount: l._count,
    }));

    // Get current player of the month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const playerOfMonth = rewards.find(
      (r) => r.type === 'player_of_month' && r.month === currentMonth
    );

    return NextResponse.json({
      rewards,
      leaderboard: enrichedLeaderboard,
      playerOfMonth: playerOfMonth
        ? {
            ...playerOfMonth,
            name: playerOfMonth.user.name,
          }
        : null,
    });
  } catch (error) {
    console.error('Coach rewards GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: 500 });
  }
}

/**
 * POST /api/coach/rewards
 * Give a reward to a student
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { academyId, userId, type, title, description, points, month, icon } = body;

    if (!academyId || !userId || !type || !title) {
      return NextResponse.json(
        { error: 'academyId, userId, type, and title are required' },
        { status: 400 }
      );
    }

    // Verify academy
    const academy = await db.academy.findUnique({ where: { id: academyId } });
    if (!academy) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    // Verify user is in academy
    const player = await db.academyPlayer.findUnique({
      where: { academyId_userId: { academyId, userId } },
    });
    if (!player) {
      return NextResponse.json(
        { error: 'Student is not in this academy' },
        { status: 404 }
      );
    }

    const reward = await db.studentReward.create({
      data: {
        academyId,
        userId,
        type,
        title,
        description: description || null,
        points: points || 0,
        month: month || null,
        icon: icon || null,
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true, avatar: true },
        },
      },
    });

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    console.error('Coach rewards POST error:', error);
    return NextResponse.json({ error: 'Failed to create reward' }, { status: 500 });
  }
}
