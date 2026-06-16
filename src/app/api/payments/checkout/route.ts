import { NextRequest, NextResponse } from 'next/server';

/**
 * Cashfree Checkout Page — Reliable payment page for both mobile and desktop
 *
 * This route returns an HTML page that uses MULTIPLE methods to pay:
 * 1. Cashfree JS SDK v3 (using payment_session_id — most reliable, avoids "Invalid Session ID")
 * 2. Form POST to Cashfree /pg/view/sessions/checkout (fallback)
 * 3. Direct link to Cashfree hosted checkout using order_token (last resort)
 *
 * KEY FIX: This page always tries the JS SDK with payment_session_id FIRST,
 * which avoids the "Invalid Session ID" error that occurs when using order_token
 * on Cashfree's hosted checkout page (especially on mobile re-purchases).
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
  const sdkMode = isProduction ? 'production' : 'sandbox';

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
    .status-area {
      min-height: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }
    .status-msg {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .status-sub {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
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
    .pay-btn:disabled {
      background: rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.4);
      cursor: not-allowed;
    }
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
    .spinner {
      display: inline-block;
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #f59e0b;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
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
    .error-text { color: #ef4444; }
    .success-text { color: #10b981; }
    .hidden { display: none !important; }
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

      <!-- Status area: shows loading, success, or error -->
      <div class="status-area" id="status-area">
        <div class="spinner" id="loading-spinner"></div>
        <div class="status-msg" id="status-msg">Preparing Payment...</div>
        <div class="status-sub" id="status-sub">Please wait while we set up your secure payment</div>
      </div>

      <!-- PRIMARY METHOD: Cashfree JS SDK v3 (uses payment_session_id) -->
      <div id="sdk-section" class="hidden">
        <button type="button" class="pay-btn" id="sdk-pay-btn" onclick="initSDKCheckout()">
          Pay Securely Now
        </button>
        <div class="status-sub" style="margin-top:8px;">Powered by Cashfree — UPI, Cards & Netbanking</div>
      </div>

      <!-- FALLBACK 1: Form POST to Cashfree (uses payment_session_id) -->
      <div id="form-section" class="hidden">
        <form method="POST" action="${formPostUrl}" id="checkout-form">
          <input type="hidden" name="payment_session_id" value="${sessionId}">
          <button type="submit" class="pay-btn">
            Pay Securely Now
          </button>
        </form>
      </div>

      <!-- FALLBACK 2: Hosted checkout link (uses order_token) -->
      ${hostedCheckoutUrl ? `
      <div id="hosted-section" class="hidden">
        <div class="or-divider">or</div>
        <a href="${hostedCheckoutUrl}" class="secondary-btn" id="direct-link">
          Open Payment Page
        </a>
      </div>
      ` : ''}

      <!-- Error state -->
      <div id="error-section" class="hidden">
        <div class="status-msg error-text">Payment Setup Failed</div>
        <div class="status-sub" id="error-msg" style="margin-bottom:16px;"></div>
        <button type="button" class="secondary-btn" onclick="location.reload()">Try Again</button>
        <a href="/" class="secondary-btn">Go Back to App</a>
      </div>
    </div>

    <div class="secure-badge">🔒 Secured by Cashfree Payments</div>
  </div>

  <!-- Load Cashfree JS SDK v3 inline -->
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js" async></script>

  <script>
    var sessionId = '${sessionId}';
    var sdkMode = '${sdkMode}';
    var sdkInitialized = false;
    var sdkLoadAttempts = 0;
    var MAX_SDK_WAIT = 10000; // 10 seconds max wait for SDK
    var sdkWaitStart = Date.now();

    // Try to initialize the Cashfree JS SDK
    function tryInitSDK() {
      if (typeof Cashfree !== 'undefined' && !sdkInitialized) {
        sdkInitialized = true;
        console.log('[Checkout] Cashfree SDK loaded successfully');
        showSDKSection();
        // Auto-init checkout after a short delay
        setTimeout(function() {
          initSDKCheckout();
        }, 500);
        return true;
      }
      return false;
    }

    function showSDKSection() {
      document.getElementById('loading-spinner').classList.add('hidden');
      document.getElementById('status-msg').textContent = 'Ready to Pay';
      document.getElementById('status-sub').textContent = 'Tap the button below to proceed';
      document.getElementById('sdk-section').classList.remove('hidden');
    }

    function showFormFallback() {
      document.getElementById('loading-spinner').classList.add('hidden');
      document.getElementById('status-msg').textContent = 'Alternative Payment Method';
      document.getElementById('status-sub').textContent = 'Use the form below to complete payment';
      document.getElementById('form-section').classList.remove('hidden');
      ${hostedCheckoutUrl ? "document.getElementById('hosted-section').classList.remove('hidden');" : ""}
    }

    function showError(msg) {
      document.getElementById('loading-spinner').classList.add('hidden');
      document.getElementById('sdk-section').classList.add('hidden');
      document.getElementById('form-section').classList.add('hidden');
      ${hostedCheckoutUrl ? "document.getElementById('hosted-section').classList.add('hidden');" : ""}
      document.getElementById('status-msg').textContent = '';
      document.getElementById('status-sub').textContent = '';
      document.getElementById('error-msg').textContent = msg;
      document.getElementById('error-section').classList.remove('hidden');
    }

    function initSDKCheckout() {
      if (typeof Cashfree === 'undefined') {
        console.warn('[Checkout] Cashfree SDK not available, showing form fallback');
        showFormFallback();
        return;
      }

      try {
        var cashfree = Cashfree({ mode: sdkMode });
        console.log('[Checkout] Initializing Cashfree checkout with payment_session_id');
        
        // Update button state
        var btn = document.getElementById('sdk-pay-btn');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner-small"></span> Redirecting to Payment...';
        }

        cashfree.checkout({
          paymentSessionId: sessionId,
          redirectTarget: '_self'
        });
      } catch (err) {
        console.error('[Checkout] SDK checkout failed:', err);
        // Show form fallback
        showFormFallback();
      }
    }

    // Wait for SDK to load with polling
    var sdkPollInterval = setInterval(function() {
      sdkLoadAttempts++;
      
      if (tryInitSDK()) {
        clearInterval(sdkPollInterval);
        return;
      }

      // If we've waited too long, show the form fallback
      if (Date.now() - sdkWaitStart > MAX_SDK_WAIT) {
        clearInterval(sdkPollInterval);
        console.warn('[Checkout] SDK load timed out, showing form fallback');
        showFormFallback();
      }
    }, 300);

    // Also try on script load event
    document.querySelector('script[src*="cashfree.js"]')?.addEventListener('load', function() {
      setTimeout(tryInitSDK, 100);
    });

    // Safety net: if nothing happens after 15 seconds, show the form
    setTimeout(function() {
      if (!sdkInitialized && document.getElementById('loading-spinner') && !document.getElementById('loading-spinner').classList.contains('hidden')) {
        console.warn('[Checkout] Safety net triggered, showing form fallback');
        showFormFallback();
      }
    }, 15000);
  </script>

  <noscript>
    <style>
      #status-area, #sdk-section, #hosted-section, #error-section { display: none !important; }
      #form-section { display: block !important; }
      #checkout-form button { display: block !important; }
    </style>
    <form method="POST" action="${formPostUrl}">
      <input type="hidden" name="payment_session_id" value="${sessionId}">
      <button type="submit" style="display:block;width:100%;padding:18px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#1a1a2e;border:none;border-radius:12px;font-size:18px;font-weight:800;cursor:pointer;">Pay Securely Now</button>
    </form>
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
