import { NextRequest, NextResponse } from 'next/server';

/**
 * Cashfree Checkout Page — Bulletproof form POST method
 *
 * This route returns an HTML page that IMMEDIATELY auto-submits a form POST
 * to Cashfree's checkout endpoint using payment_session_id.
 *
 * WHY THIS APPROACH:
 * - The Cashfree JS SDK v3 is unreliable on mobile browsers (slow loading,
 *   CORS issues, "Invalid Session ID" errors on re-purchases)
 * - The Cashfree hosted checkout URL (using order_token) shows
 *   "Invalid Session ID" for re-purchases
 * - The form POST to /pg/view/sessions/checkout with payment_session_id is
 *   the MOST RELIABLE method — no JavaScript dependency, works on ALL
 *   browsers (mobile and desktop), and uses payment_session_id (always valid)
 *
 * This is the official Cashfree server-side redirect integration method.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const env = searchParams.get('env') || 'sandbox';
  const orderId = searchParams.get('order_id') || '';
  const orderToken = searchParams.get('order_token') || '';

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
    <div class="error-msg">No payment session was found. Please close this page and try your purchase again from the app.</div>
    <a href="/" class="back-btn">Go Back to App</a>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  const isProduction = env === 'production';

  // Cashfree checkout endpoint — accepts payment_session_id via form POST
  const checkoutEndpoint = isProduction
    ? 'https://api.cashfree.com/pg/view/sessions/checkout'
    : 'https://sandbox.cashfree.com/pg/view/sessions/checkout';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Redirecting to Payment - Kabaddi Pro</title>
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
      max-width: 420px;
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
      padding: 28px;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255,255,255,0.15);
      border-top-color: #f59e0b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .status-msg {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .status-sub {
      font-size: 13px;
      color: rgba(255,255,255,0.6);
      line-height: 1.5;
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
      font-size: 16px;
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
    .order-ref {
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-top: 16px;
      word-break: break-all;
    }
    .secure-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      margin-top: 20px;
    }
    .hidden-form {
      position: absolute;
      left: -9999px;
      top: -9999px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">KABADDI PRO</div>
    <div class="logo-sub">Premium Payment</div>

    <div class="card">
      <div class="spinner" id="spinner"></div>
      <div class="status-msg" id="status-msg">Redirecting to Secure Payment...</div>
      <div class="status-sub" id="status-sub">
        You are being redirected to Cashfree's secure payment page.<br>
        Please do not close this window.
      </div>

      <!-- Manual fallback button (shown if auto-submit fails) -->
      <button type="submit" form="cashfree-form" class="pay-btn" id="manual-btn" style="display:none;">
        Tap Here to Pay Now
      </button>

      ${orderId ? `<div class="order-ref">Order: ${orderId}</div>` : ''}
    </div>

    <div class="secure-badge">🔒 Secured by Cashfree Payments</div>
  </div>

  <!-- Auto-submitting form POST to Cashfree checkout -->
  <!-- This uses payment_session_id which is always valid (unlike order_token) -->
  <form id="cashfree-form" method="POST" action="${checkoutEndpoint}" class="hidden-form">
    <input type="hidden" name="payment_session_id" value="${sessionId}">
  </form>

  <script>
    // Auto-submit the form immediately
    (function() {
      var form = document.getElementById('cashfree-form');
      var submitted = false;

      function submitForm() {
        if (submitted) return;
        submitted = true;
        try {
          form.submit();
        } catch(e) {
          console.error('Form submit failed:', e);
          // Show manual button if auto-submit fails
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('status-msg').textContent = 'Ready to Pay';
          document.getElementById('status-sub').innerHTML = 'Tap the button below to proceed to the secure payment page.';
          document.getElementById('manual-btn').style.display = 'block';
        }
      }

      // Submit immediately (DOM is ready since script is at end of body)
      submitForm();

      // Fallback: try again after 1.5 seconds if still on this page
      setTimeout(function() {
        if (document.visibilityState !== 'hidden') {
          submitForm();
        }
      }, 1500);

      // Fallback: try again after 3 seconds
      setTimeout(function() {
        if (document.visibilityState !== 'hidden') {
          // If still here after 3s, show manual button
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('status-msg').textContent = 'Ready to Pay';
          document.getElementById('status-sub').innerHTML = 'Tap the button below to proceed to the secure payment page.';
          document.getElementById('manual-btn').style.display = 'block';
        }
      }, 3000);
    })();
  </script>

  <noscript>
    <style>.hidden-form { position: static !important; left: 0 !important; top: 0 !important; padding: 20px; }</style>
    <div style="text-align:center; margin-top: 20px;">
      <p style="color: white; margin-bottom: 16px;">JavaScript is disabled. Tap the button below to pay:</p>
    </div>
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
