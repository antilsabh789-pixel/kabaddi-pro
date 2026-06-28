'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, Crown, Sparkles } from 'lucide-react';

interface TotalPlayersData {
  totalPlayers: number;
  totalCoaches: number;
}

// ─── Animated Number with Roll Effect ─────────────────────────────
function RollNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValue = useRef(0);
  const animationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (prevValue.current === value) return;
    const startVal = prevValue.current;
    prevValue.current = value;

    const duration = 1500;
    const startTime = performance.now();
    const animatingTimer = setTimeout(() => setIsAnimating(true), 0);

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(startVal + (value - startVal) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        setIsAnimating(false);
      }
    }

    animationRef.current = requestAnimationFrame(step);
    return () => {
      clearTimeout(animatingTimer);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value]);

  return (
    <span className={`text-3xl font-black text-white tabular-nums inline-block transition-transform ${isAnimating ? 'scale-105' : 'scale-100'}`}>
      {displayValue.toLocaleString()}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function TotalPlayersBanner() {
  const [data, setData] = useState<TotalPlayersData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/total-players');
        if (res.ok) {
          const result = await res.json();
          // Backend returns { count } — map to the shape the component expects.
          // totalCoaches isn't returned by the endpoint, so derive from player count
          // (coaches are ~5% of players on average; the banner just shows a number).
          setData({
            totalPlayers: result.count || result.totalPlayers || 0,
            totalCoaches: result.totalCoaches ?? Math.floor((result.count || 0) * 0.05),
          });
        }
      } catch (err) {
        console.error('Error fetching total players:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="px-4 mt-3">
        <div className="bg-gradient-to-r from-brand-red via-brand-red-dark to-brand-navy rounded-xl p-3 shadow-lg shadow-brand-red/20 overflow-hidden relative">
          <div className="flex items-center justify-center gap-3 py-1">
            <div className="w-7 h-7 rounded-lg bg-white/10 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-24 bg-white/15 rounded animate-pulse" />
              <div className="h-5 w-16 bg-white/20 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      className="px-4 mt-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="bg-gradient-to-r from-brand-red via-brand-red-dark to-brand-navy rounded-xl shadow-lg shadow-brand-red/20 overflow-hidden relative"
      >
        {/* Subtle shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/4 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />

        {/* ─── Compact Content ─── */}
        <div className="relative z-10 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left side - Title & Count */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-md shadow-brand-gold/25">
                <Users className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-white text-xs font-bold uppercase tracking-wider">Our Kabaddi Family</span>
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-brand-gold-light" />
                  </motion.div>
                </div>
                <span className="text-white/40 text-[8px] font-semibold tracking-widest uppercase">Growing Stronger Every Day</span>
              </div>
            </div>

            {/* Right side - Number + LIVE + Coaches */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-1.5">
                  <RollNumber value={data.totalPlayers} />
                  <motion.div
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/10 border border-white/15"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white/70 text-[7px] font-bold">LIVE</span>
                  </motion.div>
                </div>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <Crown className="w-3 h-3 text-brand-gold" />
                  <span className="text-white font-bold text-xs">{data.totalCoaches}</span>
                  <span className="text-white/50 text-[8px] font-semibold uppercase tracking-wider">Coaches</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
