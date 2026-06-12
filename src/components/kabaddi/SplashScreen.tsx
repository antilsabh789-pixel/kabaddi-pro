'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useMemo } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

// Confetti particle component
function ConfettiParticle({ delay, x, size, color, duration }: { delay: number; x: number; size: number; color: string; duration: number }) {
  return (
    <motion.div
      className="absolute top-0 rounded-sm"
      style={{
        left: `${x}%`,
        width: size,
        height: size * 1.5,
        backgroundColor: color,
        animation: `confetti-fall ${duration}s linear ${delay}s infinite`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: duration, delay: delay, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// Decorative dots pattern
function DotPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.07]">
      {/* Grid of small dots */}
      {Array.from({ length: 8 }).map((_, row) =>
        Array.from({ length: 6 }).map((_, col) => (
          <div
            key={`dot-${row}-${col}`}
            className="absolute w-1 h-1 rounded-full bg-white"
            style={{
              top: `${10 + row * 12}%`,
              left: `${8 + col * 17}%`,
            }}
          />
        ))
      )}
    </div>
  );
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  // Generate confetti particles once
  const confettiParticles = useMemo(() => {
    const colors = ['#FCD34D', '#FBBF24', '#F59E0B', '#DC2626', '#EF4444', '#FFFFFF'];
    return Array.from({ length: 18 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 3,
    }));
  }, []);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-red-700 via-red-800 to-red-950 flex flex-col items-center justify-center relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => {
        setTimeout(onComplete, 2500);
      }}
    >
      {/* Geometric pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 36px),
          repeating-linear-gradient(-45deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 36px)`,
      }} />

      {/* Kabaddi mat circle pattern in background */}
      <motion.div
        className="absolute rounded-full border-[3px] border-white/[0.04]"
        style={{ width: 500, height: 500 }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1.2, opacity: 1 }}
        transition={{ delay: 0.2, duration: 1.5, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute rounded-full border-2 border-white/[0.06]"
        style={{ width: 360, height: 360 }}
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1.1, opacity: 1 }}
        transition={{ delay: 0.4, duration: 1.3, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute rounded-full border border-white/[0.08]"
        style={{ width: 220, height: 220 }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: 1.05, opacity: 1 }}
        transition={{ delay: 0.6, duration: 1.1, ease: 'easeOut' }}
      />

      {/* Center line of kabaddi mat */}
      <motion.div
        className="absolute w-0.5 bg-white/[0.05]"
        style={{ height: 500 }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
      />

      {/* Background decorative circles */}
      <motion.div
        className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full bg-white/5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      />
      <motion.div
        className="absolute bottom-[-60px] left-[-60px] w-48 h-48 rounded-full bg-white/5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      />

      {/* Decorative dots pattern */}
      <DotPattern />

      {/* Confetti particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {confettiParticles.map((p) => (
          <ConfettiParticle key={p.id} {...p} />
        ))}
      </div>

      {/* Decorative gold accent elements */}
      <motion.div
        className="absolute top-12 left-8 w-2 h-2 rounded-full bg-brand-gold/40"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.3, 1] }}
        transition={{ delay: 0.7, duration: 0.5 }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-2.5 h-2.5 rounded-full bg-brand-gold/30"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.3, 1] }}
        transition={{ delay: 0.9, duration: 0.5 }}
      />
      <motion.div
        className="absolute top-1/4 right-6 w-1.5 h-1.5 rounded-full bg-brand-gold/20"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.3, 1] }}
        transition={{ delay: 1.1, duration: 0.5 }}
      />

      {/* App Logo with enhanced animation sequence */}
      <motion.div
        initial={{ scale: 0, opacity: 0, rotate: -15 }}
        animate={{ scale: [0, 1.15, 1], opacity: [0, 1, 1], rotate: [0, 0, 0] }}
        transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
        className="relative z-10"
      >
        <div className="w-36 h-36 rounded-[2rem] bg-white shadow-2xl shadow-black/40 flex items-center justify-center overflow-hidden border-4 border-white/60">
          <Image
            src="/app-icon.png"
            alt="Kabaddi Pro"
            width={120}
            height={120}
            className="rounded-2xl"
            priority
          />
        </div>

        {/* Decorative dots around the logo */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * 45) * (Math.PI / 180);
          const radius = 82;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <motion.div
              key={`orbit-${i}`}
              className="absolute w-2 h-2 rounded-full bg-brand-gold/60"
              style={{
                top: '50%',
                left: '50%',
                marginTop: -4,
                marginLeft: -4,
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{ x, y, opacity: [0, 0.8, 0.5], scale: [0, 1.2, 1] }}
              transition={{ delay: 0.6 + i * 0.08, duration: 0.5, ease: 'easeOut' }}
            />
          );
        })}

        {/* Inner glow ring */}
        <motion.div
          className="absolute inset-[-8px] rounded-[2.5rem] border-2 border-brand-gold/40"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0, 0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
        />
        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-[-18px] rounded-[3rem] border border-brand-gold/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.15, 0.8], opacity: [0, 0.3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 1.5 }}
        />
        {/* Third glow ring */}
        <motion.div
          className="absolute inset-[-28px] rounded-[3.5rem] border border-white/10"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.2, 0.8], opacity: [0, 0.2, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: 2 }}
        />
      </motion.div>

      {/* App Name - Enhanced typography */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="mt-10 text-center relative z-10"
      >
        <h1 className="text-5xl font-black text-white tracking-[0.2em] drop-shadow-lg">
          KABADDI
          <span className="text-brand-gold-light"> PRO</span>
        </h1>

        {/* Tagline with fade-in effect */}
        <motion.p
          className="text-red-200/70 mt-3 text-sm font-medium tracking-[0.3em] uppercase"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          Live Scoring &amp; Tournaments
        </motion.p>

        {/* Gold accent line */}
        <motion.div
          className="mx-auto mt-4 h-0.5 rounded-full bg-gradient-to-r from-transparent via-brand-gold/50 to-transparent"
          initial={{ width: 0 }}
          animate={{ width: 120 }}
          transition={{ delay: 1.2, duration: 0.6, ease: 'easeOut' }}
        />
      </motion.div>

      {/* Loading indicator section */}
      <motion.div
        className="mt-12 flex flex-col items-center gap-4 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        {/* Animated progress bar */}
        <div className="w-40 h-1.5 bg-white/15 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.2, delay: 0.3, ease: 'easeInOut' }}
          />
        </div>

        {/* Animated bouncing dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-brand-gold"
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>

        {/* Loading text */}
        <motion.p
          className="text-white/30 text-xs tracking-widest uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        >
          Loading
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
