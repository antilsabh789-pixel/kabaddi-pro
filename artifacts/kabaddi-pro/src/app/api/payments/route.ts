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
      const cashfreeIsLive = process.env.CASHFREE_IS_LIVE;
      const cashfreeEnv = process.env.CASHFREE_ENV;
      const isProduction = cashfreeIsLive === 'true' || cashfreeIsLive === '1' || cashfreeEnv === 'production';
      const env = isProduction ? 'production' : 'sandbox';
      const defaultBaseUrl = isProduction
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
      const baseUrl = process.env.CASHFREE_BASE_URL || defaultBaseUrl;

      // Test Cashfree API connectivity by trying to list orders (GET /orders)
      let apiTestResult: Record<string, unknown> = { tested: false };
      if (process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY) {
        try {
          const testRes = await fetch(`${baseUrl}/orders`, {
            method: 'GET',
            headers: {
              'x-client-id': process.env.CASHFREE_APP_ID,
              'x-client-secret': process.env.CASHFREE_SECRET_KEY,
              'x-api-version': process.env.CASHFREE_API_VERSION || '2023-08-01',
            },
          });
          const testData = await testRes.json().catch(() => ({}));
          apiTestResult = {
            tested: true,
            status: testRes.status,
            ok: testRes.ok,
            hasAuthenticationError: testRes.status === 401 || testData?.type === 'authentication_error',
            responseCode: testData?.code || null,
            responseType: testData?.type || null,
          };
        } catch (err) {
          apiTestResult = {
            tested: true,
            ok: false,
            error: err instanceof Error ? err.message : 'Network error',
          };
        }
      }

      // Determine the checkout URL for the current environment
      const checkoutUrl = isProduction
        ? 'https://payments.cashfree.com/pg/orders/pay/{session_id}'
        : 'https://sandbox.cashfree.com/pg/orders/pay/{session_id}';

      return NextResponse.json({
        configured: !!(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY),
        env,
        isProduction,
        baseUrl,
        checkoutUrl,
        apiVersion: process.env.CASHFREE_API_VERSION || '2023-08-01',
        hasAppId: !!process.env.CASHFREE_APP_ID,
        hasSecretKey: !!process.env.CASHFREE_SECRET_KEY,
        hasIsLive: !!cashfreeIsLive,
        isLiveValue: cashfreeIsLive || 'NOT_SET',
        hasCashfreeEnv: !!cashfreeEnv,
        cashfreeEnvValue: cashfreeEnv || 'NOT_SET',
        appIdPrefix: process.env.CASHFREE_APP_ID?.substring(0, 6) || 'NOT_SET',
        secretKeyPrefix: process.env.CASHFREE_SECRET_KEY?.substring(0, 8) || 'NOT_SET',
        apiTest: apiTestResult,
        recommendation: !process.env.CASHFREE_APP_ID
          ? 'CASHFREE_APP_ID not set. Add it in Vercel Environment Variables.'
          : !process.env.CASHFREE_SECRET_KEY
            ? 'CASHFREE_SECRET_KEY not set. Add it in Vercel Environment Variables.'
            : apiTestResult.hasAuthenticationError
              ? 'CRITICAL: Cashfree API authentication failed! Your APP_ID and SECRET_KEY may be for a different environment (sandbox vs production). Check your Cashfree dashboard.'
              : env === 'sandbox' && process.env.CASHFREE_BASE_URL === 'https://api.cashfree.com/pg'
                ? 'MISMATCH: env=sandbox but BASE_URL=production! Remove CASHFREE_BASE_URL from env vars or set it to sandbox URL.'
                : isProduction && process.env.CASHFREE_SECRET_KEY?.includes('test')
                  ? 'WARNING: CASHFREE_IS_LIVE=true but SECRET_KEY appears to be a sandbox key. Set CASHFREE_IS_LIVE=false for sandbox testing.'
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
