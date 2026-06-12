'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKabaddiStore } from '@/lib/store';
import { Swords, Shield, ChevronRight, Volume2, Sparkles } from 'lucide-react';

type TossPhase = 'ready' | 'flipping' | 'result' | 'choosing';

// ─── Confetti Particle ──────────────────────────────────────────────

function TossConfetti({ color, index }: { color: string; index: number }) {
  const leftPos = (index * 23 + 7) % 100;
  const rotateEnd = (index * 53 + 17) % 720 - 360;
  const xDrift = ((index * 37) % 100) - 50;
  const size = index % 3 === 0 ? 'w-3 h-3' : index % 3 === 1 ? 'w-2 h-2' : 'w-1.5 h-1.5';
  const shape = index % 4 === 0 ? 'rounded-full' : index % 4 === 1 ? 'rounded-sm' : index % 4 === 2 ? 'rounded-l-full' : 'rounded-t-full';

  return (
    <motion.div
      initial={{ y: -20, x: 0, rotate: 0, opacity: 1, scale: 1 }}
      animate={{ y: '100vh', x: xDrift, rotate: rotateEnd, opacity: 0, scale: 0.5 }}
      transition={{ duration: 2.5 + (index % 4) * 0.5, delay: index * 0.04, ease: 'easeIn' }}
      className={`absolute top-0 ${size} ${shape}`}
      style={{ left: `${leftPos}%`, backgroundColor: color }}
    />
  );
}

// ─── Floating Particle ──────────────────────────────────────────────

function FloatingParticle({ color, delay, x, size }: { color: string; delay: number; x: number; size: number }) {
  return (
    <motion.div
      className="absolute rounded-full"
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
        opacity: [0.2, 0.6, 0.2],
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

// ─── Sound Wave Visualization ────────────────────────────────────────

function SoundWave({ color, isActive }: { color: string; isActive: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {[0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0].map((peak, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ backgroundColor: color }}
          animate={isActive ? {
            height: [4, peak * 6 + 4, 4],
            opacity: [0.4, 0.9, 0.4],
          } : {
            height: 4,
            opacity: 0.2,
          }}
          transition={{
            duration: 0.5,
            repeat: isActive ? Infinity : 0,
            delay: i * 0.05,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Strategy Card ──────────────────────────────────────────────────

function StrategyCard({
  icon,
  title,
  description,
  color,
  onClick,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', damping: 20, stiffness: 200 }}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="flex-1 py-5 px-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all relative overflow-hidden group"
      style={{
        borderColor: `${color}50`,
        backgroundColor: `${color}10`,
      }}
    >
      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `linear-gradient(135deg, transparent, ${color}10, transparent)`,
        }}
      />
      <div className="text-3xl relative z-10">{icon}</div>
      <div className="font-black text-sm relative z-10" style={{ color }}>{title}</div>
      <div className="text-[10px] text-gray-400 relative z-10 leading-tight text-center">{description}</div>
    </motion.button>
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
  const [phase, setPhase] = useState<TossPhase>('ready');
  const [tossWinner, setTossWinner] = useState<'home' | 'away' | null>(null);
  const [coinSide, setCoinSide] = useState<'heads' | 'tails'>('heads');
  const [flipProgress, setFlipProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const doToss = useCallback(() => {
    setPhase('flipping');
    setFlipProgress(0);

    // Determine result immediately but animate
    const result: 'home' | 'away' = Math.random() < 0.5 ? 'home' : 'away';
    const side: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';

    // Animate flipping with smooth progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      setFlipProgress(progress);

      // Rapid coin side switching during flip
      const flipCount = Math.floor(progress / 5);
      setCoinSide(flipCount % 2 === 0 ? 'heads' : 'tails');

      if (progress >= 100) {
        clearInterval(interval);
        setCoinSide(side);
        setTossWinner(result);
        setShowConfetti(true);
        setTimeout(() => setPhase('result'), 400);
      }
    }, 18);
  }, []);

  const handleChoose = (firstRaidTeam: 'home' | 'away') => {
    setPhase('choosing');
    setCountdown(3);

    // Countdown before starting match
    let count = 3;
    const interval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(interval);
        onTossComplete(firstRaidTeam);
      }
    }, 800);
  };

  const winnerName = tossWinner === 'home' ? homeTeam : awayTeam;
  const winnerColor = tossWinner === 'home' ? homeTeamColor : awayTeamColor;
  const loserName = tossWinner === 'home' ? awayTeam : homeTeam;
  const loserColor = tossWinner === 'home' ? awayTeamColor : homeTeamColor;

  // Strategy recommendations
  const raidStrategy = `${winnerName} has strong raiders — raiding first puts early pressure on ${loserName}`;
  const defendStrategy = `${winnerName} starts strong on defense — force ${loserName} into empty raids first`;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* ═══ Background — Team color spotlights ═══ */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Home spotlight */}
        <motion.div
          className="absolute top-0 left-0 w-1/2 h-full"
          style={{
            background: `radial-gradient(ellipse at 30% 50%, ${homeTeamColor}15, transparent 70%)`,
          }}
          animate={phase === 'flipping' ? { opacity: [0.5, 0.8, 0.5] } : { opacity: 0.5 }}
          transition={{ duration: 1, repeat: phase === 'flipping' ? Infinity : 0 }}
        />
        {/* Away spotlight */}
        <motion.div
          className="absolute top-0 right-0 w-1/2 h-full"
          style={{
            background: `radial-gradient(ellipse at 70% 50%, ${awayTeamColor}15, transparent 70%)`,
          }}
          animate={phase === 'flipping' ? { opacity: [0.5, 0.8, 0.5] } : { opacity: 0.5 }}
          transition={{ duration: 1, repeat: phase === 'flipping' ? Infinity : 0, delay: 0.5 }}
        />
        {/* Center glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 opacity-5 bg-yellow-400 rounded-full" />

        {/* Floating particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <FloatingParticle
            key={i}
            color={i < 6 ? homeTeamColor : awayTeamColor}
            delay={i * 0.4}
            x={(i * 8 + 5) % 100}
            size={3 + (i % 3) * 2}
          />
        ))}
      </div>

      {/* Confetti on result */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {Array.from({ length: 40 }).map((_, i) => {
            const colors = [homeTeamColor, awayTeamColor, '#FFD700', '#FF6B35', '#FFFFFF', '#E040FB'];
            return (
              <TossConfetti key={i} color={colors[i % colors.length]} index={i} />
            );
          })}
        </div>
      )}

      {/* ═══ Header ═══ */}
      <div className="relative z-10 text-center mb-6">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-2"
        >
          Match Setup
        </motion.div>
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-black text-white mb-2"
        >
          TOSS
        </motion.h1>
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 justify-center mt-3"
        >
          {/* Home team */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
              style={{ backgroundColor: homeTeamColor, boxShadow: `0 0 12px ${homeTeamColor}40` }}
            >
              {homeTeam.charAt(0)}
            </div>
            <span className="text-sm font-bold text-white">{homeTeam}</span>
          </div>
          <span className="text-gray-600 font-black text-xs">VS</span>
          {/* Away team */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{awayTeam}</span>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
              style={{ backgroundColor: awayTeamColor, boxShadow: `0 0 12px ${awayTeamColor}40` }}
            >
              {awayTeam.charAt(0)}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══ Coin with 3D flip animation ═══ */}
      <div className="relative z-10 mb-6">
        <div className="perspective-[800px]">
          <motion.div
            animate={
              phase === 'flipping'
                ? {
                    rotateX: [0, 360, 720, 1080, 1440, 1800, 2160, 2520, 2880, 3240, 3600],
                    scale: [1, 1.3, 1.4, 1.3, 1.4, 1.3, 1.2, 1.1, 1.05, 1, 1],
                  }
                : phase === 'result'
                  ? { scale: [1, 1.1, 1] }
                  : {}
            }
            transition={
              phase === 'flipping'
                ? { duration: 1.8, ease: 'easeInOut' }
                : phase === 'result'
                  ? { duration: 0.3 }
                  : {}
            }
            className="w-36 h-36 relative"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Heads side — Home team */}
            <div
              className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-2xl border-4"
              style={{
                backfaceVisibility: 'hidden',
                background: `linear-gradient(135deg, #FFD700, ${homeTeamColor}40, #FFD700)`,
                borderColor: '#DAA520',
                boxShadow: `0 0 20px ${homeTeamColor}30, inset 0 0 20px rgba(255,215,0,0.2)`,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold mb-1"
                style={{ backgroundColor: homeTeamColor }}
              >
                {homeTeam.charAt(0)}
              </div>
              <div className="text-[7px] font-black text-amber-900 tracking-wider">{homeTeam.toUpperCase()}</div>
            </div>

            {/* Tails side — Away team */}
            <div
              className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-2xl border-4"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateX(180deg)',
                background: `linear-gradient(135deg, #C0C0C0, ${awayTeamColor}30, #C0C0C0)`,
                borderColor: '#A9A9A9',
                boxShadow: `0 0 20px ${awayTeamColor}30, inset 0 0 20px rgba(192,192,192,0.2)`,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold mb-1"
                style={{ backgroundColor: awayTeamColor }}
              >
                {awayTeam.charAt(0)}
              </div>
              <div className="text-[7px] font-black text-gray-600 tracking-wider">{awayTeam.toUpperCase()}</div>
            </div>
          </motion.div>
        </div>

        {/* Coin side label + sound wave */}
        <AnimatePresence mode="wait">
          {phase === 'flipping' && (
            <motion.div
              key="flipping-label"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-center mt-3"
            >
              <SoundWave color="#FFD700" isActive={true} />
              <span className="text-xs text-gray-400 font-mono mt-1 block">
                {coinSide === 'heads' ? 'HEADS' : 'TAILS'}
              </span>
            </motion.div>
          )}
          {phase === 'result' && (
            <motion.div
              key="result-label"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mt-3"
            >
              <SoundWave color={winnerColor} isActive={false} />
              <span className="text-xs text-gray-300 font-mono mt-1 block">
                It&apos;s {coinSide === 'heads' ? 'HEADS' : 'TAILS'}!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Ready Phase — Flip Button ═══ */}
      <AnimatePresence>
        {phase === 'ready' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 text-center"
          >
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
            <p className="text-gray-500 text-xs mt-4">Tap to toss and decide who raids first</p>
            <button
              onClick={onBack}
              className="text-gray-500 text-xs mt-2 underline underline-offset-2 hover:text-gray-300 transition-colors"
            >
              Go back
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Flipping Phase — Progress indicator ═══ */}
      <AnimatePresence>
        {phase === 'flipping' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 text-center"
          >
            <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden mx-auto">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-500"
                animate={{ width: `${flipProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            <p className="text-gray-400 text-xs mt-3">Flipping...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Result Phase — Winner announcement + Choose ═══ */}
      <AnimatePresence>
        {phase === 'result' && tossWinner && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative z-10 text-center w-full max-w-sm"
          >
            {/* Winner announcement with team color flash */}
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 0.2 }}
              className="mb-4"
            >
              <div className="text-xs text-gray-400 mb-1">TOSS WON BY</div>
              <motion.div
                animate={{ boxShadow: [`0 0 0px ${winnerColor}`, `0 0 30px ${winnerColor}60`, `0 0 0px ${winnerColor}`] }}
                transition={{ duration: 1.5, repeat: 2 }}
                className="text-2xl font-black py-2 px-6 rounded-xl inline-block"
                style={{ color: winnerColor, backgroundColor: `${winnerColor}15`, border: `2px solid ${winnerColor}40` }}
              >
                🎉 {winnerName}
              </motion.div>
            </motion.div>

            {/* Choose: Raid or Defend */}
            <div className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-bold">
              {winnerName} chooses to...
            </div>

            <div className="flex gap-3">
              {/* RAID FIRST */}
              <StrategyCard
                icon={<Swords className="w-7 h-7" style={{ color: winnerColor }} />}
                title="RAID FIRST"
                description={raidStrategy}
                color={winnerColor}
                onClick={() => handleChoose(tossWinner)}
                delay={0.3}
              />

              {/* DEFEND FIRST */}
              <StrategyCard
                icon={<Shield className="w-7 h-7" style={{ color: loserColor }} />}
                title="DEFEND FIRST"
                description={defendStrategy}
                color={loserColor}
                onClick={() => handleChoose(tossWinner === 'home' ? 'away' : 'home')}
                delay={0.4}
              />
            </div>

            {/* Info text */}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-gray-500">
              <Sparkles className="w-3 h-3" />
              {winnerName} raids first · {loserName} defends first
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Choosing Phase — Countdown ═══ */}
      <AnimatePresence>
        {phase === 'choosing' && countdown !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 text-center"
          >
            <motion.div
              key={countdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="text-7xl font-black text-white mb-2"
            >
              {countdown}
            </motion.div>
            <p className="text-sm text-gray-400 font-bold">Match starting...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
