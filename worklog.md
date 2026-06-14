# Kabaddi Pro - Worklog

---
Task ID: 1
Agent: Main
Task: Fresh start - Reset all user data and fix demo OTP issue

Work Log:
- Analyzed the full project state: database schema, OTP provider system, auth API, and frontend AuthScreen
- Identified root cause of demo OTP: `isDemoMode()` in `otp-provider.ts` returned true when MSG91 env vars were missing, causing fallback to demo mode
- Deleted SQLite database (`/home/z/my-project/db/custom.db`) for fresh start
- Re-pushed Prisma schema to create empty database
- Rewrote `src/lib/otp-provider.ts`:
  - Removed `demo` provider option entirely
  - `sendOTP()` now FAILS if credentials are misconfigured instead of falling back to demo
  - `isDemoMode()` always returns `false`
  - Added `isConfigured()` helper function
- Rewrote `src/app/api/auth/route.ts`:
  - Removed all `demoOtp` fields from API responses
  - `otp-status` endpoint now returns `isDemo: false` always
  - Added `isConfigured` field to otp-status response
  - Removed `OTP_TESTER_MODE` env var dependency
- Updated `src/components/kabaddi/AuthScreen.tsx`:
  - Removed `demoOtp` state variable
  - Removed `forgotDemoOtp` state variable
  - Removed `isOtpDemoMode` state variable
  - Removed `otp-status` useEffect (no longer needed)
  - Replaced conditional demo/real OTP banners with always-visible "SMS Sent" confirmation
  - Removed demo OTP auto-fill buttons
  - Removed unused `MessageSquare` import
- Cleaned up `.env` file: removed `OTP_TESTER_MODE` and demo mode references
- Verified with API tests:
  - `otp-status` returns `{"provider":"msg91","isDemo":false,"isConfigured":true,"missingEnvVars":[]}`
  - `send-signup-otp` returns `{"message":"OTP sent successfully to your phone","resendCount":1,"provider":"msg91"}` (NO demoOtp field)
- Lint passes cleanly

Stage Summary:
- All user data has been reset (fresh empty database)
- Demo OTP mode has been completely removed from the app
- Only real MSG91 SMS OTP works now
- If MSG91 credentials are missing, the OTP send will fail with an error (not fall back to demo)
- For Vercel deployment: ensure `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, and `MSG91_TEMPLATE_ID` are set in Vercel Environment Variables

---
Task ID: 2
Agent: Main
Task: Complete database reset on Vercel and fix payment gateway error

Work Log:
- User reported: old user data still exists on Vercel, payment gateway shows "cashfreeOrderId column does not exist" error
- Root cause: vercel-build.sh only ran `prisma generate` but NOT `prisma db push`, so the PostgreSQL database schema was out of sync
- The Payment table was missing the `cashfreeOrderId` column on Vercel's PostgreSQL
- Fixed vercel-build.sh to include `prisma db push` 
- Used `--force-reset` flag for one deploy to wipe ALL data from Vercel PostgreSQL
- Then changed back to `--accept-data-loss` (normal push) for future deploys to preserve data
- Verified on Vercel:
  - Previously registered phone (+919876543210) now accepts new sign-up → database is wiped
  - Payment API returns "User not found" instead of column error → schema is fixed
  - OTP status: `{"provider":"msg91","isDemo":false,"isConfigured":true,"missingEnvVars":[]}`

Stage Summary:
- Vercel PostgreSQL database completely wiped — ALL users, matches, payments gone
- Payment table schema fixed — `cashfreeOrderId` column now exists
- Build script now properly syncs Prisma schema on every deploy
- Future deploys will preserve data (no more --force-reset)
- Local SQLite also fresh and empty

---
Task ID: 3
Agent: Main
Task: Fix OTP not receiving on phone

Work Log:
- Tested MSG91 API directly - API returns "success" but SMS not delivered
- Investigated: MSG91 OTP verify API works (OTP is stored on MSG91 servers)
- Checked account balance: MSG91 transactional SMS balance = 0 (ZERO)
- This is the ROOT CAUSE: API accepts the request but doesn't deliver SMS when balance is 0
- Added MSG91_SENDER_ID (KPAPPS) to .env and OTP provider code
- Made template_id optional in MSG91 - if not provided, uses MSG91's built-in OTP service
- Added better logging for OTP debugging
- Pushed fix to GitHub, Vercel auto-deployed
- User needs to add SMS credits to MSG91 account for OTP to actually reach phones

Stage Summary:
- Code fix deployed: sender ID added, better MSG91 API integration
- ROOT CAUSE IDENTIFIED: MSG91 account has 0 SMS balance
- ACTION NEEDED: User must add SMS credits to their MSG91 account
- Go to MSG91 Dashboard → Recharge/Add Credits → Add at least ₹100 for SMS delivery
- MSG91 gives 50 free SMS on signup - may need to check if those were used already

---
Task ID: 4
Agent: Main
Task: Fix OTP not receiving - MSG91 SMS delivery failure

Work Log:
- User reported OTP not being received on phone
- Tested MSG91 API directly - returns "success" but SMS not delivered
- User screenshots revealed:
  1. MSG91 wallet has ₹50 balance (not 0 as initially suspected)
  2. MSG91 sent "Alert for Failed SMS API" email with error code 400
- Error 400 = SMS rejected by telecom operators due to DLT (Distributed Ledger Technology) non-compliance
- ROOT CAUSE: Custom template + sender ID (KPAPPS) is NOT DLT-approved
- India requires all commercial SMS to go through DLT-registered entities since 2020
- Without DLT registration, MSG91 accepts the API request but telecom operators reject the SMS
- FIX: Use MSG91's built-in OTP service (no custom template/sender needed)
  - MSG91's own service uses their DLT-registered sender = guaranteed delivery
  - Removed MSG91_TEMPLATE_ID and MSG91_SENDER_ID from .env
  - Made template_id optional in OTP provider code
  - Updated otp-status endpoint to not require template_id
- Vercel still has MSG91_TEMPLATE_ID set - needs to be removed from Vercel Dashboard

Stage Summary:
- Code fix deployed to Vercel
- CRITICAL: User must remove MSG91_TEMPLATE_ID from Vercel Environment Variables
  - Go to Vercel Dashboard → Settings → Environment Variables
  - Delete "MSG91_TEMPLATE_ID" variable
  - Delete "MSG91_SENDER_ID" variable (if exists)
  - Redeploy (push any commit or click Redeploy)
- Alternative: If user gets DLT approval for their template/sender, they can add them back
