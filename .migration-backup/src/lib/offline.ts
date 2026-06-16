/**
 * Offline mode support for scoring matches.
 * Saves match data to localStorage when offline,
 * syncs when connection is restored.
 */

const OFFLINE_KEY = 'kabaddi-offline-matches';

/** Check if the browser is currently online */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

/** Save match data to offline storage */
export function saveOfflineMatch(matchData: object): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getOfflineMatches();
    existing.push({
      ...matchData,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to save offline match:', err);
  }
}

/** Get all pending offline matches */
export function getOfflineMatches(): object[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as object[];
  } catch {
    return [];
  }
}

/** Attempt to sync offline matches to the server */
export async function syncOfflineMatches(): Promise<number> {
  const matches = getOfflineMatches();
  if (matches.length === 0) return 0;

  let syncedCount = 0;
  const remaining: object[] = [];

  for (const matchData of matches) {
    try {
      const res = await fetch('/api/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchData),
      });
      if (res.ok) {
        syncedCount++;
      } else {
        remaining.push(matchData);
      }
    } catch {
      // Still offline or network error — keep it for next sync
      remaining.push(matchData);
    }
  }

  // Update localStorage with remaining unsynced matches
  if (typeof window !== 'undefined') {
    localStorage.setItem(OFFLINE_KEY, JSON.stringify(remaining));
  }

  return syncedCount;
}

/** Set up online/offline event listeners */
export function onConnectionChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/** Get count of pending offline matches */
export function getOfflineMatchCount(): number {
  return getOfflineMatches().length;
}
