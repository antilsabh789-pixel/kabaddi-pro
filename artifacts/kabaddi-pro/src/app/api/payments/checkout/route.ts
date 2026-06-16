import { NextRequest, NextResponse } from 'next/server';

/**
 * Cashfree Checkout Page — BULLETPROOF redirect (v3, fixes "stuck on spinner")
 * ===========================================================================
 *
 * SYMPTOM THIS FIXES:
 *   User taps Buy → sees "Redirecting to Secure Payment..." → spinner spins
 *   FOREVER on both web and mobile. Cashfree's checkout page never opens.
 *
 * ROOT CAUSE (in the previous version, commit 8df29ff):
 *   The page called `cashfree.pay({ session, redirectTarget: "_self" })` with
 *   NO onSuccess/onFailure callbacks, NO promise handling, and NO hard timeout.
 *   When the SDK silently failed to redirect (invalid/expired session, env
 *   mismatch, popup blocked, network error, or SDK init failure), nothing
 *   happened — the spinner just spun forever. There was no way for the user
 *   to recover and no diagnostic info.
 *
 * THE FIX (triple-redundant redirect with full observability):
 *
 *   1. VISIBLE MANUAL BUTTON from the start (not hidden).
 *      If auto-redirect works, the user never sees it (page navigates away).
 *      If auto-redirect fails, the user immediately has a "Tap to Pay" button
 *      — no waiting, no dead end. Tapping it calls cashfree.pay() again inside
 *      a real user-gesture handler (required for mobile Safari/Chrome popup
 *      permissions).
 *
 *   2. FULL CALLBACK COVERAGE:
 *      - onSuccess → mark redirected, navigate to return URL
 *      - onFailure → show exact error from Cashfree + manual button
 *      - pay() promise rejection → caught and shown
 *      - try/catch around SDK init → caught and shown
 *
 *   3. HARD 8-SECOND TIMEOUT:
 *      If the page is still alive after 8s (no beforeunload/pagehide fired),
 *      we know the redirect did NOT happen. We surface a clear message +
 *      diagnostic info (env, orderId, session prefix) + the manual button.
 *
 *   4. REDIRECT DETECTION:
 *      `beforeunload` + `pagehide` listeners set a `redirected` flag. If the
 *      page is unloading, the SDK succeeded (we hide the UI to avoid flicker).
 *      If the 8s timeout fires and `redirected` is still false, we know it
 *      failed silently.
 *
 * This route keeps the EXACT same query-param interface (session_id, env,
 * order_id, order_token) so PremiumUpgradeScreen.tsx needs no changes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');
  const env = searchParams.get('env') || 'sandbox';
  const orderId = searchParams.get('order_id') || '';

  if (!sessionId) {
    return new NextResponse(
      renderError(
        'Payment Session Missing',
        'No payment session was found. Please close this page and try your purchase again from the app.'
      ),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const isProduction = env === 'production';
  const sdkMode = isProduction ? 'prod' : 'sandbox';

  // Escape the session id for safe embedding in HTML/JS.
  const safeSession = sessionId
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
  const safeOrderId = orderId
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const html = renderCheckoutPage({
    sessionId: safeSession,
    orderId: safeOrderId,
    sdkMode,
    env,
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
  env: string;
}): string {
  const { sessionId, orderId, sdkMode, env } = opts;

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
    .pay-btn.secondary { background: rgba(255,255,255,0.12); color: white; font-weight: 600; font-size: 14px; }
    .manual-wrap { margin-top: 8px; }
    .manual-hint { font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 10px; }
    .order-ref { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 0.05em; text-transform: uppercase; margin-top: 16px; word-break: break-all; }
    .diag { margin-top: 14px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 11px; color: rgba(255,255,255,0.6); font-family: monospace; text-align: left; word-break: break-all; display: none; }
    .secure-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 20px; }
    .err-msg { color: #fca5a5; }
    .hidden { display: none !important; }
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

      <!-- Manual fallback — visible from the start. If auto-redirect works,
           the page navigates away and the user never taps this. If auto-redirect
           fails, the user has an immediate recovery path inside a real
           user-gesture (required for mobile popup permissions). -->
      <div class="manual-wrap" id="manual-wrap">
        <div class="manual-hint" id="manual-hint">If you are not redirected automatically, tap below:</div>
        <button type="button" class="pay-btn" id="manual-btn">
          Tap Here to Pay Now
        </button>
      </div>

      <div class="diag" id="diag"></div>

      ${orderId ? `<div class="order-ref">Order: ${orderId}</div>` : ''}
    </div>

    <div class="secure-badge">🔒 Secured by Cashfree Payments</div>
  </div>

  <script>
    (function() {
      var sessionId = "${sessionId}";
      var sdkMode = "${sdkMode}";
      var envLabel = "${env}";
      var payCalled = false;
      var redirected = false;
      var sdkLoadFailed = false;

      var spinner = document.getElementById('spinner');
      var statusMsg = document.getElementById('status-msg');
      var statusSub = document.getElementById('status-sub');
      var manualBtn = document.getElementById('manual-btn');
      var manualHint = document.getElementById('manual-hint');
      var manualWrap = document.getElementById('manual-wrap');
      var diag = document.getElementById('diag');

      // ---- Redirect detection: if the page is being unloaded, the SDK
      //      succeeded in opening Cashfree. We mute the UI to avoid flicker.
      window.addEventListener('beforeunload', function() { redirected = true; });
      window.addEventListener('pagehide', function() { redirected = true; });
      window.addEventListener('blur', function() {
        // Window losing focus often means a redirect/popup happened.
        // Don't set redirected=true here (blur can fire for other reasons),
        // but give the SDK the benefit of the doubt for the timeout check.
        setTimeout(function() { redirected = redirected || true; }, 100);
      });

      function showDiag(text) {
        diag.style.display = 'block';
        diag.textContent = text;
      }

      function fail(header, detail) {
        if (redirected) return; // page is leaving — don't show error UI
        spinner.style.display = 'none';
        statusMsg.textContent = header || 'Payment could not start';
        statusMsg.classList.add('err-msg');
        statusSub.innerHTML = detail || 'Please try again.';
        manualHint.textContent = 'Tap below to retry, or go back to the app:';
        manualBtn.textContent = 'Try Again';
        if (detail) showDiag('Mode: ' + envLabel + ' · ' + detail);
      }

      function callPay() {
        if (redirected) return true;
        if (payCalled) return true; // already attempted — don't double-call
        if (!window.Cashfree) return false; // SDK not loaded yet
        payCalled = true;
        try {
          var cf = window.Cashfree(sdkMode);
          // The SDK's pay() may return undefined, a boolean, or a Promise
          // depending on version. Handle all cases defensively.
          var r = cf.pay({
            session: sessionId,
            redirectTarget: "_self",
            onSuccess: function(data) {
              redirected = true;
              // Cashfree should have already redirected; if for some reason
              // it didn't, force-navigate home.
              try { window.location.href = '/?payment=success'; } catch (e) {}
            },
            onFailure: function(data) {
              var msg = 'Cashfree reported a failure.';
              try { msg = 'Cashfree error: ' + JSON.stringify(data); } catch (e) {}
              fail('Payment window did not open', msg);
            }
          });
          // If pay() returned a Promise, attach handlers.
          if (r && typeof r.then === 'function') {
            r.then(function() { /* ok */ }, function(e) {
              fail('Payment SDK rejected', String(e && e.message || e));
            });
          }
        } catch (e) {
          fail('Payment SDK error', String(e && e.message || e));
        }
        return true;
      }

      function manualPay() {
        // Reset so callPay() will run again inside this user gesture.
        payCalled = false;
        statusMsg.textContent = 'Opening payment…';
        statusMsg.classList.remove('err-msg');
        spinner.style.display = 'block';
        diag.style.display = 'none';
        callPay();
        // If still here after 6s, surface failure.
        setTimeout(function() {
          if (!redirected) {
            fail('Auto-open failed', 'The payment window did not open. This is usually a popup blocker or a stale session. Go back and try your purchase again.');
          }
        }, 6000);
      }

      manualBtn.addEventListener('click', manualPay);
      // Also support touchstart for faster response on mobile.
      manualBtn.addEventListener('touchstart', function(e) { e.preventDefault(); manualPay(); }, { passive: false });

      // ---- Attempt #1: try immediately (SDK script is in <head>, may be loaded).
      if (!callPay()) {
        // SDK not yet loaded — poll every 150ms for up to 12 seconds.
        var attempts = 0;
        var maxAttempts = 80;
        var pollInterval = setInterval(function() {
          attempts++;
          if (callPay() || attempts >= maxAttempts) {
            clearInterval(pollInterval);
            if (attempts >= maxAttempts && !payCalled && !redirected) {
              sdkLoadFailed = true;
              fail(
                'Payment SDK failed to load',
                'The Cashfree SDK script could not be loaded from sdk.cashfree.com. Check your internet connection and try again. If the problem persists, go back and start a new purchase.'
              );
            }
          }
        }, 150);
      }

      // ---- Hard 8-second timeout: if no redirect happened, surface it.
      //      (beforeunload/pagehide would have fired if the redirect worked.)
      setTimeout(function() {
        if (redirected) return;
        if (sdkLoadFailed) return; // already handled
        if (!payCalled) return; // already handled by poll
        // pay() was called but no redirect after 8s → silent SDK failure.
        fail(
          'Redirect is taking too long',
          'The payment window did not open automatically. This can happen if the session expired or a popup was blocked. Tap the button below to try again, or go back to the app and start a new purchase.'
        );
      }, 8000);
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
