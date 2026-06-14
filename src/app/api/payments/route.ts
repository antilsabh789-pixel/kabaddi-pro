import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status') || 'paid';
    const diagnostic = searchParams.get('diagnostic');

    // Payment gateway diagnostic endpoint
    if (diagnostic === 'true') {
      const env = process.env.CASHFREE_ENV || 'sandbox';
      const isProduction = env === 'production';
      const defaultBaseUrl = isProduction
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox-api.cashfree.com/pg';

      return NextResponse.json({
        configured: !!(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY),
        env,
        isProduction,
        baseUrl: process.env.CASHFREE_BASE_URL || defaultBaseUrl,
        apiVersion: process.env.CASHFREE_API_VERSION || '2023-08-01',
        hasAppId: !!process.env.CASHFREE_APP_ID,
        hasSecretKey: !!process.env.CASHFREE_SECRET_KEY,
        appIdPrefix: process.env.CASHFREE_APP_ID?.substring(0, 6) || 'NOT_SET',
        recommendation: !process.env.CASHFREE_APP_ID
          ? 'CASHFREE_APP_ID not set. Add it in Vercel Environment Variables.'
          : !process.env.CASHFREE_SECRET_KEY
            ? 'CASHFREE_SECRET_KEY not set. Add it in Vercel Environment Variables.'
            : env === 'sandbox' && process.env.CASHFREE_BASE_URL === 'https://api.cashfree.com/pg'
              ? 'MISMATCH: env=sandbox but BASE_URL=production! Remove CASHFREE_BASE_URL from env vars or set it to sandbox URL.'
              : 'Configuration looks correct.',
      });
    }

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
