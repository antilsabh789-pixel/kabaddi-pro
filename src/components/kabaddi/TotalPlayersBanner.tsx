'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, TrendingUp, UserPlus, Crown, Sparkles, Zap } from 'lucide-react';

interface TotalPlayersData {
  totalPlayers: number;
  totalCoaches: number;
  totalActivePlayers: number;
  recentSignups: number;
  todaySignups: number;
  latestSignup: {
    name: string;
    createdAt: string;
    role: string;
  } | null;
}

// ─── Animated Number with Roll Effect ─────────────────────────────
function RollNumber({ value, fontSize = 'text-5xl', fontWeight = 'font-black', color = 'text-white' }: {
  value: number;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValue = useRef(0);
  const animationRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  useEffect(() => {
    if (prevValue.current === value) return;
    const startVal = prevValue.current;
    prevValue.current = value;

    const duration = 2000;
    const startTime = performance.now();

    // Set animating via a microtask to avoid direct setState in effect
    const animatingTimer = setTimeout(() => setIsAnimating(true), 0);

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out elastic feel
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
    <span className={`${fontSize} ${fontWeight} ${color} tabular-nums inline-block transition-transform ${isAnimating ? 'scale-105' : 'scale-100'}`}>
      {displayValue.toLocaleString()}
    </span>
  );
}

// ─── Floating Particles ───────────────────────────────────────────
function FloatingParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 3,
    duration: 3 + Math.random() * 4,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.id % 3 === 0
              ? 'rgba(255,255,255,0.25)'
              : p.id % 3 === 1
                ? 'rgba(245,158,11,0.3)'
                : 'rgba(220,38,38,0.25)',
          }}
          animate={{
            y: [0, -30, -60],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.2, 0.3],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Pulse Ring Animation ─────────────────────────────────────────
function PulseRing() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-32 h-32 rounded-full border border-white/10"
          initial={{ scale: 0.8, opacity: 0.6 }}
          animate={{
            scale: [0.8, 1.5, 2],
            opacity: [0.4, 0.15, 0],
          }}
          transition={{
            duration: 3,
            delay: i * 1,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Stat Mini Card ───────────────────────────────────────────────
function StatMiniCard({ icon: Icon, label, value, delay, color = 'from-white/15 to-white/5' }: {
  icon: typeof Users;
  label: string;
  value: number;
  delay: number;
  color?: string;
}) {
  return (
    <motion.div
      className={`bg-gradient-to-br ${color} backdrop-blur-sm rounded-xl p-3 border border-white/10 relative overflow-hidden`}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.05, y: -2 }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
      <div className="flex items-center gap-2 relative z-10">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-brand-gold-light" />
        </div>
        <div>
          <div className="text-lg font-black text-white">{value.toLocaleString()}</div>
          <div className="text-[9px] text-white/60 font-semibold uppercase tracking-wider">{label}</div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function TotalPlayersBanner() {
  const [data, setData] = useState<TotalPlayersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/total-players');
        if (res.ok) {
          const result = await res.json();
          setData(result);
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
      <motion.div
        className="px-4 mt-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="bg-gradient-to-br from-brand-red via-brand-red-dark to-brand-navy rounded-2xl p-6 shadow-xl shadow-brand-red/25 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
          <div className="flex items-center justify-center gap-3 py-6 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-white/10 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-white/15 rounded animate-pulse" />
              <div className="h-8 w-24 bg-white/20 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!data) return null;

  return (
    <motion.div
      className="px-4 mt-3"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, type: 'spring', damping: 20 }}
    >
      <motion.div
        className="bg-gradient-to-br from-brand-red via-brand-red-dark to-brand-navy rounded-2xl shadow-xl shadow-brand-red/30 overflow-hidden relative cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
        whileTap={{ scale: 0.98 }}
      >
        {/* Decorative background circles */}
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/3" />
        <div className="absolute top-10 right-24 w-12 h-12 rounded-full bg-brand-gold/8" />
        <div className="absolute bottom-8 right-16 w-6 h-6 rounded-full bg-brand-gold/10" />

        {/* Court line pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/3 w-px h-full bg-white/4" />
          <div className="absolute top-0 left-2/3 w-px h-full bg-white/4" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/4" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/6" />
        </div>

        {/* Animated shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/6 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/5 via-transparent to-brand-teal/3" />

        {/* Floating particles */}
        <FloatingParticles />

        {/* ─── Main Content ─── */}
        <div className="relative z-10 p-5">
          {/* Header Row */}
          <motion.div
            className="flex items-center justify-between mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex items-center gap-2.5">
              <motion.div
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-lg shadow-brand-gold/30"
                animate={{
                  boxShadow: [
                    '0 4px 12px rgba(245,158,11,0.3)',
                    '0 4px 20px rgba(245,158,11,0.5)',
                    '0 4px 12px rgba(245,158,11,0.3)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Users className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-white text-sm font-bold uppercase tracking-wider">Total Players</span>
                  <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-3 h-3 text-brand-gold-light" />
                  </motion.div>
                </div>
                <span className="text-white/50 text-[9px] font-semibold tracking-widest uppercase">Kabaddi Pro Community</span>
              </div>
            </div>
            <motion.div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 border border-white/15"
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/80 text-[9px] font-bold">LIVE</span>
            </motion.div>
          </motion.div>

          {/* Big Number */}
          <motion.div
            className="flex items-center justify-center mb-3 relative"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, type: 'spring', damping: 12 }}
          >
            <PulseRing />
            <div className="text-center relative z-10">
              <RollNumber value={data.totalPlayers} fontSize="text-6xl" color="text-white" />
              <motion.div
                className="text-brand-gold-light text-xs font-bold uppercase tracking-widest mt-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                Players Signed Up
              </motion.div>
            </div>
          </motion.div>

          {/* Quick Stats Row */}
          <motion.div
            className="grid grid-cols-3 gap-2 mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="text-center bg-white/8 rounded-xl p-2 backdrop-blur-sm border border-white/5">
              <div className="flex items-center justify-center gap-1">
                <UserPlus className="w-3 h-3 text-emerald-400" />
                <span className="text-white font-bold text-sm">{data.todaySignups}</span>
              </div>
              <span className="text-white/50 text-[8px] font-semibold uppercase tracking-wider">Today</span>
            </div>
            <div className="text-center bg-white/8 rounded-xl p-2 backdrop-blur-sm border border-white/5">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3 text-brand-gold-light" />
                <span className="text-white font-bold text-sm">{data.recentSignups}</span>
              </div>
              <span className="text-white/50 text-[8px] font-semibold uppercase tracking-wider">This Week</span>
            </div>
            <div className="text-center bg-white/8 rounded-xl p-2 backdrop-blur-sm border border-white/5">
              <div className="flex items-center justify-center gap-1">
                <Crown className="w-3 h-3 text-brand-gold" />
                <span className="text-white font-bold text-sm">{data.totalCoaches}</span>
              </div>
              <span className="text-white/50 text-[8px] font-semibold uppercase tracking-wider">Coaches</span>
            </div>
          </motion.div>

          {/* Latest Signup Ticker */}
          {data.latestSignup && (
            <motion.div
              className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2 border border-white/8 overflow-hidden"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Zap className="w-3.5 h-3.5 text-brand-gold shrink-0" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <span className="text-white/70 text-[10px]">
                  <span className="text-brand-gold-light font-bold">New!</span>{' '}
                  <span className="font-semibold text-white/90">{data.latestSignup.name}</span>{' '}
                  joined as{' '}
                  <span className="font-semibold text-white/90">{data.latestSignup.role}</span>
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white/40 text-[9px] font-medium">
                  {new Date(data.latestSignup.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          )}

          {/* Expand/Collapse indicator */}
          <motion.div
            className="flex items-center justify-center mt-2"
            animate={{ rotate: showDetails ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>

          {/* ─── Expanded Details ─── */}
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-3 border-t border-white/10 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <StatMiniCard
                      icon={Users}
                      label="Active Players"
                      value={data.totalActivePlayers}
                      delay={0.1}
                      color="from-brand-gold/15 to-brand-gold/5"
                    />
                    <StatMiniCard
                      icon={TrendingUp}
                      label="This Week"
                      value={data.recentSignups}
                      delay={0.2}
                      color="from-emerald-500/15 to-emerald-500/5"
                    />
                  </div>

                  {/* Growth bar */}
                  <motion.div
                    className="mt-3 bg-white/5 rounded-xl p-3 border border-white/8"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/60 text-[9px] font-bold uppercase tracking-wider">Weekly Growth</span>
                      <span className="text-brand-gold-light text-[10px] font-bold">
                        {data.totalPlayers > 0 ? ((data.recentSignups / data.totalPlayers) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min((data.recentSignups / Math.max(data.totalPlayers, 1)) * 100 * 10, 100)}%`,
                        }}
                        transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
