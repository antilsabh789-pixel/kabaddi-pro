import { NextRequest, NextResponse } from 'next/server';

/**
 * Cashfree Checkout Page — JS SDK v3 with redirectTarget "_self"
 * =================================================================
 *
 * FIX for "Invalid Session ID" on mobile (2026-06-16):
 *
 * The previous version used a form POST to /pg/view/sessions/checkout.
 * That endpoint is NOT a documented Cashfree endpoint for direct form POST —
 * it's an internal SDK endpoint. Cashfree receives the POST but can't
 * validate the session in that context, so it shows "Invalid Session ID"
 * (especially on mobile, where cookie/header context differs from desktop).
 *
 * The DOCUMENTED, reliable method is the Cashfree JS SDK v3 with
 * redirectTarget: "_self", which does a full-page redirect to Cashfree's
 * hosted checkout. This works on every browser, TWA, and WebView.
 *
 * This route keeps the EXACT same query-param interface as before
 * (session_id, env, order_id) so the frontend doesn't need to change.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const env = searchParams.get('env') || 'sandbox';
  const orderId = searchParams.get('order_id') || '';

  // Validate required parameter
  if (!sessionId) {
    return new NextResponse(renderError('Payment Session Missing', 'No payment session was found. Please close this page and try your purchase again from the app.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const isProduction = env === 'production';
  const sdkMode = isProduction ? 'prod' : 'sandbox';

  // Escape the session id for safe embedding in HTML/JS
  const safeSession = sessionId
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  const html = renderCheckoutPage({
    sessionId: safeSession,
    orderId,
    sdkMode,
  });

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

function renderCheckoutPage(opts: {
  sessionId: string;
  orderId: string;
  sdkMode: string;
}): string {
  const { sessionId, orderId, sdkMode } = opts;

  return `<!DOCTYPE html>
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
    .container { text-align: center; max-width: 420px; width: 100%; }
    .logo { font-size: 18px; font-weight: 900; letter-spacing: 0.1em; color: #f59e0b; margin-bottom: 8px; }
    .logo-sub { font-size: 12px; color: rgba(255,255,255,0.5); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 24px; }
    .card { background: rgba(255,255,255,0.08); border-radius: 16px; padding: 28px; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); }
    .spinner { width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.15); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-msg { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
    .status-sub { font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.5; margin-bottom: 20px; }
    .pay-btn { display: block; width: 100%; padding: 16px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #1a1a2e; border: none; border-radius: 12px; font-size: 16px; font-weight: 800; cursor: pointer; -webkit-tap-highlight-color: transparent; text-decoration: none; text-align: center; letter-spacing: 0.02em; margin-bottom: 12px; }
    .pay-btn:active { transform: scale(0.98); }
    .order-ref { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.05em; text-transform: uppercase; margin-top: 16px; word-break: break-all; }
    .secure-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 20px; }
    .err-msg { color: #f87171; }
  </style>
  <!-- Cashfree JS SDK v3 — the official, documented client integration -->
  <script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script>
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

      <button type="button" class="pay-btn" id="manual-btn" style="display:none;">
        Tap Here to Pay Now
      </button>

      ${orderId ? `<div class="order-ref">Order: ${orderId}</div>` : ''}
    </div>

    <div class="secure-badge">🔒 Secured by Cashfree Payments</div>
  </div>

  <script>
    (function() {
      var sessionId = "${sessionId}";
      var sdkMode = "${sdkMode}";
      var submitted = false;

      function fail(msg) {
        var spinner = document.getElementById('spinner');
        if (spinner) spinner.style.display = 'none';
        var statusMsg = document.getElementById('status-msg');
        if (statusMsg) { statusMsg.textContent = 'Payment could not start'; statusMsg.classList.add('err-msg'); }
        var statusSub = document.getElementById('status-sub');
        if (statusSub) statusSub.innerHTML = msg;
        var btn = document.getElementById('manual-btn');
        if (btn) {
          btn.style.display = 'block';
          btn.textContent = 'Try Again';
          btn.onclick = function() { window.location.href = '/'; };
        }
      }

      function startPayment() {
        if (submitted) return true;
        if (!window.Cashfree) {
          return false;
        }
        submitted = true;
        try {
          var cashfree = window.Cashfree(sdkMode);
          // redirectTarget: "_self" → full-page redirect to Cashfree.
          // This is the ONLY mode that works reliably inside a TWA / WebView.
          // No iframe, no modal, no cross-origin issues.
          cashfree.pay({
            session: sessionId,
            redirectTarget: "_self"
          });
        } catch (e) {
          console.error('Cashfree SDK error:', e);
          fail('The payment SDK encountered an error. Please try again.');
        }
        return true;
      }

      // Try to start payment immediately (SDK script is in <head>, may already be loaded)
      if (!startPayment()) {
        // SDK not yet loaded — poll every 200ms for up to 10 seconds
        var attempts = 0;
        var maxAttempts = 50;
        var pollInterval = setInterval(function() {
          attempts++;
          if (startPayment() || attempts >= maxAttempts) {
            clearInterval(pollInterval);
            if (attempts >= maxAttempts && !submitted) {
              fail('The payment SDK took too long to load. Check your connection and try again.');
            }
          }
        }, 200);
      }
    })();
  </script>

  <noscript>
    <div style="text-align:center; margin-top: 20px;">
      <p style="color: white; margin-bottom: 16px;">JavaScript is required for payment. Please enable it and refresh.</p>
    </div>
  </noscript>
</body>
</html>`;
}

function renderError(title: string, message: string): string {
  return `<!DOCTYPE html>
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
    <div class="error-title">${title}</div>
    <div class="error-msg">${message}</div>
    <a href="/" class="back-btn">Go Back to App</a>
  </div>
</body>
</html>`;
}
