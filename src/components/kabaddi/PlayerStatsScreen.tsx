'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Swords,
  Shield,
  Trophy,
  Target,
  Star,
  Sparkles,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  Loader2,
  Award,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { useTheme } from 'next-themes';

// ─── Types ────────────────────────────────────────────────────────

interface PlayerStatsScreenProps {
  userId: string;
  onClose: () => void;
}

interface PlayerData {
  id: string;
  name: string | null;
  avatar: string | null;
  gender?: string | null;
  role: string;
}

interface ProfileData {
  jerseyNumber: number | null;
  position: string | null;
  overallRating: number;
  totalRaids: number;
  successfulRaids: number;
  totalTackles: number;
  successfulTackles: number;
  bonusPoints: number;
  superTackles: number;
  totalMatches: number;
  totalPoints: number;
  raidPoints: number;
  tacklePoints: number;
  // Tournament
  tournamentMatches: number;
  tournamentTotalRaids: number;
  tournamentSuccessfulRaids: number;
  tournamentTotalTackles: number;
  tournamentSuccessfulTackles: number;
  tournamentRaidPoints: number;
  tournamentTacklePoints: number;
  tournamentBonusPoints: number;
  tournamentSuperTackles: number;
  tournamentTotalPoints: number;
  // Practice
  practiceMatches: number;
  practiceTotalRaids: number;
  practiceSuccessfulRaids: number;
  practiceTotalTackles: number;
  practiceSuccessfulTackles: number;
  practiceRaidPoints: number;
  practiceTacklePoints: number;
  practiceBonusPoints: number;
  practiceSuperTackles: number;
  practiceTotalPoints: number;
}

interface RecentMatchResult {
  id: string;
  opponent: string;
  result: 'W' | 'L' | 'D';
  score: string;
  date: string;
}

// ─── Animation variants ──────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 20, stiffness: 200 },
  },
};

// ─── Helper: Position labels ─────────────────────────────────────

const POSITION_LABELS: Record<string, { label: string; icon: string }> = {
  'left-raider': { label: 'Left Raider', icon: '⬅️' },
  'right-raider': { label: 'Right Raider', icon: '➡️' },
  'both-raider': { label: 'Both Raider', icon: '↔️' },
  'left-corner': { label: 'Left Corner', icon: '🛡️' },
  'right-corner': { label: 'Right Corner', icon: '🛡️' },
  'left-cover': { label: 'Left Cover', icon: '🧱' },
  'right-cover': { label: 'Right Cover', icon: '🧱' },
  'all-rounder': { label: 'All-Rounder', icon: '⭐' },
  raider: { label: 'Raider', icon: '⚔️' },
  defender: { label: 'Defender', icon: '🛡️' },
};

function getPositionLabel(pos: string | null) {
  if (!pos) return 'Player';
  return POSITION_LABELS[pos]?.label || pos;
}

function getPositionCategory(pos: string | null): string {
  if (!pos) return 'Players';
  const p = pos.toLowerCase();
  if (p.includes('raider')) return 'Raiders';
  if (p.includes('corner') || p.includes('cover') || p.includes('defender')) return 'Defenders';
  if (p.includes('all-rounder')) return 'All-Rounders';
  return 'Players';
}

// ─── Animated Counter Hook ────────────────────────────────────────

function useAnimatedCounter(target: number, duration = 1200, delay = 0) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      startTime.current = performance.now();

      const animate = (now: number) => {
        if (!startTime.current) return;
        const elapsed = now - startTime.current;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutExpo
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setCount(Math.round(eased * target));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return count;
}

// ─── Circular Progress Ring ───────────────────────────────────────

function CircularProgressRing({
  value,
  maxValue = 100,
  size = 180,
  strokeWidth = 12,
}: {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
}) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / maxValue, 1);
  const offset = circumference - percentage * circumference;
  const animatedValue = useAnimatedCounter(Math.round(value), 1500, 400);

  // Color based on rating
  const getColor = (val: number) => {
    if (val < 40) return { ring: '#EF4444', bg: 'from-red-500/10 to-red-600/5', text: 'text-red-500' };
    if (val <= 70) return { ring: '#EAB308', bg: 'from-yellow-500/10 to-yellow-600/5', text: 'text-yellow-500' };
    return { ring: '#22C55E', bg: 'from-green-500/10 to-green-600/5', text: 'text-green-500' };
  };

  const colorInfo = getColor(value);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isDark ? '#3B3428' : '#F0EBE1'}
            strokeWidth={strokeWidth}
          />
          {/* Glow effect */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colorInfo.ring}
            strokeWidth={strokeWidth + 6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference, opacity: 0.15 }}
            animate={{ strokeDashoffset: offset, opacity: 0.15 }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
            style={{ filter: 'blur(6px)' }}
          />
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colorInfo.ring}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-black"
            style={{ color: colorInfo.ring }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring', damping: 12 }}
          >
            {animatedValue}
          </motion.span>
          <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider mt-0.5">
            Overall
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card Component ──────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  delay = 0,
  gradientFrom,
  gradientTo,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral' | null;
  delay?: number;
  gradientFrom: string;
  gradientTo: string;
  iconColor: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      custom={delay}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
    >
      <Card className={`overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`}>
        <div className={`p-3.5 bg-gradient-to-br ${gradientFrom} ${gradientTo}`}>
          <div className="flex items-start justify-between mb-2">
            <div className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center`}>
              <Icon className="w-4 h-4" />
            </div>
            {trend && (
              <div className={`flex items-center gap-0.5 text-[10px] font-bold ${
                trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-warm-400'
              }`}>
                {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              </div>
            )}
          </div>
          <p className="text-2xl font-black text-warm-800 dark:text-warm-100">{value}</p>
          <p className="text-[10px] font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider mt-0.5">{label}</p>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Performance Bar Component ────────────────────────────────────

function PerformanceBar({
  label,
  value,
  maxValue,
  color,
  delay = 0,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  delay?: number;
}) {
  const percentage = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  const animatedWidth = useAnimatedCounter(percentage, 1000, 300 + delay * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + delay * 0.15, duration: 0.4 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-warm-700 dark:text-warm-300">{label}</span>
        <span className="text-xs font-bold text-warm-800 dark:text-warm-200">
          {value} <span className="text-warm-400 font-normal text-[10px]">({animatedWidth}%)</span>
        </span>
      </div>
      <div className="h-3 rounded-full bg-warm-200 dark:bg-warm-700 overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.5 + delay * 0.15 }}
        />
      </div>
    </motion.div>
  );
}

// ─── Recent Form Dot ──────────────────────────────────────────────

function RecentFormDot({
  result,
  match,
  index,
}: {
  result: 'W' | 'L' | 'D';
  match: RecentMatchResult;
  index: number;
}) {
  const colorMap = {
    W: 'bg-green-500 border-green-400',
    L: 'bg-red-500 border-red-400',
    D: 'bg-yellow-500 border-yellow-400',
  };

  const labelMap = {
    W: 'Win',
    L: 'Loss',
    D: 'Draw',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6 + index * 0.1, type: 'spring', damping: 12 }}
      className="relative group"
    >
      <div
        className={`w-9 h-9 rounded-full ${colorMap[result]} border-2 flex items-center justify-center shadow-sm cursor-default`}
      >
        <span className="text-white text-xs font-black">{result}</span>
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-warm-800 dark:bg-warm-200 text-white dark:text-warm-900 text-[10px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-20 shadow-lg">
        <p className="font-bold">{labelMap[result]} vs {match.opponent}</p>
        <p>{match.score} • {match.date}</p>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-warm-800 dark:bg-warm-200 rotate-45 -mt-1" />
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function PlayerStatsScreen({ userId, onClose }: PlayerStatsScreenProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const currentUser = useKabaddiStore((s) => s.currentUser);

  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchType, setMatchType] = useState<'tournament' | 'practice'>('tournament');
  const [recentForm, setRecentForm] = useState<RecentMatchResult[]>([]);
  const [positionRank, setPositionRank] = useState<{ rank: number; total: number } | null>(null);

  const isPremium = currentUser?.isPremium || false;

  // Fetch player data
  const fetchPlayerData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch player');
      const data = await res.json();
      setPlayer(data.player);
      setProfile(data.profile || null);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load player stats');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Fetch recent form and rank
  const fetchAdditionalData = useCallback(async () => {
    try {
      // Fetch recent match results for this player
      const matchRes = await fetch(`/api/matches?userId=${userId}&limit=5`);
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        if (matchData.matches && Array.isArray(matchData.matches)) {
          const formResults: RecentMatchResult[] = matchData.matches
            .slice(0, 5)
            .map((m: Record<string, unknown>) => {
              const homeScore = m.homeScore as number;
              const awayScore = m.awayScore as number;
              const homeTeam = (m.homeTeam as Record<string, string>)?.name || 'Home';
              const awayTeam = (m.awayTeam as Record<string, string>)?.name || 'Away';
              const completedAt = (m.completedAt as string) || '';

              // Determine user's team
              const isHome = Array.isArray(m.scorers) && m.scorers.some((s: Record<string, unknown>) => s.userId === userId && s.teamId === m.homeTeamId);
              const userScore = isHome ? homeScore : awayScore;
              const oppScore = isHome ? awayScore : homeScore;
              const opponent = isHome ? awayTeam : homeTeam;

              let result: 'W' | 'L' | 'D' = 'D';
              if (userScore > oppScore) result = 'W';
              else if (userScore < oppScore) result = 'L';

              return {
                id: m.id as string,
                opponent,
                result,
                score: `${homeScore}-${awayScore}`,
                date: completedAt ? new Date(completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '',
              };
            });
          setRecentForm(formResults);
        }
      }

      // Fetch position rank
      if (profile?.position) {
        const rankRes = await fetch(`/api/player-stats?leaderboard=true&position=${profile.position}&limit=1000`);
        if (rankRes.ok) {
          const rankData = await rankRes.json();
          if (rankData.leaderboard && Array.isArray(rankData.leaderboard)) {
            const idx = rankData.leaderboard.findIndex((p: Record<string, unknown>) => p.userId === userId);
            if (idx >= 0) {
              setPositionRank({ rank: idx + 1, total: rankData.leaderboard.length });
            }
          }
        }
      }
    } catch {
      // Non-critical, just don't show
    }
  }, [userId, profile?.position]);

  useEffect(() => {
    fetchPlayerData();
  }, [fetchPlayerData]);

  useEffect(() => {
    if (profile) {
      fetchAdditionalData();
    }
  }, [profile, fetchAdditionalData]);

  // Derived stats based on match type
  const getStats = useCallback(() => {
    if (!profile) {
      return {
        raidPoints: 0,
        tacklePoints: 0,
        totalMatches: 0,
        successRate: 0,
        superTackles: 0,
        bonusPoints: 0,
        totalRaids: 0,
        successfulRaids: 0,
        totalTackles: 0,
        successfulTackles: 0,
        totalPoints: 0,
        raidTrend: null as 'up' | 'down' | 'neutral' | null,
        tackleTrend: null as 'up' | 'down' | 'neutral' | null,
      };
    }

    if (matchType === 'tournament') {
      const successRate = profile.tournamentTotalRaids > 0
        ? Math.round((profile.tournamentSuccessfulRaids / profile.tournamentTotalRaids) * 100)
        : 0;
      return {
        raidPoints: profile.tournamentRaidPoints,
        tacklePoints: profile.tournamentTacklePoints,
        totalMatches: profile.tournamentMatches,
        successRate,
        superTackles: profile.tournamentSuperTackles,
        bonusPoints: profile.tournamentBonusPoints,
        totalRaids: profile.tournamentTotalRaids,
        successfulRaids: profile.tournamentSuccessfulRaids,
        totalTackles: profile.tournamentTotalTackles,
        successfulTackles: profile.tournamentSuccessfulTackles,
        totalPoints: profile.tournamentTotalPoints,
        raidTrend: profile.tournamentRaidPoints > 0 ? 'up' as const : null,
        tackleTrend: profile.tournamentTacklePoints > 0 ? 'up' as const : null,
      };
    }

    const successRate = profile.practiceTotalRaids > 0
      ? Math.round((profile.practiceSuccessfulRaids / profile.practiceTotalRaids) * 100)
      : 0;
    return {
      raidPoints: profile.practiceRaidPoints,
      tacklePoints: profile.practiceTacklePoints,
      totalMatches: profile.practiceMatches,
      successRate,
      superTackles: profile.practiceSuperTackles,
      bonusPoints: profile.practiceBonusPoints,
      totalRaids: profile.practiceTotalRaids,
      successfulRaids: profile.practiceSuccessfulRaids,
      totalTackles: profile.practiceTotalTackles,
      successfulTackles: profile.practiceSuccessfulTackles,
      totalPoints: profile.practiceTotalPoints,
      raidTrend: profile.practiceRaidPoints > 0 ? 'up' as const : null,
      tackleTrend: profile.practiceTacklePoints > 0 ? 'up' as const : null,
    };
  }, [profile, matchType]);

  const stats = getStats();

  // Point distribution for performance breakdown
  const totalPointDistribution = profile
    ? profile.raidPoints + profile.tacklePoints + profile.bonusPoints
    : 0;
  const raidPercentage = totalPointDistribution > 0
    ? Math.round((profile?.raidPoints || 0) / totalPointDistribution * 100)
    : 0;
  const tacklePercentage = totalPointDistribution > 0
    ? Math.round((profile?.tacklePoints || 0) / totalPointDistribution * 100)
    : 0;
  const bonusPercentage = totalPointDistribution > 0
    ? Math.round((profile?.bonusPoints || 0) / totalPointDistribution * 100)
    : 0;

  // ─── Loading State ────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-red animate-spin" />
          <p className="text-sm text-warm-500 dark:text-warm-400 font-medium">Loading stats...</p>
        </div>
      </motion.div>
    );
  }

  // ─── Error State ──────────────────────────────────────────────
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex items-center justify-center p-6"
      >
        <Card className="p-6 text-center max-w-sm mx-auto">
          <div className="text-4xl mb-3">😵</div>
          <p className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPlayerData} className="mt-2">
            Try Again
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="mt-2 ml-2">
            Go Back
          </Button>
        </Card>
      </motion.div>
    );
  }

  // ─── Empty State ──────────────────────────────────────────────
  if (!player || !profile) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200 dark:border-warm-700 bg-warm-50 dark:bg-warm-900">
          <Button variant="ghost" size="sm" onClick={onClose} className="flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <h2 className="text-sm font-bold text-warm-800 dark:text-warm-200">Player Stats</h2>
          <div className="w-16" />
        </div>
        <div className="flex items-center justify-center p-6" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <Card className="p-8 text-center max-w-sm mx-auto">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-5xl mb-4"
            >
              📊
            </motion.div>
            <h3 className="text-lg font-bold text-warm-800 dark:text-warm-200 mb-2">No Stats Yet</h3>
            <p className="text-sm text-warm-500 dark:text-warm-400 mb-4">
              Complete some matches to see your player statistics here!
            </p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Go Back
            </Button>
          </Card>
        </div>
      </motion.div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-warm-200 dark:border-warm-700 bg-warm-50/95 dark:bg-warm-900/95 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={onClose} className="flex items-center gap-1 -ml-2">
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs">Back</span>
        </Button>
        <h2 className="text-sm font-bold text-warm-800 dark:text-warm-200">Player Stats</h2>
        <div className="w-16" />
      </div>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto pb-24">
        {/* ═══ Overall Performance Card ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="bg-gradient-to-br from-brand-red/5 via-warm-50 to-brand-gold/5 dark:from-brand-red/10 dark:via-warm-800 dark:to-brand-gold/10 p-6">
              <div className="flex flex-col items-center gap-4">
                {/* Avatar + Info */}
                <div className="flex items-center gap-3 w-full">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-red to-brand-gold flex items-center justify-center text-white font-black text-lg shadow-md">
                    {player.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-black text-warm-800 dark:text-warm-100 truncate">
                      {player.name || 'Unknown Player'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {profile.position && (
                        <Badge variant="secondary" className="text-[10px] bg-brand-red/10 text-brand-red border border-brand-red/20">
                          {getPositionLabel(profile.position)}
                        </Badge>
                      )}
                      {profile.jerseyNumber && (
                        <Badge variant="secondary" className="text-[10px] bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold border border-brand-gold/20">
                          #{profile.jerseyNumber}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Circular Progress */}
                <CircularProgressRing value={Math.min(profile.overallRating, 100)} />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ═══ Stats Grid (2x3) ═══ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3"
        >
          <StatCard
            icon={Swords}
            label="Raid Points"
            value={stats.raidPoints}
            trend={stats.raidTrend}
            delay={0}
            gradientFrom="from-brand-red/5"
            gradientTo="to-brand-red/10"
            iconColor="bg-brand-red/15 text-brand-red"
          />
          <StatCard
            icon={Shield}
            label="Tackle Points"
            value={stats.tacklePoints}
            trend={stats.tackleTrend}
            delay={0.08}
            gradientFrom="from-brand-teal/5"
            gradientTo="to-brand-teal/10"
            iconColor="bg-brand-teal/15 text-brand-teal"
          />
          <StatCard
            icon={Trophy}
            label="Total Matches"
            value={stats.totalMatches}
            delay={0.16}
            gradientFrom="from-brand-gold/5"
            gradientTo="to-brand-gold/10"
            iconColor="bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold"
          />
          <StatCard
            icon={Target}
            label="Success Rate"
            value={`${stats.successRate}%`}
            delay={0.24}
            gradientFrom={stats.successRate >= 60 ? 'from-green-500/5' : stats.successRate >= 30 ? 'from-yellow-500/5' : 'from-red-500/5'}
            gradientTo={stats.successRate >= 60 ? 'to-green-500/10' : stats.successRate >= 30 ? 'to-yellow-500/10' : 'to-red-500/10'}
            iconColor={stats.successRate >= 60 ? 'bg-green-500/15 text-green-600' : stats.successRate >= 30 ? 'bg-yellow-500/15 text-yellow-600' : 'bg-red-500/15 text-red-500'}
          />
          <StatCard
            icon={Star}
            label="Super Tackles"
            value={stats.superTackles}
            delay={0.32}
            gradientFrom="from-purple-500/5"
            gradientTo="to-purple-500/10"
            iconColor="bg-purple-500/15 text-purple-500"
          />
          <StatCard
            icon={Sparkles}
            label="Bonus Points"
            value={stats.bonusPoints}
            delay={0.40}
            gradientFrom="from-brand-gold/5"
            gradientTo="to-brand-gold/10"
            iconColor="bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold"
          />
        </motion.div>

        {/* ═══ Performance Breakdown ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="p-4 bg-gradient-to-br from-warm-50 to-warm-100 dark:from-warm-800 dark:to-warm-850">
              <h3 className="text-sm font-bold text-warm-800 dark:text-warm-200 mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-gold" />
                Performance Breakdown
              </h3>
              <div className="space-y-4">
                <PerformanceBar
                  label="Raid Points"
                  value={profile.raidPoints}
                  maxValue={totalPointDistribution || 1}
                  color="from-brand-red to-brand-red/70"
                  delay={0}
                />
                <PerformanceBar
                  label="Tackle Points"
                  value={profile.tacklePoints}
                  maxValue={totalPointDistribution || 1}
                  color="from-brand-teal to-brand-teal/70"
                  delay={1}
                />
                <PerformanceBar
                  label="Bonus Points"
                  value={profile.bonusPoints}
                  maxValue={totalPointDistribution || 1}
                  color="from-brand-gold to-brand-gold/70"
                  delay={2}
                />
              </div>
              {/* Distribution summary */}
              <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-warm-200 dark:border-warm-700">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-red" />
                  <span className="text-[10px] font-semibold text-warm-600 dark:text-warm-400">Raid {raidPercentage}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-teal" />
                  <span className="text-[10px] font-semibold text-warm-600 dark:text-warm-400">Tackle {tacklePercentage}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-gold" />
                  <span className="text-[10px] font-semibold text-warm-600 dark:text-warm-400">Bonus {bonusPercentage}%</span>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ═══ Match Type Breakdown ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="p-4 bg-gradient-to-br from-warm-50 to-warm-100 dark:from-warm-800 dark:to-warm-850">
              <h3 className="text-sm font-bold text-warm-800 dark:text-warm-200 mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-brand-teal" />
                Match Breakdown
              </h3>

              {/* Segmented Toggle */}
              <div className="flex bg-warm-200 dark:bg-warm-700 rounded-lg p-1 mb-4">
                {(['tournament', 'practice'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setMatchType(type)}
                    className={`flex-1 py-2 px-3 rounded-md text-xs font-bold transition-all duration-200 ${
                      matchType === type
                        ? 'bg-white dark:bg-warm-800 text-warm-800 dark:text-warm-100 shadow-sm'
                        : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-300'
                    }`}
                  >
                    {type === 'tournament' ? '🏆 Tournament' : '🏋️ Practice'}
                  </button>
                ))}
              </div>

              {/* Stats that change based on segment */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={matchType}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="grid grid-cols-3 gap-3"
                >
                  <div className="text-center p-3 rounded-xl bg-brand-red/5 dark:bg-brand-red/10">
                    <Swords className="w-4 h-4 text-brand-red mx-auto mb-1" />
                    <p className="text-lg font-black text-warm-800 dark:text-warm-100">{stats.raidPoints}</p>
                    <p className="text-[9px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Raid Pts</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-brand-teal/5 dark:bg-brand-teal/10">
                    <Shield className="w-4 h-4 text-brand-teal mx-auto mb-1" />
                    <p className="text-lg font-black text-warm-800 dark:text-warm-100">{stats.tacklePoints}</p>
                    <p className="text-[9px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Tackle Pts</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-brand-gold/5 dark:bg-brand-gold/10">
                    <Trophy className="w-4 h-4 text-brand-gold mx-auto mb-1" />
                    <p className="text-lg font-black text-warm-800 dark:text-warm-100">{stats.totalMatches}</p>
                    <p className="text-[9px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Matches</p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Additional detail row */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={matchType + '-detail'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                  className="grid grid-cols-3 gap-3 mt-3"
                >
                  <div className="text-center p-2 rounded-lg bg-purple-500/5 dark:bg-purple-500/10">
                    <p className="text-sm font-bold text-purple-500">{stats.superTackles}</p>
                    <p className="text-[9px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Super Tackles</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-brand-gold/5 dark:bg-brand-gold/10">
                    <p className="text-sm font-bold text-brand-gold-dark dark:text-brand-gold">{stats.bonusPoints}</p>
                    <p className="text-[9px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Bonus Pts</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-green-500/5 dark:bg-green-500/10">
                    <p className="text-sm font-bold text-green-500">{stats.successRate}%</p>
                    <p className="text-[9px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Success Rate</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </Card>
        </motion.div>

        {/* ═══ Recent Form Indicator ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="p-4 bg-gradient-to-br from-warm-50 to-warm-100 dark:from-warm-800 dark:to-warm-850">
              <h3 className="text-sm font-bold text-warm-800 dark:text-warm-200 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-red" />
                Recent Form
              </h3>
              {recentForm.length > 0 ? (
                <div className="flex items-center justify-center gap-3">
                  {recentForm.map((match, idx) => (
                    <RecentFormDot key={match.id} result={match.result} match={match} index={idx} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-warm-500 dark:text-warm-400 font-medium">No recent matches</p>
                  <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1">Complete matches to see your form</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* ═══ Position Ranking ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="p-4 bg-gradient-to-br from-brand-gold/5 via-warm-50 to-brand-red/5 dark:from-brand-gold/10 dark:via-warm-800 dark:to-brand-red/10">
              <h3 className="text-sm font-bold text-warm-800 dark:text-warm-200 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-brand-gold" />
                Position Ranking
              </h3>
              {positionRank ? (
                <div className="flex items-center justify-center gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1, type: 'spring', damping: 10, stiffness: 150 }}
                    className="relative"
                  >
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-lg shadow-brand-gold/20">
                      <div className="text-center">
                        <p className="text-2xl font-black text-white">#{positionRank.rank}</p>
                      </div>
                    </div>
                    {/* Glow ring */}
                    <div className="absolute inset-0 w-20 h-20 rounded-full bg-brand-gold/20 animate-ping" style={{ animationDuration: '3s' }} />
                  </motion.div>
                  <div>
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-200">
                      Rank #{positionRank.rank} of {positionRank.total}
                    </p>
                    <p className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">
                      {getPositionCategory(profile.position)}
                    </p>
                    {positionRank.rank <= 3 && (
                      <Badge variant="secondary" className="mt-2 text-[10px] bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold border border-brand-gold/20">
                        🏅 Top 3
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl mb-2"
                  >
                    🏆
                  </motion.div>
                  <p className="text-xs text-warm-500 dark:text-warm-400 font-medium">
                    {profile.position
                      ? 'Play tournament matches to get ranked'
                      : 'Set your position to see ranking'}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
