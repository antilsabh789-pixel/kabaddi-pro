'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, X, Clock, Radio, Users, Trophy,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchTeam {
  id: string;
  name: string;
  shortName?: string;
  color?: string;
}

interface MatchData {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  currentHalf: number;
  halfDuration: number;
  status: string;
  gender?: string | null;
  weightCategory?: string | null;
  startedAt: string | null;
}

interface LiveScoreTVModeProps {
  matchId: string;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LiveScoreTVMode({ matchId, onBack }: LiveScoreTVModeProps) {
  const { activeMatch, language } = useKabaddiStore();
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch match data from API
  const fetchMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/matches?id=${matchId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data.match) {
        setMatchData(data.match);
      }
    } catch (err) {
      console.error('TV mode fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
    const interval = setInterval(fetchMatch, 5000); // auto-refresh every 5s
    return () => clearInterval(interval);
  }, [fetchMatch]);

  // Timer: compute elapsed time from activeMatch or matchData
  useEffect(() => {
    if (activeMatch?.id === matchId && activeMatch.isLive) {
      setElapsedSeconds(activeMatch.timer);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else if (matchData?.startedAt) {
      // For completed matches, no live timer
      setElapsedSeconds(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeMatch, matchId, matchData?.startedAt]);

  // Use activeMatch for live data if available
  const isLive = activeMatch?.id === matchId && activeMatch.isLive;
  const homeTeam = isLive
    ? { id: activeMatch.homeTeamId, name: activeMatch.homeTeam, color: activeMatch.homeTeamColor }
    : matchData?.homeTeam;
  const awayTeam = isLive
    ? { id: activeMatch.awayTeamId, name: activeMatch.awayTeam, color: activeMatch.awayTeamColor }
    : matchData?.awayTeam;
  const homeScore = isLive ? activeMatch.homeScore : (matchData?.homeScore ?? 0);
  const awayScore = isLive ? activeMatch.awayScore : (matchData?.awayScore ?? 0);
  const currentHalf = isLive ? activeMatch.currentHalf : (matchData?.currentHalf ?? 1);
  const halfDuration = isLive ? activeMatch.halfDuration : (matchData?.halfDuration ?? 20);
  const gender = isLive ? activeMatch.gender : (matchData?.gender ?? null);
  const weightCategory = isLive ? activeMatch.weightCategory : (matchData?.weightCategory ?? null);
  const matchStatus = isLive ? 'live' : (matchData?.status ?? 'upcoming');

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const homeColor = homeTeam?.color || '#DC2626';
  const awayColor = awayTeam?.color || '#1E293B';

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-white text-2xl font-black tracking-wider"
        >
          {t('tv.loading', language)}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col"
      >
        {/* ─── Top bar ─── */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/80 z-10">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-white/70" />
            <span className="text-white/70 text-xs font-bold tracking-widest uppercase">
              {t('tv.tvMode', language)}
            </span>
          </div>

          {/* LIVE indicator */}
          {matchStatus === 'live' && (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="w-3 h-3 rounded-full bg-red-500"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <span className="text-red-500 font-black text-sm tracking-widest">LIVE</span>
            </motion.div>
          )}

          {matchStatus === 'completed' && (
            <Badge className="bg-warm-200 text-warm-800 text-xs font-bold">COMPLETED</Badge>
          )}

          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Main scoreboard ─── */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          {/* Match info row */}
          <div className="flex items-center gap-3 mb-6">
            {gender && (
              <Badge className="bg-white/10 text-white/80 text-xs">
                <Users className="w-3 h-3 mr-1" />
                {gender === 'boys' ? t('home.boys', language) : t('home.girls', language)}
              </Badge>
            )}
            {weightCategory && (
              <Badge className="bg-white/10 text-white/80 text-xs">
                {weightCategory}
              </Badge>
            )}
            <Badge className="bg-white/10 text-white/80 text-xs">
              {currentHalf === 1 ? t('scoring.firstHalf', language) : t('scoring.secondHalf', language)}
            </Badge>
          </div>

          {/* Scoreboard */}
          <div className="w-full max-w-4xl flex items-center justify-center gap-4 sm:gap-8">
            {/* Home team */}
            <motion.div
              className="flex-1 flex flex-col items-center justify-center rounded-2xl p-6 sm:p-10 min-h-[200px] sm:min-h-[280px]"
              style={{ background: `linear-gradient(135deg, ${homeColor}cc, ${homeColor}88)` }}
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 20 }}
            >
              <div
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-white/40 mb-3 flex items-center justify-center text-white font-black text-xl sm:text-2xl"
                style={{ background: homeColor }}
              >
                {(homeTeam?.name || 'H').charAt(0)}
              </div>
              <h2 className="text-white font-black text-xl sm:text-3xl md:text-4xl text-center tracking-wide leading-tight">
                {homeTeam?.name || 'Home'}
              </h2>
              <motion.div
                key={homeScore}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-white font-black text-6xl sm:text-8xl md:text-9xl mt-3 tabular-nums"
              >
                {homeScore}
              </motion.div>
            </motion.div>

            {/* Center divider */}
            <div className="flex flex-col items-center gap-3">
              <div className="text-white/40 font-black text-2xl sm:text-3xl">VS</div>
              {matchStatus === 'live' && (
                <div className="flex flex-col items-center">
                  <Clock className="w-5 h-5 text-white/50 mb-1" />
                  <motion.span
                    key={elapsedSeconds}
                    className="text-white/80 font-mono font-bold text-lg sm:text-2xl tabular-nums"
                  >
                    {formatTimer(elapsedSeconds)}
                  </motion.span>
                  <span className="text-white/40 text-xs mt-1">
                    {halfDuration}:00 {t('scoring.half', language)}
                  </span>
                </div>
              )}
              {matchStatus === 'completed' && (
                <div className="flex items-center gap-1 text-white/40">
                  <Trophy className="w-5 h-5" />
                  <span className="text-xs font-bold">{t('home.completed', language)}</span>
                </div>
              )}
            </div>

            {/* Away team */}
            <motion.div
              className="flex-1 flex flex-col items-center justify-center rounded-2xl p-6 sm:p-10 min-h-[200px] sm:min-h-[280px]"
              style={{ background: `linear-gradient(135deg, ${awayColor}cc, ${awayColor}88)` }}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 20 }}
            >
              <div
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-white/40 mb-3 flex items-center justify-center text-white font-black text-xl sm:text-2xl"
                style={{ background: awayColor }}
              >
                {(awayTeam?.name || 'A').charAt(0)}
              </div>
              <h2 className="text-white font-black text-xl sm:text-3xl md:text-4xl text-center tracking-wide leading-tight">
                {awayTeam?.name || 'Away'}
              </h2>
              <motion.div
                key={awayScore}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-white font-black text-6xl sm:text-8xl md:text-9xl mt-3 tabular-nums"
              >
                {awayScore}
              </motion.div>
            </motion.div>
          </div>

          {/* Auto-refresh indicator */}
          <motion.div
            className="flex items-center gap-2 mt-8 text-white/30 text-xs"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            <Radio className="w-3 h-3" />
            <span>{t('tv.autoRefresh', language)}</span>
          </motion.div>
        </div>

        {/* ─── Bottom bar ─── */}
        <div className="px-4 py-3 bg-black/60 flex items-center justify-center">
          <span className="text-white/30 text-xs tracking-widest">
            KABADDI PRO • TV MODE
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
