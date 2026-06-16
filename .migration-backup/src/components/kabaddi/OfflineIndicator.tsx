'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function OfflineIndicator() {
  const [bannerState, setBannerState] = useState<'hidden' | 'offline' | 'online'>('hidden');

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;

    const handleOnline = () => {
      setBannerState('online');
      hideTimer = setTimeout(() => setBannerState('hidden'), 3000);
    };

    const handleOffline = () => {
      setBannerState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(hideTimer);
    };
  }, []);

  if (bannerState === 'hidden') return null;

  const isOnline = bannerState === 'online';

  return (
    <AnimatePresence>
      <motion.div
        key={bannerState}
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2 ${
          isOnline
            ? 'bg-emerald-500 text-white'
            : 'bg-warm-800 text-warm-100'
        }`}
      >
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4" />
            Back Online — Data will sync
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            Offline — Score matches, sync when connected
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
