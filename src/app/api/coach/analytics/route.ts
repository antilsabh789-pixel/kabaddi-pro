import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/coach/analytics?academyId=xxx
 * Get analytics data for an academy
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');

    if (!academyId) {
      return NextResponse.json({ error: 'academyId is required' }, { status: 400 });
    }

    const academy = await db.academy.findUnique({
      where: { id: academyId },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    if (!academy) {
      return NextResponse.json({ error: 'Academy not found' }, { status: 404 });
    }

    // ─── Attendance-to-Performance chart data ─────────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendanceRecords = await db.attendance.findMany({
      where: {
        academyId,
        date: { gte: thirtyDaysAgo },
      },
    });

    // Attendance % per student
    const attendanceByStudent = new Map<string, { total: number; present: number }>();
    attendanceRecords.forEach((a) => {
      const current = attendanceByStudent.get(a.userId) || { total: 0, present: 0 };
      current.total += 1;
      if (a.isPresent) current.present += 1;
      attendanceByStudent.set(a.userId, current);
    });

    // Get player profiles for performance data
    const userIds = academy.players.map((p) => p.userId);
    const profiles = await db.playerProfile.findMany({
      where: { userId: { in: userIds } },
    });
    const profileMap = new Map(profiles.map((p) => [p.userId, p]));

    const attendancePerformance = academy.players.map((p) => {
      const att = attendanceByStudent.get(p.userId) || { total: 0, present: 0 };
      const profile = profileMap.get(p.userId);
      const attendancePercent = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
      const performanceScore = profile
        ? Math.min(100, Math.round(
            ((profile.raidPoints + profile.tacklePoints + profile.bonusPoints) /
              Math.max(profile.totalMatches, 1)) *
              10
          ))
        : 0;

      return {
        name: p.user.name || 'Unknown',
        attendancePercent,
        performanceScore,
      };
    });

    // ─── Monthly attendance trend ─────────────────────────
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyAttendance = await db.attendance.findMany({
      where: {
        academyId,
        date: { gte: sixMonthsAgo },
      },
    });

    const monthlyTrend = new Map<string, { total: number; present: number }>();
    monthlyAttendance.forEach((a) => {
      const monthKey = a.date.toISOString().slice(0, 7);
      const current = monthlyTrend.get(monthKey) || { total: 0, present: 0 };
      current.total += 1;
      if (a.isPresent) current.present += 1;
      monthlyTrend.set(monthKey, current);
    });

    const attendanceTrend = Array.from(monthlyTrend.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        attendanceRate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
        present: data.present,
        total: data.total,
      }));

    // ─── Fee collection data ─────────────────────────────
    const currentMonth = now.toISOString().slice(0, 7);
    const feeRecords = await db.feeRecord.findMany({
      where: { academyId, month: currentMonth },
    });

    const feeSummary = {
      paid: feeRecords.filter((f) => f.status === 'paid').reduce((s, f) => s + f.amount, 0),
      pending: feeRecords.filter((f) => f.status === 'pending').reduce((s, f) => s + f.amount, 0),
      overdue: feeRecords.filter((f) => f.status === 'overdue').reduce((s, f) => s + f.amount, 0),
      paidCount: feeRecords.filter((f) => f.status === 'paid').length,
      pendingCount: feeRecords.filter((f) => f.status === 'pending').length,
      overdueCount: feeRecords.filter((f) => f.status === 'overdue').length,
    };

    return NextResponse.json({
      attendancePerformance,
      attendanceTrend,
      feeSummary,
      totalPlayers: academy.players.length,
    });
  } catch (error) {
    console.error('Coach analytics GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
