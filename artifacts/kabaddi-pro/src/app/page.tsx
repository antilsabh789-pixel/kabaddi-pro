'use client';

import { lazy, Suspense, useState, useEffect, useCallback, useRef, ComponentType, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKabaddiStore } from '@/lib/store';
import Portal from '@/components/portal';
import { useBackButton } from '@/hooks/use-back-button';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, RefreshCw, MessageSquare, Bell } from 'lucide-react';
import {
  requestNotificationPermission,
  showChatMessageNotification,
  isNotificationSupported,
} from '@/lib/pushNotifications';

const SplashScreen = lazy(() => import('@/components/kabaddi/SplashScreen'));
const AuthScreen = lazy(() => import('@/components/kabaddi/AuthScreen'));
const HomeTab = lazy(() => import('@/components/kabaddi/HomeTab'));
const TournamentsTab = lazy(() => import('@/components/kabaddi/TournamentsTab'));
const QuickScoreTab = lazy(() => import('@/components/kabaddi/QuickScoreTab'));
const ProfileTab = lazy(() => import('@/components/kabaddi/ProfileTab'));
const LiveScoringScreen = lazy(() => import('@/components/kabaddi/LiveScoringScreen'));
const TossScreen = lazy(() => import('@/components/kabaddi/TossScreen'));
const BottomNav = lazy(() => import('@/components/kabaddi/BottomNav'));
const OfflineIndicator = lazy(() => import('@/components/kabaddi/OfflineIndicator'));
const NotificationPanel = lazy(() => import('@/components/kabaddi/NotificationPanel'));
const OnboardingWizard = lazy(() => import('@/components/kabaddi/OnboardingWizard'));

// ─── Error Boundary Component ───────────────────────────────────────

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ComponentType<{ error: Error; retry: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ error, retry }: { error: Error; retry: () => void }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="error-boundary-container">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="flex flex-col items-center max-w-sm mx-auto"
      >
        {/* Error icon */}
        <motion.div
          className="w-16 h-16 rounded-2xl bg-brand-red/10 flex items-center justify-center mb-4"
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <AlertTriangle className="w-8 h-8 text-brand-red" />
        </motion.div>

        <h2 className="text-lg font-bold text-warm-800 dark:text-warm-700 mb-1">
          Something went wrong
        </h2>
        <p className="text-sm text-warm-500 dark:text-warm-400 mb-6 text-center">
          We encountered an unexpected error. Don&apos;t worry, your data is safe.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={retry}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-red text-white font-semibold text-sm hover:bg-brand-red-dark transition-colors active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-warm-100 dark:bg-warm-200/20 text-warm-600 dark:text-warm-400 font-medium text-xs hover:bg-warm-200 dark:hover:bg-warm-200/30 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            {showDetails ? 'Hide Details' : 'Report Issue'}
          </button>
        </div>

        {/* Error details (collapsible) */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full mt-4 overflow-hidden"
            >
              <div className="bg-warm-100 dark:bg-warm-200/20 rounded-xl p-3 text-left">
                <p className="text-[10px] font-mono text-warm-500 dark:text-warm-400 break-all">
                  {error.message || 'Unknown error'}
                </p>
                {error.stack && (
                  <details className="mt-2">
                    <summary className="text-[10px] text-warm-400 cursor-pointer">
                      Stack trace
                    </summary>
                    <pre className="text-[9px] font-mono text-warm-400 dark:text-warm-500 mt-1 whitespace-pre-wrap break-all max-h-32 overflow-y-auto custom-scrollbar">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [state, setState] = useState<ErrorBoundaryState>({ hasError: false, error: null });

  useEffect(() => {
    const handleError = (error: Error) => {
      setState({ hasError: true, error });
      console.error('[KabaddiPro ErrorBoundary]', error);
    };

    const originalError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      if (error) handleError(error);
      if (originalError) originalError(message, source, lineno, colno, error);
    };

    return () => {
      window.onerror = originalError;
    };
  }, []);

  const retry = useCallback(() => {
    setState({ hasError: false, error: null });
  }, []);

  if (state.hasError && state.error) {
    return <ErrorFallback error={state.error} retry={retry} />;
  }

  return <>{children}</>;
}

// ─── Branded Loading Screen ─────────────────────────────────────────

function BrandedLoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-700 via-red-800 to-red-950 flex flex-col items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 36px)`,
        }}
      />

      <div className="flex flex-col items-center gap-5 relative z-10">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-white shadow-2xl shadow-black/40 flex items-center justify-center overflow-hidden border-3 border-white/60">
            <img
              src="/app-icon.png"
              alt="Kabaddi Pro"
              width={80}
              height={80}
              className="rounded-xl"
            />
          </div>
          <div
            className="absolute inset-[-6px] rounded-[1.75rem] border-2 border-brand-gold/30"
            style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
          />
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-black text-white tracking-[0.15em]">
            KABADDI
            <span className="text-brand-gold"> PRO</span>
          </h1>
        </div>

        <div className="w-28 h-1 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light"
            style={{
              animation: 'load-progress 1.5s ease-in-out infinite',
            }}
          />
        </div>

        <div className="flex gap-2 mt-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-gold"
              style={{
                animation: 'pulse 1s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Lightweight Tab Loading Spinner ─────────────────────────────────
// Used when switching between tabs — NOT a full splash screen.
// Just a minimal spinner so the user knows something is loading.

function TabLoadingSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 rounded-full border-3 border-brand-red/20 border-t-brand-red animate-spin" />
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  // Unread count for the Chat tab badge — polled from the backend every
  // 15s so the user sees new DMs even when not on the Chat tab. Stays at
  // 0 when the user is actively on the Chat tab (the tab's own poller
  // handles live updates there).
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const { isAuthenticated, isOnboarded, activeTab, setActiveTab, activeMatch, hasSeenSplash, setHasSeenSplash, showToss, tossMatchConfig, startMatch, cancelToss, hasCompletedOnboarding, currentUser, updateUser, completeOnboarding, notifications, syncBackendNotifications } =
    useKabaddiStore();
  // Bell icon counts both in-app notifications AND unread chat messages.
  // Chat unread count is polled separately (see useEffect below).
  const unreadCount = notifications.filter((n) => !n.read).length + chatUnreadCount;

  // ─── Request notification permission on first auth ─────────────────
  // Ask the user for OS-level notification permission the first time they
  // log in. This lets us fire WhatsApp-style notifications (banner +
  // vibration + sound) when a new chat message arrives. We only ask once
  // per browser — if they deny, we don't re-prompt (the user can re-grant
  // from browser settings later).
  const askedPermissionRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;
    if (askedPermissionRef.current) return;
    askedPermissionRef.current = true;
    if (!isNotificationSupported()) return;
    // Don't prompt immediately — wait 5s so the user lands on the app first.
    // Asking too early can feel pushy and reduce grant rates.
    const timer = setTimeout(() => {
      requestNotificationPermission().then((perm) => {
        if (perm === 'granted') {
          console.log('[notifications] OS permission granted — will show push banners for new chat messages');
        } else if (perm === 'denied') {
          console.log('[notifications] OS permission denied — will only show in-app bell badge');
        }
      });
    }, 5000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, currentUser?.id]);

  // ─── Poll backend notifications (chat messages, real events) ───────
  // Every 20s, fetch real notifications from /api/notifications and merge
  // any new ones into the local store. This is what makes the bell badge
  // reflect REAL events (new chat messages, etc.) instead of just the
  // locally-generated fake notifications we used to push.
  //
  // When new chat notifications arrive AND the user isn't on the Chat tab
  // AND we have OS permission, fire a WhatsApp-style system notification
  // (banner + vibration + sound).
  const prevNotificationIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUser?.id) return;
    // Skip polling during live match / toss (no distractions while scoring).
    if (activeMatch?.isLive || showToss) return;

    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const added = await syncBackendNotifications(currentUser.id);
      if (cancelled || added === 0) return;

      // New notifications arrived! For chat messages, fire a WhatsApp-style
      // OS push notification (banner + vibration + sound) — the user
      // explicitly asked for this. We fire it for ALL new chat notifications
      // (even if the user is in the app) because that matches WhatsApp
      // behavior — you get a notification sound + banner even when you're
      // in a different chat. The showChatMessageNotification helper handles
      // the permission check internally (no-op if not granted).
      const latest = useKabaddiStore.getState().notifications.slice(0, added);
      for (const n of latest) {
        if (n.type === 'chat' && !prevNotificationIdsRef.current.has(n.id)) {
          // Use the notification title/description. The title from the
          // backend is "New message from <sender>" — perfect.
          showChatMessageNotification({
            senderName: n.title.replace(/^New message from\s+/i, '') || 'Kabaddi Player',
            messagePreview: n.description,
            fromUserId: n.fromUserId,
            threadId: n.threadId,
          });
        }
        prevNotificationIdsRef.current.add(n.id);
      }
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => { cancelled = true; clearInterval(id); };
  }, [currentUser?.id, activeMatch?.isLive, showToss, syncBackendNotifications]);

  // ─── Poll chat threads for unread count (bell + HomeTab badge) ─────
  // Skip during a live match / toss (no distractions while scoring).
  // The HomeTab's Player Chat card surfaces this same count via prop.
  useEffect(() => {
    if (!currentUser?.id || activeMatch?.isLive || showToss) {
      setChatUnreadCount(0);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/chat/threads?userId=${currentUser.id}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const total: number = (data.threads || []).reduce(
          (sum: number, t: any) => sum + (t.unreadCount || 0),
          0,
        );
        setChatUnreadCount(total);
      } catch {
        /* ignore polling errors */
      }
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [currentUser?.id, activeMatch?.isLive, showToss]);

  // ─── Android Back Button Support ──────────────────────────────────
  // Prevents the back button from exiting the app when overlays are open.
  // Each overlay pushes a history entry; pressing back closes the overlay
  // instead of minimizing the app.
  useBackButton(showNotifications, () => setShowNotifications(false));
  useBackButton(showToss && !!tossMatchConfig, () => cancelToss());

  useEffect(() => {
    const timer = setTimeout(() => {
      setHydrated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // ─── Auto-restore live match on app OPEN (not on every tab switch) ──
  // Only auto-switch to scoring screen when the app FIRST opens with a live match.
  // After that, the user can freely navigate to Home/Profile/etc and come back
  // to scoring via the Quick Score tab — the match stays live in the background.
  const hasRestoredMatch = useRef(false);
  useEffect(() => {
    if (activeMatch?.isLive && !hasRestoredMatch.current && activeTab !== 'quick-score') {
      hasRestoredMatch.current = true;
      setActiveTab('quick-score');
    }
    // Reset the flag when no match is live so the next match can auto-restore
    if (!activeMatch?.isLive) {
      hasRestoredMatch.current = false;
    }
  }, [activeMatch?.isLive, activeTab, setActiveTab]);

  // Handle payment return from Cashfree redirect
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const orderId = params.get('order_id') || localStorage.getItem('pendingPaymentOrderId');

    if (paymentStatus && orderId) {
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('order_id');
      url.searchParams.delete('cf_order_id');
      window.history.replaceState({}, '', url.toString());

      localStorage.removeItem('pendingPaymentOrderId');
      localStorage.removeItem('pendingPaymentPlan');

      if (paymentStatus === 'success' || paymentStatus === 'redirect') {
        fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              updateUser({
                isPremium: true,
                premiumExpiry: data.user?.premiumExpiry || null,
                premiumPlan: data.user?.premiumPlan || null,
              });
            }
          })
          .catch(err => console.error('Payment verification error:', err));
      }
    } else {
      const pendingOrderId = localStorage.getItem('pendingPaymentOrderId');
      if (pendingOrderId) {
        localStorage.removeItem('pendingPaymentOrderId');
        localStorage.removeItem('pendingPaymentPlan');

        fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: pendingOrderId }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              updateUser({
                isPremium: true,
                premiumExpiry: data.user?.premiumExpiry || null,
                premiumPlan: data.user?.premiumPlan || null,
              });
            }
          })
          .catch(err => console.error('Payment verification error:', err));
      }
    }
  }, [isAuthenticated, currentUser?.id, updateUser]);

  // ─── Handle Giveaway ₹2 entry-fee payment return ────────────────────
  // Cashfree redirects back to /?giveaway_payment=success&order_id=... after
  // the user pays the ₹2 giveaway entry fee. We verify the payment server-side
  // and the backend auto-enters the user into the current round.
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const params = new URLSearchParams(window.location.search);
    const giveawayPayment = params.get('giveaway_payment');
    const orderId = params.get('order_id');

    if (giveawayPayment && orderId) {
      // Clean the URL
      const url = new URL(window.location.href);
      url.searchParams.delete('giveaway_payment');
      url.searchParams.delete('order_id');
      url.searchParams.delete('cf_order_id');
      window.history.replaceState({}, '', url.toString());

      if (giveawayPayment === 'success' || giveawayPayment === 'redirect') {
        // ─── Bounce-back detection ────────────────────────────────
        // If Cashfree returned within 5 seconds of the user tapping "Pay ₹2",
        // the payment page was never actually shown to the user — Cashfree
        // bounced back immediately (invalid session, env mismatch, wrong
        // credentials, etc.). We detect this using the pendingGiveawayPayment
        // timestamp stored in localStorage by handlePayEntryFee.
        let bouncedBack = false;
        try {
          const pendingRaw = localStorage.getItem('pendingGiveawayPayment');
          if (pendingRaw) {
            const pending = JSON.parse(pendingRaw);
            const elapsed = Date.now() - (pending.startedAt || 0);
            // Under 5 seconds = almost certainly a bounce-back (a real
            // payment takes at least 10-15 seconds for the user to enter
            // their card/UPI details).
            if (elapsed < 5000) {
              bouncedBack = true;
            }
          }
        } catch { /* ignore parse errors */ }
        // Always clear the pending flag — we only need it once.
        try { localStorage.removeItem('pendingGiveawayPayment'); } catch { /* noop */ }

        fetch('/api/giveaway/verify-entry-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              // Surface a toast — the user will see the green "You're participating!" card
              // when they next open the Giveaway screen.
              toast({
                title: '🎉 Payment Successful!',
                description: '₹2 entry fee paid. You are now entered in the giveaway round.',
              });
              console.log('[giveaway] Entry fee paid, user auto-entered into round.');
            } else {
              // The payment verification failed. This usually means Cashfree
              // bounced back immediately without showing the payment page —
              // the session was invalid, the env was mismatched, or the
              // gateway rejected the request. Previously this was silently
              // logged, which made it look like the app "just refreshed"
              // with no explanation. Now we surface a clear error so the
              // user knows the payment didn't go through.
              const reason = bouncedBack
                ? 'Cashfree rejected the payment session and returned immediately. This usually means the payment gateway credentials are wrong or the environment (sandbox/production) is mismatched.'
                : (data?.reason || data?.error || 'Payment could not be verified.');
              toast({
                title: '❌ Payment Not Completed',
                description: `${reason} You were not charged. Please try again or contact support.`,
                variant: 'destructive',
              });
              console.warn('[giveaway] Payment verification returned non-success:', { data, bouncedBack });
            }
          })
          .catch(err => {
            toast({
              title: 'Payment Verification Failed',
              description: 'Could not verify your payment. Please check your connection.',
              variant: 'destructive',
            });
            console.error('[giveaway] Entry fee verification error:', err);
          });
      }
    }
  }, [isAuthenticated, currentUser?.id]);

  // ─── Premium status sync ───
  // On app load (and when the user logs in), fetch the user's REAL premium
  // status from /api/premium and update the store. This replaces the old
  // "all-free refactor" hack that forced isPremium=true for everyone.
  // The endpoint now returns the actual DB values: isPremium, premiumExpiry,
  // premiumPlan, expired. If premium has expired (premiumExpiry in the past),
  // isPremium will be false and the user will see the PremiumLock overlay on
  // gated screens.
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;
    let cancelled = false;
    fetch(`/api/premium?userId=${currentUser.id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data || typeof data.isPremium !== 'boolean') return;
        // Only update if something actually changed (avoid render loops).
        const currentExpiry = currentUser.premiumExpiry
          ? new Date(currentUser.premiumExpiry).getTime()
          : null;
        const newExpiry = data.premiumExpiry ? new Date(data.premiumExpiry).getTime() : null;
        if (
          currentUser.isPremium !== data.isPremium ||
          currentExpiry !== newExpiry ||
          currentUser.premiumPlan !== data.premiumPlan
        ) {
          updateUser({
            isPremium: data.isPremium,
            premiumExpiry: data.premiumExpiry || null,
            premiumPlan: data.premiumPlan || null,
          });
        }
      })
      .catch(() => { /* non-fatal — premium status will be rechecked on next action */ });
    return () => { cancelled = true; };
  }, [isAuthenticated, currentUser?.id, updateUser]);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  if (!hydrated) {
    return <BrandedLoadingScreen />;
  }

  if (showSplash) {
    return (
      <Suspense fallback={<BrandedLoadingScreen />}>
        <SplashScreen onComplete={() => {
          setShowSplash(false);
          if (!hasSeenSplash) {
            setHasSeenSplash(true);
          }
        }} />
      </Suspense>
    );
  }

  if (!isAuthenticated || !isOnboarded) {
    return (
      <Suspense fallback={<BrandedLoadingScreen />}>
        <AuthScreen />
      </Suspense>
    );
  }

  if (isAuthenticated && isOnboarded && !hasCompletedOnboarding) {
    // Coach role is deprecated — everyone goes through the standard
    // onboarding wizard now. (Previously coaches skipped onboarding, but
    // since everyone is a player now, no special-casing is needed.)
    return (
      <Suspense fallback={<BrandedLoadingScreen />}>
        <OnboardingWizard />
      </Suspense>
    );
  }

  if (showToss && tossMatchConfig) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<BrandedLoadingScreen />}>
          <TossScreen
            homeTeam={tossMatchConfig.homeTeam}
            awayTeam={tossMatchConfig.awayTeam}
            homeTeamColor={tossMatchConfig.homeTeamColor}
            awayTeamColor={tossMatchConfig.awayTeamColor}
            onTossComplete={(firstRaidTeam) => {
              startMatch(tossMatchConfig, firstRaidTeam);
            }}
            onBack={() => cancelToss()}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (activeMatch?.isLive && activeTab === 'quick-score') {
    return (
      <ErrorBoundary>
        <Suspense fallback={<BrandedLoadingScreen />}>
          <div className="h-screen bg-warm-50 dark:bg-warm-900 flex flex-col overflow-hidden">
            <LiveScoringScreen />
            <AnimatePresence>
              {showNotifications && (
                <NotificationPanel
                  onClose={() => setShowNotifications(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<BrandedLoadingScreen />}>
        <div className="min-h-screen bg-warm-50 dark:bg-warm-900 flex flex-col">
          <OfflineIndicator />

          {/* ─── Top-Right Notification Bell (fixed, above all tabs) ─── */}
          {/* Hidden on Quick Score tab (scoring area) and during live match/toss */}
          {activeTab !== 'quick-score' && !activeMatch?.isLive && !showToss && (
          <motion.button
            type="button"
            onClick={() => setShowNotifications(true)}
            whileTap={{ scale: 0.85 }}
            aria-label={`Notifications${unreadCount > 0 ? ` - ${unreadCount} unread` : ''}`}
            className="fixed top-3 right-3 z-40 flex items-center justify-center w-10 h-10 rounded-full bg-white/90 dark:bg-warm-800/90 backdrop-blur-md shadow-lg shadow-black/10 hover:bg-white dark:hover:bg-warm-700 transition-colors border border-warm-200/60 dark:border-warm-700/60"
          >
            <motion.div
              animate={unreadCount > 0 ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
              transition={{ duration: 0.5, repeat: unreadCount > 0 ? 3 : 0, ease: 'easeInOut', repeatDelay: 5 }}
            >
              <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-brand-red' : 'text-warm-500 dark:text-warm-300'}`} />
            </motion.div>

            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-brand-red text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-lg shadow-brand-red/40 badge-pulse-prominent"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.div>
            )}
          </motion.button>
          )}

          <main className="flex-1 overflow-y-auto pb-20">
            <Suspense fallback={<TabLoadingSpinner />}>
              {activeTab === 'home' && <HomeTab chatUnreadCount={chatUnreadCount} />}
              {activeTab === 'tournaments' && <TournamentsTab />}
              {activeTab === 'quick-score' && <QuickScoreTab />}
              {activeTab === 'profile' && <ProfileTab />}
            </Suspense>
          </main>

          <BottomNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            hasLiveMatch={!!activeMatch?.isLive}
          />

          <Portal>
            <AnimatePresence>
              {showNotifications && (
                <NotificationPanel
                  onClose={() => setShowNotifications(false)}
                />
              )}
            </AnimatePresence>
          </Portal>
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}
