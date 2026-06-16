'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Trophy,
  Flame,
  Target,
  Star,
  Zap,
  Shield,
  TrendingUp,
  Award,
  Swords,
  Loader2,
  Crown,
  CheckCircle2,
  Clock,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useKabaddiStore } from '@/lib/store';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────

interface StreaksRecordsScreenProps {
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
  tournamentMatches: number;
  tournamentTotalPoints: number;
  practiceMatches: number;
  practiceTotalPoints: number;
}

interface MatchData {
  id: string;
  homeScore: number;
  awayScore: number;
  isPractice: boolean;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  completedAt: string | null;
  events: { eventType: string; value: number; playerId: string | null; teamId: string }[];
  scorers: { userId: string }[];
  homeTeam: { id: string; name: string; shortName: string | null; color: string | null };
  awayTeam: { id: string; name: string; shortName: string | null; color: string | null };
  tournament: { id: string; name: string } | null;
}

interface StreakInfo {
  current: number;
  best: number;
  isActive: boolean;
}

interface PersonalRecord {
  id: string;
  label: string;
  value: number;
  unit: string;
  icon: typeof Trophy;
  matchDetails: string;
  date: string | null;
  isNew: boolean;
}

interface MilestoneInfo {
  id: string;
  label: string;
  current: number;
  target: number;
  icon: typeof Trophy;
  completed: boolean;
}

// ─── Animation variants ──────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15 },
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

// ─── Helper Functions ────────────────────────────────────────────

function calculateStreaks(
  matches: MatchData[],
  userId: string
): {
  winStreak: StreakInfo;
  raidStreak: StreakInfo;
  tackleStreak: StreakInfo;
  unbeatenStreak: StreakInfo;
} {
  // Sort matches by date (oldest first for streak calculation)
  const sorted = [...matches]
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(a.completedAt || 0).getTime() - new Date(b.completedAt || 0).getTime());

  // Determine match results for this user
  interface MatchResult {
    result: 'W' | 'L' | 'D';
    raidPoints: number;
    tacklePoints: number;
  }
  const matchResults: MatchResult[] = sorted.map((m) => {
    const userScorer = m.scorers.some((s) => s.userId === userId);
    const isHome = userScorer; // simplified assumption
    const homeWon = m.homeScore > m.awayScore;
    const awayWon = m.awayScore > m.homeScore;
    const isDraw = m.homeScore === m.awayScore;

    let result: 'W' | 'L' | 'D';
    if (isDraw) {
      result = 'D';
    } else if (isHome && homeWon) {
      result = 'W';
    } else if (!isHome && awayWon) {
      result = 'W';
    } else {
      result = 'L';
    }

    // Calculate player's raid/tackle points in this match
    const raidPts = m.events
      .filter((e) => e.playerId === userId && ['raid_point', 'bonus_point', 'super_raid', 'do_or_die_raid'].includes(e.eventType))
      .reduce((sum, e) => sum + e.value, 0);
    const tacklePts = m.events
      .filter((e) => e.playerId === userId && ['tackle_point', 'super_tackle'].includes(e.eventType))
      .reduce((sum, e) => sum + e.value, 0);

    return { result, raidPoints: raidPts, tacklePoints: tacklePts };
  });

  // Win streak
  let currentWinStreak = 0;
  let bestWinStreak = 0;
  let tempWinStreak = 0;
  for (const mr of matchResults) {
    if (mr.result === 'W') {
      tempWinStreak++;
      bestWinStreak = Math.max(bestWinStreak, tempWinStreak);
    } else {
      tempWinStreak = 0;
    }
  }
  // Current streak: count from end
  for (let i = matchResults.length - 1; i >= 0; i--) {
    if (matchResults[i].result === 'W') currentWinStreak++;
    else break;
  }

  // Raid streak (consecutive matches with raid points > 5)
  let currentRaidStreak = 0;
  let bestRaidStreak = 0;
  let tempRaidStreak = 0;
  for (const mr of matchResults) {
    if (mr.raidPoints > 5) {
      tempRaidStreak++;
      bestRaidStreak = Math.max(bestRaidStreak, tempRaidStreak);
    } else {
      tempRaidStreak = 0;
    }
  }
  for (let i = matchResults.length - 1; i >= 0; i--) {
    if (matchResults[i].raidPoints > 5) currentRaidStreak++;
    else break;
  }

  // Tackle streak (consecutive matches with tackle points > 3)
  let currentTackleStreak = 0;
  let bestTackleStreak = 0;
  let tempTackleStreak = 0;
  for (const mr of matchResults) {
    if (mr.tacklePoints > 3) {
      tempTackleStreak++;
      bestTackleStreak = Math.max(bestTackleStreak, tempTackleStreak);
    } else {
      tempTackleStreak = 0;
    }
  }
  for (let i = matchResults.length - 1; i >= 0; i--) {
    if (matchResults[i].tacklePoints > 3) currentTackleStreak++;
    else break;
  }

  // Unbeaten streak
  let currentUnbeatenStreak = 0;
  let bestUnbeatenStreak = 0;
  let tempUnbeatenStreak = 0;
  for (const mr of matchResults) {
    if (mr.result !== 'L') {
      tempUnbeatenStreak++;
      bestUnbeatenStreak = Math.max(bestUnbeatenStreak, tempUnbeatenStreak);
    } else {
      tempUnbeatenStreak = 0;
    }
  }
  for (let i = matchResults.length - 1; i >= 0; i--) {
    if (matchResults[i].result !== 'L') currentUnbeatenStreak++;
    else break;
  }

  return {
    winStreak: { current: currentWinStreak, best: bestWinStreak, isActive: currentWinStreak > 0 },
    raidStreak: { current: currentRaidStreak, best: bestRaidStreak, isActive: currentRaidStreak > 0 },
    tackleStreak: { current: currentTackleStreak, best: bestTackleStreak, isActive: currentTackleStreak > 0 },
    unbeatenStreak: { current: currentUnbeatenStreak, best: bestUnbeatenStreak, isActive: currentUnbeatenStreak > 0 },
  };
}

function calculateRecords(
  matches: MatchData[],
  userId: string
): PersonalRecord[] {
  const sorted = [...matches]
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(a.completedAt || 0).getTime() - new Date(b.completedAt || 0).getTime());

  let mostRaidPoints = { value: 0, matchDetails: '', date: null as string | null };
  let mostTacklePoints = { value: 0, matchDetails: '', date: null as string | null };
  let highestContribution = { value: 0, matchDetails: '', date: null as string | null };
  let longestMatch = { value: 0, matchDetails: '', date: null as string | null };
  let mostSuperTackles = { value: 0, matchDetails: '', date: null as string | null };
  let mostBonusPoints = { value: 0, matchDetails: '', date: null as string | null };

  const now = Date.now();
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

  for (const m of sorted) {
    const matchLabel = `${m.homeTeam.shortName || m.homeTeam.name} vs ${m.awayTeam.shortName || m.awayTeam.name}`;
    const completedAt = m.completedAt;

    const raidPts = m.events
      .filter((e) => e.playerId === userId && ['raid_point', 'bonus_point', 'super_raid', 'do_or_die_raid'].includes(e.eventType))
      .reduce((sum, e) => sum + e.value, 0);
    const tacklePts = m.events
      .filter((e) => e.playerId === userId && ['tackle_point', 'super_tackle'].includes(e.eventType))
      .reduce((sum, e) => sum + e.value, 0);
    const totalPts = raidPts + tacklePts;
    const superTackles = m.events.filter((e) => e.playerId === userId && e.eventType === 'super_tackle').length;
    const bonusPts = m.events
      .filter((e) => e.playerId === userId && e.eventType === 'bonus_point')
      .reduce((sum, e) => sum + e.value, 0);
    const halfDuration = 20; // default

    if (raidPts > mostRaidPoints.value) {
      mostRaidPoints = { value: raidPts, matchDetails: matchLabel, date: completedAt };
    }
    if (tacklePts > mostTacklePoints.value) {
      mostTacklePoints = { value: tacklePts, matchDetails: matchLabel, date: completedAt };
    }
    if (totalPts > highestContribution.value) {
      highestContribution = { value: totalPts, matchDetails: matchLabel, date: completedAt };
    }
    if (halfDuration > longestMatch.value) {
      longestMatch = { value: halfDuration, matchDetails: matchLabel, date: completedAt };
    }
    if (superTackles > mostSuperTackles.value) {
      mostSuperTackles = { value: superTackles, matchDetails: matchLabel, date: completedAt };
    }
    if (bonusPts > mostBonusPoints.value) {
      mostBonusPoints = { value: bonusPts, matchDetails: matchLabel, date: completedAt };
    }
  }

  const isNewRecord = (date: string | null) => {
    if (!date) return false;
    return new Date(date).getTime() > threeDaysAgo;
  };

  return [
    {
      id: 'most-raid-pts',
      label: 'Most Raid Points',
      value: mostRaidPoints.value,
      unit: 'pts',
      icon: Swords,
      matchDetails: mostRaidPoints.matchDetails,
      date: mostRaidPoints.date,
      isNew: isNewRecord(mostRaidPoints.date),
    },
    {
      id: 'most-tackle-pts',
      label: 'Most Tackle Points',
      value: mostTacklePoints.value,
      unit: 'pts',
      icon: Shield,
      matchDetails: mostTacklePoints.matchDetails,
      date: mostTacklePoints.date,
      isNew: isNewRecord(mostTacklePoints.date),
    },
    {
      id: 'highest-contribution',
      label: 'Highest Score Contribution',
      value: highestContribution.value,
      unit: 'pts',
      icon: Star,
      matchDetails: highestContribution.matchDetails,
      date: highestContribution.date,
      isNew: isNewRecord(highestContribution.date),
    },
    {
      id: 'longest-match',
      label: 'Longest Match Played',
      value: longestMatch.value,
      unit: 'min',
      icon: Clock,
      matchDetails: longestMatch.matchDetails,
      date: longestMatch.date,
      isNew: isNewRecord(longestMatch.date),
    },
    {
      id: 'most-super-tackles',
      label: 'Most Super Tackles',
      value: mostSuperTackles.value,
      unit: '',
      icon: Zap,
      matchDetails: mostSuperTackles.matchDetails,
      date: mostSuperTackles.date,
      isNew: isNewRecord(mostSuperTackles.date),
    },
    {
      id: 'most-bonus-pts',
      label: 'Most Bonus Points',
      value: mostBonusPoints.value,
      unit: 'pts',
      icon: Target,
      matchDetails: mostBonusPoints.matchDetails,
      date: mostBonusPoints.date,
      isNew: isNewRecord(mostBonusPoints.date),
    },
  ];
}

function calculateMilestones(profile: ProfileData | null): MilestoneInfo[] {
  if (!profile) return [];

  return [
    {
      id: 'matches-50',
      label: '50 Matches',
      current: profile.totalMatches,
      target: 50,
      icon: Trophy,
      completed: profile.totalMatches >= 50,
    },
    {
      id: 'total-pts-100',
      label: '100 Total Points',
      current: profile.totalPoints,
      target: 100,
      icon: Star,
      completed: profile.totalPoints >= 100,
    },
    {
      id: 'raid-pts-50',
      label: '50 Raid Points',
      current: profile.raidPoints,
      target: 50,
      icon: Swords,
      completed: profile.raidPoints >= 50,
    },
    {
      id: 'tackle-pts-25',
      label: '25 Tackle Points',
      current: profile.tacklePoints,
      target: 25,
      icon: Shield,
      completed: profile.tacklePoints >= 25,
    },
    {
      id: 'super-tackles-10',
      label: '10 Super Tackles',
      current: profile.superTackles,
      target: 10,
      icon: Zap,
      completed: profile.superTackles >= 10,
    },
  ];
}

function getMatchForm(
  matches: MatchData[],
  userId: string
): { results: ('W' | 'L' | 'D')[]; formScore: number; formBadge: string } {
  const sorted = [...matches]
    .filter((m) => m.status === 'completed')
    .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
    .slice(0, 10);

  const results: ('W' | 'L' | 'D')[] = sorted.map((m) => {
    const userScorer = m.scorers.some((s) => s.userId === userId);
    const isHome = userScorer;
    const homeWon = m.homeScore > m.awayScore;
    const awayWon = m.awayScore > m.homeScore;
    const isDraw = m.homeScore === m.awayScore;
    if (isDraw) return 'D';
    if (isHome && homeWon) return 'W';
    if (!isHome && awayWon) return 'W';
    return 'L';
  });

  const wins = results.filter((r) => r === 'W').length;
  const formScore = results.length > 0 ? Math.round((wins / results.length) * 100) : 0;
  let formBadge = 'Mixed Form';
  if (formScore >= 70) formBadge = 'Hot Streak';
  else if (formScore <= 30) formBadge = 'Cold Streak';

  return { results, formScore, formBadge };
}

function getSeasonSummary(
  matches: MatchData[],
  userId: string,
  profile: ProfileData | null
) {
  const completed = matches.filter((m) => m.status === 'completed');
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let pointsScored = 0;
  let pointsConceded = 0;

  for (const m of completed) {
    const userScorer = m.scorers.some((s) => s.userId === userId);
    const isHome = userScorer;
    if (m.homeScore === m.awayScore) {
      draws++;
    } else if (isHome && m.homeScore > m.awayScore) {
      wins++;
    } else if (!isHome && m.awayScore > m.homeScore) {
      wins++;
    } else {
      losses++;
    }
    if (isHome) {
      pointsScored += m.homeScore;
      pointsConceded += m.awayScore;
    } else {
      pointsScored += m.awayScore;
      pointsConceded += m.homeScore;
    }
  }

  const totalMatches = completed.length;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return {
    totalMatches,
    wins,
    losses,
    draws,
    pointsScored,
    pointsConceded,
    winRate,
  };
}

// ─── Circular Progress SVG ───────────────────────────────────────

function CircularProgress({
  value,
  maxValue,
  size = 72,
  strokeWidth = 6,
  color = '#DC2626',
  children,
}: {
  value: number;
  maxValue: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  const offset = circumference - percentage * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/30"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ─── Streak Fire Animation ───────────────────────────────────────

function StreakFire({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="streak-fire">
      <Flame className="w-5 h-5 text-orange-500" />
      <Flame className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1" />
    </div>
  );
}

// ─── Streak Card ──────────────────────────────────────────────────

function StreakCard({
  label,
  streak,
  icon: Icon,
  color,
  delay = 0,
}: {
  label: string;
  streak: StreakInfo;
  icon: typeof Flame;
  color: string;
  delay?: number;
}) {
  const progressPercent = streak.best > 0 ? Math.min((streak.current / streak.best) * 100, 100) : 0;

  return (
    <motion.div
      variants={itemVariants}
      custom={delay}
    >
      <Card className={cn(
        'card-elevated p-4 relative overflow-hidden',
        streak.isActive && 'border-l-4',
      )}
        style={{ borderLeftColor: streak.isActive ? color : undefined }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <span className="text-sm font-semibold text-foreground">{label}</span>
          </div>
          <StreakFire active={streak.isActive} />
        </div>

        <div className="flex items-end gap-1 mb-2">
          <span className="text-3xl font-bold number-ticker" style={{ color }}>
            {streak.current}
          </span>
          <span className="text-sm text-muted-foreground mb-1">
            / {streak.best} best
          </span>
        </div>

        <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.5 + delay * 0.1 }}
          />
        </div>

        {streak.isActive && (
          <style jsx>{`
            .streak-fire {
              position: relative;
              display: flex;
              animation: fire-pulse 1.5s ease-in-out infinite;
            }
            @keyframes fire-pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.2); opacity: 0.8; }
            }
          `}</style>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Record Card ──────────────────────────────────────────────────

function RecordCard({
  record,
  delay = 0,
}: {
  record: PersonalRecord;
  delay?: number;
}) {
  const Icon = record.icon;

  return (
    <motion.div variants={itemVariants}>
      <Card className={cn(
        'card-elevated p-4 relative overflow-hidden',
        record.isNew && 'card-premium',
      )}>
        {/* Gold shimmer border for personal bests */}
        {record.value > 0 && (
          <div className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.05), rgba(220,38,38,0.05))',
            }}
          />
        )}

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-gold/15 to-brand-gold/5 flex items-center justify-center">
              <Icon className="w-4 h-4 text-brand-gold-dark dark:text-brand-gold" />
            </div>
            {record.isNew && (
              <Badge className="badge-new text-[10px] px-2 py-0.5">
                New Record!
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground font-medium mb-1">{record.label}</p>

          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground number-ticker">{record.value}</span>
            {record.unit && (
              <span className="text-xs text-muted-foreground">{record.unit}</span>
            )}
          </div>

          {record.matchDetails && (
            <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
              vs {record.matchDetails}
            </p>
          )}
          {record.date && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              {new Date(record.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Milestone Card ───────────────────────────────────────────────

function MilestoneCard({ milestone }: { milestone: MilestoneInfo }) {
  const Icon = milestone.icon;
  const percentage = Math.min((milestone.current / milestone.target) * 100, 100);

  return (
    <motion.div variants={itemVariants} className="flex flex-col items-center">
      <div className="relative">
        <CircularProgress
          value={milestone.current}
          maxValue={milestone.target}
          size={80}
          strokeWidth={6}
          color={milestone.completed ? '#F59E0B' : '#DC2626'}
        >
          {milestone.completed ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, delay: 0.5 }}
            >
              <CheckCircle2 className="w-6 h-6 text-brand-gold" />
            </motion.div>
          ) : (
            <span className="text-xs font-bold text-foreground">
              {Math.round(percentage)}%
            </span>
          )}
        </CircularProgress>
        {milestone.completed && (
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
          >
            <Crown className="w-4 h-4 text-brand-gold" />
          </motion.div>
        )}
      </div>
      <div className="mt-2 text-center">
        <p className="text-[11px] font-semibold text-foreground">{milestone.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {milestone.current}/{milestone.target}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Match Form Chart ─────────────────────────────────────────────

function MatchFormChart({ results, formScore, formBadge }: {
  results: ('W' | 'L' | 'D')[];
  formScore: number;
  formBadge: string;
}) {
  const dotColor = (r: 'W' | 'L' | 'D') => {
    switch (r) {
      case 'W': return '#22C55E';
      case 'L': return '#EF4444';
      case 'D': return '#F59E0B';
    }
  };

  const badgeStyle = formBadge === 'Hot Streak'
    ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
    : formBadge === 'Cold Streak'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';

  return (
    <motion.div variants={itemVariants}>
      <Card className="card-elevated p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-red" />
            <h3 className="text-sm font-bold text-foreground">Match Form</h3>
          </div>
          <Badge className={cn('text-[10px] px-2.5 py-0.5 border', badgeStyle)}>
            {formBadge}
          </Badge>
        </div>

        {/* Form dots with connecting lines */}
        <div className="flex items-center justify-between mb-4 px-2">
          {results.map((r, i) => (
            <div key={i} className="flex items-center">
              <motion.div
                className="flex flex-col items-center gap-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                  style={{ backgroundColor: dotColor(r) }}
                >
                  {r}
                </div>
              </motion.div>
              {i < results.length - 1 && (
                <div
                  className="w-4 h-0.5 mx-0.5"
                  style={{
                    background: `linear-gradient(90deg, ${dotColor(r)}, ${dotColor(results[i + 1])})`,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form score */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Form Score</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 bg-muted/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: formScore >= 70 ? '#22C55E' : formScore <= 30 ? '#EF4444' : '#F59E0B' }}
                initial={{ width: 0 }}
                animate={{ width: `${formScore}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
              />
            </div>
            <span className="text-sm font-bold text-foreground">{formScore}%</span>
          </div>
        </div>

        {results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No completed matches yet
          </p>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Season Summary Card ─────────────────────────────────────────

function SeasonSummaryCard({
  summary,
}: {
  summary: ReturnType<typeof getSeasonSummary>;
}) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="card-elevated p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-brand-teal" />
          <h3 className="text-sm font-bold text-foreground">Season Summary</h3>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <CircularProgress
            value={summary.winRate}
            maxValue={100}
            size={80}
            strokeWidth={6}
            color={summary.winRate >= 60 ? '#22C55E' : summary.winRate >= 40 ? '#F59E0B' : '#EF4444'}
          >
            <div className="text-center">
              <span className="text-base font-bold text-foreground">{summary.winRate}%</span>
              <span className="block text-[9px] text-muted-foreground">Win Rate</span>
            </div>
          </CircularProgress>

          <div className="flex-1 grid grid-cols-2 gap-2">
            <div className="bg-green-500/5 dark:bg-green-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-green-600 dark:text-green-400">{summary.wins}</p>
              <p className="text-[10px] text-muted-foreground">Wins</p>
            </div>
            <div className="bg-red-500/5 dark:bg-red-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{summary.losses}</p>
              <p className="text-[10px] text-muted-foreground">Losses</p>
            </div>
            <div className="bg-amber-500/5 dark:bg-amber-500/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{summary.draws}</p>
              <p className="text-[10px] text-muted-foreground">Draws</p>
            </div>
            <div className="bg-brand-teal/5 dark:bg-brand-teal/10 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-brand-teal">{summary.totalMatches}</p>
              <p className="text-[10px] text-muted-foreground">Matches</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
            <span className="text-[11px] text-muted-foreground">Pts Scored</span>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">{summary.pointsScored}</span>
          </div>
          <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
            <span className="text-[11px] text-muted-foreground">Pts Conceded</span>
            <span className="text-sm font-bold text-red-600 dark:text-red-400">{summary.pointsConceded}</span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="fixed inset-0 z-50 bg-background pb-8 overflow-y-auto">
      {/* Header skeleton */}
      <div className="h-48 skeleton" />
      <div className="px-4 -mt-6 space-y-4">
        {/* Streaks skeleton */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card h-28" />
          ))}
        </div>
        {/* Records skeleton */}
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton-card h-32" />
          ))}
        </div>
        {/* Milestones skeleton */}
        <div className="skeleton-card h-36" />
        {/* Form skeleton */}
        <div className="skeleton-card h-40" />
        {/* Season skeleton */}
        <div className="skeleton-card h-52" />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function StreaksRecordsScreen({ onClose }: StreaksRecordsScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [matches, setMatches] = useState<MatchData[]>([]);

  const loadData = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      // Fetch player profile
      const playerRes = await fetch(`/api/players/${currentUser.id}`);
      if (playerRes.ok) {
        const data = await playerRes.json();
        setPlayerData(data.player);
        setProfileData(data.profile);
      }

      // Fetch matches
      const matchesRes = await fetch(`/api/matches?userId=${currentUser.id}&limit=50`);
      if (matchesRes.ok) {
        const data = await matchesRes.json();
        setMatches(data.matches || []);
      }
    } catch (err) {
      console.error('StreaksRecordsScreen load error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate all derived data
  const streaks = calculateStreaks(matches, currentUser?.id || '');
  const records = calculateRecords(matches, currentUser?.id || '');
  const milestones = calculateMilestones(profileData);
  const matchForm = getMatchForm(matches, currentUser?.id || '');
  const seasonSummary = getSeasonSummary(matches, currentUser?.id || '', profileData);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background pb-8 custom-scrollbar overflow-y-auto">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-navy-dark via-brand-red-dark to-brand-gold-dark">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 right-4">
            <Trophy className="w-24 h-24 text-white/20" />
          </div>
          <div className="absolute bottom-0 left-4">
            <Flame className="w-16 h-16 text-white/10" />
          </div>
        </div>

        <div className="relative z-10 px-4 pt-12 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={onClose}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">Streaks & Records</h1>
              <p className="text-xs text-white/70">
                {playerData?.name || 'Player'}&apos;s achievements
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="gradient-text text-xl font-extrabold">
              {streaks.winStreak.current > 0 ? `${streaks.winStreak.current}-Match Win Streak` : 'Start Your Streak'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────────────── */}
      <motion.div
        className="px-4 -mt-4 space-y-5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* ─── Current Streaks ─────────────────────────────── */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-brand-red" />
            <h2 className="text-sm font-bold text-foreground">Current Streaks</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StreakCard
              label="Win Streak"
              streak={streaks.winStreak}
              icon={Trophy}
              color="#DC2626"
              delay={0}
            />
            <StreakCard
              label="Raid Streak"
              streak={streaks.raidStreak}
              icon={Swords}
              color="#14B8A6"
              delay={1}
            />
            <StreakCard
              label="Tackle Streak"
              streak={streaks.tackleStreak}
              icon={Shield}
              color="#1E293B"
              delay={2}
            />
            <StreakCard
              label="Unbeaten Run"
              streak={streaks.unbeatenStreak}
              icon={Award}
              color="#F59E0B"
              delay={3}
            />
          </div>
        </motion.div>

        {/* ─── Personal Records ────────────────────────────── */}
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-brand-gold" />
            <h2 className="text-sm font-bold text-foreground">Personal Records</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {records.map((record, idx) => (
              <RecordCard key={record.id} record={record} delay={idx} />
            ))}
          </div>
        </motion.div>

        {/* ─── Milestones ──────────────────────────────────── */}
        <motion.div variants={itemVariants}>
          <Card className="card-elevated p-4">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-brand-teal" />
              <h2 className="text-sm font-bold text-foreground">Milestones</h2>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {milestones.map((m) => (
                <MilestoneCard key={m.id} milestone={m} />
              ))}
            </div>
          </Card>
        </motion.div>

        {/* ─── Match Form ──────────────────────────────────── */}
        <MatchFormChart
          results={matchForm.results}
          formScore={matchForm.formScore}
          formBadge={matchForm.formBadge}
        />

        {/* ─── Season Summary ──────────────────────────────── */}
        <SeasonSummaryCard summary={seasonSummary} />
      </motion.div>
    </div>
  );
}
