import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { db } from '@/lib/db';

// Plan prices in paise (1 INR = 100 paise)
const PLAN_PRICES: Record<string, number> = {
  monthly: 14900,    // ₹149
  yearly: 99900,     // ₹999
  lifetime: 299900,  // ₹2,999
};

// Initialize Razorpay with env vars (falls back to test mode if not set)
function getRazorpayInstance() {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_XXXXXXXXXXXXXXX';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'XXXXXXXXXXXXXXXXXXXXXX';

  return new Razorpay({
    key_id,
    key_secret,
  });
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

    // Get user details for receipt
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { phone: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create Razorpay order
    const razorpay = getRazorpayInstance();
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}_${userId.slice(-6)}`,
      notes: {
        userId,
        plan,
        userName: user.name || 'N/A',
        userPhone: user.phone,
      },
    });

    // Save payment record to database
    const payment = await db.payment.create({
      data: {
        userId,
        razorpayOrderId: order.id,
        plan,
        amount,
        currency: 'INR',
        status: 'created',
        email: user.email,
        phone: user.phone,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      paymentId: payment.id,
      amount,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_XXXXXXXXXXXXXXX',
      prefill: {
        name: user.name || '',
        email: user.email || '',
        contact: user.phone || '',
      },
    });
  } catch (error: unknown) {
    console.error('Create order error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create payment order';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
