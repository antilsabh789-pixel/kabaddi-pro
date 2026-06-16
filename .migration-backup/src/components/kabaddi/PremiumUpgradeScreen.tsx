'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  Trophy,
  BarChart3,
  Shield,
  Zap,
  Check,
  X,
  Sparkles,
  Users,
  TrendingUp,
  Award,
  CreditCard,
  ShieldCheck,
  Tag,
  Loader2,
  Star,
  Target,
  Flame,
  Megaphone,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

interface PremiumUpgradeScreenProps {
  onClose: () => void;
  feature?: string; // Which feature triggered the upgrade prompt
}

const PREMIUM_FEATURES = [
  {
    icon: BarChart3,
    title: 'Detailed Player Stats',
    description: 'Full performance breakdowns, advanced analytics & career stats',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Trophy,
    title: 'Host Tournaments',
    description: 'Create & manage tournaments with custom formats and live tracking',
    color: 'text-red-500',
    bg: 'bg-red-500/10',
  },
  {
    icon: TrendingUp,
    title: 'Full Stats Dashboard',
    description: 'Complete performance charts, raid efficiency, tackle success rate',
    color: 'text-teal-500',
    bg: 'bg-teal-500/10',
  },
  {
    icon: Users,
    title: 'Player Comparison',
    description: 'Compare your stats with other players and see your rank',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Target,
    title: 'Advanced Match Analytics',
    description: 'Deep match insights, heatmaps, and performance patterns',
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
  },
  {
    icon: Flame,
    title: 'Streaks & Records',
    description: 'Track your winning streaks, personal bests and milestones',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    icon: Award,
    title: 'Exclusive Badges & Rewards',
    description: 'Premium-only badges, achievements & leaderboard recognition',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Star,
    title: 'AI Insights & Predictions',
    description: 'AI-powered match predictions and personalized recommendations',
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: Shield,
    title: 'Priority Support',
    description: 'Priority customer support & early access to new features',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Megaphone,
    title: "Coach's Corner",
    description: 'Manage academies, track attendance & organize training sessions',
    color: 'text-teal-500',
    bg: 'bg-teal-500/10',
  },
];

const PLANS = [
  {
    id: 'daily',
    name: '1 Day',
    price: '1',
    pricePaise: 100,
    period: '/day',
    badge: 'TRY IT',
    features: ['All premium features', 'Full access for 24 hours', 'Cancel anytime'],
    highlight: false,
  },
  {
    id: 'weekly',
    name: 'Weekly',
    price: '27',
    pricePaise: 2700,
    period: '/week',
    badge: 'STARTER',
    features: ['All premium features', 'Cancel anytime'],
    highlight: false,
  },
  {
    id: 'monthly',
    name: 'Monthly',
    price: '99',
    pricePaise: 9900,
    period: '/month',
    badge: 'POPULAR',
    features: ['All premium features', 'Cancel anytime', 'Better value'],
    highlight: true,
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '999',
    pricePaise: 99900,
    period: '/year',
    badge: 'BEST VALUE',
    features: ['All premium features', 'Save ₹183', 'Priority support', 'Exclusive badges'],
    highlight: false,
  },
];

// Sample coupon codes (in production these would be validated on the server)
const VALID_COUPONS: Record<string, { discount: number; label: string }> = {
  'KABADDI50': { discount: 50, label: '50% OFF' },
  'FIRST100': { discount: 100, label: '₹100 OFF' },
  'PRO2025': { discount: 25, label: '25% OFF' },
  'LAUNCH20': { discount: 20, label: '20% OFF' },
};

/**
 * Wait for the Cashfree JS SDK to load (kept for backward compat, unused now).
 */
function waitForCashfreeSDK(timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const win = window as Record<string, unknown>;
    if (win.Cashfree) {
      resolve(true);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (win.Cashfree) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 200);
  });
}

/**
 * Detect if we're on a mobile/touch device
 */
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || ('ontouchstart' in window && window.innerWidth < 1024);
}

/**
 * Open Cashfree checkout — BULLETPROOF method for ALL devices.
 *
 * KEY FIX (v2): Previous approach used Cashfree JS SDK on desktop and
 * server checkout page on mobile. The JS SDK is unreliable and the mobile
 * checkout page (which tried JS SDK) still showed "Invalid Session ID".
 *
 * NEW APPROACH: Redirect ALL devices (mobile + desktop) to our
 * /api/payments/checkout page, which returns an auto-submitting form POST
 * to Cashfree's /pg/view/sessions/checkout endpoint using payment_session_id.
 *
 * Why this works:
 * - No JavaScript SDK dependency (flaky on mobile)
 * - Uses payment_session_id (always valid, unlike order_token)
 * - Form POST is the official Cashfree server-side redirect method
 * - Works identically on ALL browsers (mobile + desktop)
 */
async function openCashfreeCheckout(
  paymentSessionId: string,
  env: string,
  orderId: string,
  orderToken: string,
) {
  // Save order ID to localStorage so we can verify payment when user returns
  localStorage.setItem('pendingPaymentOrderId', orderId);

  const onMobile = isMobileDevice();
  console.log(`[Cashfree] Redirecting to server checkout page (device: ${onMobile ? 'mobile' : 'desktop'}, orderId: ${orderId})`);

  // ALL devices use the same reliable form POST checkout page
  const params = new URLSearchParams({
    session_id: paymentSessionId,
    env: env,
    order_id: orderId,
    order_token: orderToken,
  });
  window.location.href = `/api/payments/checkout?${params.toString()}`;
}

export default function PremiumUpgradeScreen({ onClose, feature }: PremiumUpgradeScreenProps) {
  const { currentUser, updateUser } = useKabaddiStore();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState('daily');
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ discount: number; label: string } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const hasVerifiedRef = useRef(false);

  // Verify payment with backend
  const verifyPayment = useCallback(async (orderId: string) => {
    if (hasVerifiedRef.current) return; // prevent double verification
    hasVerifiedRef.current = true;
    setVerifying(true);
    try {
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      });

      const verifyData = await verifyRes.json();

      if (verifyData.success) {
        setActivated(true);
        setActivating(false);
        if (verifyData.user) {
          updateUser({
            isPremium: true,
            premiumExpiry: verifyData.user.premiumExpiry || null,
            premiumPlan: verifyData.user.premiumPlan || null,
          });
        }
        toast({
          title: '🎉 Premium Activated!',
          description: 'Welcome to Kabaddi Pro Premium! All features unlocked.',
        });
      } else {
        setPaymentError(verifyData.error || 'Payment verification failed. Please contact support.');
        setActivating(false);
        hasVerifiedRef.current = false; // allow retry
      }
    } catch (err) {
      console.error('Payment verification error:', err);
      setPaymentError('Could not verify payment. Please contact support if you were charged.');
      setActivating(false);
      hasVerifiedRef.current = false; // allow retry
    } finally {
      setVerifying(false);
    }
  }, [updateUser, toast]);

  // Handle payment result from URL params or localStorage (when redirected back after payment)
  useEffect(() => {
    // Skip if user is currently initiating a new purchase (activating = true means they just clicked pay)
    if (activating) return;

    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    let orderId = params.get('order_id');

    // Also check Cashfree's standard redirect params
    const cfOrderId = params.get('cf_order_id');

    // Check localStorage for pending payment (saved before redirect)
    const pendingOrderId = localStorage.getItem('pendingPaymentOrderId');

    // Determine which order ID to verify
    const orderIdToVerify = orderId || cfOrderId || pendingOrderId;

    if (paymentStatus && orderIdToVerify) {
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('order_id');
      url.searchParams.delete('cf_order_id');
      window.history.replaceState({}, '', url.toString());

      if (paymentStatus === 'success' || paymentStatus === 'redirect') {
        verifyPayment(orderIdToVerify);
      } else if (paymentStatus === 'failed') {
        setPaymentError('Payment was not completed. Please try again.');
        setActivating(false);
      }
    } else if (pendingOrderId && !paymentStatus) {
      // User returned from Cashfree redirect but without explicit success/fail param
      // Verify the payment anyway to check if it was completed
      localStorage.removeItem('pendingPaymentOrderId');
      localStorage.removeItem('pendingPaymentPlan');
      verifyPayment(pendingOrderId);
    }
  }, [verifyPayment, activating]);

  const currentPlan = PLANS.find(p => p.id === selectedPlan)!;
  const discountedPaise = couponApplied
    ? Math.max(0, currentPlan.pricePaise - (couponApplied.discount >= 100 ? couponApplied.discount * 100 : Math.floor(currentPlan.pricePaise * couponApplied.discount / 100)))
    : currentPlan.pricePaise;
  const displayPrice = couponApplied ? (discountedPaise / 100).toLocaleString('en-IN') : currentPlan.price;
  const hasDiscount = couponApplied && discountedPaise < currentPlan.pricePaise;

  const handleApplyCoupon = useCallback(() => {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    setCouponError(null);

    // Simulate API call delay
    setTimeout(() => {
      const code = couponCode.trim().toUpperCase();
      const coupon = VALID_COUPONS[code];
      if (coupon) {
        setCouponApplied(coupon);
        setCouponError(null);
        toast({ title: 'Coupon applied!', description: `${coupon.label} — discount applied to your plan` });
      } else {
        setCouponApplied(null);
        setCouponError('Invalid coupon code. Try KABADDI50 or FIRST100');
        toast({ title: 'Invalid coupon', description: 'This coupon code is not valid', variant: 'destructive' });
      }
      setCheckingCoupon(false);
    }, 500);
  }, [couponCode, toast]);

  const handleRemoveCoupon = useCallback(() => {
    setCouponApplied(null);
    setCouponCode('');
    setCouponError(null);
  }, []);

  const handleActivate = useCallback(async () => {
    if (!currentUser?.id) {
      toast({ title: 'Please login first', description: 'You need to be logged in to purchase premium.', variant: 'destructive' });
      return;
    }

    setActivating(true);
    setPaymentError(null);
    hasVerifiedRef.current = false;

    // Clear any stale payment data from previous attempts
    localStorage.removeItem('pendingPaymentOrderId');
    localStorage.removeItem('pendingPaymentPlan');

    try {
      // Step 1: Create order on server
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          plan: selectedPlan,
          couponCode: couponApplied ? couponCode.trim().toUpperCase() : undefined,
          amount: discountedPaise,
        }),
      });

      if (!orderRes.ok) {
        let errorMessage = 'Failed to create payment order';
        try {
          const errData = await orderRes.json();
          errorMessage = errData.error || errorMessage;
        } catch {
          // Non-JSON response (e.g., 404 HTML page from Next.js)
          if (orderRes.status === 404) {
            errorMessage = 'Payment service is currently unavailable. Please try again later.';
          } else if (orderRes.status === 503) {
            errorMessage = 'Payment gateway is being configured. Please try again in a few minutes.';
          } else if (orderRes.status === 502) {
            errorMessage = 'Payment gateway error. Please try again later.';
          } else if (orderRes.status === 500) {
            errorMessage = 'Payment server error. Please try again later.';
          } else {
            errorMessage = `Payment error (${orderRes.status}). Please try again.`;
          }
        }
        throw new Error(errorMessage);
      }

      const orderData = await orderRes.json();

      if (!orderData.paymentSessionId) {
        throw new Error('No payment session ID received. Please try again.');
      }

      // Step 2: Open Cashfree checkout using multi-method approach
      const paymentSessionId = orderData.paymentSessionId;

      console.log(`[Cashfree] Opening checkout: env=${orderData.env}, orderId=${orderData.orderId}, sessionId=${paymentSessionId.substring(0, 10)}..., orderToken=${!!orderData.orderToken}`);

      // Save order ID to localStorage so we can verify payment when user returns
      localStorage.setItem('pendingPaymentOrderId', orderData.orderId);
      localStorage.setItem('pendingPaymentPlan', selectedPlan);

      // Mobile-first: detect device and use best method
      await openCashfreeCheckout(paymentSessionId, orderData.env, orderData.orderId, orderData.orderToken || '');

    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
      toast({
        title: 'Payment failed',
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      setActivating(false);
    }
  }, [currentUser, selectedPlan, couponApplied, couponCode, discountedPaise, toast]);

  // Check if user already has active premium
  const hasActivePremium = currentUser?.isPremium && (
    !currentUser.premiumExpiry || new Date(currentUser.premiumExpiry) > new Date()
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-3xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with gold gradient */}
          <div className="relative bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-400 p-5 pb-7 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/3" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white tracking-wide">KABADDI PRO</h2>
                    <p className="text-[10px] font-bold text-white/80 tracking-[0.2em]">PREMIUM</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-center">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  className="inline-block mb-1"
                >
                  <Crown className="w-10 h-10 text-white mx-auto" />
                </motion.div>
                <h3 className="text-xl font-black text-white">
                  {activated ? "You're Premium Now!" : hasActivePremium ? 'Extend Your Premium' : 'Unlock Pro Features'}
                </h3>
                <p className="text-white/80 text-sm mt-0.5">
                  {activated
                    ? 'All premium features are now active'
                    : feature
                      ? `Upgrade to access ${feature}`
                      : hasActivePremium
                        ? 'Add more time to your premium subscription'
                        : 'Take your kabaddi game to the next level'}
                </p>
              </div>
            </div>
          </div>

          {activated ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-6 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"
              >
                <Sparkles className="w-10 h-10 text-amber-500" />
              </motion.div>
              <h3 className="text-xl font-bold">Premium Activated!</h3>
              <p className="text-muted-foreground text-sm mt-2">
                Payment successful. Enjoy all the premium features!
              </p>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-teal-600">
                <ShieldCheck className="w-4 h-4" />
                <span>Receipt sent to your email</span>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Premium Features - Compact grid */}
              <div className="p-4 pb-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  What you get with Premium
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {PREMIUM_FEATURES.map((feat, idx) => (
                    <motion.div
                      key={feat.title}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="flex flex-col items-center text-center p-2 rounded-xl bg-muted/50 border border-border/50"
                    >
                      <div className={`w-8 h-8 rounded-lg ${feat.bg} flex items-center justify-center mb-1`}>
                        <feat.icon className={`w-4 h-4 ${feat.color}`} />
                      </div>
                      <p className="text-[10px] font-semibold leading-tight">{feat.title}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Free features note */}
              <div className="px-4 py-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 rounded-lg px-2.5 py-1.5">
                  <Zap className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Free always: Live tournaments, past scores, quick scoring & basic profile</span>
                </div>
              </div>

              {/* Current premium status */}
              {hasActivePremium && currentUser?.premiumExpiry && (
                <div className="px-4 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium bg-emerald-50 rounded-lg px-2.5 py-1.5">
                    <ShieldCheck className="w-3 h-3 shrink-0" />
                    <span>Your premium is active until {new Date(currentUser.premiumExpiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Purchasing again will extend it.</span>
                  </div>
                </div>
              )}

              {/* Plan Selection */}
              <div className="p-4 pt-2 pb-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5">Choose your plan</h4>
                {/* Daily plan - highlighted separately */}
                <motion.button
                  onClick={() => { setSelectedPlan('daily'); setPaymentError(null); }}
                  className={`relative w-full p-2.5 rounded-xl border-2 text-center transition-all mb-2 ${
                    selectedPlan === 'daily'
                      ? 'border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-200/50 dark:bg-emerald-500/10 dark:shadow-emerald-500/20'
                      : 'border-border bg-background hover:border-emerald-300'
                  }`}
                  whileTap={{ scale: 0.97 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
                        <Zap className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">1 Day Trial</p>
                          <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white whitespace-nowrap">TRY IT</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground">Full access for 24 hours</p>
                      </div>
                    </div>
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">₹1</span>
                      <span className="text-[9px] text-muted-foreground">/day</span>
                    </div>
                  </div>
                  {selectedPlan === 'daily' && (
                    <motion.div
                      layoutId="plan-check-daily"
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"
                    >
                      <Check className="w-2.5 h-2.5 text-white" />
                    </motion.div>
                  )}
                </motion.button>
                <div className="grid grid-cols-4 gap-1.5">
                  {PLANS.filter(p => p.id !== 'daily').map((plan) => (
                    <motion.button
                      key={plan.id}
                      onClick={() => { setSelectedPlan(plan.id); setPaymentError(null); }}
                      className={`relative p-2.5 rounded-xl border-2 text-center transition-all ${
                        selectedPlan === plan.id
                          ? 'border-amber-500 bg-amber-50 shadow-sm dark:bg-amber-500/10'
                          : 'border-border bg-background hover:border-amber-300'
                      }`}
                      whileTap={{ scale: 0.97 }}
                    >
                      {plan.badge && (
                        <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                          plan.highlight ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {plan.badge}
                        </span>
                      )}
                      <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">{plan.name}</p>
                      <div className="mt-1">
                        <span className="text-sm font-black">
                          ₹{plan.price}
                        </span>
                      </div>
                      <p className="text-[8px] text-muted-foreground">{plan.period}</p>
                      {selectedPlan === plan.id && (
                        <motion.div
                          layoutId="plan-check"
                          className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 flex items-center justify-center"
                        >
                          <Check className="w-2 h-2 text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Plan features list */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {currentPlan.features.map((f) => (
                    <span key={f} className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                      <Check className="w-2.5 h-2.5" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              {/* Coupon Code */}
              <div className="px-4 pb-2">
                <div className="relative">
                  <div className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                        placeholder="Enter coupon code"
                        disabled={!!couponApplied}
                        className="pl-8 h-9 text-xs rounded-lg border-border/80 focus:border-amber-500"
                      />
                    </div>
                    {couponApplied ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveCoupon}
                        className="h-9 px-3 text-xs rounded-lg border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplyCoupon}
                        disabled={!couponCode.trim() || checkingCoupon}
                        className="h-9 px-3 text-xs rounded-lg border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        {checkingCoupon ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Apply'}
                      </Button>
                    )}
                  </div>
                  {couponApplied && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-600 font-medium bg-emerald-50 rounded-lg px-2.5 py-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{couponApplied.label} applied! You save ₹{((currentPlan.pricePaise - discountedPaise) / 100).toLocaleString('en-IN')}</span>
                    </motion.div>
                  )}
                  {couponError && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1 text-[10px] text-red-500 font-medium"
                    >
                      {couponError}
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Payment Error */}
              {paymentError && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4"
                >
                  <Card className="p-3 bg-red-50 border-red-200">
                    <p className="text-xs text-red-700 font-medium">{paymentError}</p>
                    <p className="text-[10px] text-red-500 mt-0.5">Please try again. If the problem persists, contact support.</p>
                  </Card>
                </motion.div>
              )}

              {/* Pay Button */}
              <div className="p-4 pt-2 pb-6">
                <Button
                  onClick={handleActivate}
                  disabled={activating || verifying}
                  className="w-full h-12 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400 hover:opacity-90 text-white font-bold rounded-xl text-base shadow-lg shadow-amber-500/25"
                >
                  {verifying ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying payment...</span>
                    </div>
                  ) : activating ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Redirecting to payment...</span>
                    </div>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      {hasDiscount ? (
                        <span className="flex items-center gap-1.5">
                          <span className="line-through text-white/60 text-sm">₹{currentPlan.price}</span>
                          <span>Pay ₹{displayPrice}</span>
                        </span>
                      ) : (
                        <span>{hasActivePremium ? 'Extend — ₹' : 'Pay ₹'}{currentPlan.price}</span>
                      )}
                    </>
                  )}
                </Button>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <ShieldCheck className="w-3 h-3 text-muted-foreground" />
                  <p className="text-center text-[10px] text-muted-foreground">
                    Secure payment via Cashfree • UPI, Cards & Netbanking accepted
                  </p>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
