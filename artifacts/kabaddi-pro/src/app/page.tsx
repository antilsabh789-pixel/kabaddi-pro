'use client';

import { lazy, Suspense, useState, useEffect, useCallback, useRef, ComponentType, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKabaddiStore } from '@/lib/store';
import Portal from '@/components/portal';
import { useBackButton } from '@/hooks/use-back-button';
import { AlertTriangle, RefreshCw, MessageSquare, Bell } from 'lucide-react';

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
  const { isAuthenticated, isOnboarded, activeTab, setActiveTab, activeMatch, hasSeenSplash, setHasSeenSplash, showToss, tossMatchConfig, startMatch, cancelToss, hasCompletedOnboarding, currentUser, updateUser, completeOnboarding, notifications } =
    useKabaddiStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

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

  // Auto-check premium expiry on app load
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id || !currentUser.isPremium) return;

    if (currentUser.premiumExpiry && new Date(currentUser.premiumExpiry) < new Date()) {
      updateUser({ isPremium: false, premiumExpiry: null, premiumPlan: null });
      return;
    }

    fetch(`/api/premium?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.expired || !data.isPremium) {
          updateUser({ isPremium: false, premiumExpiry: null, premiumPlan: null });
        } else if (data.premiumExpiry !== currentUser.premiumExpiry) {
          updateUser({
            isPremium: data.isPremium,
            premiumExpiry: data.premiumExpiry,
            premiumPlan: data.premiumPlan,
          });
        }
      })
      .catch(() => {});
  }, [isAuthenticated, currentUser?.id, currentUser?.isPremium, currentUser?.premiumExpiry, updateUser]);

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
    if (currentUser?.role === 'coach') {
      completeOnboarding();
    } else {
      return (
        <Suspense fallback={<BrandedLoadingScreen />}>
          <OnboardingWizard />
        </Suspense>
      );
    }
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
              {activeTab === 'home' && <HomeTab />}
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
