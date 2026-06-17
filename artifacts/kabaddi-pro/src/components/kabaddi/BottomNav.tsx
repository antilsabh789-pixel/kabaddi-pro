'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home as HomeIcon, Trophy, PlusCircle, User, Crown } from 'lucide-react';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: 'home' | 'tournaments' | 'quick-score' | 'profile') => void;
  hasLiveMatch: boolean;
}

// Ripple effect component for tab press
function Ripple({ x, y }: { x: number; y: number }) {
  return (
    <motion.span
      className="absolute rounded-full bg-brand-red/20 dark:bg-brand-red-light/20 pointer-events-none"
      style={{
        left: x - 10,
        top: y - 10,
        width: 20,
        height: 20,
      }}
      initial={{ scale: 0, opacity: 0.5 }}
      animate={{ scale: 3, opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    />
  );
}

const tabs = [
  { id: 'home' as const, labelKey: 'nav.home', icon: HomeIcon, ariaLabel: 'Home tab' },
  { id: 'tournaments' as const, labelKey: 'nav.tournaments', icon: Trophy, ariaLabel: 'Tournaments tab' },
  { id: 'quick-score' as const, labelKey: 'nav.quickScore', icon: PlusCircle, ariaLabel: 'Quick Score - start or view live match' },
  { id: 'profile' as const, labelKey: 'nav.profile', icon: User, ariaLabel: 'Profile tab' },
];

export default function BottomNav({ activeTab, setActiveTab, hasLiveMatch }: BottomNavProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const language = useKabaddiStore((s) => s.language);
  const isPremium = currentUser?.isPremium || false;

  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; tabId: string }>>([]);
  const [showLiveTooltip, setShowLiveTooltip] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear ripples after animation
  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => {
        setRipples((prev) => prev.slice(1));
      }, 600);
      return () => clearTimeout(timer);
    }
  
    return undefined;}, [ripples]);

  // Auto-hide live tooltip
  useEffect(() => {
    if (showLiveTooltip && !tooltipDismissed) {
      tooltipTimerRef.current = setTimeout(() => {
        setShowLiveTooltip(false);
      }, 3000);
      return () => {
        if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      };
    }
  
    return undefined;}, [showLiveTooltip, tooltipDismissed]);

  const handleTabClick = useCallback(
    (tabId: 'home' | 'tournaments' | 'quick-score' | 'profile', e: React.MouseEvent<HTMLButtonElement>) => {
      // Create ripple effect
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setRipples((prev) => [...prev, { id: Date.now(), x, y, tabId }]);
      setActiveTab(tabId);
    },
    [setActiveTab]
  );

  const activeTabIndex = tabs.findIndex((t) => t.id === activeTab);

  // Get live match score for tooltip
  const activeMatch = useKabaddiStore((s) => s.activeMatch);
  const liveScoreText = hasLiveMatch && activeMatch
    ? `${activeMatch.homeTeam} ${activeMatch.homeScore} - ${activeMatch.awayScore} ${activeMatch.awayTeam}`
    : '';

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, tabIndex: number) => {
      let nextIndex = tabIndex;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (tabIndex + 1) % tabs.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (tabIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActiveTab(tabs[tabIndex].id);
        return;
      } else {
        return;
      }
      setActiveTab(tabs[nextIndex].id);
      // Focus the next tab button
      const btns = navRef.current?.querySelectorAll('[role="tab"]');
      if (btns && btns[nextIndex]) {
        (btns[nextIndex] as HTMLElement).focus();
      }
    },
    [setActiveTab]
  );

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      role="tablist"
      aria-label="Main navigation"
    >
      {/* Gradient top border - enhanced with animated shimmer */}
      <div className="h-px bg-gradient-to-r from-transparent via-brand-red/30 to-transparent relative overflow-hidden">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/40 to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Frosted glass nav bar - enhanced with stronger glassmorphism */}
      <div className="glass-effect dark:bg-warm-900/85 border-t border-white/10 dark:border-warm-700/30 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* Sliding indicator bar with gradient glow */}
        <div className="max-w-lg mx-auto relative">
          <motion.div
            className="absolute top-0 h-[2px] bg-gradient-to-r from-brand-red to-brand-gold rounded-full"
            layoutId="nav-sliding-indicator"
            style={{
              width: '20%',
              left: `${activeTabIndex * 25}%`,
            }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          >
            {/* Glow under the indicator */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-brand-red/30 rounded-full blur-sm" />
          </motion.div>
        </div>

        <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-2 pb-3 relative" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            const isQuickScore = tab.id === 'quick-score';
            const isProfile = tab.id === 'profile';
            const Icon = tab.icon;

            return (
              <motion.button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.ariaLabel}
                tabIndex={isActive ? 0 : -1}
                onClick={(e) => handleTabClick(tab.id, e)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                whileTap={{ scale: 0.85 }}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1 transition-colors duration-200 ripple-container ${
                  isQuickScore ? '-mt-6' : ''
                }`}
              >
                {/* Ripple effects */}
                {ripples
                  .filter((r) => r.tabId === tab.id)
                  .map((r) => (
                    <Ripple key={r.id} x={r.x} y={r.y} />
                  ))}

                {isQuickScore ? (
                  <>
                    {/* Quick Score Center Button - Enhanced with animated border */}
                    <motion.div
                      className="relative"
                      whileHover={{ scale: 1.05 }}
                      animate={hasLiveMatch ? { scale: [1, 1.04, 1] } : {}}
                      transition={hasLiveMatch ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                      onMouseEnter={() => {
                        if (hasLiveMatch && !tooltipDismissed) {
                          setShowLiveTooltip(true);
                        }
                      }}
                      onMouseLeave={() => setShowLiveTooltip(false)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setTooltipDismissed(true);
                        setShowLiveTooltip(false);
                      }}
                    >
                      {/* Glow effect when live - enhanced with gradient */}
                      {hasLiveMatch && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          animate={{
                            boxShadow: [
                              '0 0 8px rgba(220,38,38,0.3), 0 0 20px rgba(245,158,11,0.1)',
                              '0 0 24px rgba(220,38,38,0.6), 0 0 40px rgba(245,158,11,0.2)',
                              '0 0 8px rgba(220,38,38,0.3), 0 0 20px rgba(245,158,11,0.1)',
                            ],
                          }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}

                      {/* Main button - enhanced with animated border ring */}
                      <div
                        className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-xl transition-all duration-300 ${
                          isActive
                            ? 'bg-gradient-to-br from-brand-red to-brand-gold shadow-brand-red/40'
                            : hasLiveMatch
                              ? 'bg-gradient-to-br from-brand-red to-red-500 shadow-brand-red/30'
                              : 'bg-gradient-to-br from-white to-gray-100 shadow-gray-300/40 dark:from-brand-red dark:to-red-700 dark:shadow-brand-red/20'
                        }`}
                      >
                        <Icon className={`w-7 h-7 ${isActive || hasLiveMatch ? 'text-white' : 'text-brand-red dark:text-white'} strokeWidth={2.5}`} />

                        {/* Animated border ring on active */}
                        {isActive && (
                          <motion.div
                            className="absolute inset-0 rounded-full border-2 border-white/20"
                            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        )}

                        {/* Pulsing red dot for live match - enhanced with glow */}
                        {hasLiveMatch && !isActive && (
                          <span className="absolute -top-1 -right-1 flex">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                            <span className="relative inline-flex w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white dark:border-warm-900 shadow-lg shadow-red-500/50" />
                          </span>
                        )}
                      </div>

                      {/* Live Score Tooltip - Enhanced with better positioning */}
                      <AnimatePresence>
                        {showLiveTooltip && hasLiveMatch && liveScoreText && (
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.95 }}
                            className="live-score-tooltip"
                          >
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              {liveScoreText}
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    {/* Quick Score label - enhanced */}
                    <span
                      className={`text-[10px] font-semibold mt-1.5 transition-colors duration-200 ${
                        isActive
                          ? 'text-white font-bold'
                          : 'text-white/90 dark:text-warm-100'
                      }`}
                    >
                      {t(tab.labelKey, language)}
                    </span>
                  </>
                ) : (
                  /* Regular tab items - Enhanced with active gradient bg */
                  <>
                    <motion.div
                      className="relative"
                      animate={{ scale: isActive ? 1.1 : 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      {/* Active background glow — enhanced with brand glow pulse */}
                      {isActive && (
                        <motion.div
                          className="absolute -inset-3 rounded-xl"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        >
                          {/* Inner glow */}
                          <div className="absolute inset-0 rounded-xl bg-brand-red/8 dark:bg-brand-red/10" />
                          {/* Outer glow ring */}
                          <motion.div
                            className="absolute -inset-1 rounded-xl"
                            animate={{
                              boxShadow: [
                                '0 0 4px rgba(220,38,38,0.2), 0 0 8px rgba(245,158,11,0.08)',
                                '0 0 12px rgba(220,38,38,0.4), 0 0 24px rgba(245,158,11,0.12)',
                                '0 0 4px rgba(220,38,38,0.2), 0 0 8px rgba(245,158,11,0.08)',
                              ],
                            }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        </motion.div>
                      )}
                      <Icon
                        className={`w-5 h-5 transition-colors duration-200 relative z-10 ${
                          isActive
                            ? 'text-brand-red'
                            : 'text-warm-400 dark:text-warm-500'
                        }`}
                        strokeWidth={isActive ? 2.5 : 2}
                      />

                      {/* Premium crown indicator on Profile tab - enhanced */}
                      {isProfile && isPremium && (
                        <motion.div
                          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-brand-gold flex items-center justify-center shadow-sm shadow-brand-gold/30"
                          animate={{ y: [0, -1, 0] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                          <Crown className="w-2 h-2 text-white" />
                        </motion.div>
                      )}

                      {/* Premium lock indicator on Tournaments tab for free users */}
                      {tab.id === 'tournaments' && !isPremium && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-brand-gold/80 flex items-center justify-center">
                          <Crown className="w-1.5 h-1.5 text-white" />
                        </div>
                      )}
                    </motion.div>

                    {/* Tab label */}
                    <span
                      className={`text-[10px] font-medium transition-colors duration-200 ${
                        isActive
                          ? 'text-brand-red'
                          : 'text-warm-400 dark:text-warm-500'
                      }`}
                    >
                      {t(tab.labelKey, language)}
                    </span>

                    {/* Active indicator dot - enhanced with morphing */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="w-1 h-1 rounded-full bg-gradient-to-r from-brand-red to-brand-gold"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                    </AnimatePresence>
                  </>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
