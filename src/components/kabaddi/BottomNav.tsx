'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Home as HomeIcon, Trophy, PlusCircle, User, Crown } from 'lucide-react';
import { useKabaddiStore } from '@/lib/store';

const tabs = [
  { id: 'home' as const, label: 'Home', icon: HomeIcon },
  { id: 'tournaments' as const, label: 'Tournaments', icon: Trophy },
  { id: 'quick-score' as const, label: 'Quick Score', icon: PlusCircle },
  { id: 'profile' as const, label: 'Profile', icon: User },
];

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: 'home' | 'tournaments' | 'quick-score' | 'profile') => void;
  hasLiveMatch: boolean;
}

export default function BottomNav({ activeTab, setActiveTab, hasLiveMatch }: BottomNavProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || false;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      {/* Gradient top border */}
      <div className="h-px bg-gradient-to-r from-transparent via-brand-red/30 to-transparent" />

      {/* Frosted glass nav bar */}
      <div className="glass-effect dark:bg-warm-900/80 border-t border-white/10 dark:border-warm-700/30 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.4)]">
        <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-2 pb-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isQuickScore = tab.id === 'quick-score';
            const isProfile = tab.id === 'profile';
            const Icon = tab.icon;

            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: 0.9 }}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1 transition-colors duration-200 ${
                  isQuickScore ? '-mt-6' : ''
                }`}
              >
                {isQuickScore ? (
                  <>
                  {/* Quick Score Center Button */}
                  <motion.div
                    className="relative"
                    whileHover={{ scale: 1.05 }}
                    animate={hasLiveMatch ? { scale: [1, 1.04, 1] } : {}}
                    transition={hasLiveMatch ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                  >
                    {/* Glow effect when live */}
                    {hasLiveMatch && (
                      <motion.div
                        className="absolute inset-0 rounded-full"
                        animate={{
                          boxShadow: [
                            '0 0 8px rgba(220,38,38,0.3)',
                            '0 0 24px rgba(220,38,38,0.6)',
                            '0 0 8px rgba(220,38,38,0.3)',
                          ],
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    )}

                    {/* Main button */}
                    <div
                      className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-xl transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-br from-brand-red to-brand-gold shadow-brand-red/40'
                          : hasLiveMatch
                            ? 'bg-gradient-to-br from-brand-red to-red-500 shadow-brand-red/30'
                            : 'bg-gradient-to-br from-brand-red to-red-700 shadow-brand-red/20'
                      }`}
                    >
                      <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />

                      {/* Pulsing red dot for live match */}
                      {hasLiveMatch && !isActive && (
                        <span className="absolute -top-1 -right-1 flex">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                          <span className="relative inline-flex w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white dark:border-warm-900" />
                        </span>
                      )}
                    </div>
                  </motion.div>

                  {/* Quick Score label */}
                  <span
                    className={`text-[10px] font-semibold mt-1.5 transition-colors duration-200 ${
                      isActive
                        ? 'gradient-text'
                        : 'text-warm-500 dark:text-warm-400'
                    }`}
                  >
                    {tab.label}
                  </span>
                  </>
                ) : (
                  /* Regular tab items */
                  <>
                    <motion.div
                      className="relative"
                      animate={{ scale: isActive ? 1.1 : 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      <Icon
                        className={`w-5 h-5 transition-colors duration-200 ${
                          isActive
                            ? 'text-brand-red'
                            : 'text-warm-400 dark:text-warm-500'
                        }`}
                        strokeWidth={isActive ? 2.5 : 2}
                      />

                      {/* Premium crown indicator on Profile tab */}
                      {isProfile && isPremium && (
                        <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-brand-gold flex items-center justify-center">
                          <Crown className="w-2 h-2 text-white" />
                        </div>
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
                      {tab.label}
                    </span>

                    {/* Active indicator dot */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="w-1 h-1 rounded-full bg-brand-red"
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
