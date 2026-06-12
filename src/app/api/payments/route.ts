import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'paid';

    if (userId) {
      // Get payments for a specific user
      const payments = await db.payment.findMany({
        where: { userId, status },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ payments });
    }

    // Get all successful payments (admin/earnings view)
    const payments = await db.payment.findMany({
      where: { status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate summary stats
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const monthlyCount = payments.filter((p) => p.plan === 'monthly').length;
    const yearlyCount = payments.filter((p) => p.plan === 'yearly').length;
    const lifetimeCount = payments.filter((p) => p.plan === 'lifetime').length;

    // Recent payments (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPayments = payments.filter(
      (p) => new Date(p.createdAt) >= thirtyDaysAgo
    );
    const recentRevenue = recentPayments.reduce((sum, p) => sum + p.amount, 0);

    return NextResponse.json({
      payments,
      summary: {
        totalRevenue,          // in paise
        totalRevenueINR: totalRevenue / 100,  // in rupees
        totalPayments: payments.length,
        monthlyCount,
        yearlyCount,
        lifetimeCount,
        recentRevenue,
        recentRevenueINR: recentRevenue / 100,
        recentPaymentsCount: recentPayments.length,
      },
    });
  } catch (error) {
    console.error('Payments fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}
