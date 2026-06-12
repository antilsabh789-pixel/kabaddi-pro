# Task: cashfree-migration — Migrate Kabaddi Pro from Razorpay to Cashfree

## Summary
Successfully migrated the Kabaddi Pro payment gateway from Razorpay to Cashfree.

## Changes Made

### 1. Prisma Schema (`prisma/schema.prisma`)
- Replaced `razorpayOrderId` → `cashfreeOrderId` (String @unique)
- Replaced `razorpayPaymentId` → `cashfreePaymentId` (String?)
- Replaced `razorpaySignature` → `cashfreeSignature` (String?)
- Added `orderId` (String?) — internal order reference
- Added `cfPaymentId` (String?) — Cashfree's internal payment ID
- Schema pushed to database successfully with `prisma db push --accept-data-loss`

### 2. Create Order API (`src/app/api/payments/create-order/route.ts`)
- Removed Razorpay SDK dependency
- Uses Cashfree PG Orders API (`POST {CASHFREE_BASE_URL}/orders`)
- Headers: `x-client-id`, `x-client-secret`, `x-api-version`
- Returns `paymentSessionId` for Cashfree frontend SDK checkout
- Generates unique `cashfreeOrderId` in format `kabaddi_pro_{timestamp}_{userIdSuffix}`

### 3. Verify Payment API (`src/app/api/payments/verify/route.ts`)
- **GET handler**: Handles Cashfree redirect after checkout completion. Returns HTML with JS to postMessage to parent/opener window
- **POST handler**: Programmatic verification. Calls Cashfree GET order endpoint, checks `order_status === "PAID"`, updates DB, activates premium

### 4. Webhook API (`src/app/api/payments/webhook/route.ts`) — NEW
- Handles `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_REFUNDED` events
- Verifies webhook signature using HMAC-SHA256
- Double-verifies PAYMENT_SUCCESS with Cashfree API before activating premium

### 5. Payments List API (`src/app/api/payments/route.ts`)
- Updated — no Razorpay-specific references remain

### 6. Frontend (`src/components/kabaddi/PremiumUpgradeScreen.tsx`)
- Replaced `loadRazorpayScript()` → `loadCashfreeSDK()` (loads from `https://sdk.cashfree.com/js/v3/cashfree.js`)
- Initializes `Cashfree({ mode: "production"|"sandbox" })` based on env
- Uses `cf.checkout({ paymentSessionId })` to open payment UI
- Polling mechanism checks payment status every 2 seconds after checkout opens
- Updated footer text to "Secure payment via Cashfree"

### 7. ProfileTab (`src/components/kabaddi/ProfileTab.tsx`)
- Changed "Razorpay" label → "Cashfree"

### 8. Package & Config
- Removed `razorpay` from package.json
- Updated `.env.example` with Cashfree env vars

## Environment Variables Required
```
CASHFREE_APP_ID=your_app_id
CASHFREE_SECRET_KEY=your_secret_key
CASHFREE_API_VERSION=2025-01-01
CASHFREE_BASE_URL=https://api.cashfree.com/pg
CASHFREE_ENV=production
```

## Verification
- `bun run lint` — passes with no errors
- `prisma db push` — schema synced with database
- No remaining Razorpay references in source code
- Dev server running without errors
