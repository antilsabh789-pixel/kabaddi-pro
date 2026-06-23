'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKabaddiStore } from '@/lib/store';
import { Swords, Shield, X, Volume2, Sparkles, CircleDot, ArrowLeft, Zap, MapPin, FastForward } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Toss Phases ────────────────────────────────────────────────────
type TossPhase = 'choose-caller' | 'choose-side' | 'ready' | 'flipping' | 'result' | 'choose-advantage' | 'countdown' | 'skip-toss';

// ─── Confetti Particle ──────────────────────────────────────────────

function TossConfetti({ color, index }: { color: string; index: number }) {
  const leftPos = (index * 23 + 7) % 100;
  const rotateEnd = (index * 53 + 17) % 720 - 360;
  const xDrift = ((index * 37) % 100) - 50;
  const sizeClass = index % 3 === 0 ? 'w-3 h-3' : index % 3 === 1 ? 'w-2 h-2' : 'w-1.5 h-1.5';
  const shapeClass = index % 4 === 0 ? 'rounded-full' : index % 4 === 1 ? 'rounded-sm' : index % 4 === 2 ? 'rounded-l-full' : 'rounded-t-full';

  return (
    <motion.div
      initial={{ y: -20, x: 0, rotate: 0, opacity: 1, scale: 1 }}
      animate={{ y: '100vh', x: xDrift, rotate: rotateEnd, opacity: 0, scale: 0.5 }}
      transition={{ duration: 2.5 + (index % 4) * 0.5, delay: index * 0.04, ease: 'easeIn' }}
      className={cn('absolute top-0', sizeClass, shapeClass)}
      style={{ left: `${leftPos}%`, backgroundColor: color }}
    />
  );
}

// ─── Floating Particle ──────────────────────────────────────────────

function FloatingParticle({ color, delay, x, size }: { color: string; delay: number; x: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        left: `${x}%`,
        top: '50%',
        filter: `blur(${size > 4 ? 2 : 1}px)`,
      }}
      animate={{
        y: [-30, 30, -30],
        x: [-10, 10, -10],
        opacity: [0.15, 0.5, 0.15],
        scale: [0.8, 1.2, 0.8],
      }}
      transition={{
        duration: 4 + delay,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
    />
  );
}

// ─── Team Avatar ────────────────────────────────────────────────────

function TeamAvatar({ name, color, size = 'md', glow = false }: { name: string; color: string; size?: 'sm' | 'md' | 'lg'; glow?: boolean }) {
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-20 h-20 text-2xl',
  };

  return (
    <motion.div
      className={cn('rounded-full flex items-center justify-center font-black text-white', sizeClasses[size])}
      style={{
        backgroundColor: color,
        boxShadow: glow ? `0 0 24px ${color}60, 0 0 48px ${color}30` : `0 0 12px ${color}30`,
        border: '2px solid rgba(255,255,255,0.2)',
      }}
      whileHover={{ scale: 1.05 }}
    >
      {name.charAt(0)}
    </motion.div>
  );
}

// ─── Coin Face: Heads (KABADDI PRO side) ────────────────────────────

function CoinHeadsFace() {
  return (
    <div
      className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-2xl border-[3px] overflow-hidden"
      style={{
        backfaceVisibility: 'hidden',
        background: 'linear-gradient(145deg, #FFD700 0%, #DAA520 25%, #B8860B 50%, #DAA520 75%, #FFD700 100%)',
        borderColor: '#FFD700',
        boxShadow: `
          0 0 40px rgba(255,215,0,0.2),
          0 0 80px rgba(255,215,0,0.1),
          inset 0 2px 4px rgba(255,255,255,0.3),
          inset 0 -2px 4px rgba(0,0,0,0.2)
        `,
      }}
    >
      {/* Ornamental outer ring */}
      <div className="absolute inset-[6px] rounded-full border-2 border-dashed" style={{ borderColor: 'rgba(139,101,8,0.5)' }} />
      {/* Inner decorative ring */}
      <div className="absolute inset-[14px] rounded-full border" style={{ borderColor: 'rgba(139,101,8,0.4)' }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <span
          className="text-[8px] font-black tracking-[0.4em] opacity-70 mb-1"
          style={{ color: '#8B6508', textShadow: '0 1px 0 rgba(255,255,255,0.3)' }}
        >
          ★ KABADDI ★
        </span>
        <span
          className="text-3xl font-black tracking-[0.2em] leading-none"
          style={{ color: '#8B6508', textShadow: '0 2px 0 rgba(255,255,255,0.2), 0 -1px 0 rgba(0,0,0,0.3)' }}
        >
          PRO
        </span>
        {/* Decorative divider with raider icon */}
        <div className="flex items-center gap-1 my-1.5">
          <div className="w-8 h-[1px] bg-amber-800/50" />
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" className="opacity-50">
            <path d="M16 4 C14 4 13 5.5 13 7 C13 8.5 14 10 16 10 C18 10 19 8.5 19 7 C19 5.5 18 4 16 4Z" fill="#8B6508" />
            <path d="M14 10.5 C12 11 11 12.5 11 14 L11 20 C11 20.5 11.5 21 12 21 C12.5 21 13 20.5 13 20 L13 15 L14 15 L14 22 C14 22.5 14.5 23 15 23 L15 28 C15 28.5 15.5 29 16 29 C16.5 29 17 28.5 17 28 L17 23 L18 23 L18 28 C18 28.5 18.5 29 19 29 C19.5 29 20 28.5 20 28 L20 23 C20.5 23 21 22.5 21 22 L21 15 L22 15 L22 20 C22 20.5 22.5 21 23 21 C23.5 21 24 20.5 24 20 L24 14 C24 12.5 23 11 21 10.5 Z" fill="#8B6508" />
            <path d="M22 12 L28 9 C28.5 8.8 29 9 29 9.5 C29 10 28.8 10.5 28.3 10.6 L22 13.5 Z" fill="#8B6508" />
          </svg>
          <div className="w-8 h-[1px] bg-amber-800/50" />
        </div>
        <span className="text-[9px] font-black tracking-[0.3em] opacity-60" style={{ color: '#8B6508' }}>HEADS</span>
      </div>

      {/* Corner decorative dots */}
      {[0, 90, 180, 270].map((angle) => (
        <div
          key={angle}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: 'rgba(139,101,8,0.4)',
            top: angle === 0 || angle === 90 ? '8px' : undefined,
            bottom: angle === 180 || angle === 270 ? '8px' : undefined,
            left: angle === 0 || angle === 270 ? '8px' : undefined,
            right: angle === 90 || angle === 180 ? '8px' : undefined,
          }}
        />
      ))}

      {/* Emboss overlay */}
      <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)' }} />
    </div>
  );
}

// ─── Coin Face: Tails (KP side) ─────────────────────────────────────

function CoinTailsFace() {
  return (
    <div
      className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-2xl border-[3px] overflow-hidden"
      style={{
        backfaceVisibility: 'hidden',
        transform: 'rotateX(180deg)',
        background: 'linear-gradient(145deg, #E8E8E8 0%, #B0B0B0 25%, #808080 50%, #B0B0B0 75%, #E8E8E8 100%)',
        borderColor: '#C0C0C0',
        boxShadow: `
          0 0 40px rgba(192,192,192,0.2),
          0 0 80px rgba(192,192,192,0.1),
          inset 0 2px 4px rgba(255,255,255,0.4),
          inset 0 -2px 4px rgba(0,0,0,0.2)
        `,
      }}
    >
      {/* Ornamental outer ring */}
      <div className="absolute inset-[6px] rounded-full border-2 border-dashed" style={{ borderColor: 'rgba(80,80,80,0.4)' }} />
      {/* Inner decorative ring */}
      <div className="absolute inset-[14px] rounded-full border" style={{ borderColor: 'rgba(80,80,80,0.3)' }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <span
          className="text-[8px] font-black tracking-[0.4em] opacity-60 mb-1"
          style={{ color: '#404040', textShadow: '0 1px 0 rgba(255,255,255,0.3)' }}
        >
          ★ KABADDI ★
        </span>
        <span
          className="text-4xl font-black tracking-[0.25em] leading-none"
          style={{ color: '#404040', textShadow: '0 2px 0 rgba(255,255,255,0.2), 0 -1px 0 rgba(0,0,0,0.3)' }}
        >
          KP
        </span>
        {/* Decorative divider */}
        <div className="flex items-center gap-1 my-1.5">
          <div className="w-8 h-[1px] bg-gray-600/50" />
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" className="opacity-40">
            <path d="M16 4 C14 4 13 5.5 13 7 C13 8.5 14 10 16 10 C18 10 19 8.5 19 7 C19 5.5 18 4 16 4Z" fill="#404040" />
            <path d="M14 10.5 C12 11 11 12.5 11 14 L11 20 C11 20.5 11.5 21 12 21 C12.5 21 13 20.5 13 20 L13 15 L14 15 L14 22 C14 22.5 14.5 23 15 23 L15 28 C15 28.5 15.5 29 16 29 C16.5 29 17 28.5 17 28 L17 23 L18 23 L18 28 C18 28.5 18.5 29 19 29 C19.5 29 20 28.5 20 28 L20 23 C20.5 23 21 22.5 21 22 L21 15 L22 15 L22 20 C22 20.5 22.5 21 23 21 C23.5 21 24 20.5 24 20 L24 14 C24 12.5 23 11 21 10.5 Z" fill="#404040" />
            <path d="M22 12 L28 9 C28.5 8.8 29 9 29 9.5 C29 10 28.8 10.5 28.3 10.6 L22 13.5 Z" fill="#404040" />
          </svg>
          <div className="w-8 h-[1px] bg-gray-600/50" />
        </div>
        <span className="text-[9px] font-black tracking-[0.3em] opacity-60" style={{ color: '#404040' }}>TAILS</span>
      </div>

      {/* Corner decorative dots */}
      {[0, 90, 180, 270].map((angle) => (
        <div
          key={angle}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: 'rgba(80,80,80,0.4)',
            top: angle === 0 || angle === 90 ? '8px' : undefined,
            bottom: angle === 180 || angle === 270 ? '8px' : undefined,
            left: angle === 0 || angle === 270 ? '8px' : undefined,
            right: angle === 90 || angle === 180 ? '8px' : undefined,
          }}
        />
      ))}

      {/* Emboss overlay */}
      <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(0,0,0,0.15) 100%)' }} />
    </div>
  );
}

// ─── Advantage Card ─────────────────────────────────────────────────

function AdvantageCard({
  icon,
  title,
  subtitle,
  color,
  onClick,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', damping: 20, stiffness: 200 }}
      whileTap={{ scale: 0.93 }}
      whileHover={{ scale: 1.03 }}
      onClick={onClick}
      className="flex-1 py-6 px-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all relative overflow-hidden group"
      style={{
        borderColor: `${color}50`,
        backgroundColor: `${color}10`,
      }}
    >
      {/* Shimmer effect on hover */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(135deg, transparent, ${color}15, transparent)` }}
      />

      {/* Icon container with glow */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center relative z-10"
        style={{
          backgroundColor: `${color}20`,
          boxShadow: `0 0 20px ${color}20`,
        }}
      >
        {icon}
      </div>

      <div className="font-black text-base relative z-10" style={{ color }}>{title}</div>
      <div className="text-[11px] text-warm-500 dark:text-gray-400 relative z-10 leading-tight text-center max-w-[140px]">{subtitle}</div>
    </motion.button>
  );
}

// ─── Phase Indicator ────────────────────────────────────────────────

function PhaseIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <motion.div
            className="w-2.5 h-2.5 rounded-full"
            animate={{
              backgroundColor: i < current ? '#FFD700' : i === current ? '#FFFFFF' : 'rgba(255,255,255,0.2)',
              scale: i === current ? 1.3 : 1,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          />
          {i < total - 1 && (
            <div className="w-6 h-[1px]" style={{ backgroundColor: i < current ? '#FFD700' : 'rgba(255,255,255,0.15)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main TossScreen ────────────────────────────────────────────────

interface TossScreenProps {
  homeTeam: string;
  awayTeam: string;
  homeTeamColor: string;
  awayTeamColor: string;
  onTossComplete: (firstRaidTeam: 'home' | 'away') => void;
  onBack: () => void;
}

export default function TossScreen({
  homeTeam,
  awayTeam,
  homeTeamColor,
  awayTeamColor,
  onTossComplete,
  onBack,
}: TossScreenProps) {
  // Phase state
  const [phase, setPhase] = useState<TossPhase>('choose-caller');

  // Toss data
  const [callingTeam, setCallingTeam] = useState<'home' | 'away' | null>(null);
  const [chosenSide, setChosenSide] = useState<'heads' | 'tails' | null>(null);
  const [coinResult, setCoinResult] = useState<'heads' | 'tails'>('heads');
  const [tossWinner, setTossWinner] = useState<'home' | 'away' | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  // Skip toss data
  const [skipTossWinner, setSkipTossWinner] = useState<'home' | 'away' | null>(null);
  const [skipTossChoice, setSkipTossChoice] = useState<'raid' | 'court' | null>(null);

  // Countdown
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived
  const callingTeamName = callingTeam === 'home' ? homeTeam : callingTeam === 'away' ? awayTeam : '';
  const callingTeamColor = callingTeam === 'home' ? homeTeamColor : callingTeam === 'away' ? awayTeamColor : '';
  const winnerName = tossWinner === 'home' ? homeTeam : tossWinner === 'away' ? awayTeam : '';
  const winnerColor = tossWinner === 'home' ? homeTeamColor : tossWinner === 'away' ? awayTeamColor : '';
  const loserName = tossWinner === 'home' ? awayTeam : tossWinner === 'away' ? homeTeam : '';
  const loserColor = tossWinner === 'home' ? awayTeamColor : tossWinner === 'away' ? homeTeamColor : '';

  // Phase step number for indicator
  const phaseStep: number = phase === 'choose-caller' ? 0 : phase === 'choose-side' ? 1 : phase === 'ready' ? 1 : phase === 'flipping' ? 1 : phase === 'result' ? 2 : phase === 'choose-advantage' ? 2 : 2;

  // Clean up countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleSelectCaller = (team: 'home' | 'away') => {
    setCallingTeam(team);
    setPhase('choose-side');
  };

  const handleChooseSide = (side: 'heads' | 'tails') => {
    setChosenSide(side);
    setPhase('ready');
  };

  const doToss = useCallback(() => {
    setPhase('flipping');
    setFlipKey((k) => k + 1);

    // Determine coin result randomly
    const result: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';
    setCoinResult(result);

    // The calling team wins if the coin result matches their choice
    const winner: 'home' | 'away' = result === chosenSide ? callingTeam! : (callingTeam === 'home' ? 'away' : 'home');
    setTossWinner(winner);

    // Show confetti and move to result after animation
    setTimeout(() => {
      setShowConfetti(true);
      setPhase('result');
    }, 2200);
  }, [chosenSide, callingTeam]);

  const handleChooseAdvantage = (firstRaidTeam: 'home' | 'away') => {
    setPhase('countdown');
    setCountdown(3);

    let count = 3;
    countdownRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        onTossComplete(firstRaidTeam);
      }
    }, 800);
  };

  // ─── Strategy text ───────────────────────────────────────────────

  const raidStrategy = `${winnerName} raids first — put early pressure on ${loserName}'s defense`;
  const defendStrategy = `${winnerName} defends first — choose your court side and force ${loserName} into empty raids`;

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-950 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* ═══ Background — Team color spotlights ═══ */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Home spotlight */}
        <motion.div
          className="absolute top-0 left-0 w-1/2 h-full"
          style={{ background: `radial-gradient(ellipse at 30% 50%, ${homeTeamColor}15, transparent 70%)` }}
          animate={phase === 'flipping' ? { opacity: [0.5, 0.9, 0.5] } : { opacity: 0.5 }}
          transition={{ duration: 1, repeat: phase === 'flipping' ? Infinity : 0 }}
        />
        {/* Away spotlight */}
        <motion.div
          className="absolute top-0 right-0 w-1/2 h-full"
          style={{ background: `radial-gradient(ellipse at 70% 50%, ${awayTeamColor}15, transparent 70%)` }}
          animate={phase === 'flipping' ? { opacity: [0.5, 0.9, 0.5] } : { opacity: 0.5 }}
          transition={{ duration: 1, repeat: phase === 'flipping' ? Infinity : 0, delay: 0.5 }}
        />
        {/* Center glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 opacity-5 bg-yellow-400 rounded-full" />

        {/* Floating particles */}
        {Array.from({ length: 16 }).map((_, i) => (
          <FloatingParticle
            key={i}
            color={i < 8 ? homeTeamColor : awayTeamColor}
            delay={i * 0.35}
            x={(i * 6 + 5) % 100}
            size={2 + (i % 4) * 2}
          />
        ))}

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ═══ Confetti ═══ */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
            {Array.from({ length: 50 }).map((_, i) => {
              const colors = [homeTeamColor, awayTeamColor, '#FFD700', '#FF6B35', '#FFFFFF', '#E040FB', '#00E5FF'];
              return <TossConfetti key={`confetti-${i}`} color={colors[i % colors.length]} index={i} />;
            })}
          </div>
        )}
      </AnimatePresence>

      {/* ═══ Close / Back button ═══ */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        onClick={onBack}
        className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 hover:bg-white/20 transition-colors"
        aria-label="Close toss"
      >
        <X className="w-5 h-5 text-white/70" />
      </motion.button>

      {/* ═══ Skip Toss button ═══ */}
      {phase !== 'countdown' && phase !== 'skip-toss' && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          onClick={() => setPhase('skip-toss')}
          className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-colors"
        >
          <FastForward className="w-4 h-4 text-white/70" />
          <span className="text-xs font-bold text-white/70">Skip Toss</span>
        </motion.button>
      )}

      {/* ═══ Phase Indicator ═══ */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
        <PhaseIndicator current={phaseStep} total={3} />
      </div>

      {/* ═══ Phase Labels ═══ */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 text-center">
        <AnimatePresence mode="wait">
          {phase === 'choose-caller' && (
            <motion.div key="label-caller" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
              <span className="text-[10px] font-bold text-warm-500 dark:text-gray-500 uppercase tracking-[0.3em]">Step 1 — Choose Caller</span>
            </motion.div>
          )}
          {(phase === 'choose-side' || phase === 'ready' || phase === 'flipping') && (
            <motion.div key="label-side" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
              <span className="text-[10px] font-bold text-warm-500 dark:text-gray-500 uppercase tracking-[0.3em]">Step 2 — Call the Toss</span>
            </motion.div>
          )}
          {(phase === 'result' || phase === 'choose-advantage' || phase === 'countdown') && (
            <motion.div key="label-adv" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}>
              <span className="text-[10px] font-bold text-warm-500 dark:text-gray-500 uppercase tracking-[0.3em]">Step 3 — Choose Advantage</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Header with VS ═══ */}
      <div className="relative z-10 text-center mb-4 mt-8">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center gap-3 sm:gap-5 justify-center"
        >
          {/* Home team */}
          <div className="flex items-center gap-2">
            <TeamAvatar name={homeTeam} color={homeTeamColor} size="sm" glow={tossWinner === 'home'} />
            <span className="text-sm font-bold text-white max-w-[80px] sm:max-w-[120px] truncate">{homeTeam}</span>
          </div>

          {/* VS */}
          <motion.div
            className="flex flex-col items-center"
            animate={phase === 'flipping' ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5, repeat: phase === 'flipping' ? Infinity : 0 }}
          >
            <span className="text-xs font-black text-gray-600">VS</span>
          </motion.div>

          {/* Away team */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white max-w-[80px] sm:max-w-[120px] truncate">{awayTeam}</span>
            <TeamAvatar name={awayTeam} color={awayTeamColor} size="sm" glow={tossWinner === 'away'} />
          </div>
        </motion.div>
      </div>

      {/* ═══ Coin ═══ */}
      <div className="relative z-10 mb-4">
        <div className="perspective-[800px]">
          <motion.div
            key={flipKey}
            animate={
              phase === 'flipping'
                ? {
                    rotateX: [0, 720, 1440, 2160, 2880, 3240, 3600],
                    scale: [1, 1.3, 1.4, 1.3, 1.2, 1.05, 1],
                  }
                : phase === 'result' || phase === 'choose-advantage'
                  ? {
                      rotateX: coinResult === 'heads' ? 0 : 180,
                      scale: [1, 1.08, 1],
                    }
                  : phase === 'choose-caller' || phase === 'choose-side' || phase === 'ready'
                    ? { rotateY: [0, 5, -5, 0], rotateX: 0 }
                    : { rotateX: coinResult === 'heads' ? 0 : 180 }
            }
            transition={
              phase === 'flipping'
                ? { duration: 2, ease: [0.25, 0.1, 0.25, 1] }
                : phase === 'result' || phase === 'choose-advantage'
                  ? { duration: 0.4, ease: 'easeOut' }
                  : { duration: 4, repeat: Infinity, ease: 'easeInOut' }
            }
            className="w-36 h-36 sm:w-44 sm:h-44 relative"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <CoinHeadsFace />
            <CoinTailsFace />
          </motion.div>
        </div>

        {/* Coin label beneath */}
        <AnimatePresence mode="wait">
          {phase === 'flipping' && (
            <motion.div
              key="flip-label"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-center mt-3"
            >
              <div className="flex items-center justify-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-4 rounded-full bg-yellow-500/60"
                    animate={{ height: [4, 16, 4], opacity: [0.3, 0.9, 0.3] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
                  />
                ))}
              </div>
              <span className="text-xs text-warm-500 dark:text-gray-400 font-mono mt-1 block">FLIPPING...</span>
            </motion.div>
          )}
          {(phase === 'result' || phase === 'choose-advantage') && (
            <motion.div
              key="result-label"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mt-3"
            >
              <span
                className="text-sm font-black tracking-wider"
                style={{
                  color: coinResult === 'heads' ? '#FFD700' : '#C0C0C0',
                  textShadow: `0 0 10px ${coinResult === 'heads' ? 'rgba(255,215,0,0.4)' : 'rgba(192,192,192,0.4)'}`,
                }}
              >
                It&apos;s {coinResult === 'heads' ? 'HEADS' : 'TAILS'}!
              </span>
            </motion.div>
          )}
          {(phase === 'choose-caller' || phase === 'choose-side' || phase === 'ready') && (
            <motion.div
              key="idle-label"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center mt-3"
            >
              <span className="text-[10px] text-gray-600 font-mono block tracking-wider">KABADDI PRO CHAMPIONSHIP COIN</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Phase 1: Choose Caller ═══ */}
      <AnimatePresence>
        {phase === 'choose-caller' && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative z-10 text-center w-full max-w-sm"
          >
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl font-black text-white mb-2"
            >
              Who Calls the Toss?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-warm-500 dark:text-gray-400 mb-6"
            >
              Select which team will call Heads or Tails before the flip
            </motion.p>

            <div className="flex gap-4 justify-center">
              {/* Home team button */}
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, type: 'spring', damping: 20 }}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => handleSelectCaller('home')}
                className="flex-1 py-6 px-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all group relative overflow-hidden"
                style={{
                  borderColor: `${homeTeamColor}40`,
                  backgroundColor: `${homeTeamColor}08`,
                }}
              >
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(135deg, transparent, ${homeTeamColor}10, transparent)` }}
                />
                <TeamAvatar name={homeTeam} color={homeTeamColor} size="md" />
                <span className="font-black text-sm relative z-10" style={{ color: homeTeamColor }}>{homeTeam}</span>
                <span className="text-[10px] text-warm-500 dark:text-gray-500 relative z-10">Call the toss</span>
              </motion.button>

              {/* Away team button */}
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, type: 'spring', damping: 20 }}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => handleSelectCaller('away')}
                className="flex-1 py-6 px-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all group relative overflow-hidden"
                style={{
                  borderColor: `${awayTeamColor}40`,
                  backgroundColor: `${awayTeamColor}08`,
                }}
              >
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: `linear-gradient(135deg, transparent, ${awayTeamColor}10, transparent)` }}
                />
                <TeamAvatar name={awayTeam} color={awayTeamColor} size="md" />
                <span className="font-black text-sm relative z-10" style={{ color: awayTeamColor }}>{awayTeam}</span>
                <span className="text-[10px] text-warm-500 dark:text-gray-500 relative z-10">Call the toss</span>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Phase 2a: Choose Side (Heads or Tails) ═══ */}
      <AnimatePresence>
        {phase === 'choose-side' && callingTeam && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative z-10 text-center w-full max-w-sm"
          >
            {/* Calling team badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{
                backgroundColor: `${callingTeamColor}12`,
                border: `1px solid ${callingTeamColor}30`,
              }}
            >
              <TeamAvatar name={callingTeamName} color={callingTeamColor} size="sm" />
              <span className="font-bold text-sm" style={{ color: callingTeamColor }}>{callingTeamName} calls...</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-xl font-black text-white mb-2"
            >
              Heads or Tails?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-warm-500 dark:text-gray-400 mb-6"
            >
              Choose the side {callingTeamName} is calling for this toss
            </motion.p>

            <div className="flex items-center gap-5 sm:gap-8 justify-center">
              {/* HEADS button */}
              <motion.button
                initial={{ opacity: 0, x: -20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', damping: 20, stiffness: 200 }}
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.08 }}
                onClick={() => handleChooseSide('heads')}
                className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all group"
                style={{
                  background: 'linear-gradient(145deg, #FFD700, #DAA520, #B8860B)',
                  boxShadow: `
                    0 0 30px rgba(255,215,0,0.3),
                    0 6px 20px rgba(0,0,0,0.3),
                    inset 0 2px 4px rgba(255,255,255,0.3),
                    inset 0 -2px 4px rgba(0,0,0,0.2)
                  `,
                  border: '3px solid #FFD700',
                }}
              >
                <span className="text-4xl font-black text-amber-900 drop-shadow-sm">H</span>
                <span className="text-[8px] font-bold text-amber-800/70 tracking-widest mt-1">HEADS</span>
                {/* Shimmer */}
                <motion.div
                  className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, transparent, rgba(255,255,255,0.25), transparent)' }}
                />
              </motion.button>

              {/* OR divider */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-[1px] h-6 bg-warm-200 dark:bg-warm-700" />
                <span className="text-gray-600 font-black text-xs">OR</span>
                <div className="w-[1px] h-6 bg-warm-200 dark:bg-warm-700" />
              </div>

              {/* TAILS button */}
              <motion.button
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', damping: 20, stiffness: 200 }}
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.08 }}
                onClick={() => handleChooseSide('tails')}
                className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center transition-all group"
                style={{
                  background: 'linear-gradient(145deg, #E8E8E8, #B0B0B0, #808080)',
                  boxShadow: `
                    0 0 30px rgba(192,192,192,0.3),
                    0 6px 20px rgba(0,0,0,0.3),
                    inset 0 2px 4px rgba(255,255,255,0.4),
                    inset 0 -2px 4px rgba(0,0,0,0.2)
                  `,
                  border: '3px solid #C0C0C0',
                }}
              >
                <span className="text-4xl font-black text-gray-700 drop-shadow-sm">T</span>
                <span className="text-[8px] font-bold text-gray-600/70 tracking-widest mt-1">TAILS</span>
                {/* Shimmer */}
                <motion.div
                  className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, transparent, rgba(255,255,255,0.3), transparent)' }}
                />
              </motion.button>
            </div>

            {/* Back to caller selection */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => { setPhase('choose-caller'); setCallingTeam(null); }}
              className="mt-6 text-warm-500 dark:text-gray-500 text-xs underline underline-offset-2 hover:text-warm-600 dark:text-gray-300 transition-colors"
            >
              Change caller
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Phase 2b: Ready — Flip Button ═══ */}
      <AnimatePresence>
        {phase === 'ready' && chosenSide && callingTeam && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative z-10 text-center w-full max-w-sm"
          >
            {/* Show what was chosen */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 flex flex-col items-center gap-3"
            >
              <div
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                style={{
                  color: chosenSide === 'heads' ? '#DAA520' : '#A0A0A0',
                  backgroundColor: chosenSide === 'heads' ? 'rgba(255,215,0,0.1)' : 'rgba(192,192,192,0.1)',
                  border: `1px solid ${chosenSide === 'heads' ? 'rgba(255,215,0,0.3)' : 'rgba(192,192,192,0.3)'}`,
                }}
              >
                <CircleDot className="w-4 h-4" />
                <span>{callingTeamName} calls {chosenSide === 'heads' ? 'HEADS' : 'TAILS'}</span>
              </div>

              {/* The other team's side */}
              <div className="text-[11px] text-warm-500 dark:text-gray-500">
                The other team automatically gets {chosenSide === 'heads' ? 'TAILS' : 'HEADS'}
              </div>
            </motion.div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={doToss}
              className="relative px-12 py-4 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-yellow-500/30 active:shadow-none transition-shadow overflow-hidden"
            >
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              <span className="relative z-10 flex items-center gap-2">
                <Volume2 className="w-5 h-5" />
                FLIP COIN
              </span>
            </motion.button>

            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-warm-500 dark:text-gray-500 text-xs">
                {callingTeamName} called {chosenSide === 'heads' ? 'HEADS' : 'TAILS'} — flip to reveal!
              </p>
              <button
                onClick={() => { setPhase('choose-side'); setChosenSide(null); }}
                className="text-warm-500 dark:text-gray-500 text-xs underline underline-offset-2 hover:text-warm-600 dark:text-gray-300 transition-colors"
              >
                Change choice
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Flipping Phase — Progress ═══ */}
      <AnimatePresence>
        {phase === 'flipping' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 text-center"
          >
            <div className="w-48 h-1.5 bg-warm-100 dark:bg-warm-700 rounded-full overflow-hidden mx-auto">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-500"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2, ease: 'easeInOut' }}
              />
            </div>
            <p className="text-warm-500 dark:text-gray-400 text-xs mt-3">
              {callingTeamName} called {chosenSide === 'heads' ? 'HEADS' : 'TAILS'}...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Phase 3a: Result ─══ */}
      <AnimatePresence>
        {phase === 'result' && tossWinner && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative z-10 text-center w-full max-w-sm"
          >
            {/* Toss detail */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-2 text-xs text-warm-500 dark:text-gray-500"
            >
              {callingTeamName} called {chosenSide === 'heads' ? 'HEADS' : 'TAILS'} — It&apos;s {coinResult === 'heads' ? 'HEADS' : 'TAILS'}!
            </motion.div>

            {/* Winner announcement */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 0.2 }}
              className="mb-6"
            >
              <div className="text-xs text-warm-500 dark:text-gray-400 mb-2 uppercase tracking-wider font-bold">Toss Won By</div>
              <motion.div
                animate={{
                  boxShadow: [
                    `0 0 0px ${winnerColor}`,
                    `0 0 40px ${winnerColor}60`,
                    `0 0 80px ${winnerColor}30`,
                    `0 0 0px ${winnerColor}`,
                  ],
                }}
                transition={{ duration: 2, repeat: 2 }}
                className="inline-flex items-center gap-3 text-2xl font-black py-3 px-6 rounded-2xl"
                style={{
                  color: winnerColor,
                  backgroundColor: `${winnerColor}12`,
                  border: `2px solid ${winnerColor}40`,
                }}
              >
                <TeamAvatar name={winnerName} color={winnerColor} size="sm" />
                {winnerName}
                <motion.span
                  animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  🏆
                </motion.span>
              </motion.div>
            </motion.div>

            {/* Transition to advantage selection */}
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setPhase('choose-advantage')}
              className="px-8 py-3 rounded-xl font-bold text-sm text-white flex items-center gap-2 mx-auto"
              style={{
                backgroundColor: `${winnerColor}25`,
                border: `1px solid ${winnerColor}40`,
              }}
            >
              Choose Advantage
              <Zap className="w-4 h-4" style={{ color: winnerColor }} />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Phase 3b: Choose Advantage ═══ */}
      <AnimatePresence>
        {phase === 'choose-advantage' && tossWinner && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative z-10 text-center w-full max-w-sm"
          >
            {/* Winner banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{
                  backgroundColor: `${winnerColor}12`,
                  border: `1px solid ${winnerColor}30`,
                }}
              >
                <TeamAvatar name={winnerName} color={winnerColor} size="sm" />
                <span className="font-bold text-sm" style={{ color: winnerColor }}>{winnerName} won the toss!</span>
              </div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg font-black text-white mb-2"
            >
              Choose Your Advantage
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-xs text-warm-500 dark:text-gray-400 mb-5"
            >
              {winnerName} must choose between raiding first or choosing court side
            </motion.p>

            <div className="flex gap-3">
              {/* RAID FIRST */}
              <AdvantageCard
                icon={<Swords className="w-7 h-7" style={{ color: winnerColor }} />}
                title="RAID FIRST"
                subtitle={raidStrategy}
                color={winnerColor}
                onClick={() => handleChooseAdvantage(tossWinner)}
                delay={0.2}
              />

              {/* CHOOSE COURT */}
              <AdvantageCard
                icon={<Shield className="w-7 h-7" style={{ color: loserColor }} />}
                title="CHOOSE COURT"
                subtitle={defendStrategy}
                color={loserColor}
                onClick={() => handleChooseAdvantage(tossWinner === 'home' ? 'away' : 'home')}
                delay={0.35}
              />
            </div>

            {/* Info line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-warm-500 dark:text-gray-500"
            >
              <Sparkles className="w-3 h-3" />
              <span>Raid First: {winnerName} attacks first</span>
              <span className="mx-1">·</span>
              <span>Choose Court: {loserName} raids first</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Countdown Phase ═══ */}
      <AnimatePresence>
        {phase === 'countdown' && countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 text-center"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 2.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="text-8xl font-black text-white mb-3"
              style={{ textShadow: `0 0 40px ${winnerColor}40` }}
            >
              {countdown}
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base font-bold mb-1"
              style={{ color: winnerColor }}
            >
              Match Starting!
            </motion.p>
            <p className="text-xs text-warm-500 dark:text-gray-500">
              {winnerName} chose to {tossWinner === tossWinner ? 'raid' : 'defend'} first
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Skip Toss Phase ═══ */}
      <AnimatePresence>
        {phase === 'skip-toss' && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative z-10 text-center w-full max-w-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10"
            >
              <FastForward className="w-4 h-4 text-warm-500 dark:text-gray-400" />
              <span className="text-sm font-bold text-warm-600 dark:text-gray-300">Quick Toss Setup</span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-xl font-black text-white mb-2"
            >
              Who Won the Toss?
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-warm-500 dark:text-gray-400 mb-5"
            >
              Select the toss winner and their choice — skip the animation
            </motion.p>

            {/* Team buttons */}
            <div className="flex gap-3 mb-5">
              <motion.button
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, type: 'spring', damping: 20 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSkipTossWinner('home')}
                className={`flex-1 py-5 px-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                  skipTossWinner === 'home' ? '' : 'opacity-50'
                }`}
                style={{
                  borderColor: skipTossWinner === 'home' ? homeTeamColor : `${homeTeamColor}30`,
                  backgroundColor: skipTossWinner === 'home' ? `${homeTeamColor}15` : `${homeTeamColor}05`,
                }}
              >
                <TeamAvatar name={homeTeam} color={homeTeamColor} size="sm" glow={skipTossWinner === 'home'} />
                <span className="font-black text-sm" style={{ color: homeTeamColor }}>{homeTeam}</span>
              </motion.button>

              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, type: 'spring', damping: 20 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSkipTossWinner('away')}
                className={`flex-1 py-5 px-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${
                  skipTossWinner === 'away' ? '' : 'opacity-50'
                }`}
                style={{
                  borderColor: skipTossWinner === 'away' ? awayTeamColor : `${awayTeamColor}30`,
                  backgroundColor: skipTossWinner === 'away' ? `${awayTeamColor}15` : `${awayTeamColor}05`,
                }}
              >
                <TeamAvatar name={awayTeam} color={awayTeamColor} size="sm" glow={skipTossWinner === 'away'} />
                <span className="font-black text-sm" style={{ color: awayTeamColor }}>{awayTeam}</span>
              </motion.button>
            </div>

            {/* Choice buttons */}
            {skipTossWinner && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <p className="text-xs text-warm-500 dark:text-gray-500 mb-2">What did they choose?</p>
                <div className="flex gap-3">
                  <AdvantageCard
                    icon={<Swords className="w-6 h-6" style={{ color: skipTossWinner === 'home' ? homeTeamColor : awayTeamColor }} />}
                    title="RAID FIRST"
                    subtitle={`${skipTossWinner === 'home' ? homeTeam : awayTeam} raids first`}
                    color={skipTossWinner === 'home' ? homeTeamColor : awayTeamColor}
                    onClick={() => {
                      setSkipTossChoice('raid');
                      // Skip directly to countdown
                      setTossWinner(skipTossWinner);
                      setPhase('countdown');
                      setCountdown(3);
                      let count = 3;
                      countdownRef.current = setInterval(() => {
                        count--;
                        setCountdown(count);
                        if (count <= 0) {
                          if (countdownRef.current) clearInterval(countdownRef.current);
                          onTossComplete(skipTossWinner);
                        }
                      }, 800);
                    }}
                    delay={0.2}
                  />
                  <AdvantageCard
                    icon={<Shield className="w-6 h-6" style={{ color: skipTossWinner === 'home' ? awayTeamColor : homeTeamColor }} />}
                    title="CHOOSE COURT"
                    subtitle={`${skipTossWinner === 'home' ? awayTeam : homeTeam} raids first`}
                    color={skipTossWinner === 'home' ? awayTeamColor : homeTeamColor}
                    onClick={() => {
                      setSkipTossChoice('court');
                      const otherTeam = skipTossWinner === 'home' ? 'away' : 'home';
                      setTossWinner(skipTossWinner);
                      setPhase('countdown');
                      setCountdown(3);
                      let count = 3;
                      countdownRef.current = setInterval(() => {
                        count--;
                        setCountdown(count);
                        if (count <= 0) {
                          if (countdownRef.current) clearInterval(countdownRef.current);
                          onTossComplete(otherTeam);
                        }
                      }, 800);
                    }}
                    delay={0.35}
                  />
                </div>
              </motion.div>
            )}

            {/* Back to normal toss */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => { setPhase('choose-caller'); setSkipTossWinner(null); setSkipTossChoice(null); }}
              className="mt-5 text-warm-500 dark:text-gray-500 text-xs underline underline-offset-2 hover:text-warm-600 dark:text-gray-300 transition-colors"
            >
              Do full toss instead
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
