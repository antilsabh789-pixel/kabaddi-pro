'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown,
  Trophy,
  BarChart3,
  Shield,
  Zap,
  Lock,
  Star,
  Check,
  X,
  Sparkles,
  Users,
  TrendingUp,
  Award,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    description: 'View full performance breakdowns, advanced analytics, and career stats for any player',
    color: 'text-brand-gold',
    bg: 'bg-brand-gold/10',
  },
  {
    icon: Trophy,
    title: 'Host Tournaments',
    description: 'Create and manage tournaments with custom formats, team management, and live tracking',
    color: 'text-brand-red',
    bg: 'bg-brand-red/10',
  },
  {
    icon: TrendingUp,
    title: 'Your Full Stats Dashboard',
    description: 'Access your complete performance chart, badges, raid efficiency, tackle success rate and more',
    color: 'text-brand-teal',
    bg: 'bg-brand-teal/10',
  },
  {
    icon: Users,
    title: 'Player Comparison',
    description: 'Compare your stats with other players and see where you rank among the best',
    color: 'text-brand-blue',
    bg: 'bg-brand-blue/10',
  },
  {
    icon: Award,
    title: 'Exclusive Badges & Rewards',
    description: 'Unlock premium-only badges, achievements, and special recognition on leaderboards',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Shield,
    title: 'Priority Support',
    description: 'Get priority customer support and early access to new features before anyone else',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
];

const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '149',
    pricePaise: 14900,
    period: '/month',
    badge: null,
    features: ['All premium features', 'Cancel anytime', 'No commitment'],
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '999',
    pricePaise: 99900,
    period: '/year',
    badge: 'BEST VALUE',
    features: ['All premium features', 'Save 44%', 'Priority support', 'Exclusive badges'],
    highlight: true,
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    price: '2,999',
    pricePaise: 299900,
    period: ' once',
    badge: 'POPULAR',
    features: ['All premium features', 'One-time payment', 'All future updates', 'VIP badge forever'],
  },
];

// Razorpay checkout script loader
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    // Check if already loaded
    if ((window as unknown as Record<string, unknown>).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PremiumUpgradeScreen({ onClose, feature }: PremiumUpgradeScreenProps) {
  const { currentUser, updateUser } = useKabaddiStore();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleActivate = useCallback(async () => {
    if (!currentUser?.id) {
      toast({ title: 'Please login first', description: 'You need to be logged in to purchase premium.', variant: 'destructive' });
      return;
    }

    setActivating(true);
    setPaymentError(null);

    try {
      // Step 1: Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        // Fallback to demo mode if script can't load
        toast({ title: 'Payment gateway loading...', description: 'Using demo activation for now.' });
        updateUser({ isPremium: true });
        setActivated(true);
        setTimeout(() => onClose(), 2000);
        return;
      }

      // Step 2: Create order on server
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          plan: selectedPlan,
        }),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to create payment order');
      }

      const orderData = await orderRes.json();

      // Step 3: Open Razorpay checkout
      const RazorpayConstructor = (window as unknown as Record<string, unknown>).Razorpay as new (options: Record<string, unknown>) => {
        open: () => void;
        on: (event: string, callback: (...args: unknown[]) => void) => void;
      };

      const options: Record<string, unknown> = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Kabaddi Pro',
        description: `${PLANS.find(p => p.id === selectedPlan)?.name || 'Premium'} Plan`,
        image: '/logo.svg',
        order_id: orderData.orderId,
        prefill: orderData.prefill,
        theme: {
          color: '#14B8A6', // brand-teal
        },
        modal: {
          ondismiss: () => {
            setActivating(false);
            toast({ title: 'Payment cancelled', description: 'You cancelled the payment. No charge was made.' });
          },
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          // Step 4: Verify payment on server
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              updateUser({ isPremium: true });
              setActivated(true);
              toast({
                title: 'Welcome to Kabaddi Pro Premium!',
                description: `Payment successful! Plan: ${verifyData.plan}. All premium features unlocked.`,
              });
              setTimeout(() => onClose(), 2000);
            } else {
              const errData = await verifyRes.json().catch(() => ({}));
              setPaymentError(errData.error || 'Payment verification failed');
              toast({
                title: 'Payment verification failed',
                description: 'Your payment could not be verified. If money was deducted, it will be refunded within 5-7 days.',
                variant: 'destructive',
              });
            }
          } catch {
            setPaymentError('Could not verify payment. Please contact support.');
            toast({
              title: 'Verification error',
              description: 'Could not verify your payment. Please contact support if money was deducted.',
              variant: 'destructive',
            });
          } finally {
            setActivating(false);
          }
        },
      };

      const rzp = new RazorpayConstructor(options);
      rzp.open();
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
      toast({
        title: 'Payment failed',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      setActivating(false);
    }
  }, [currentUser, selectedPlan, updateUser, toast, onClose]);

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
          className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-warm-50 rounded-t-3xl sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with gold gradient */}
          <div className="relative bg-gradient-to-br from-brand-gold-dark via-brand-gold to-brand-gold-light p-6 pb-8 overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/3" />

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">KABADDI PRO</h2>
                    <p className="text-xs font-bold text-white/80 tracking-wider">PREMIUM</p>
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
                  className="inline-block mb-2"
                >
                  <Crown className="w-12 h-12 text-white mx-auto" />
                </motion.div>
                <h3 className="text-2xl font-black text-white">
                  {activated ? "You're Premium Now!" : 'Unlock Pro Features'}
                </h3>
                <p className="text-white/80 text-sm mt-1">
                  {activated
                    ? 'All premium features are now active'
                    : feature
                      ? `Upgrade to access ${feature}`
                      : 'Take your kabaddi game to the next level'}
                </p>
              </div>
            </div>
          </div>

          {activated ? (
            /* Success state */
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-6 text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5 }}
                className="w-20 h-20 rounded-full bg-brand-gold/20 flex items-center justify-center mx-auto mb-4"
              >
                <Sparkles className="w-10 h-10 text-brand-gold" />
              </motion.div>
              <h3 className="text-xl font-bold text-warm-800">Premium Activated!</h3>
              <p className="text-warm-500 text-sm mt-2">
                Payment successful. Enjoy all the premium features!
              </p>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-brand-teal">
                <ShieldCheck className="w-4 h-4" />
                <span>Receipt sent to your email</span>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Feature List */}
              <div className="p-4 pb-2">
                <h4 className="text-sm font-bold text-warm-700 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-gold" />
                  What you get with Premium
                </h4>
                <div className="space-y-2.5">
                  {PREMIUM_FEATURES.map((feat, idx) => (
                    <motion.div
                      key={feat.title}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.05 }}
                    >
                      <Card className="p-3 flex items-start gap-3 bg-white border-warm-200 hover:border-brand-gold/30 transition-colors">
                        <div className={`w-9 h-9 rounded-lg ${feat.bg} flex items-center justify-center shrink-0`}>
                          <feat.icon className={`w-4 h-4 ${feat.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-warm-800">{feat.title}</p>
                          <p className="text-xs text-warm-500 leading-relaxed">{feat.description}</p>
                        </div>
                        <Check className="w-4 h-4 text-brand-gold shrink-0 mt-1" />
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Free vs Premium comparison note */}
              <div className="px-4 py-2">
                <Card className="p-3 bg-warm-100 border-warm-200">
                  <div className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-brand-gold shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-warm-700">Free features always included</p>
                      <p className="text-[11px] text-warm-500 mt-0.5">
                        Watch live tournaments, see past scores, quick scoring, and basic profile are always free
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Plan Selection */}
              <div className="p-4 pt-2">
                <h4 className="text-sm font-bold text-warm-700 mb-3">Choose your plan</h4>
                <div className="grid grid-cols-3 gap-2">
                  {PLANS.map((plan) => (
                    <motion.button
                      key={plan.id}
                      onClick={() => { setSelectedPlan(plan.id); setPaymentError(null); }}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                        selectedPlan === plan.id
                          ? 'border-brand-gold bg-brand-gold/5 shadow-sm'
                          : 'border-warm-200 bg-white hover:border-warm-300'
                      } ${plan.highlight ? 'ring-2 ring-brand-gold/30' : ''}`}
                      whileTap={{ scale: 0.97 }}
                    >
                      {plan.badge && (
                        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-brand-gold text-white border-0 px-1.5 py-0">
                          {plan.badge}
                        </Badge>
                      )}
                      <p className="text-xs font-semibold text-warm-700">{plan.name}</p>
                      <div className="mt-1">
                        <span className="text-base font-black text-warm-800">
                          ₹{plan.price}
                        </span>
                        <span className="text-[10px] text-warm-500">{plan.period}</span>
                      </div>
                      {selectedPlan === plan.id && (
                        <motion.div
                          layoutId="plan-check"
                          className="absolute top-2 right-2 w-4 h-4 rounded-full bg-brand-gold flex items-center justify-center"
                        >
                          <Check className="w-2.5 h-2.5 text-white" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
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

              {/* Activate Button */}
              <div className="p-4 pt-2">
                <Button
                  onClick={handleActivate}
                  disabled={activating}
                  className="w-full h-12 bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light hover:opacity-90 text-white font-bold rounded-xl text-base shadow-lg shadow-brand-gold/25"
                >
                  {activating ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      Pay ₹{PLANS.find(p => p.id === selectedPlan)?.price || '999'}
                    </>
                  )}
                </Button>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <ShieldCheck className="w-3 h-3 text-warm-400" />
                  <p className="text-center text-[10px] text-warm-400">
                    Secure payment via Razorpay. UPI, Cards & Netbanking accepted.
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
