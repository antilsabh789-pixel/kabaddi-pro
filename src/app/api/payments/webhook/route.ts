import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

function getCashfreeConfig() {
  const env = process.env.CASHFREE_ENV || 'sandbox';
  const isProduction = env === 'production';
  const defaultBaseUrl = isProduction
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  return {
    secretKey: process.env.CASHFREE_SECRET_KEY || '',
    apiVersion: process.env.CASHFREE_API_VERSION || '2023-08-01',
    baseUrl: process.env.CASHFREE_BASE_URL || defaultBaseUrl,
    appId: process.env.CASHFREE_APP_ID || '',
    env,
    isProduction,
  };
}

// Verify Cashfree webhook signature
function verifyWebhookSignature(
  signature: string,
  timestamp: string,
  rawData: string,
  secretKey: string
): boolean {
  try {
    // Cashfree webhook signature verification
    // Signature = base64(hmac_sha256(timestamp + rawData, secretKey))
    const message = timestamp + rawData;
    const expectedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(message)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const config = getCashfreeConfig();

    if (!config.secretKey) {
      console.error('Cashfree webhook: CASHFREE_SECRET_KEY not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Get the raw body and headers
    const rawData = await request.text();
    const signature = request.headers.get('x-webhook-signature') || '';
    const timestamp = request.headers.get('x-webhook-timestamp') || '';

    // Verify webhook signature
    if (signature && timestamp) {
      const isValid = verifyWebhookSignature(signature, timestamp, rawData, config.secretKey);
      if (!isValid) {
        console.error('Cashfree webhook: Invalid signature');
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    } else {
      // Log warning but still process (some webhook configs may not include signature)
      console.warn('Cashfree webhook: Missing signature/timestamp headers');
    }

    // Parse the webhook payload
    let payload: {
      type?: string;
      data?: {
        order?: {
          order_id?: string;
          order_amount?: number;
          order_currency?: string;
          order_status?: string;
        };
        payment?: {
          cf_payment_id?: string;
          payment_status?: string;
          payment_method?: string;
          payment_message?: string;
          payment_group?: string;
          bank_reference?: string;
          auth_id?: string;
        };
        customer_details?: {
          customer_id?: string;
          customer_email?: string;
          customer_phone?: string;
        };
      };
    };

    try {
      payload = JSON.parse(rawData);
    } catch {
      console.error('Cashfree webhook: Invalid JSON payload');
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const eventType = payload.type;
    const orderData = payload.data?.order;
    const paymentData = payload.data?.payment;

    if (!orderData?.order_id) {
      console.error('Cashfree webhook: Missing order_id in payload');
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    const cashfreeOrderId = orderData.order_id;

    // Find the payment record
    const payment = await db.payment.findUnique({
      where: { cashfreeOrderId },
    });

    if (!payment) {
      console.error(`Cashfree webhook: Payment not found for order ${cashfreeOrderId}`);
      return NextResponse.json({ error: 'Payment record not found for this order' }, { status: 200 });
    }

    // Handle different event types
    switch (eventType) {
      case 'PAYMENT_SUCCESS': {
        // Verify with Cashfree API to be sure
        const verifyResponse = await fetch(`${config.baseUrl}/orders/${cashfreeOrderId}`, {
          method: 'GET',
          headers: {
            'x-client-id': config.appId,
            'x-client-secret': config.secretKey,
            'x-api-version': config.apiVersion,
          },
        });

        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();

          if (verifyData.order_status === 'PAID') {
            // Update payment record
            await db.payment.update({
              where: { cashfreeOrderId },
              data: {
                status: 'paid',
                cashfreePaymentId: paymentData?.cf_payment_id || null,
                cfPaymentId: paymentData?.cf_payment_id || null,
                method: paymentData?.payment_method || null,
              },
            });

            // Activate premium for the user
            await db.user.update({
              where: { id: payment.userId },
              data: { isPremium: true },
            });

            console.log(`Cashfree webhook: Payment success for order ${cashfreeOrderId}`);
          } else {
            console.warn(`Cashfree webhook: Order ${cashfreeOrderId} status is ${verifyData.order_status}, not PAID`);
          }
        } else {
          console.error(`Cashfree webhook: Failed to verify order ${cashfreeOrderId} with Cashfree API`);
        }
        break;
      }

      case 'PAYMENT_FAILED': {
        await db.payment.update({
          where: { cashfreeOrderId },
          data: {
            status: 'failed',
            cashfreePaymentId: paymentData?.cf_payment_id || null,
            cfPaymentId: paymentData?.cf_payment_id || null,
            method: paymentData?.payment_method || null,
          },
        });

        console.log(`Cashfree webhook: Payment failed for order ${cashfreeOrderId}`);
        break;
      }

      case 'PAYMENT_REFUNDED': {
        await db.payment.update({
          where: { cashfreeOrderId },
          data: {
            status: 'refunded',
          },
        });

        console.log(`Cashfree webhook: Payment refunded for order ${cashfreeOrderId}`);
        break;
      }

      default:
        console.log(`Cashfree webhook: Unhandled event type: ${eventType}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Cashfree webhook error:', error);
    // Still return 200 to prevent retries
    return NextResponse.json({ received: true });
  }
}
