import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: 'Missing payment verification details' },
        { status: 400 }
      );
    }

    // Find the payment record
    const payment = await db.payment.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });

    if (!payment) {
      return NextResponse.json(
        { error: 'Payment order not found' },
        { status: 404 }
      );
    }

    // Verify the signature
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'XXXXXXXXXXXXXXXXXXXXXX';
    const expectedSignature = crypto
      .createHmac('sha256', key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isSignatureValid = expectedSignature === razorpay_signature;

    if (!isSignatureValid) {
      // Mark payment as failed
      await db.payment.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          status: 'failed',
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
      });

      return NextResponse.json(
        { error: 'Payment verification failed. Signature mismatch.' },
        { status: 400 }
      );
    }

    // Signature is valid — activate premium!
    await db.payment.update({
      where: { razorpayOrderId: razorpay_order_id },
      data: {
        status: 'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
    });

    // Activate premium for the user
    const user = await db.user.update({
      where: { id: payment.userId },
      data: { isPremium: true },
    });

    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      message: 'Payment verified and premium activated!',
      user: userWithoutPassword,
      plan: payment.plan,
      amount: payment.amount,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
