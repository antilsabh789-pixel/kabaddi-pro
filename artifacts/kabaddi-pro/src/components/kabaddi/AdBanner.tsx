'use client';

import { useEffect, useRef } from 'react';
import { useKabaddiStore } from '@/lib/store';
import { useAdConfig, useAdSenseScript } from '@/lib/useAdConfig';

/**
 * AdBanner — renders a Google AdSense ad unit.
 *
 * Behavior:
 *   - If the user is premium OR admin → renders nothing (ad-free experience
 *     is a premium perk).
 *   - If ads are disabled globally (admin hasn't enabled them) → renders nothing.
 *   - If no publisher ID is configured → renders nothing.
 *   - Otherwise, injects the AdSense script + renders an <ins> tag and pushes
 *     it to the adsbygoogle queue.
 *
 * Props:
 *   - slot: which AdSense slot ID to use (falls back to the configured slot
 *     for the given `placement`).
 *   - placement: 'home' | 'feed' | 'profile' — picks the configured slot.
 *   - format: AdSense ad format (default 'auto').
 *   - responsive: whether the ad is responsive (default true).
 *   - className: extra classes for the wrapper.
 *
 * Usage:
 *   <AdBanner placement="home" />
 *   <AdBanner placement="feed" slot="1234567890" />
 */

type AdPlacement = 'home' | 'feed' | 'profile';

interface AdBannerProps {
  placement?: AdPlacement;
  slot?: string; // override the configured slot
  format?: string;
  responsive?: boolean;
  className?: string;
}

export default function AdBanner({
  placement = 'home',
  slot,
  format = 'auto',
  responsive = true,
  className = '',
}: AdBannerProps) {
  const insRef = useRef<HTMLModElement>(null);
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { config, loading } = useAdConfig();
  useAdSenseScript(config?.publisherId);

  // Determine if this user should see ads.
  // Premium users + admins get an ad-free experience.
  const isAdFreeUser = !!(currentUser?.isPremium || currentUser?.isAdmin);

  // Pick the slot ID for this placement
  const slotId = slot || (placement === 'home'
    ? config?.homeBannerSlot
    : placement === 'feed'
    ? config?.feedNativeSlot
    : config?.profileBannerSlot) || null;

  // Push the ad to the adsbygoogle queue when the ins element mounts.
  // This is what actually triggers AdSense to fill the ad slot.
  useEffect(() => {
    if (isAdFreeUser || loading || !config?.adsEnabled || !config?.publisherId || !slotId) return;
    if (!insRef.current) return;

    try {
      // The adsbygoogle queue is pushed once per <ins> element. We guard with
      // a data attribute so React strict-mode double-mounts don't double-push.
      if (insRef.current.dataset.pushed !== 'true') {
        // @ts-expect-error - adsbygoogle is injected by the AdSense script
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        insRef.current.dataset.pushed = 'true';
      }
    } catch (err) {
      // AdSense sometimes throws if the script hasn't loaded yet — silently ignore.
      console.warn('AdSense push failed:', err);
    }
  }, [isAdFreeUser, loading, config?.adsEnabled, config?.publisherId, slotId]);

  // Don't render anything if:
  // - User is premium/admin (ad-free perk)
  // - Ads are globally disabled
  // - No publisher ID configured
  // - No slot ID for this placement
  // - Still loading config (avoid flash of empty ad container)
  if (isAdFreeUser || loading || !config?.adsEnabled || !config?.publisherId || !slotId) {
    return null;
  }

  return (
    <div className={`ad-container ${className}`} aria-label="Advertisement">
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', minHeight: '90px' }}
        data-ad-client={config.publisherId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
}
