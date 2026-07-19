'use client';

import { useEffect } from 'react';
import { useKabaddiStore } from '@/lib/store';

/**
 * PremiumUpgradeScreen — post-premium-removal version.
 *
 * As of the "all-free" refactor, every feature in the app is free for all
 * users. There is no premium tier to upgrade to anymore. This component
 * used to be a full-screen upgrade modal with Cashfree payment; now it
 * simply calls `onClose` immediately and renders nothing.
 *
 * Kept as a thin stub so existing call sites that do
 *   {showUpgrade && <PremiumUpgradeScreen onClose={...} feature="..." />}
 * continue to compile and behave as a no-op (the modal never appears).
 *
 * ALSO: as a safety net, force `isPremium: true` on the current user the
 * first time this stub mounts. This catches stale persisted sessions in
 * localStorage that still have `isPremium: false` from before the refactor.
 * Once set, the rest of the app (which keys off `isPremium`) will treat
 * the user as unlocked for every screen.
 */
export default function PremiumUpgradeScreen({ onClose }: { onClose: () => void; feature?: string }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const updateUser = useKabaddiStore((s) => s.updateUser);

  useEffect(() => {
    // Safety net: if the persisted session still has isPremium=false,
    // flip it on so every `currentUser.isPremium` check across the app
    // evaluates to true. This is idempotent.
    if (currentUser && !currentUser.isPremium) {
      updateUser({
        isPremium: true,
        premiumExpiry: null,
        premiumPlan: 'lifetime',
      });
    }
    // Close the modal immediately — there's nothing to upgrade to.
    onClose();
  }, [currentUser, updateUser, onClose]);

  return null;
}
