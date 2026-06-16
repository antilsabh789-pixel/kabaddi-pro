'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useMemo, useState, useEffect, useCallback } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

// Motivational kabaddi quotes that rotate each launch
const KABADDI_QUOTES = [
  "One breath. One raid. One champion.",
  "Where courage meets the mat.",
  "Touch the line. Own the game.",
  "Strength is born on the kabaddi mat.",
  "No retreat. No surrender. Just raid.",
  "The mat doesn't lie. Neither does the score.",
  "Every raid writes a new story.",
  "Heart of a raider. Soul of a defender.",
  "Chase the touch. Embrace the tackle.",
  "In kabaddi, we trust the breath.",
];

// Loading context messages that cycle
const LOADING_MESSAGES = [
  "Loading match data...",
  "Preparing the mat...",
  "Warming up raiders...",
  "Setting up the court...",
  "Getting live scores...",
  "Almost ready...",
];

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

// Particle burst effect for logo appearance
function ParticleBurst() {
  const particles = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const angle = (i * 30) * (Math.PI / 180);
      const distance = 60 + Math.random() * 40;
      return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: 3 + Math.random() * 4,
        color: i % 2 === 0 ? '#FCD34D' : '#EF4444',
        duration: 0.6 + Math.random() * 0.4,
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={`burst-${p.id}`}
          className="absolute w-2 h-2 rounded-full"
          style={{ backgroundColor: p.color, width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ x: p.x, y: p.y, scale: 0, opacity: 0 }}
          transition={{ duration: p.duration, delay: 0.8, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// Morphing kabaddi player silhouette
function PlayerSilhouette() {
  return (
    <motion.div
      className="absolute bottom-32 left-1/2 -translate-x-1/2 opacity-[0.06]"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 0.06, scale: 1 }}
      transition={{ delay: 0.5, duration: 1 }}
    >
      <div
        className="w-20 h-32 bg-white silhouette-morph"
        style={{
          clipPath: 'polygon(50% 0%, 65% 15%, 70% 35%, 85% 40%, 75% 55%, 80% 75%, 65% 85%, 55% 100%, 45% 100%, 35% 85%, 20% 75%, 25% 55%, 15% 40%, 30% 35%, 35% 15%)',
        }}
      />
    </motion.div>
  );
}

// Sound wave visualization pattern
function SoundWave() {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={`wave-${i}`}
          className="sound-wave-bar"
          style={{
            animationDelay: `${i * 0.12}s`,
            animationDuration: `${0.8 + i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

// App version - read from package.json would be ideal but we'll use a constant
const APP_VERSION = '1.2.0';

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showSkip, setShowSkip] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  // Pick a random quote for this launch
  const quote = useMemo(() => {
    return KABADDI_QUOTES[Math.floor(Math.random() * KABADDI_QUOTES.length)];
  }, []);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // Show skip button after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Cycle loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Simulated progress bar — auto-complete when full
  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 15 + 5;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        // Auto-complete splash after progress fills
        setTimeout(() => handleSkip(), 300);
      }
      setProgress(current);
    }, 400);
    return () => clearInterval(interval);
  }, [handleSkip]);

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
      onClick={showSkip ? handleSkip : undefined}
      style={{ cursor: showSkip ? 'pointer' : 'default' }}
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

      {/* Morphing player silhouette */}
      <PlayerSilhouette />

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
        {/* Particle burst behind logo */}
        <ParticleBurst />

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

        {/* Motivational quote */}
        <motion.p
          className="mt-4 text-white/40 text-xs italic max-w-[260px] mx-auto leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0.5] }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          &ldquo;{quote}&rdquo;
        </motion.p>
      </motion.div>

      {/* Loading indicator section */}
      <motion.div
        className="mt-10 flex flex-col items-center gap-4 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        {/* Animated progress bar with estimated loading */}
        <div className="w-48 h-2 bg-white/15 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light"
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Sound wave visualization */}
        <SoundWave />

        {/* Cycling loading text */}
        <div className="h-4 flex items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingMsgIndex}
              className="text-white/30 text-xs tracking-widest uppercase"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 0.5, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              {LOADING_MESSAGES[loadingMsgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Version number at bottom */}
      <motion.div
        className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <p className="text-white/20 text-[10px] tracking-widest">
          v{APP_VERSION}
        </p>

        {/* Skip button */}
        <AnimatePresence>
          {showSkip && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => {
                e.stopPropagation();
                handleSkip();
              }}
              className="px-5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/60 text-xs font-medium tracking-wider transition-colors border border-white/10"
              aria-label="Skip splash screen"
            >
              SKIP
            </motion.button>
          )}
        </AnimatePresence>

        {/* Tap to skip hint */}
        {showSkip && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            className="text-white/20 text-[9px] tracking-wider"
          >
            Tap anywhere to skip
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}
