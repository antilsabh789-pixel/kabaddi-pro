'use client';

import { motion } from 'framer-motion';
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
    <nav className="fixed bottom-0 left-0 right-0 bg-warm-100/95 backdrop-blur-lg border-t border-warm-300 z-50 safe-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 pt-2 pb-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isQuickScore = tab.id === 'quick-score';
          const isProfile = tab.id === 'profile';
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] py-1 transition-colors duration-200 ${
                isQuickScore ? '-mt-5' : ''
              } ${isActive ? 'text-brand-red' : 'text-warm-500'}`}
            >
              {isQuickScore ? (
                <div
                  className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-red shadow-brand-red/30'
                      : hasLiveMatch
                        ? 'bg-brand-red shadow-brand-red/20 animate-pulse'
                        : 'bg-brand-red shadow-brand-red/20'
                  }`}
                >
                  <Icon className="w-6 h-6 text-white" />
                  {hasLiveMatch && !isActive && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-warm-100 animate-pulse" />
                  )}
                </div>
              ) : (
                <div className="relative">
                  <Icon className="w-5 h-5" />
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
                </div>
              )}
              <span
                className={`text-[10px] font-medium ${isQuickScore ? 'mt-1' : ''}`}
              >
                {tab.label}
              </span>
              {isActive && !isQuickScore && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand-red rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
