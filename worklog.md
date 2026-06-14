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
