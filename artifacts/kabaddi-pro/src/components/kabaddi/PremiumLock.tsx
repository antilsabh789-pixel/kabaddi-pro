'use client';

/**
 * PremiumLock — post-premium-removal version.
 *
 * As of the "all-free" refactor, every feature in the app is free for all
 * users. The premium tier no longer exists. This component used to wrap
 * children in a lock overlay and pop up `PremiumUpgradeScreen` on tap; now
 * it simply renders its children, always, for everyone.
 *
 * Kept as a thin pass-through so that all the existing call sites
 *   <PremiumLock feature="...">{children}</PremiumLock>
 * continue to compile and render the (now-always-unlocked) content
 * without requiring a flag-day rewrite of every screen.
 */
export default function PremiumLock({ children }: { feature?: string; children: React.ReactNode; className?: string; compact?: boolean }) {
  return <>{children}</>;
}
