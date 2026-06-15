import { NextRequest, NextResponse } from 'next/server';

/**
 * Cashfree Checkout Page — Fallback for mobile/WebView
 *
 * This route returns an HTML page with MULTIPLE ways to pay:
 * 1. Form POST to Cashfree /pg/view/sessions/checkout (auto-submits)
 * 2. Direct link to Cashfree hosted checkout using order_token
 * 3. Manual "Tap to Pay" button
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const env = searchParams.get('env') || 'sandbox';
  const orderId = searchParams.get('order_id') || '';
  const orderToken = searchParams.get('order_token') || '';
  const plan = searchParams.get('plan') || '';

  // Validate required parameters
  if (!sessionId) {
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <title>Payment Error</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; color: #333; }
    .error-card { background: white; border-radius: 16px; padding: 32px; text-align: center; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
    .error-icon { font-size: 48px; margin-bottom: 16px; }
    .error-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .error-msg { font-size: 14px; color: #666; margin-bottom: 24px; line-height: 1.5; }
    .back-btn { display: inline-block; background: #d97706; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="error-icon">⚠️</div>
    <div class="error-title">Payment Session Missing</div>
    <div class="error-msg">No payment session was found. Please try your purchase again.</div>
    <a href="/" class="back-btn">Go Back to App</a>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  const isProduction = env === 'production';

  // Form POST URL for Cashfree checkout
  const formPostUrl = isProduction
    ? 'https://api.cashfree.com/pg/view/sessions/checkout'
    : 'https://sandbox.cashfree.com/pg/view/sessions/checkout';

  // Hosted checkout URL using order_token (if available)
  const hostedCheckoutUrl = orderToken
    ? (isProduction
      ? `https://payments.cashfree.com/pg/orders/pay/${orderToken}`
      : `https://sandbox.cashfree.com/pg/orders/pay/${orderToken}`)
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Complete Payment - Kabaddi Pro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .container {
      text-align: center;
      max-width: 400px;
      width: 100%;
    }
    .logo {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.1em;
      color: #f59e0b;
      margin-bottom: 8px;
    }
    .logo-sub {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 24px;
    }
    .card {
      background: rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 24px;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .order-ref {
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .order-id {
      font-size: 13px;
      color: #f59e0b;
      font-weight: 600;
      word-break: break-all;
      margin-bottom: 20px;
    }
    .pay-btn {
      display: block;
      width: 100%;
      padding: 18px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #1a1a2e;
      border: none;
      border-radius: 12px;
      font-size: 18px;
      font-weight: 800;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      text-decoration: none;
      text-align: center;
      letter-spacing: 0.02em;
      margin-bottom: 12px;
    }
    .pay-btn:hover { background: linear-gradient(135deg, #d97706, #b45309); }
    .pay-btn:active { transform: scale(0.98); }
    .secondary-btn {
      display: block;
      width: 100%;
      padding: 14px;
      background: rgba(255,255,255,0.1);
      color: white;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      text-decoration: none;
      text-align: center;
      margin-bottom: 12px;
    }
    .secondary-btn:hover { background: rgba(255,255,255,0.15); }
    .or-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 12px 0;
      font-size: 12px;
      color: rgba(255,255,255,0.3);
    }
    .or-divider::before, .or-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.1);
    }
    .secure-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      margin-top: 20px;
    }
    .auto-notice {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin-top: 12px;
    }
    .spinner-small {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #f59e0b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">KABADDI PRO</div>
    <div class="logo-sub">Premium Payment</div>

    <div class="card">
      ${orderId ? `
      <div class="order-ref">Order Reference</div>
      <div class="order-id">${orderId}</div>
      ` : ''}

      <!-- PRIMARY: Form POST to Cashfree /pg/view/sessions/checkout -->
      <form method="POST" action="${formPostUrl}" id="checkout-form">
        <input type="hidden" name="payment_session_id" value="${sessionId}">
        <button type="submit" class="pay-btn" id="pay-btn">
          <span class="spinner-small" id="btn-spinner"></span>
          Pay Securely Now
        </button>
      </form>

      ${hostedCheckoutUrl ? `
      <div class="or-divider">or</div>

      <!-- SECONDARY: Direct link to Cashfree hosted checkout using order_token -->
      <a href="${hostedCheckoutUrl}" class="secondary-btn" id="direct-link">
        Open Payment Page
      </a>
      ` : ''}

      <div class="auto-notice" id="auto-notice">
        <span class="spinner-small"></span> Auto-redirecting in 3 seconds...
      </div>
    </div>

    <div class="secure-badge">🔒 Secured by Cashfree Payments</div>
  </div>

  <script>
    // Auto-submit the form after 3 seconds
    var submitted = false;
    var form = document.getElementById('checkout-form');
    var btn = document.getElementById('pay-btn');
    var notice = document.getElementById('auto-notice');

    setTimeout(function() {
      if (!submitted && form) {
        try {
          submitted = true;
          if (btn) btn.click();  // Click the button instead of form.submit() for better compatibility
        } catch(e) {
          try {
            form.submit();  // Fallback to direct submit
          } catch(e2) {
            if (notice) notice.textContent = 'Tap the Pay button above to proceed.';
          }
        }
      }
    }, 3000);

    // After 8 seconds, if still here, update the notice
    setTimeout(function() {
      if (notice && document.visibilityState !== 'hidden') {
        notice.innerHTML = 'Tap <strong>Pay Securely Now</strong> above to proceed.';
      }
    }, 8000);
  </script>

  <noscript>
    <style>.auto-notice { display: none; }</style>
  </noscript>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
