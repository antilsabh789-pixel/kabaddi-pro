# Task 2 - AuthScreen Rewrite: Remove OTP, Add Password Auth with DOB Reset

## Summary
Rewrote the AuthScreen component to completely remove OTP-based authentication and replace it with simple password-based auth with Date of Birth for password reset verification.

## Changes Made

### 1. `src/components/kabaddi/AuthScreen.tsx` (Complete Rewrite)
**Before:** ~2006 lines with OTP flow (send-signup-otp → verify-signup-otp → set-password → register)
**After:** ~850 lines with simple password auth

**Removed:**
- `OTPInput` component
- `CountdownTimer` component
- `SignupStep` type (no multi-step signup)
- All OTP state variables and handlers
- Imports: Mail, Smartphone, Timer, RefreshCw

**New Components:**
- `DOBPicker` - Day/Month/Year dropdown selector with smart day count (leap year aware)
- `ErrorMessage` - Reusable error message component

**New Signup Flow (single form):**
1. Phone (+91) with availability check
2. Name
3. Password (with strength meter + show/hide)
4. Confirm Password (with show/hide + match indicator)
5. Date of Birth (3 dropdowns)
6. Terms checkbox
7. "Sign Up" button → `action: 'register'`

**New Login Flow:**
1. Phone + Password → "Sign In" button → `action: 'login'`
2. "Forgot Password?" link

**New Forgot Password Flow:**
1. Phone + DOB → "Verify" → `action: 'forgot-password-verify'`
2. New Password + Confirm → "Reset Password" → `action: 'reset-password'`
3. Success → "Login Now"

**Phone Check Feature:**
- Debounced 500ms API call when 10 digits entered
- Shows loading spinner
- Amber "Already registered? Login instead" banner

### 2. `src/app/api/auth/route.ts` (Already updated in Task 12)
- `check-phone` action returns `{ exists: boolean }`
- `forgot-password-verify` verifies phone + DOB match
- `register` no longer requires OTP verification token
- `reset-password` uses DOB-based verification token

### 3. `prisma/schema.prisma` (Already updated in Task 12)
- `dateOfBirth String?` field exists on User model
- `phoneVerified` defaults to `true`

## Verification
- `bun run lint` passes cleanly
- Dev server running on port 3000
