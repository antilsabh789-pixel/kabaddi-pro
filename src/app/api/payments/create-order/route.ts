import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Plan prices in paise (1 INR = 100 paise)
const PLAN_PRICES: Record<string, number> = {
  monthly: 14900,    // ₹149
  yearly: 99900,     // ₹999
  lifetime: 299900,  // ₹2,999
};

// Plan display amounts in rupees (for Cashfree API which takes decimal string)
const PLAN_AMOUNTS_INR: Record<string, string> = {
  monthly: '149.00',
  yearly: '999.00',
  lifetime: '2999.00',
};

function getCashfreeConfig() {
  return {
    appId: process.env.CASHFREE_APP_ID || '',
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
    apiVersion: process.env.CASHFREE_API_VERSION || '2025-01-01',
    baseUrl: process.env.CASHFREE_BASE_URL || 'https://api.cashfree.com/pg',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plan } = body;

    if (!userId || !plan) {
      return NextResponse.json(
        { error: 'User ID and plan are required' },
        { status: 400 }
      );
    }

    if (!PLAN_PRICES[plan]) {
      return NextResponse.json(
        { error: 'Invalid plan. Choose monthly, yearly, or lifetime.' },
        { status: 400 }
      );
    }

    const amount = PLAN_PRICES[plan];
    const amountINR = PLAN_AMOUNTS_INR[plan];
    const config = getCashfreeConfig();

    if (!config.appId || !config.secretKey) {
      return NextResponse.json(
        { error: 'Cashfree credentials not configured' },
        { status: 500 }
      );
    }

    // Get user details for order
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phone: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate a unique order_id for Cashfree
    const cashfreeOrderId = `kabaddi_pro_${Date.now()}_${userId.slice(-6)}`;

    // Determine return URL based on environment
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const returnUrl = `${protocol}://${host}/api/payments/verify?order_id=${cashfreeOrderId}`;

    // Create order with Cashfree API
    const orderPayload = {
      order_id: cashfreeOrderId,
      order_amount: amountINR,
      order_currency: 'INR',
      customer_details: {
        customer_id: userId,
        customer_name: user.name || 'Kabaddi Pro User',
        customer_email: user.email || `user_${userId.slice(-6)}@kabaddipro.app`,
        customer_phone: user.phone || '9999999999',
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: `${protocol}://${host}/api/payments/webhook`,
      },
      order_note: `Kabaddi Pro ${plan} plan subscription`,
    };

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
      console.error('Cashfree create order error:', errorData);
      return NextResponse.json(
        { error: 'Failed to create payment order with Cashfree', details: errorData },
        { status: 500 }
      );
    }

    const cashfreeData = await cashfreeResponse.json();

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
      paymentId: payment.id,
      amount,
      currency: 'INR',
      orderStatus: cashfreeData.order_status || 'ACTIVE',
      env: process.env.CASHFREE_ENV || 'sandbox',
    });
  } catch (error: unknown) {
    console.error('Create order error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
