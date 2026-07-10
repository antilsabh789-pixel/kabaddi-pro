'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * useAdConfig — fetches the global ad configuration from the backend.
 * Returns { config, loading, isAdFreeUser }.
 *
 * The config is cached in module-level state so all AdBanner instances on a
 * page share a single fetch. Refreshed every 5 minutes (TTL).
 */

interface AdConfig {
  adsEnabled: boolean;
  publisherId: string | null;
  homeBannerSlot: string | null;
  feedNativeSlot: string | null;
  profileBannerSlot: string | null;
}

// Module-level cache so multiple AdBanner instances share one fetch.
let cachedConfig: AdConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function useAdConfig() {
  const [config, setConfig] = useState<AdConfig | null>(cachedConfig);
  const [loading, setLoading] = useState(!cachedConfig);

  const fetchConfig = useCallback(async (force = false) => {
    // Return cached config if it's fresh enough
    if (!force && cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      setConfig(cachedConfig);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/ads/config');
      const data = await res.json();
      cachedConfig = {
        adsEnabled: data.adsEnabled ?? false,
        publisherId: data.publisherId ?? null,
        homeBannerSlot: data.homeBannerSlot ?? null,
        feedNativeSlot: data.feedNativeSlot ?? null,
        profileBannerSlot: data.profileBannerSlot ?? null,
      };
      cacheTimestamp = Date.now();
      setConfig(cachedConfig);
    } catch (err) {
      console.error('Failed to fetch ad config:', err);
      // Default to ads disabled so we never break the UI
      cachedConfig = {
        adsEnabled: false,
        publisherId: null,
        homeBannerSlot: null,
        feedNativeSlot: null,
        profileBannerSlot: null,
      };
      cacheTimestamp = Date.now();
      setConfig(cachedConfig);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, refresh: () => fetchConfig(true) };
}

/**
 * useAdSenseScript — injects the AdSense script tag into <head> ONCE when the
 * publisher ID is first available. Subsequent calls are no-ops.
 */
let scriptInjected = false;
export function useAdSenseScript(publisherId: string | null | undefined) {
  useEffect(() => {
    if (!publisherId || scriptInjected) return;
    if (typeof document === 'undefined') return;

    // Check if the script is already in the DOM (e.g. from a previous session)
    const existing = document.querySelector(`script[src*="adsbygoogle.js"]`);
    if (existing) {
      scriptInjected = true;
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
    scriptInjected = true;
  }, [publisherId]);
}
