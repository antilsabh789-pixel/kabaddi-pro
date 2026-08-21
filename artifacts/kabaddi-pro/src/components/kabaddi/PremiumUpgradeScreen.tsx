'use client';

/**
 * PremiumUpgradeScreen
 *
 * Full-screen upgrade modal showing premium plans + coupon code input.
 * On tap "Pay", creates a Cashfree order via /api/payments/create-order
 * and uses Cashfree's official JS SDK (cashfree.js v3) to open the
 * checkout page. The SDK is the ONLY documented way to open Cashfree's
 * hosted checkout — there is no direct GET URL.
 *
 * On success, Cashfree redirects back to /?payment=success&order_id=...
 * and the page.tsx return handler calls /api/payments/verify which
 * grants premium.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Crown,
  Check,
  Loader2,
  Sparkles,
  Zap,
  Shield,
  Gift,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { useBackButton } from '@/hooks/use-back-button';

interface Plan {
  id: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
  label: string;
  priceInr: string;
  per: string;
  badge?: string;
  highlight?: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    id: 'daily',
    label: 'Daily',
    priceInr: '2',
    per: '/ day',
    badge: 'Try for ₹2',
    features: ['All premium features', 'Direct giveaway entry', '24 hours of premium'],
  },
  {
    id: 'weekly',
    label: 'Weekly',
    priceInr: '27',
    per: '/ week',
    features: ['All premium features', 'Direct giveaway entry', '7 days of premium', '₹3/day effective'],
  },
  {
    id: 'monthly',
    label: 'Monthly',
    priceInr: '99',
    per: '/ month',
    highlight: true,
    badge: 'Most Popular',
    features: ['All premium features', 'Direct giveaway entry', '30 days of premium', '₹3.3/day effective'],
  },
  {
    id: 'yearly',
    label: 'Yearly',
    priceInr: '999',
    per: '/ year',
    badge: 'Best Value',
    features: ['All premium features', 'Direct giveaway entry', '365 days of premium', '₹2.7/day effective'],
  },
  {
    id: 'lifetime',
    label: 'Lifetime',
    priceInr: '3299',
    per: 'one-time',
    features: ['All premium features', 'Direct giveaway entry', 'Forever — never pay again', 'Priority support'],
  },
];

// ─── Cashfree JS SDK loader ──────────────────────────────────────────
// Dynamically loads the Cashfree drop-in JS SDK from their CDN. The SDK
// is the ONLY documented way to open Cashfree's hosted checkout — there
// is no direct GET URL that works (we tried payments.cashfree.com/checkout
// and it returns 404 — that URL doesn't exist).
//
// The SDK is loaded dynamically (instead of being added to index.html) so
// that it only loads when the user actually taps "Pay" (saves ~50KB for
// non-paying users) and so we can detect load failures and show a
// manual fallback button.
declare global {
  interface Window {
    Cashfree?: (config: { mode: 'production' | 'sandbox' }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget?: '_self' | '_blank' | '_modal' }) => void;
    };
  }
}

let cashfreeSdkPromise: Promise<typeof window.Cashfree | null> | null = null;

function loadCashfreeSDK(): Promise<typeof window.Cashfree | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  // Return cached promise if already loading/loaded (dedup concurrent calls)
  if (cashfreeSdkPromise) return cashfreeSdkPromise;
  // Already loaded on window
  if (window.Cashfree) {
    cashfreeSdkPromise = Promise.resolve(window.Cashfree);
    return cashfreeSdkPromise;
  }
  cashfreeSdkPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) {
        console.log('[premium] Cashfree SDK loaded successfully');
        resolve(window.Cashfree);
      } else {
        console.error('[premium] Cashfree SDK loaded but window.Cashfree is not set');
        resolve(null);
      }
    };
    script.onerror = (e) => {
      console.error('[premium] Failed to load Cashfree SDK from CDN:', e);
      cashfreeSdkPromise = null; // allow retry on next attempt
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return cashfreeSdkPromise;
}

export default function PremiumUpgradeScreen({ onClose, feature }: { onClose: () => void; feature?: string }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<Plan['id']>('monthly');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountInr: string; finalInr: string; baseInr: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [paying, setPaying] = useState(false);

  useBackButton(true, onClose);

  const selectedPlanData = PLANS.find((p) => p.id === selectedPlan)!;

  // Extension context — if user is already premium, show their current plan
  // + expiry banner and label the CTA "Extend" instead of "Pay".
  const isAlreadyPremium = !!currentUser?.isPremium || !!currentUser?.isAdmin;
  const currentPlanId = currentUser?.premiumPlan as Plan['id'] | undefined;
  const currentPlanLabel = currentPlanId
    ? PLANS.find((p) => p.id === currentPlanId)?.label || currentPlanId
    : null;
  const expiryText = (() => {
    if (!currentUser?.premiumExpiry) return null;
    if (currentUser.premiumPlan === 'lifetime') return 'Lifetime';
    const d = new Date(currentUser.premiumExpiry);
    const now = Date.now();
    if (d.getTime() < now) return 'Expired';
    const daysLeft = Math.max(0, Math.ceil((d.getTime() - now) / 86400000));
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${daysLeft}d left`;
  })();

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      toast({ title: 'Enter a coupon code', variant: 'destructive' });
      return;
    }
    setValidating(true);
    try {
      const res = await fetch('/api/payments/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan, couponCode: couponCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        toast({ title: 'Invalid coupon', description: data.error || 'Code is invalid, expired, or exhausted.', variant: 'destructive' });
        setAppliedCoupon(null);
        return;
      }
      setAppliedCoupon({
        code: couponCode.trim().toUpperCase(),
        discountInr: data.discountInr,
        finalInr: data.finalInr,
        baseInr: data.baseInr,
      });
      toast({ title: 'Coupon applied!', description: `₹${data.discountInr} off — pay ₹${data.finalInr}` });
    } catch {
      toast({ title: 'Network error', description: 'Could not validate coupon. Try again.', variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  const handlePay = async () => {
    if (!currentUser?.id) {
      toast({ title: 'Please log in first', variant: 'destructive' });
      return;
    }
    setPaying(true);
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          plan: selectedPlan,
          couponCode: appliedCoupon?.code || couponCode.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Distinguish network errors from gateway errors so the user gets
        // an actionable message instead of a vague "Could not start payment".
        if (res.status >= 500) {
          toast({
            title: 'Server error',
            description: data?.error || 'The payment server is unavailable. Please try again in a moment.',
            variant: 'destructive',
          });
        } else if (res.status === 401 || res.status === 403) {
          toast({
            title: 'Payment not configured',
            description: 'Cashfree credentials are missing or invalid on the server. Please contact support.',
            variant: 'destructive',
          });
        } else if (res.status === 409) {
          toast({
            title: 'Session expired',
            description: data?.error || 'Your session has expired. Please log out and log in again.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Could not start payment',
            description: data?.error || `Server returned ${res.status}`,
            variant: 'destructive',
          });
        }
        return;
      }
      if (!data.paymentSessionId) {
        toast({ title: 'Payment error', description: 'No payment session returned.', variant: 'destructive' });
        return;
      }

      // ─── Persist pending payment state BEFORE redirecting ────────────
      // This is CRITICAL for the mobile PWA case. When the PWA redirects to
      // Cashfree, on Android the system often opens Cashfree in Chrome (NOT
      // inside the PWA). After payment, Cashfree redirects back to
      // /?payment=success&order_id=... — but that redirect lands in Chrome,
      // not in the PWA. The user then has to manually switch back to the PWA.
      //
      // When they do, the PWA's URL has NOT changed (it's still on
      // PremiumUpgradeScreen), so the page.tsx payment-return useEffect
      // never fires. The only way for the PWA to discover the payment
      // completed is via the `pendingPaymentOrderId` flag in localStorage,
      // which the visibilitychange listener (added in page.tsx) reads when
      // the PWA regains focus.
      //
      // We also store a `startedAt` timestamp so the page.tsx handler can
      // detect "bounce-backs" (Cashfree returning immediately without
      // showing the payment page — which means the session was invalid,
      // env was mismatched, or the gateway rejected the request).
      if (data.orderId) {
        try {
          localStorage.setItem('pendingPaymentOrderId', String(data.orderId));
          localStorage.setItem('pendingPaymentPlan', String(selectedPlan));
          localStorage.setItem(
            'pendingPaymentStartedAt',
            JSON.stringify({ orderId: String(data.orderId), startedAt: Date.now() }),
          );
        } catch { /* localStorage may be unavailable (private mode) — non-fatal */ }
      }

      // ─── Open Cashfree checkout via official JS SDK ─────────────────
      // Per Cashfree's official documentation (cashfree.com/docs/payments/
      // online/web/redirect), the JS SDK is the ONLY documented way to open
      // Cashfree's hosted checkout. There is NO direct GET URL that works —
      // payments.cashfree.com/checkout returns 404 (we tried it).
      //
      // The SDK uses cashfree.checkout({paymentSessionId, redirectTarget}).
      // With redirectTarget: '_self' (the default), the SDK navigates the
      // current page to Cashfree's hosted checkout at api.cashfree.com/checkout.
      // After payment, Cashfree redirects back to our return_url
      // (/?payment=success&order_id=...) which page.tsx handles.
      const sessionId = String(data.paymentSessionId);
      const env = data.env || 'sandbox';

      // Defensive: if the session ID looks malformed, show an error.
      if (!sessionId || sessionId.length < 10) {
        toast({
          title: 'Payment error',
          description: 'The payment gateway returned an invalid session. Please try again.',
          variant: 'destructive',
        });
        try {
          localStorage.removeItem('pendingPaymentOrderId');
          localStorage.removeItem('pendingPaymentPlan');
          localStorage.removeItem('pendingPaymentStartedAt');
        } catch { /* noop */ }
        return;
      }

      // Log everything we can to help diagnose any future failures.
      console.log('[premium] Opening Cashfree checkout via SDK', {
        env,
        sessionLength: sessionId.length,
        sessionPreview: sessionId.slice(0, 8) + '...',
        orderId: data.orderId,
      });

      // Load the Cashfree SDK dynamically, then open the checkout.
      try {
        const cashfree = await loadCashfreeSDK();
        if (!cashfree) {
          throw new Error('SDK failed to load from CDN');
        }
        // Initialize with the correct mode (sandbox or production).
        // CRITICAL: This mode MUST match the env used to create the order
        // on the backend. If they mismatch, Cashfree returns "Invalid
        // Session ID" because the session exists in one env but the SDK
        // is looking for it in the other.
        const mode = env === 'production' ? 'production' : 'sandbox';
        console.log('[premium] Initializing Cashfree SDK with mode:', mode);
        const cf = cashfree({ mode });
        // Open the checkout. redirectTarget: '_self' navigates the current
        // page to Cashfree's hosted checkout.
        cf.checkout({
          paymentSessionId: sessionId,
          redirectTarget: '_self',
        });
        console.log('[premium] Cashfree checkout() called — should redirect now');
      } catch (sdkErr) {
        console.error('[premium] Cashfree SDK error:', sdkErr);
        // Show a clear error to the user with a retry option.
        toast({
          title: 'Could not open payment page',
          description: 'The Cashfree SDK failed to load. Check your internet connection and try again.',
          variant: 'destructive',
        });
        try {
          localStorage.removeItem('pendingPaymentOrderId');
          localStorage.removeItem('pendingPaymentPlan');
          localStorage.removeItem('pendingPaymentStartedAt');
        } catch { /* noop */ }
      }
    } catch (err) {
      console.error('Premium payment error:', err);
      toast({ title: 'Network error', description: 'Could not reach the payment server. Please check your connection and try again.', variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  // Compute displayed price
  const displayPrice = appliedCoupon?.finalInr || selectedPlanData.priceInr;
  const hasDiscount = appliedCoupon && appliedCoupon.discountInr !== '0.00';

  return (
    <div className="fixed inset-0 z-[70] bg-warm-50 dark:bg-warm-900 flex flex-col">
      {/* Header */}
      <motion.div
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-20 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white shadow-md"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-base flex items-center gap-2">
              <Crown className="w-4 h-4" /> {isAlreadyPremium ? 'Extend Premium' : 'Go Premium'}
            </h1>
            <p className="text-[11px] text-white/80">
              {isAlreadyPremium
                ? 'Pick a plan to extend or upgrade your premium'
                : feature ? `Unlock ${feature}` : 'Unlock all premium features'}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto w-full pb-28">
        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 border border-amber-200 dark:border-amber-800/40 p-5 mb-5 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white shadow-lg mx-auto mb-3">
            <Crown className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-amber-800 dark:text-amber-300">Kabaddi Pro Premium</h2>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">
            Unlock every feature + free direct entry to every giveaway round.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-lg bg-white/60 dark:bg-warm-800/60 p-2">
              <Sparkles className="w-4 h-4 text-amber-500 mx-auto mb-0.5" />
              <p className="text-[9px] font-bold text-warm-700 dark:text-warm-300">All Features</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-warm-800/60 p-2">
              <Gift className="w-4 h-4 text-amber-500 mx-auto mb-0.5" />
              <p className="text-[9px] font-bold text-warm-700 dark:text-warm-300">Giveaway Entry</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-warm-800/60 p-2">
              <Shield className="w-4 h-4 text-amber-500 mx-auto mb-0.5" />
              <p className="text-[9px] font-bold text-warm-700 dark:text-warm-300">Priority</p>
            </div>
          </div>
        </motion.div>

        {/* Current-plan banner — only for users who already have premium */}
        {isAlreadyPremium && (currentPlanLabel || expiryText) && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 p-3 mb-4 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                You{currentPlanLabel ? `'re on the ${currentPlanLabel} plan` : ' have premium'}
              </p>
              {expiryText && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-500/80 mt-0.5">
                  {expiryText}
                </p>
              )}
            </div>
            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-1 rounded-full shrink-0">
              ACTIVE
            </span>
          </motion.div>
        )}

        {/* Plans */}
        <div className="space-y-2.5 mb-5">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const isCurrentPlan = isAlreadyPremium && currentPlanId === plan.id;
            return (
              <motion.button
                key={plan.id}
                onClick={() => {
                  setSelectedPlan(plan.id);
                  setAppliedCoupon(null); // reset coupon when plan changes
                }}
                className={`w-full text-left rounded-2xl border-2 p-4 transition-all active:scale-[0.99] ${
                  isSelected
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 shadow-md'
                    : 'border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-amber-500 border-amber-500' : 'border-warm-300 dark:border-warm-600'}`}>
                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{plan.label}</p>
                      {plan.badge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                          plan.highlight
                            ? 'bg-amber-500 text-white'
                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                        }`}>
                          {plan.badge}
                        </span>
                      )}
                      {isCurrentPlan && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-0.5">{plan.features[0]}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-amber-700 dark:text-amber-400">₹{plan.priceInr}</p>
                    <p className="text-[10px] text-warm-500">{plan.per}</p>
                  </div>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/40 space-y-1"
                  >
                    {plan.features.map((f, i) => (
                      <p key={i} className="text-[10px] text-warm-600 dark:text-warm-300 flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-500 shrink-0" /> {f}
                      </p>
                    ))}
                    {isCurrentPlan && (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 pt-1">
                        <Check className="w-3 h-3 shrink-0" /> Buying this plan will EXTEND your premium from {expiryText || 'today'}.
                      </p>
                    )}
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Coupon input */}
        <div className="rounded-2xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 p-3 mb-5">
          <p className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-2 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-500" /> Have a coupon code?
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setAppliedCoupon(null);
              }}
              placeholder="e.g., KABADDI50"
              className="flex-1 h-10 rounded-xl uppercase"
              disabled={validating}
            />
            <Button
              onClick={validateCoupon}
              disabled={validating || !couponCode.trim()}
              variant="outline"
              className="h-10 px-4 rounded-xl border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
          {appliedCoupon && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40"
            >
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="w-3 h-3" /> {appliedCoupon.code} applied
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5">
                Base ₹{appliedCoupon.baseInr} − ₹{appliedCoupon.discountInr} = ₹{appliedCoupon.finalInr}
              </p>
            </motion.div>
          )}
          <p className="text-[9px] text-warm-400 mt-2">
            Try KABADDI50 (50% off), FIRST100 (₹100 off), PRO2025 (25% off), LAUNCH20 (20% off).
          </p>
        </div>

        {/* Trust badges */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 p-2.5 text-center">
            <Shield className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-[9px] font-bold text-warm-700 dark:text-warm-300">Secure Payment</p>
            <p className="text-[8px] text-warm-400">Cashfree</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 p-2.5 text-center">
            <Zap className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <p className="text-[9px] font-bold text-warm-700 dark:text-warm-300">Instant Activation</p>
            <p className="text-[8px] text-warm-400">No waiting</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 p-2.5 text-center">
            <Check className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            <p className="text-[9px] font-bold text-warm-700 dark:text-warm-300">Cancel Anytime</p>
            <p className="text-[8px] text-warm-400">No auto-renew</p>
          </div>
        </div>
      </div>

      {/* Sticky pay bar */}
      <div className="sticky bottom-0 bg-white/95 dark:bg-warm-800/95 backdrop-blur border-t border-warm-200 dark:border-warm-700 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-warm-500 dark:text-warm-400 uppercase tracking-wider">
              {selectedPlanData.label} plan
            </p>
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl font-black text-amber-700 dark:text-amber-400">₹{displayPrice}</p>
              {hasDiscount && (
                <p className="text-[11px] text-warm-400 line-through">₹{appliedCoupon!.baseInr}</p>
              )}
            </div>
          </div>
          <Button
            onClick={handlePay}
            disabled={paying}
            className="h-12 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white font-black flex items-center gap-2 shrink-0"
          >
            {paying ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
            ) : (
              <>{isAlreadyPremium ? 'Extend' : 'Pay'} ₹{displayPrice} <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
