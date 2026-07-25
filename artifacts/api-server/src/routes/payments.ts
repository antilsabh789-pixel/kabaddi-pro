import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../lib/db';

const router = Router();

const PLAN_PRICES: Record<string, number> = { daily: 200, weekly: 2700, monthly: 9900, yearly: 99900, lifetime: 329900 };
const PLAN_AMOUNTS_INR: Record<string, string> = { daily: '2.00', weekly: '27.00', monthly: '99.00', yearly: '999.00', lifetime: '3299.00' };
const VALID_COUPONS: Record<string, { discount: number; type: 'percent' | 'flat'; applicablePlans?: string[] }> = {
  'KABADDI50': { discount: 50, type: 'percent' },
  'FIRST100': { discount: 100, type: 'flat' },
  'PRO2025': { discount: 25, type: 'percent' },
  'LAUNCH20': { discount: 20, type: 'percent' },
  // 98% off — Lifetime plan only. ₹3299 → ₹66 (saves ₹3233).
  'LIFETIME98': { discount: 98, type: 'percent', applicablePlans: ['lifetime'] },
};

function getCashfreeConfig() {
  const cashfreeIsLive = process.env['CASHFREE_IS_LIVE'];
  const cashfreeEnv = process.env['CASHFREE_ENV'];
  const isProduction = cashfreeIsLive === 'true' || cashfreeIsLive === '1' || cashfreeEnv === 'production';
  return {
    appId: (process.env['CASHFREE_APP_ID'] || '').trim(),
    secretKey: (process.env['CASHFREE_SECRET_KEY'] || '').trim(),
    apiVersion: process.env['CASHFREE_API_VERSION'] || '2023-08-01',
    baseUrl: isProduction ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg',
    env: isProduction ? 'production' : 'sandbox',
    isProduction,
  };
}

/**
 * Build an ABSOLUTE return URL for Cashfree. Mirrors the helper in giveaway.ts.
 * Cashfree rejects relative URLs with HTTP 422 — this resolves the public
 * origin from APP_URL, the Origin/Referer headers, or req.protocol+host.
 */
function buildAbsoluteReturnUrl(req: any, pathWithQuery: string, explicitReturnUrl?: string): string {
  if (explicitReturnUrl && /^https?:\/\//i.test(explicitReturnUrl)) {
    return explicitReturnUrl;
  }
  const appUrl = (process.env['APP_URL'] || '').trim().replace(/\/+$/, '');
  if (appUrl) {
    return `${appUrl}${pathWithQuery}`;
  }
  const origin = (req?.get?.('origin') || '').trim();
  if (origin && origin !== 'null') {
    return `${origin}${pathWithQuery}`;
  }
  const referer = (req?.get?.('referer') || '').trim();
  if (referer) {
    try {
      const u = new URL(referer);
      return `${u.origin}${pathWithQuery}`;
    } catch { /* fall through */ }
  }
  const proto = (req?.protocol || 'https');
  const host = (req?.get?.('host') || req?.get?.('x-forwarded-host') || '').trim();
  if (host) {
    return `${proto}://${host}${pathWithQuery}`;
  }
  return pathWithQuery;
}

function calculateDiscount(plan: string, couponCode?: string): { discountPaise: number; finalPaise: number } {
  const basePaise = PLAN_PRICES[plan] || 0;
  if (!couponCode) return { discountPaise: 0, finalPaise: basePaise };
  // Try hardcoded coupons first (legacy). DB-backed DiscountCode is checked
  // asynchronously in the route handler below — this synchronous helper only
  // handles the legacy set so calculateDiscount can be called from other places.
  const upperCode = couponCode.toUpperCase();
  if (VALID_COUPONS[upperCode]) {
    const coupon = VALID_COUPONS[upperCode];
    // Plan-restricted coupons (e.g. LIFETIME98) only apply to the listed plans.
    if (coupon.applicablePlans && !coupon.applicablePlans.includes(plan)) {
      return { discountPaise: 0, finalPaise: basePaise };
    }
    const discountPaise = coupon.type === 'flat' ? coupon.discount * 100 : Math.floor((basePaise * coupon.discount) / 100);
    return { discountPaise, finalPaise: Math.max(0, basePaise - discountPaise) };
  }
  return { discountPaise: 0, finalPaise: basePaise };
}

/**
 * Look up a coupon code in the DB-backed DiscountCode table.
 * Returns the discount to apply (in paise) + the code's id (for incrementing
 * usedCount after a successful payment). Returns null if the code is invalid,
 * expired, exhausted, or doesn't meet the minimum-order threshold.
 */
async function calculateDbDiscount(plan: string, couponCode?: string): Promise<{ discountPaise: number; finalPaise: number; codeId: string | null }> {
  const basePaise = PLAN_PRICES[plan] || 0;
  if (!couponCode) return { discountPaise: 0, finalPaise: basePaise, codeId: null };
  const upperCode = couponCode.toUpperCase().trim();
  if (!upperCode) return { discountPaise: 0, finalPaise: basePaise, codeId: null };
  try {
    const code = await db.discountCode.findUnique({ where: { code: upperCode } });
    if (!code) return { discountPaise: 0, finalPaise: basePaise, codeId: null };
    if (!code.isActive) return { discountPaise: 0, finalPaise: basePaise, codeId: null };
    if (code.expiresAt && code.expiresAt.getTime() < Date.now()) {
      return { discountPaise: 0, finalPaise: basePaise, codeId: null };
    }
    if (code.maxUses > 0 && code.usedCount >= code.maxUses) {
      return { discountPaise: 0, finalPaise: basePaise, codeId: null };
    }
    if (code.minOrderAmount > 0 && basePaise < code.minOrderAmount) {
      return { discountPaise: 0, finalPaise: basePaise, codeId: null };
    }
    const discountPaise = code.discountType === 'flat'
      ? Math.min(code.discountValue, basePaise)
      : Math.floor((basePaise * code.discountValue) / 100);
    return {
      discountPaise,
      finalPaise: Math.max(0, basePaise - discountPaise),
      codeId: code.id,
    };
  } catch {
    return { discountPaise: 0, finalPaise: basePaise, codeId: null };
  }
}

/**
 * Public: validate a coupon code WITHOUT creating an order. Used by the
 * frontend's "Apply" button on the upgrade screen so the user sees the
 * discounted price before tapping Pay.
 */
router.post('/payments/validate-coupon', async (req, res) => {
  try {
    const { plan, couponCode } = req.body;
    if (!plan || !PLAN_PRICES[plan]) return res.status(400).json({ error: 'Invalid plan' });
    if (!couponCode) return res.status(400).json({ error: 'couponCode is required' });

    const basePaise = PLAN_PRICES[plan];
    // Try DB first, then fall back to hardcoded legacy coupons.
    const dbResult = await calculateDbDiscount(plan, couponCode);
    let discountPaise = dbResult.discountPaise;
    let finalPaise = dbResult.finalPaise;
    let source: 'db' | 'legacy' | 'none' = dbResult.codeId ? 'db' : 'none';

    if (source === 'none') {
      const legacy = calculateDiscount(plan, couponCode);
      if (legacy.discountPaise > 0) {
        discountPaise = legacy.discountPaise;
        finalPaise = legacy.finalPaise;
        source = 'legacy';
      }
    }

    if (discountPaise === 0) {
      return res.status(404).json({ error: 'Invalid, expired, or exhausted coupon code' });
    }
    return res.json({
      valid: true,
      source,
      basePaise,
      discountPaise,
      finalPaise,
      baseInr: (basePaise / 100).toFixed(2),
      discountInr: (discountPaise / 100).toFixed(2),
      finalInr: (finalPaise / 100).toFixed(2),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

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
    const { userId, plan, couponCode, returnUrl, phone, name, email } = req.body;
    if (!userId || !plan) return res.status(400).json({ error: 'userId and plan are required' });
    if (!PLAN_PRICES[plan]) return res.status(400).json({ error: 'Invalid plan' });

    const config = getCashfreeConfig();
    // Try DB-backed DiscountCode first; fall back to legacy hardcoded coupons.
    const dbDisc = await calculateDbDiscount(plan, couponCode);
    let discountPaise = dbDisc.discountPaise;
    let finalPaise = dbDisc.finalPaise;
    let discountCodeId: string | null = dbDisc.codeId;
    if (discountPaise === 0) {
      const legacy = calculateDiscount(plan, couponCode);
      discountPaise = legacy.discountPaise;
      finalPaise = legacy.finalPaise;
    }
    const amountInr = (finalPaise / 100).toFixed(2);

    // Resolve the user robustly: by id first, then by an EXACT match on the
    // unique phone field. This handles stale client sessions (e.g. after the
    // database was reseeded) where the persisted userId no longer exists but the
    // account is still reachable by phone. Exact match on the unique column is
    // deterministic and collision-free (never `endsWith`/`findFirst`).
    let user = await db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, phone: true, email: true } });
    if (!user && phone) {
      user = await db.user.findUnique({ where: { phone: String(phone).trim() }, select: { id: true, name: true, phone: true, email: true } });
    }
    if (!user) {
      console.error(`[create-order] User not found. userId=${userId} phone=${phone || 'none'}`);
      return res.status(409).json({ error: 'Your session has expired. Please log out and log in again to continue your purchase.' });
    }

    const orderId = `KP_${user.id.slice(-6)}_${Date.now()}`;

    const cashfreePayload = {
      order_id: orderId,
      order_amount: parseFloat(amountInr),
      order_currency: 'INR',
      customer_details: { customer_id: user.id, customer_name: user.name || name || 'Kabaddi Pro User', customer_phone: (user.phone || phone || '').replace(/\D/g, '').slice(-10), customer_email: user.email || email || `${user.id}@kabaddipro.app` },
      order_meta: { return_url: buildAbsoluteReturnUrl(req, '/?payment=success&order_id={order_id}', returnUrl) },
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
      data: { userId: user.id, cashfreeOrderId: orderId, plan, amount: finalPaise, status: 'pending' },
    });

    return res.json({ orderId, paymentSessionId: cfOrder.payment_session_id, sessionId: cfOrder.payment_session_id, cfOrderId: cfOrder.cf_order_id, amount: amountInr, discount: (discountPaise / 100).toFixed(2), env: config.env });
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

  const safeSession = sessionId.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\u003c');
  const safeSessionAttr = sessionId.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeOrderId = orderId.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isProd = env === 'production';
  const sdkMode = isProd ? 'production' : 'sandbox';

  // Cashfree hosted checkout form POST endpoint (works in ALL environments incl. WebView)
  const cfFormEndpoint = isProd
    ? 'https://api.cashfree.com/pg/view/sessions/checkout'
    : 'https://sandbox.cashfree.com/pg/view/sessions/checkout';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Secure Payment – Kabaddi Pro</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);color:#fff;padding:16px}
.card{text-align:center;padding:36px 28px;background:rgba(255,255,255,.1);border-radius:20px;width:100%;max-width:340px;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.15)}
.logo{font-size:22px;font-weight:900;color:#f59e0b;letter-spacing:.05em;margin-bottom:20px}
.shield{font-size:40px;margin-bottom:12px}
.spinner{width:44px;height:44px;border:4px solid rgba(255,255,255,.15);border-top-color:#f59e0b;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
p{font-size:14px;opacity:.8;margin-bottom:20px;line-height:1.5}
.btn{display:block;width:100%;padding:16px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#1a1a2e;border:none;border-radius:14px;font-size:17px;font-weight:800;cursor:pointer;letter-spacing:.02em;box-shadow:0 4px 16px rgba(245,158,11,.4);transition:opacity .2s;text-decoration:none}
.btn:active{opacity:.85}
.note{font-size:11px;opacity:.4;margin-top:16px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🏆 KABADDI PRO</div>
  <div class="shield">🔒</div>
  <div class="spinner" id="spinner"></div>
  <p id="status">Opening secure payment gateway…</p>
  <button class="btn" id="pay-btn" style="display:none" onclick="doFormPost()">Pay Securely Now</button>
  ${safeOrderId ? `<p class="note">Order: ${safeOrderId}</p>` : ''}
</div>

<!-- Form POST method: works in WebView, browser, everywhere -->
<form id="cf-form" method="POST" action="${cfFormEndpoint}" style="display:none">
  <input type="hidden" name="payment_session_id" value="${safeSessionAttr}">
</form>

<script>
// Direct form POST — most reliable method, works in all browsers and WebViews.
// Submits the hidden form immediately, redirecting to Cashfree's hosted checkout.
(function(){
  document.getElementById('status').textContent = 'Redirecting to payment…';
  document.getElementById('cf-form').submit();
  // Safety: show manual button after 3s in case the form post was blocked
  setTimeout(function(){
    document.getElementById('spinner').style.display = 'none';
    document.getElementById('pay-btn').style.display = 'block';
    document.getElementById('status').textContent = 'Click below to pay securely';
  }, 3000);
})();
</script>
</body>
</html>`);
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

    // EXTEND premium from the existing expiry (if still in the future) so users
    // can renew early without losing paid days. Falls back to "now" if expired
    // or no prior premium. Lifetime always wins (null expiry).
    const existingUser = await db.user.findUnique({
      where: { id: payment.userId },
      select: { premiumExpiry: true, premiumPlan: true },
    });
    const now = new Date();
    const hasActiveExpiry = existingUser?.premiumExpiry && existingUser.premiumExpiry.getTime() > now.getTime();
    const baseTime = hasActiveExpiry ? (existingUser!.premiumExpiry as Date) : now;

    let premiumExpiry: Date | null = null;
    switch (payment.plan) {
      case 'daily': premiumExpiry = new Date(baseTime.getTime() + 86400000); break;
      case 'weekly': premiumExpiry = new Date(baseTime.getTime() + 7 * 86400000); break;
      case 'monthly': premiumExpiry = new Date(baseTime.getTime() + 30 * 86400000); break;
      case 'yearly': premiumExpiry = new Date(baseTime.getTime() + 365 * 86400000); break;
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
        // Extend from existing expiry if still active (same logic as verifyPayment).
        const existingUser = await db.user.findUnique({
          where: { id: payment.userId },
          select: { premiumExpiry: true, premiumPlan: true },
        });
        const now = new Date();
        const hasActiveExpiry = existingUser?.premiumExpiry && existingUser.premiumExpiry.getTime() > now.getTime();
        const baseTime = hasActiveExpiry ? (existingUser!.premiumExpiry as Date) : now;
        let premiumExpiry: Date | null = null;
        switch (payment.plan) {
          case 'daily': premiumExpiry = new Date(baseTime.getTime() + 86400000); break;
          case 'weekly': premiumExpiry = new Date(baseTime.getTime() + 7 * 86400000); break;
          case 'monthly': premiumExpiry = new Date(baseTime.getTime() + 30 * 86400000); break;
          case 'yearly': premiumExpiry = new Date(baseTime.getTime() + 365 * 86400000); break;
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
