'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useKabaddiStore } from '@/lib/store';

type TossPhase = 'ready' | 'flipping' | 'result' | 'choosing';

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
  const [flipCount, setFlipCount] = useState(0);

  const doToss = useCallback(() => {
    setPhase('flipping');
    setFlipCount(0);

    // Determine result immediately but animate
    const result: 'home' | 'away' = Math.random() < 0.5 ? 'home' : 'away';
    const side: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';

    // Animate flipping with multiple rotations
    let count = 0;
    const interval = setInterval(() => {
      count++;
      setFlipCount(count);
      setCoinSide(count % 2 === 0 ? 'heads' : 'tails');
      if (count >= 10) {
        clearInterval(interval);
        setCoinSide(side);
        setTossWinner(result);
        setTimeout(() => setPhase('result'), 300);
      }
    }, 150);
  }, []);

  const winnerName = tossWinner === 'home' ? homeTeam : awayTeam;
  const winnerColor = tossWinner === 'home' ? homeTeamColor : awayTeamColor;
  const loserName = tossWinner === 'home' ? awayTeam : homeTeam;
  const loserColor = tossWinner === 'home' ? awayTeamColor : homeTeamColor;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: homeTeamColor }} />
        <div className="absolute bottom-1/4 -right-20 w-64 h-64 rounded-full opacity-10" style={{ backgroundColor: awayTeamColor }} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-5 bg-yellow-400" />
      </div>

      {/* Header */}
      <div className="relative z-10 text-center mb-8">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-2"
        >
          Match Setup
        </motion.div>
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-black text-white mb-1"
        >
          TOSS
        </motion.h1>
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 justify-center mt-3"
        >
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
              style={{ backgroundColor: homeTeamColor }}
            >
              {homeTeam.charAt(0)}
            </div>
            <span className="text-sm font-bold text-white">{homeTeam}</span>
          </div>
          <span className="text-gray-500 font-bold text-xs">VS</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{awayTeam}</span>
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
              style={{ backgroundColor: awayTeamColor }}
            >
              {awayTeam.charAt(0)}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Coin */}
      <div className="relative z-10 mb-8">
        <div className="perspective-[800px]">
          <motion.div
            animate={
              phase === 'flipping'
                ? {
                    rotateX: [0, 180, 360, 540, 720, 900, 1080, 1260, 1440, 1620, 1800],
                    scale: [1, 1.2, 1.3, 1.2, 1.3, 1.2, 1.1, 1.05, 1, 1, 1],
                  }
                : {}
            }
            transition={
              phase === 'flipping'
                ? { duration: 1.8, ease: 'easeInOut' }
                : {}
            }
            className="w-32 h-32 relative"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Heads side */}
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center shadow-2xl border-4"
              style={{
                backfaceVisibility: 'hidden',
                background: `linear-gradient(135deg, #FFD700, #FFA500, #FFD700)`,
                borderColor: '#DAA520',
              }}
            >
              <div className="text-center">
                <div className="text-4xl font-black text-amber-900">K</div>
                <div className="text-[8px] font-bold text-amber-800 tracking-wider">KABADDI</div>
              </div>
            </div>

            {/* Tails side */}
            <div
              className="absolute inset-0 rounded-full flex items-center justify-center shadow-2xl border-4"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateX(180deg)',
                background: `linear-gradient(135deg, #C0C0C0, #E8E8E8, #C0C0C0)`,
                borderColor: '#A9A9A9',
              }}
            >
              <div className="text-center">
                <div className="text-4xl font-black text-gray-600">P</div>
                <div className="text-[8px] font-bold text-gray-500 tracking-wider">PRO</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Coin side label */}
        <AnimatePresence mode="wait">
          {phase === 'flipping' && (
            <motion.div
              key={flipCount}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-center mt-3"
            >
              <span className="text-xs text-gray-400 font-mono">
                {coinSide === 'heads' ? 'HEADS' : 'TAILS'}
              </span>
            </motion.div>
          )}
          {phase === 'result' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mt-3"
            >
              <span className="text-xs text-gray-300 font-mono">
                It&apos;s {coinSide === 'heads' ? 'HEADS' : 'TAILS'}!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ready phase - Flip button */}
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
              className="px-10 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black text-lg rounded-2xl shadow-xl shadow-yellow-500/30 active:shadow-none transition-shadow"
            >
              🪙 FLIP COIN
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

      {/* Flipping phase - spinning indicator */}
      <AnimatePresence>
        {phase === 'flipping' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 text-center"
          >
            <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 text-xs mt-3">Flipping...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result phase - Winner announcement + Choose */}
      <AnimatePresence>
        {phase === 'result' && tossWinner && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative z-10 text-center w-full max-w-sm"
          >
            {/* Winner announcement */}
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 0.2 }}
              className="mb-6"
            >
              <div className="text-xs text-gray-400 mb-1">TOSS WON BY</div>
              <div
                className="text-2xl font-black py-2 px-6 rounded-xl inline-block"
                style={{ color: winnerColor, backgroundColor: `${winnerColor}20` }}
              >
                🎉 {winnerName}
              </div>
            </motion.div>

            {/* Choose: Raid or Defend */}
            <div className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-bold">
              {winnerName} chooses to...
            </div>

            <div className="flex gap-3">
              {/* RAID */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (tossWinner) onTossComplete(tossWinner);
                }}
                className="flex-1 py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all"
                style={{
                  borderColor: `${winnerColor}60`,
                  backgroundColor: `${winnerColor}10`,
                }}
              >
                <div className="text-2xl">⚡</div>
                <div className="font-black text-sm" style={{ color: winnerColor }}>
                  RAID FIRST
                </div>
                <div className="text-[10px] text-gray-400">{winnerName} raids first</div>
              </motion.button>

              {/* DEFEND */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (tossWinner) onTossComplete(tossWinner === 'home' ? 'away' : 'home');
                }}
                className="flex-1 py-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all"
                style={{
                  borderColor: `${loserColor}60`,
                  backgroundColor: `${loserColor}10`,
                }}
              >
                <div className="text-2xl">🛡️</div>
                <div className="font-black text-sm" style={{ color: loserColor }}>
                  DEFEND FIRST
                </div>
                <div className="text-[10px] text-gray-400">{loserName} raids first</div>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
