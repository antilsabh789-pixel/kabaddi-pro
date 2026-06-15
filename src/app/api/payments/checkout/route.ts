import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-rendered checkout redirect page for Cashfree payments.
 *
 * This is the MOST RELIABLE way to redirect to Cashfree on ALL devices:
 * - Desktop browsers ✓
 * - Mobile browsers ✓
 * - PWA / WebView ✓
 * - JavaScript disabled ✓
 *
 * Instead of relying on the Cashfree JS SDK (which fails on some mobile devices),
 * this route returns a complete HTML page with an auto-submitting POST form.
 * The form POSTs the payment_session_id directly to Cashfree's checkout page.
 * Zero client-side JavaScript is needed — the browser handles the form submission natively.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const env = searchParams.get('env') || 'sandbox';
  const orderId = searchParams.get('order_id') || '';
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
  const checkoutUrl = isProduction
    ? 'https://api.cashfree.com/pg/view/sessions/checkout'
    : 'https://sandbox.cashfree.com/pg/view/sessions/checkout';

  // Return a complete HTML page with auto-submitting form
  // This works on ALL devices — no JavaScript dependency
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Redirecting to Payment...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      overflow: hidden;
    }
    .container {
      text-align: center;
      padding: 24px;
      max-width: 380px;
    }
    .spinner {
      width: 56px;
      height: 56px;
      border: 4px solid rgba(255,255,255,0.2);
      border-top-color: #f59e0b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 14px;
      color: rgba(255,255,255,0.7);
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .order-info {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 24px;
      backdrop-filter: blur(8px);
    }
    .order-info .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: rgba(255,255,255,0.5);
      margin-bottom: 4px;
    }
    .order-info .value {
      font-size: 14px;
      font-weight: 600;
      color: #f59e0b;
    }
    .manual-btn {
      display: inline-block;
      background: #f59e0b;
      color: #1a1a2e;
      padding: 14px 32px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 15px;
      text-decoration: none;
      cursor: pointer;
      border: none;
      -webkit-tap-highlight-color: transparent;
    }
    .manual-btn:hover { background: #d97706; }
    .manual-section {
      display: none;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .footer-text {
      margin-top: 20px;
      font-size: 11px;
      color: rgba(255,255,255,0.3);
    }
    .secure-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner" id="spinner"></div>
    <div class="title" id="status-text">Redirecting to Payment</div>
    <div class="subtitle" id="status-subtitle">Please wait while we connect you to our secure payment partner...</div>

    ${orderId ? `
    <div class="order-info">
      <div class="label">Order Reference</div>
      <div class="value">${orderId}</div>
    </div>
    ` : ''}

    <div class="manual-section" id="manual-section">
      <p style="font-size:13px; color:rgba(255,255,255,0.6); margin-bottom:16px;">
        If you are not redirected automatically, tap the button below:
      </p>
      <form method="POST" action="${checkoutUrl}" id="manual-form">
        <input type="hidden" name="payment_session_id" value="${sessionId}">
        <button type="submit" class="manual-btn">Open Payment Page</button>
      </form>
    </div>

    <div class="secure-badge">
      🔒 Secured by Cashfree Payments
    </div>
    <div class="footer-text">Kabaddi Pro Premium</div>
  </div>

  <!-- Hidden auto-submit form — the PRIMARY method -->
  <form method="POST" action="${checkoutUrl}" id="auto-form" style="display:none;">
    <input type="hidden" name="payment_session_id" value="${sessionId}">
  </form>

  <script>
    // Auto-submit the form after a short delay
    // The delay ensures the page is fully rendered before navigation
    setTimeout(function() {
      try {
        document.getElementById('auto-form').submit();
      } catch(e) {
        // If auto-submit fails, show manual button
        document.getElementById('manual-section').style.display = 'block';
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('status-text').textContent = 'Tap to Continue';
        document.getElementById('status-subtitle').textContent = 'Tap the button below to open the payment page.';
      }
    }, 800);

    // If auto-submit hasn't happened after 5 seconds, show the manual button
    setTimeout(function() {
      var manualSection = document.getElementById('manual-section');
      if (manualSection.style.display !== 'block') {
        manualSection.style.display = 'block';
        document.getElementById('status-text').textContent = 'Almost there...';
        document.getElementById('status-subtitle').textContent = 'If the payment page doesn\'t load, tap the button below.';
      }
    }, 5000);
  </script>

  <noscript>
    <!-- JavaScript disabled: show the manual form immediately -->
    <style>.manual-section { display: block !important; } .spinner { display: none !important; }</style>
  </noscript>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Prevent caching — each checkout must be fresh
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
