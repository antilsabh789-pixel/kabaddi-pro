'use client';

/**
 * PremiumLock
 *
 * Wraps children in a lock overlay if the current user is NOT premium.
 * Tapping the overlay opens the PremiumUpgradeScreen.
 *
 * Premium status comes from useKabaddiStore.currentUser.isPremium.
 * - Admins are always treated as premium (the API returns isPremium=true for them).
 * - If premiumExpiry is in the past, isPremium will be false (the /api/premium
 *   endpoint handles this logic on app load).
 *
 * Props:
 *   - feature: short label shown on the lock overlay (e.g. "Advanced Stats")
 *   - compact: if true, render a small "PRO" badge instead of a full overlay
 *              (useful for inline buttons that just need a visual hint)
 */
import { useState, useEffect } from 'react';
import { Crown, Lock, Sparkles } from 'lucide-react';
import { useKabaddiStore } from '@/lib/store';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';

export default function PremiumLock({
  feature,
  children,
  className = '',
  compact = false,
}: {
  feature?: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Auto-close the upgrade sheet when premium gets activated.
  useEffect(() => {
    if (currentUser?.isPremium) setShowUpgrade(false);
  }, [currentUser?.isPremium]);

  // Admins always pass through (the API already returns isPremium=true for them,
  // but this is a defensive check in case the store is stale).
  const isUnlocked = !!currentUser?.isPremium || !!currentUser?.isAdmin;

  // Compact mode: just show a small "PRO" badge alongside the children.
  // Useful for buttons/labels that should remain visible but hint at premium.
  if (compact) {
    return (
      <>
        <span className={className}>{children}</span>
        {!isUnlocked && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setShowUpgrade(true);
            }}
            className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-black text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full cursor-pointer"
            title="Premium feature — tap to upgrade"
          >
            <Crown className="w-2.5 h-2.5" /> PRO
          </span>
        )}
        {showUpgrade && <PremiumUpgradeScreen onClose={() => setShowUpgrade(false)} />}
      </>
    );
  }

  // Full mode: render children if unlocked, otherwise render a lock overlay.
  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        className={`relative ${className}`}
        onClick={() => setShowUpgrade(true)}
      >
        {/* Blurred preview of the locked content */}
        <div className="pointer-events-none select-none opacity-40 blur-[2px]" aria-hidden>
          {children}
        </div>
        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 dark:bg-warm-900/60 backdrop-blur-sm rounded-xl cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Premium Feature
          </p>
          {feature && (
            <p className="text-[10px] text-warm-500 dark:text-warm-400 -mt-1">{feature}</p>
          )}
          <p className="text-[10px] text-amber-600 dark:text-amber-500 font-bold mt-1">
            Tap to unlock →
          </p>
        </div>
      </div>
      {showUpgrade && <PremiumUpgradeScreen onClose={() => setShowUpgrade(false)} />}
    </>
  );
}
