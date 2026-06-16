'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, ComponentType, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKabaddiStore } from '@/lib/store';
import Portal from '@/components/portal';
import Image from 'next/image';
import { AlertTriangle, RefreshCw, MessageSquare } from 'lucide-react';

// Dynamic imports with SSR disabled to reduce server memory usage
const SplashScreen = dynamic(() => import('@/components/kabaddi/SplashScreen'), { ssr: false });
const AuthScreen = dynamic(() => import('@/components/kabaddi/AuthScreen'), { ssr: false });
const HomeTab = dynamic(() => import('@/components/kabaddi/HomeTab'), { ssr: false });
const TournamentsTab = dynamic(() => import('@/components/kabaddi/TournamentsTab'), { ssr: false });
const QuickScoreTab = dynamic(() => import('@/components/kabaddi/QuickScoreTab'), { ssr: false });
const ProfileTab = dynamic(() => import('@/components/kabaddi/ProfileTab'), { ssr: false });
const LiveScoringScreen = dynamic(() => import('@/components/kabaddi/LiveScoringScreen'), { ssr: false });
const TossScreen = dynamic(() => import('@/components/kabaddi/TossScreen'), { ssr: false });

const BottomNav = dynamic(() => import('@/components/kabaddi/BottomNav'), { ssr: false });
const OfflineIndicator = dynamic(() => import('@/components/kabaddi/OfflineIndicator'), { ssr: false });
const NotificationPanel = dynamic(() => import('@/components/kabaddi/NotificationPanel'), { ssr: false });
const OnboardingWizard = dynamic(() => import('@/components/kabaddi/OnboardingWizard'), { ssr: false });

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
      // Log error for debugging
      console.error('[KabaddiPro ErrorBoundary]', error);
    };

    // Listen for unhandled errors
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
      {/* Subtle geometric pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 36px)`,
        }}
      />

      <div className="flex flex-col items-center gap-5 relative z-10">
        {/* Logo with pulse animation */}
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-white shadow-2xl shadow-black/40 flex items-center justify-center overflow-hidden border-3 border-white/60">
            <Image
              src="/app-icon.png"
              alt="Kabaddi Pro"
              width={80}
              height={80}
              className="rounded-xl"
              priority
            />
          </div>
          {/* Animated glow ring */}
          <div
            className="absolute inset-[-6px] rounded-[1.75rem] border-2 border-brand-gold/30"
            style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
          />
        </div>

        {/* App name */}
        <div className="text-center">
          <h1 className="text-2xl font-black text-white tracking-[0.15em]">
            KABADDI
            <span className="text-brand-gold"> PRO</span>
          </h1>
        </div>

        {/* Loading indicator bar */}
        <div className="w-28 h-1 bg-white/15 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light"
            style={{
              animation: 'load-progress 1.5s ease-in-out infinite',
            }}
          />
        </div>

        {/* Kabaddi-themed spinner */}
        <div className="spinner-kabaddi spinner-kabaddi-lg mt-2" />

        {/* Animated dots */}
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

// ─── Main Page Component ────────────────────────────────────────────

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { isAuthenticated, isOnboarded, activeTab, setActiveTab, activeMatch, hasSeenSplash, setHasSeenSplash, showToss, tossMatchConfig, startMatch, cancelToss, hasCompletedOnboarding, currentUser, updateUser, completeOnboarding } =
    useKabaddiStore();

  // Wait for Zustand persist to hydrate from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      setHydrated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle payment return from Cashfree redirect
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const orderId = params.get('order_id') || localStorage.getItem('pendingPaymentOrderId');

    if (paymentStatus && orderId) {
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('order_id');
      url.searchParams.delete('cf_order_id');
      window.history.replaceState({}, '', url.toString());

      // Clear localStorage
      localStorage.removeItem('pendingPaymentOrderId');
      localStorage.removeItem('pendingPaymentPlan');

      if (paymentStatus === 'success' || paymentStatus === 'redirect') {
        // Verify payment with backend
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
      // Check localStorage for pending payment (user returned from Cashfree)
      const pendingOrderId = localStorage.getItem('pendingPaymentOrderId');
      if (pendingOrderId) {
        localStorage.removeItem('pendingPaymentOrderId');
        localStorage.removeItem('pendingPaymentPlan');

        // Verify payment
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

    // Check if premium has expired locally first (instant)
    if (currentUser.premiumExpiry && new Date(currentUser.premiumExpiry) < new Date()) {
      updateUser({ isPremium: false, premiumExpiry: null, premiumPlan: null });
      return;
    }

    // Then verify with backend (in case of timezone differences)
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
      .catch(() => {}); // silent fail - not critical
  }, [isAuthenticated, currentUser?.id, currentUser?.isPremium, currentUser?.premiumExpiry, updateUser]);

  // Scroll to top whenever activeTab changes
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab]);

  // Show branded loading screen while hydrating from localStorage
  if (!hydrated) {
    return <BrandedLoadingScreen />;
  }

  // Show splash screen on every app launch with app logo
  if (showSplash) {
    return <SplashScreen onComplete={() => {
      setShowSplash(false);
      if (!hasSeenSplash) {
        setHasSeenSplash(true);
      }
    }} />;
  }

  // Show auth/onboarding if not authenticated
  if (!isAuthenticated || !isOnboarded) {
    return <AuthScreen />;
  }

  // Show onboarding wizard for first-time players (coaches skip this)
  if (isAuthenticated && isOnboarded && !hasCompletedOnboarding) {
    if (currentUser?.role === 'coach') {
      // Auto-complete onboarding for coaches
      completeOnboarding();
    } else {
      return <OnboardingWizard />;
    }
  }

  // Show toss screen if a toss is in progress
  if (showToss && tossMatchConfig) {
    return (
      <ErrorBoundary>
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
      </ErrorBoundary>
    );
  }

  // If there's an active live match, show the scoring screen
  if (activeMatch?.isLive && activeTab === 'quick-score') {
    return (
      <ErrorBoundary>
        <div className="h-screen bg-warm-50 flex flex-col overflow-hidden">
          <LiveScoringScreen />
          {/* Notification Panel */}
          <AnimatePresence>
            {showNotifications && (
              <NotificationPanel
                onClose={() => setShowNotifications(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-warm-50 flex flex-col">
        <OfflineIndicator />
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20">
          {activeTab === 'home' && <HomeTab />}
          {activeTab === 'tournaments' && <TournamentsTab />}
          {activeTab === 'quick-score' && <QuickScoreTab />}
          {activeTab === 'profile' && <ProfileTab />}
        </main>

        {/* Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          hasLiveMatch={!!activeMatch?.isLive}
          onNotificationOpen={() => setShowNotifications(true)}
        />

        {/* Notification Panel */}
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
    </ErrorBoundary>
  );
}
