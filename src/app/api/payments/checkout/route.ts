import { NextRequest, NextResponse } from 'next/server';

/**
 * Cashfree Checkout Redirect
 *
 * This route handles the payment redirect to Cashfree's hosted checkout page.
 * It tries MULTIPLE methods to ensure the payment works on ALL devices:
 *
 * Method 1: Server-side 302 redirect (most reliable, no JS needed)
 * Method 2: HTML page with visible form + auto-submit (fallback)
 * Method 3: Manual "Tap to Pay" button (last resort for restricted browsers)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const env = searchParams.get('env') || 'sandbox';
  const orderId = searchParams.get('order_id') || '';
  const plan = searchParams.get('plan') || '';
  const method = searchParams.get('method') || 'redirect'; // redirect | html

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
    .back-btn:hover { background: #b45309; }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="error-icon">⚠️</div>
    <div class="error-title">Payment Session Missing</div>
    <div class="error-msg">No payment session was found. This could happen if you navigated here directly. Please try your purchase again.</div>
    <a href="/" class="back-btn">Go Back to App</a>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  const isProduction = env === 'production';

  // METHOD 1: Server-side 302 redirect to Cashfree hosted checkout
  // This is the simplest and most reliable method — no JavaScript, no forms
  // The browser follows the redirect natively on ALL devices
  if (method === 'redirect') {
    // Cashfree v3 hosted checkout URL format:
    // https://payments.cashfree.com/pg/orders/pay/{payment_session_id}
    const hostedCheckoutUrl = isProduction
      ? `https://payments.cashfree.com/pg/orders/pay/${sessionId}`
      : `https://sandbox.cashfree.com/pg/orders/pay/${sessionId}`;

    console.log(`[Cashfree] 302 redirect to hosted checkout: ${hostedCheckoutUrl.substring(0, 60)}...`);

    // Use 307 to preserve the GET method (some browsers convert 302 to POST)
    return NextResponse.redirect(hostedCheckoutUrl, 307);
  }

  // METHOD 2: HTML page with VISIBLE form and multiple submit methods
  // This is the fallback if the 302 redirect doesn't work
  const formPostUrl = isProduction
    ? 'https://api.cashfree.com/pg/view/sessions/checkout'
    : 'https://sandbox.cashfree.com/pg/view/sessions/checkout';

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
    .subtitle {
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
      padding: 16px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #1a1a2e;
      border: none;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 800;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      text-decoration: none;
      text-align: center;
      letter-spacing: 0.02em;
    }
    .pay-btn:hover { background: linear-gradient(135deg, #d97706, #b45309); }
    .pay-btn:active { transform: scale(0.98); }
    .or-divider {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 16px 0;
      font-size: 12px;
      color: rgba(255,255,255,0.3);
    }
    .or-divider::before, .or-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255,255,255,0.1);
    }
    .link-btn {
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
    }
    .link-btn:hover { background: rgba(255,255,255,0.15); }
    .secure-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      margin-top: 20px;
    }
    .auto-notice {
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">KABADDI PRO</div>
    <div class="subtitle">Premium Payment</div>

    <div class="card">
      ${orderId ? `
      <div class="order-ref">Order Reference</div>
      <div class="order-id">${orderId}</div>
      ` : ''}

      <!-- METHOD A: Form POST to Cashfree (primary) -->
      <form method="POST" action="${formPostUrl}" id="checkout-form">
        <input type="hidden" name="payment_session_id" value="${sessionId}">
        <button type="submit" class="pay-btn">Pay Securely</button>
      </form>

      <div class="or-divider">or</div>

      <!-- METHOD B: Direct link to Cashfree hosted checkout -->
      <a href="${isProduction ? `https://payments.cashfree.com/pg/orders/pay/${sessionId}` : `https://sandbox.cashfree.com/pg/orders/pay/${sessionId}`}" class="link-btn" id="direct-link">
        Open Payment Page Directly
      </a>

      <div class="auto-notice" id="auto-notice">Auto-redirecting in 2 seconds...</div>
    </div>

    <div class="secure-badge">🔒 Secured by Cashfree Payments</div>
  </div>

  <script>
    // Auto-submit the form after 2 seconds
    // This gives the page time to render and the user a moment to see the UI
    var autoSubmitted = false;
    setTimeout(function() {
      try {
        autoSubmitted = true;
        document.getElementById('checkout-form').submit();
      } catch(e) {
        // Form submit failed — user can tap the button manually
        document.getElementById('auto-notice').textContent = 'Tap the button above to proceed.';
      }
    }, 2000);

    // Update notice after 5 seconds if still on this page
    setTimeout(function() {
      if (!autoSubmitted || document.getElementById('auto-notice')) {
        document.getElementById('auto-notice').textContent = 'Tap either button above to proceed to payment.';
      }
    }, 5000);
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
