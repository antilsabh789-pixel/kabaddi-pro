import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const totalPlayers = await db.user.count();
    const totalCoaches = await db.user.count({ where: { role: 'coach' } });
    const totalActivePlayers = await db.user.count({
      where: {
        profile: {
          totalMatches: { gt: 0 },
        },
      },
    });

    // Get recent signups (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentSignups = await db.user.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Get today's signups
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySignups = await db.user.count({
      where: {
        createdAt: { gte: todayStart },
      },
    });

    // Get latest signup
    const latestSignup = await db.user.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        createdAt: true,
        role: true,
      },
    });

    return NextResponse.json({
      totalPlayers,
      totalCoaches,
      totalActivePlayers,
      recentSignups,
      todaySignups,
      latestSignup: latestSignup ? {
        name: latestSignup.name || 'Anonymous',
        createdAt: latestSignup.createdAt.toISOString(),
        role: latestSignup.role,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching total players:', error);
    return NextResponse.json(
      { totalPlayers: 0, totalCoaches: 0, totalActivePlayers: 0, recentSignups: 0, todaySignups: 0, latestSignup: null },
      { status: 500 }
    );
  }
}
