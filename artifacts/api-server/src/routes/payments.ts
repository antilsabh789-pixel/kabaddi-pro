import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../lib/db';

const router = Router();

const PLAN_PRICES: Record<string, number> = { daily: 200, weekly: 2700, monthly: 9900, yearly: 99900, lifetime: 329900 };
const PLAN_AMOUNTS_INR: Record<string, string> = { daily: '2.00', weekly: '27.00', monthly: '99.00', yearly: '999.00', lifetime: '3299.00' };
const VALID_COUPONS: Record<string, { discount: number; type: 'percent' | 'flat' }> = {
  'KABADDI50': { discount: 50, type: 'percent' }, 'FIRST100': { discount: 100, type: 'flat' }, 'PRO2025': { discount: 25, type: 'percent' }, 'LAUNCH20': { discount: 20, type: 'percent' },
};

function getCashfreeConfig() {
  const cashfreeIsLive = process.env['CASHFREE_IS_LIVE'];
  const cashfreeEnv = process.env['CASHFREE_ENV'];
  const isProduction = cashfreeIsLive === 'true' || cashfreeIsLive === '1' || cashfreeEnv === 'production';
  return {
    appId: process.env['CASHFREE_APP_ID'] || '',
    secretKey: process.env['CASHFREE_SECRET_KEY'] || '',
    apiVersion: process.env['CASHFREE_API_VERSION'] || '2023-08-01',
    baseUrl: isProduction ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
    env: isProduction ? 'production' : 'sandbox',
    isProduction,
  };
}

function calculateDiscount(plan: string, couponCode?: string): { discountPaise: number; finalPaise: number } {
  const basePaise = PLAN_PRICES[plan] || 0;
  if (!couponCode || !VALID_COUPONS[couponCode]) return { discountPaise: 0, finalPaise: basePaise };
  const coupon = VALID_COUPONS[couponCode];
  const discountPaise = coupon.type === 'flat' ? coupon.discount * 100 : Math.floor((basePaise * coupon.discount) / 100);
  return { discountPaise, finalPaise: Math.max(0, basePaise - discountPaise) };
}

router.get('/payments', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const payments = await db.payment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 });
    return res.json({ payments });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/payments/create-order', async (req, res) => {
  try {
    const { userId, plan, couponCode, returnUrl } = req.body;
    if (!userId || !plan) return res.status(400).json({ error: 'userId and plan are required' });
    if (!PLAN_PRICES[plan]) return res.status(400).json({ error: 'Invalid plan' });

    const config = getCashfreeConfig();
    const { discountPaise, finalPaise } = calculateDiscount(plan, couponCode);
    const amountInr = (finalPaise / 100).toFixed(2);

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, phone: true, email: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const orderId = `KP_${userId.slice(-6)}_${Date.now()}`;

    const cashfreePayload = {
      order_id: orderId,
      order_amount: parseFloat(amountInr),
      order_currency: 'INR',
      customer_details: { customer_id: userId, customer_name: user.name || 'Kabaddi Pro User', customer_phone: (user.phone || '').replace(/\D/g, '').slice(-10), customer_email: user.email || `${userId}@kabaddipro.app` },
      order_meta: { return_url: returnUrl || `${process.env['APP_URL'] || ''}/?payment=success&order_id={order_id}` },
    };

    const cfResponse = await fetch(`${config.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'x-client-id': config.appId, 'x-client-secret': config.secretKey, 'x-api-version': config.apiVersion, 'Content-Type': 'application/json' },
      body: JSON.stringify(cashfreePayload),
    });

    if (!cfResponse.ok) {
      const err = await cfResponse.text();
      console.error('Cashfree order creation failed:', err);
      return res.status(502).json({ error: 'Payment gateway error', details: err });
    }

    const cfOrder = await cfResponse.json() as { payment_session_id?: string; cf_order_id?: string; [k: string]: unknown };

    await db.payment.create({
      data: { userId, cashfreeOrderId: orderId, plan, amount: finalPaise, status: 'pending' },
    });

    return res.json({ orderId, sessionId: cfOrder.payment_session_id, cfOrderId: cfOrder.cf_order_id, amount: amountInr, discount: (discountPaise / 100).toFixed(2), env: config.env });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/payments/checkout', async (req, res) => {
  const sessionId = req.query['session_id'] as string;
  const env = (req.query['env'] as string) || 'sandbox';
  const orderId = (req.query['order_id'] as string) || '';
  if (!sessionId) return res.status(400).send('<h1>Payment Session Missing</h1>');

  const safeSession = sessionId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const safeOrderId = orderId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sdkMode = env === 'production' ? 'prod' : 'sandbox';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirecting to Payment - Kabaddi Pro</title><style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:linear-gradient(135deg,#1a1a2e,#0f3460);color:white}.card{text-align:center;padding:32px;background:rgba(255,255,255,.1);border-radius:16px}.logo{font-size:24px;font-weight:900;color:#f59e0b;margin-bottom:16px}.spinner{width:48px;height:48px;border:4px solid rgba(255,255,255,.2);border-top:4px solid #f59e0b;border-radius:50%;animation:spin .8s linear infinite;margin:16px auto}.btn{display:block;width:100%;padding:14px;background:#f59e0b;color:#1a1a2e;border:none;border-radius:12px;font-size:16px;font-weight:800;cursor:pointer;margin-top:16px}@keyframes spin{to{transform:rotate(360deg)}}</style><script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script></head><body><div class="card"><div class="logo">KABADDI PRO</div><div class="spinner"></div><p>Redirecting to Secure Payment...</p><button class="btn" id="manual-btn">Tap Here to Pay</button>${safeOrderId ? `<p style="font-size:11px;opacity:.4">Order: ${safeOrderId}</p>` : ''}</div><script>(function(){var s="${safeSession}",m="${sdkMode}",done=false;function pay(){try{var cf=window.Cashfree(m);cf.pay({session:s,redirectTarget:"_self",onSuccess:function(){done=true},onFailure:function(e){document.querySelector('p').textContent='Payment failed: '+(e&&e.message||'Unknown error')}})}catch(e){document.querySelector('p').textContent='SDK error: '+e.message}}document.getElementById('manual-btn').onclick=pay;if(window.Cashfree)pay();else{var t=setInterval(function(){if(window.Cashfree){clearInterval(t);pay()}},200)}})()</script></body></html>`);
});

router.get('/payments/verify', async (req, res) => {
  try {
    const orderId = req.query['order_id'] as string;
    if (!orderId) return res.status(400).json({ error: 'Missing order_id' });
    return await verifyPayment(orderId, res);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/payments/verify', async (req, res) => {
  try {
    const { order_id } = req.body;
    if (!order_id) return res.status(400).json({ error: 'Missing order_id' });
    return await verifyPayment(order_id, res);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

async function verifyPayment(orderId: string, res: any) {
  const payment = await db.payment.findUnique({ where: { cashfreeOrderId: orderId } });
  if (!payment) return res.status(400).json({ error: 'Payment order not found' });

  const config = getCashfreeConfig();
  const cfResponse = await fetch(`${config.baseUrl}/orders/${orderId}`, {
    method: 'GET',
    headers: { 'x-client-id': config.appId, 'x-client-secret': config.secretKey, 'x-api-version': config.apiVersion },
  });

  if (!cfResponse.ok) return res.status(502).json({ error: 'Could not verify payment with gateway' });
  const cfOrder = await cfResponse.json() as { order_status?: string; [k: string]: unknown };

  if (cfOrder.order_status === 'PAID') {
    await db.payment.update({ where: { id: payment.id }, data: { status: 'success' } });

    const now = new Date();
    let premiumExpiry: Date | null = null;
    switch (payment.plan) {
      case 'daily': premiumExpiry = new Date(now.getTime() + 86400000); break;
      case 'weekly': premiumExpiry = new Date(now.getTime() + 7 * 86400000); break;
      case 'monthly': premiumExpiry = new Date(now.getTime() + 30 * 86400000); break;
      case 'yearly': premiumExpiry = new Date(now.getTime() + 365 * 86400000); break;
      case 'lifetime': premiumExpiry = null; break;
    }

    const user = await db.user.update({ where: { id: payment.userId }, data: { isPremium: true, premiumExpiry, premiumPlan: payment.plan } });
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ success: true, user: userWithoutPassword });
  }

  return res.json({ success: false, status: cfOrder.order_status });
}

router.post('/payments/webhook', async (req, res) => {
  try {
    const signature = (req.headers['x-webhook-signature'] as string) || '';
    const timestamp = (req.headers['x-webhook-timestamp'] as string) || '';

    if (!signature || !timestamp) return res.status(401).json({ error: 'Missing webhook signature headers' });

    const config = getCashfreeConfig();
    if (!config.secretKey) return res.status(500).json({ error: 'Webhook not configured' });

    const rawData = JSON.stringify(req.body);

    const message = timestamp + rawData;
    const expected = crypto.createHmac('sha256', config.secretKey).update(message).digest('base64');
    try {
      const sigValid = crypto.timingSafeEqual(Buffer.from(signature, 'base64'), Buffer.from(expected, 'base64'));
      if (!sigValid) return res.status(401).json({ error: 'Invalid signature' });
    } catch { return res.status(401).json({ error: 'Signature verification failed' }); }

    const event = req.body;
    const orderId = event?.data?.order?.order_id;
    const eventType = event?.type;

    if (orderId && eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
      const payment = await db.payment.findUnique({ where: { cashfreeOrderId: orderId } });
      if (payment && payment.status !== 'success') {
        await db.payment.update({ where: { id: payment.id }, data: { status: 'success' } });
        const now = new Date();
        let premiumExpiry: Date | null = null;
        switch (payment.plan) {
          case 'daily': premiumExpiry = new Date(now.getTime() + 86400000); break;
          case 'weekly': premiumExpiry = new Date(now.getTime() + 7 * 86400000); break;
          case 'monthly': premiumExpiry = new Date(now.getTime() + 30 * 86400000); break;
          case 'yearly': premiumExpiry = new Date(now.getTime() + 365 * 86400000); break;
          case 'lifetime': premiumExpiry = null; break;
        }
        await db.user.update({ where: { id: payment.userId }, data: { isPremium: true, premiumExpiry, premiumPlan: payment.plan } });
      }
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/payments/diagnose', async (req, res) => {
  const config = getCashfreeConfig();
  return res.json({ env: config.env, hasAppId: !!config.appId, hasSecretKey: !!config.secretKey, baseUrl: config.baseUrl });
});

export default router;
