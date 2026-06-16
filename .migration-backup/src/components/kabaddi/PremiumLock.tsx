'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Crown } from 'lucide-react';
import { useKabaddiStore } from '@/lib/store';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';

interface PremiumLockProps {
  feature: string; // Name of the locked feature
  children: React.ReactNode;
  className?: string;
  compact?: boolean; // Smaller overlay for inline use
}

export default function PremiumLock({ feature, children, className = '', compact = false }: PremiumLockProps) {
  const { currentUser } = useKabaddiStore();
  const [showUpgrade, setShowUpgrade] = useState(false);

  // If user is premium, just render the children without lock
  if (currentUser?.isPremium) {
    return <>{children}</>;
  }

  if (compact) {
    return (
      <>
        <div className={`relative ${className}`} onClick={() => setShowUpgrade(true)}>
          {children}
          {/* Compact lock badge */}
          <div className="absolute top-2 right-2 z-10">
            <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center shadow-md">
              <Lock className="w-3 h-3 text-white" />
            </div>
          </div>
          {/* Subtle blur overlay */}
          <div className="absolute inset-0 bg-warm-50/60 backdrop-blur-[2px] rounded-xl z-[5] flex items-center justify-center cursor-pointer">
            <div className="flex items-center gap-1 text-brand-gold">
              <Crown className="w-4 h-4" />
              <span className="text-xs font-bold">PRO</span>
            </div>
          </div>
        </div>
        {showUpgrade && (
          <PremiumUpgradeScreen
            onClose={() => setShowUpgrade(false)}
            feature={feature}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={`relative group ${className}`}>
        {children}
        {/* Full lock overlay */}
        <div
          className="absolute inset-0 bg-warm-50/80 backdrop-blur-sm rounded-xl z-10 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
          onClick={() => setShowUpgrade(true)}
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-lg">
              <Crown className="w-5 h-5 text-white" />
            </div>
          </motion.div>
          <p className="text-sm font-bold text-warm-800">{feature}</p>
          <div className="flex items-center gap-1 bg-brand-gold/10 px-3 py-1 rounded-full">
            <Lock className="w-3 h-3 text-brand-gold" />
            <span className="text-xs font-semibold text-brand-gold">Premium Feature</span>
          </div>
          <p className="text-[10px] text-warm-500">Tap to unlock</p>
        </div>
      </div>
      {showUpgrade && (
        <PremiumUpgradeScreen
          onClose={() => setShowUpgrade(false)}
          feature={feature}
        />
      )}
    </>
  );
}
