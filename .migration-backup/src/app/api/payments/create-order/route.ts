import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Plan prices in paise (1 INR = 100 paise)
const PLAN_PRICES: Record<string, number> = {
  daily: 100,        // ₹1
  weekly: 2700,      // ₹27
  monthly: 9900,     // ₹99
  yearly: 99900,     // ₹999
  lifetime: 319900,  // ₹3,199
};

// Plan display amounts in rupees (for Cashfree API which takes decimal string)
const PLAN_AMOUNTS_INR: Record<string, string> = {
  daily: '1.00',
  weekly: '27.00',
  monthly: '99.00',
  yearly: '999.00',
  lifetime: '3199.00',
};

// Coupon codes
const VALID_COUPONS: Record<string, { discount: number; type: 'percent' | 'flat' }> = {
  'KABADDI50': { discount: 50, type: 'percent' },
  'FIRST100': { discount: 100, type: 'flat' },
  'PRO2025': { discount: 25, type: 'percent' },
  'LAUNCH20': { discount: 20, type: 'percent' },
};

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

function calculateDiscount(plan: string, couponCode?: string): { discountPaise: number; finalPaise: number } {
  const basePaise = PLAN_PRICES[plan] || 0;
  if (!couponCode || !VALID_COUPONS[couponCode]) {
    return { discountPaise: 0, finalPaise: basePaise };
  }

  const coupon = VALID_COUPONS[couponCode];
  let discountPaise: number;

  if (coupon.type === 'flat') {
    discountPaise = coupon.discount * 100; // flat rupees → paise
  } else {
    discountPaise = Math.floor(basePaise * coupon.discount / 100);
  }

  const finalPaise = Math.max(100, basePaise - discountPaise); // minimum ₹1
  return { discountPaise, finalPaise };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plan, couponCode, amount: clientAmount } = body;

    if (!userId || !plan) {
      return NextResponse.json(
        { error: 'User ID and plan are required' },
        { status: 400 }
      );
    }

    if (!PLAN_PRICES[plan]) {
      return NextResponse.json(
        { error: 'Invalid plan. Choose daily, weekly, monthly, yearly, or lifetime.' },
        { status: 400 }
      );
    }

    // Calculate discount if coupon provided
    const { discountPaise, finalPaise } = calculateDiscount(plan, couponCode);
    const amount = finalPaise;
    const amountINR = (amount / 100).toFixed(2);

    const config = getCashfreeConfig();

    if (!config.appId || !config.secretKey) {
      console.error('[Cashfree] Missing credentials - CASHFREE_APP_ID or CASHFREE_SECRET_KEY not set');
      return NextResponse.json(
        { error: 'Payment gateway is being configured. Please try again in a few minutes.' },
        { status: 503 }
      );
    }

    // Get user details for order
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phone: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Your account was not found. Please log out and log back in, then try again.' },
        { status: 400 }
      );
    }

    // Generate a unique order_id for Cashfree
    const cashfreeOrderId = `kp_${plan}_${Date.now()}_${userId.slice(-6)}`;

    // Determine return URL based on environment
    // Cashfree will redirect to this URL after payment, appending order_id as a query param
    // The frontend will then verify the payment status
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const returnUrl = `${protocol}://${host}/?payment=redirect`;

    // Create order with Cashfree API
    const orderPayload: Record<string, unknown> = {
      order_id: cashfreeOrderId,
      order_amount: amountINR,
      order_currency: 'INR',
      customer_details: {
        customer_id: `KP_${userId.replace(/[^a-zA-Z0-9]/g, '').slice(-12)}`,
        customer_name: user.name || 'Kabaddi Pro User',
        customer_email: user.email || `user_${userId.slice(-6)}@kabaddipro.app`,
        customer_phone: user.phone || '9999999999',
      },
      order_meta: {
        return_url: `${returnUrl}&order_id=${cashfreeOrderId}`,
      },
      order_note: `Kabaddi Pro ${plan} plan${couponCode ? ` (coupon: ${couponCode})` : ''}`,
    };

    // Only add notify_url if we have a publicly accessible URL (not localhost)
    if (host !== 'localhost:3000') {
      (orderPayload.order_meta as Record<string, unknown>).notify_url = `${protocol}://${host}/api/payments/webhook`;
    }

    console.log(`[Cashfree] Creating order: baseUrl=${config.baseUrl}, env=${config.env}, apiVersion=${config.apiVersion}, orderId=${cashfreeOrderId}`);

    const cashfreeResponse = await fetch(`${config.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': config.appId,
        'x-client-secret': config.secretKey,
        'x-api-version': config.apiVersion,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!cashfreeResponse.ok) {
      const errorData = await cashfreeResponse.json().catch(() => ({}));
      console.error('[Cashfree] Create order error:', JSON.stringify(errorData));

      // Provide user-friendly error messages based on Cashfree error type
      let userMessage = 'Payment gateway error. Please try again later.';
      const errorType = errorData?.type || errorData?.code || '';
      if (errorType === 'authentication_error' || errorType === 'authentication_failed') {
        userMessage = 'Payment gateway configuration issue. Our team has been notified. Please try again later.';
        console.error('[Cashfree] CRITICAL: Authentication failed - check CASHFREE_APP_ID and CASHFREE_SECRET_KEY');
      } else if (errorType === 'rate_limit_exceeded') {
        userMessage = 'Too many payment attempts. Please wait a moment and try again.';
      } else if (errorData?.message?.includes('order_id')) {
        userMessage = 'Payment order conflict. Please try again.';
      }

      return NextResponse.json(
        { error: userMessage, details: errorData },
        { status: 502 }
      );
    }

    const cashfreeData = await cashfreeResponse.json();
    console.log(`[Cashfree] Order created: orderId=${cashfreeData.order_id}, hasPaymentSessionId=${!!cashfreeData.payment_session_id}, hasOrderToken=${!!cashfreeData.order_token}, orderStatus=${cashfreeData.order_status}`);

    // Save payment record to database
    const payment = await db.payment.create({
      data: {
        userId,
        cashfreeOrderId,
        orderId: cashfreeData.order_id || cashfreeOrderId,
        plan,
        amount,
        currency: 'INR',
        status: 'created',
        email: user.email,
        phone: user.phone,
      },
    });

    return NextResponse.json({
      orderId: cashfreeData.order_id || cashfreeOrderId,
      paymentSessionId: cashfreeData.payment_session_id,
      orderToken: cashfreeData.order_token || '',  // For hosted checkout URL
      paymentId: payment.id,
      amount,
      originalAmount: PLAN_PRICES[plan],
      discount: discountPaise,
      currency: 'INR',
      orderStatus: cashfreeData.order_status || 'ACTIVE',
      env: config.env,
    });
  } catch (error: unknown) {
    console.error('Create order error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
