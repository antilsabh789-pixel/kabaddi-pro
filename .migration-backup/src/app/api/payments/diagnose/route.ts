import { NextResponse } from "next/server";

/**
 * GET /api/payments/diagnose
 *
 * Diagnostic endpoint — open this URL on the FAILING PHONE to see exactly
 * which Cashfree environment variables the server sees. Helps spot
 * sandbox/prod mismatches that cause "Invalid Session ID".
 */
export async function GET() {
  const appId = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  const isLiveRaw = process.env.CASHFREE_IS_LIVE;
  const envRaw = process.env.CASHFREE_ENV;

  const isLive =
    isLiveRaw === "true" ||
    isLiveRaw === "1" ||
    envRaw === "production";

  const checks: Record<string, string> = {
    keysPresent: !!appId && !!secret ? "ok" : "ERROR: CASHFREE_APP_ID or CASHFREE_SECRET_KEY is missing",
    liveModeWithoutKeys:
      isLive && (!appId || !secret)
        ? "ERROR: CASHFREE_IS_LIVE=true but keys are missing"
        : "ok",
    sandboxKeysOnLive:
      appId && isLive && appId.startsWith("T")
        ? "ERROR: CASHFREE_IS_LIVE=true but APP_ID starts with 'T' (test key). Use prod keys."
        : appId && !isLive && /^\d/.test(appId)
        ? "WARN: CASHFREE_IS_LIVE=false but APP_ID looks like a prod key. Set CASHFREE_IS_LIVE=true."
        : "ok",
  };

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json({
    status: allOk ? "ALL_OK" : "HAS_ISSUES",
    config: {
      CASHFREE_APP_ID_set: !!appId,
      CASHFREE_APP_ID_prefix: appId ? appId.slice(0, 4) + "…" : null,
      CASHFREE_SECRET_KEY_set: !!secret,
      CASHFREE_IS_LIVE_raw: isLiveRaw ?? "(unset)",
      CASHFREE_ENV_raw: envRaw ?? "(unset)",
      CASHFREE_IS_LIVE_parsed: isLive,
      NODE_ENV: process.env.NODE_ENV,
    },
    endpoint: isLive
      ? "https://api.cashfree.com/pg (PROD)"
      : "https://sandbox.cashfree.com/pg (SANDBOX)",
    checks,
    nextSteps: allOk
      ? ["Config looks correct. If still failing, check: (1) NEXT_PUBLIC_BASE_URL matches Cashfree dashboard, (2) the checkout page loads the SDK, (3) tester is using the latest app build."]
      : [
          "Fix the ERRORs above in Vercel → Settings → Environment Variables → Production",
          "CASHFREE_IS_LIVE must be 'true' for live payments (not 'false')",
          "CASHFREE_APP_ID must be a prod key (numeric), not a test key (T-xxx)",
          "Redeploy after changing env vars",
        ],
  });
}
