import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function getCashfreeConfig() {
  // Support both CASHFREE_ENV (sandbox/production) and CASHFREE_IS_LIVE (true/false)
  const cashfreeIsLive = process.env.CASHFREE_IS_LIVE;
  const cashfreeEnv = process.env.CASHFREE_ENV;
  const isProduction = cashfreeIsLive === 'true' || cashfreeIsLive === '1' || cashfreeEnv === 'production';
  const env = isProduction ? 'production' : 'sandbox';
  const defaultBaseUrl = isProduction
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  return {
    appId: process.env.CASHFREE_APP_ID || '',
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
    apiVersion: process.env.CASHFREE_API_VERSION || '2023-08-01',
    baseUrl: process.env.CASHFREE_BASE_URL || defaultBaseUrl,
    env,
    isProduction,
  };
}

// GET handler — Cashfree redirects here after payment with order_id in query
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing order_id parameter' },
        { status: 400 }
      );
    }

    // Find the payment record
    const payment = await db.payment.findUnique({
      where: { cashfreeOrderId: orderId },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment order not found. It may have expired. Please try purchasing again.' },
        { status: 400 }
      );
    }

    const config = getCashfreeConfig();

    // Verify payment status with Cashfree
    const cashfreeResponse = await fetch(`${config.baseUrl}/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
      },
    });

    if (!cashfreeResponse.ok) {
      const errorData = await cashfreeResponse.json().catch(() => ({}));
      console.error('Cashfree verify error:', errorData);
      return NextResponse.json(
        { error: 'Failed to verify payment with Cashfree', details: errorData },
        { status: 500 }
      );
    }

    const cashfreeData = await cashfreeResponse.json();

    if (cashfreeData.order_status === 'PAID') {
      // Payment successful — activate premium
      await db.payment.update({
        where: { cashfreeOrderId: orderId },
        data: {
          status: 'paid',
          cashfreePaymentId: cashfreeData.cf_payment_id || null,
          cfPaymentId: cashfreeData.cf_payment_id || null,
          cashfreeSignature: cashfreeData.payment_signature || null,
          method: cashfreeData.payment_method || null,
        },
      });

      // Calculate premium expiry based on plan
      const now = new Date();
      let premiumExpiry: Date | null = null;
      switch (payment.plan) {
        case 'daily':
          premiumExpiry = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          premiumExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          premiumExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case 'yearly':
          premiumExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
        case 'lifetime':
          premiumExpiry = null;
          break;
        default:
          premiumExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // If user already has premium with a future expiry, extend it
      const existingUser = await db.user.findUnique({
        where: { id: payment.userId },
        select: { isPremium: true, premiumExpiry: true },
      });
      let effectiveExpiry = premiumExpiry;
      if (existingUser?.isPremium && existingUser.premiumExpiry) {
        const currentExpiry = new Date(existingUser.premiumExpiry);
        if (currentExpiry > now && payment.plan !== 'lifetime' && premiumExpiry) {
          const extensionMs = premiumExpiry.getTime() - now.getTime();
          effectiveExpiry = new Date(currentExpiry.getTime() + extensionMs);
        }
      }

      // Activate premium for the user
      const user = await db.user.update({
        where: { id: payment.userId },
        data: {
          isPremium: true,
          premiumExpiry: effectiveExpiry,
          premiumPlan: payment.plan,
        },
      });

      const { password: _, ...userWithoutPassword } = user;

      // Redirect to a success page or return JSON
      // Since this is a redirect from Cashfree, we return a simple HTML page
      // that posts a message to the parent window (if in iframe) or redirects
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head><title>Payment Successful</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'cashfree_success', orderId: '${orderId}' }, '*');
    window.close();
  } else if (window.parent !== window) {
    window.parent.postMessage({ type: 'cashfree_success', orderId: '${orderId}' }, '*');
  } else {
    window.location.href = '/?payment=success&order_id=${orderId}';
  }
</script>
<noscript>
  <meta http-equiv="refresh" content="0;url=/?payment=success&order_id=${orderId}">
</noscript>
<p>Payment successful! Redirecting...</p>
</body>
</html>`,
        {
          headers: { 'Content-Type': 'text/html' },
        }
      );
    } else {
      // Payment not completed
      const status = cashfreeData.order_status || 'UNKNOWN';
      await db.payment.update({
        where: { cashfreeOrderId: orderId },
        data: {
          status: status === 'FAILED' ? 'failed' : status.toLowerCase(),
        },
      });

      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head><title>Payment ${status}</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'cashfree_${status.toLowerCase()}', orderId: '${orderId}' }, '*');
    window.close();
  } else if (window.parent !== window) {
    window.parent.postMessage({ type: 'cashfree_${status.toLowerCase()}', orderId: '${orderId}' }, '*');
  } else {
    window.location.href = '/?payment=failed&order_id=${orderId}';
  }
</script>
<noscript>
  <meta http-equiv="refresh" content="0;url=/?payment=failed&order_id=${orderId}">
</noscript>
<p>Payment ${status}. Redirecting...</p>
</body>
</html>`,
        {
          headers: { 'Content-Type': 'text/html' },
        }
      );
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}

// POST handler — for programmatic verification from frontend
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json(
        { error: 'Missing order_id' },
        { status: 400 }
      );
    }

    // Find the payment record
    const payment = await db.payment.findUnique({
      where: { cashfreeOrderId: order_id },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment order not found. It may have expired. Please try purchasing again.' },
        { status: 400 }
      );
    }

    // If already paid, return success
    if (payment.status === 'paid') {
      const user = await db.user.findUnique({
        where: { id: payment.userId },
        select: { id: true, isPremium: true, name: true, email: true, phone: true },
      });

      return NextResponse.json({
        success: true,
        message: 'Payment already verified and premium activated!',
        user,
        plan: payment.plan,
        amount: payment.amount,
      });
    }

    const config = getCashfreeConfig();

    // Verify payment status with Cashfree
    const cashfreeResponse = await fetch(`${config.baseUrl}/orders/${order_id}`, {
      method: 'GET',
      headers: {
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
      },
    });

    if (!cashfreeResponse.ok) {
      const errorData = await cashfreeResponse.json().catch(() => ({}));
      console.error('Cashfree verify error:', errorData);
      return NextResponse.json(
        { error: 'Failed to verify payment with Cashfree', details: errorData },
        { status: 500 }
      );
    }

    const cashfreeData = await cashfreeResponse.json();

    if (cashfreeData.order_status === 'PAID') {
      // Payment successful — activate premium
      await db.payment.update({
        where: { cashfreeOrderId: order_id },
        data: {
          status: 'paid',
          cashfreePaymentId: cashfreeData.cf_payment_id || null,
          cfPaymentId: cashfreeData.cf_payment_id || null,
          cashfreeSignature: cashfreeData.payment_signature || null,
          method: cashfreeData.payment_method || null,
        },
      });

      // Calculate premium expiry based on plan
      const now = new Date();
      let premiumExpiry: Date | null = null;
      switch (payment.plan) {
        case 'daily':
          premiumExpiry = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          premiumExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          premiumExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case 'yearly':
          premiumExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
        case 'lifetime':
          premiumExpiry = null;
          break;
        default:
          premiumExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // If user already has premium with a future expiry, extend it
      const existingUser = await db.user.findUnique({
        where: { id: payment.userId },
        select: { isPremium: true, premiumExpiry: true },
      });
      let effectiveExpiry = premiumExpiry;
      if (existingUser?.isPremium && existingUser.premiumExpiry) {
        const currentExpiry = new Date(existingUser.premiumExpiry);
        if (currentExpiry > now && payment.plan !== 'lifetime' && premiumExpiry) {
          const extensionMs = premiumExpiry.getTime() - now.getTime();
          effectiveExpiry = new Date(currentExpiry.getTime() + extensionMs);
        }
      }

      // Activate premium for the user
      const user = await db.user.update({
        where: { id: payment.userId },
        data: {
          isPremium: true,
          premiumExpiry: effectiveExpiry,
          premiumPlan: payment.plan,
        },
      });

      const { password: _, ...userWithoutPassword } = user;

      return NextResponse.json({
        success: true,
        message: 'Payment verified and premium activated!',
        user: userWithoutPassword,
        plan: payment.plan,
        amount: payment.amount,
      });
    } else {
      // Payment not successful
      const status = cashfreeData.order_status || 'UNKNOWN';
      const mappedStatus = status === 'FAILED' ? 'failed' : status.toLowerCase();

      await db.payment.update({
        where: { cashfreeOrderId: order_id },
        data: { status: mappedStatus },
      });

      return NextResponse.json(
        {
          error: `Payment not completed. Status: ${status}`,
          orderStatus: status,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
