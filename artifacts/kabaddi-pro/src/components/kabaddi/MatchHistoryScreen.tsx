'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  ChevronLeft,
  Calendar,
  Trophy,
  Swords,
  Shield,
  Filter,
  ChevronDown,
  ChevronUp,
  Clock,
  Users,
  MapPin,
  Play,
  Zap,
  Star,
  Target,
  Loader2,
  TrendingUp,
  Flame,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';

// ─── Types ────────────────────────────────────────────────────────

interface MatchHistoryScreenProps {
  onClose: () => void;
}

type ResultFilter = 'all' | 'won' | 'lost' | 'draw';
type TypeFilter = 'all' | 'tournament' | 'practice';
type GenderFilter = 'all' | 'boys' | 'girls';
type SortFilter = 'newest' | 'oldest' | 'highest_score';
type DateFilter = 'all' | 'week' | 'month' | 'year';

interface MatchTeam {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  logo?: string | null;
}

interface MatchScorer {
  id: string;
  userId: string;
  user: { id: string; name: string; avatar: string | null };
}

interface MatchEventItem {
  id: string;
  eventType: string;
  teamId: string;
  playerId: string | null;
  value: number;
  half: number;
  details: string | null;
}

interface MatchItem {
  id: string;
  homeScore: number;
  awayScore: number;
  half: number;
  status: string;
  isPractice: boolean;
  gender: string | null;
  weightCategory: string | null;
  venue: string | null;
  halfDuration: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  tournament: { id: string; name: string } | null;
  events: MatchEventItem[];
  scorers: MatchScorer[];
  motmUserId?: string | null;
}

// ─── Animation variants ──────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const filterPillVariants: Variants = {
  inactive: { scale: 1 },
  active: { scale: 1.05, transition: { type: 'spring', stiffness: 400, damping: 20 } },
};

// ─── Animated Counter ─────────────────────────────────────────────

function AnimatedCounter({ target, duration = 1000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(target);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (prevTarget.current === target && hasAnimated.current) return;
    prevTarget.current = target;
    hasAnimated.current = true;

    let start = 0;
    const startTime = performance.now();

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setCount(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [target, duration]);

  return <span>{count}</span>;
}

// ─── Mini Circular Progress ───────────────────────────────────────

function MiniProgressRing({ percent, size = 40, colorClass = 'stroke-emerald-500 dark:stroke-emerald-400' }: { percent: number; size?: number; colorClass?: string }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        className="stroke-warm-200 dark:stroke-warm-700"
        fill="none"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        className={colorClass}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
      />
    </svg>
  );
}

// ─── Score Comparison Bar ─────────────────────────────────────────

function ScoreBar({ homeScore, awayScore }: { homeScore: number; awayScore: number }) {
  const total = homeScore + awayScore;
  if (total === 0) return null;
  const homePercent = (homeScore / total) * 100;
  const awayPercent = (awayScore / total) * 100;

  return (
    <div className="flex items-center gap-1 w-full mt-2">
      <span className="text-[9px] font-bold text-warm-600 dark:text-warm-300 w-5 text-right tabular-nums">{homeScore}</span>
      <div className="flex-1 h-1.5 rounded-full bg-warm-200 dark:bg-warm-700 overflow-hidden flex">
        <motion.div
          className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${homePercent}%` }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
        <div className="flex-1" />
        <motion.div
          className="h-full bg-red-500 dark:bg-red-400 rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${awayPercent}%` }}
          transition={{ duration: 0.6, delay: 0.2 }}
        />
      </div>
      <span className="text-[9px] font-bold text-warm-600 dark:text-warm-300 w-5 tabular-nums">{awayScore}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const matchDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (matchDate.getTime() === today.getTime()) return 'Today';
  if (matchDate.getTime() === yesterday.getTime()) return 'Yesterday';
  if (matchDate > weekAgo) return 'This Week';
  return 'Earlier';
}

function formatMatchDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

function isWithinDateFilter(dateStr: string, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date >= weekAgo;
  }
  if (filter === 'month') {
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return date >= monthAgo;
  }
  if (filter === 'year') {
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    return date >= yearAgo;
  }
  return true;
}

function getMatchResult(match: MatchItem, userId?: string): 'won' | 'lost' | 'draw' {
  if (match.homeScore === match.awayScore) return 'draw';
  const homeWon = match.homeScore > match.awayScore;

  // If userId is a scorer, determine which side they were on
  if (userId) {
    const isScorer = match.scorers.some((s) => s.userId === userId);
    if (isScorer) {
      // Check if the user's team is home or away (based on scorer relation)
      // Default: assume home team if we can't determine
      return homeWon ? 'won' : 'lost';
    }
  }

  // General: show from home team perspective
  return homeWon ? 'won' : 'lost';
}

function getWinnerTeamId(match: MatchItem): string | null {
  if (match.homeScore > match.awayScore) return match.homeTeam.id;
  if (match.awayScore > match.homeScore) return match.awayTeam.id;
  return null;
}

// ─── Event Icon Helper ────────────────────────────────────────────

function getEventIcon(eventType: string): { icon: string; color: string } {
  switch (eventType) {
    case 'raid_point':
      return { icon: '⚔️', color: 'text-blue-600 dark:text-blue-400' };
    case 'tackle_point':
      return { icon: '🛡️', color: 'text-emerald-600 dark:text-emerald-400' };
    case 'bonus_point':
      return { icon: '⭐', color: 'text-amber-600 dark:text-amber-400' };
    case 'super_raid':
      return { icon: '🔥', color: 'text-orange-600 dark:text-orange-400' };
    case 'super_tackle':
      return { icon: '💪', color: 'text-teal-600 dark:text-teal-400' };
    case 'all_out':
      return { icon: '💥', color: 'text-red-600 dark:text-red-400' };
    case 'empty_raid':
      return { icon: '○', color: 'text-warm-500 dark:text-warm-400' };
    case 'do_or_die_raid':
      return { icon: '🎲', color: 'text-purple-600 dark:text-purple-400' };
    default:
      return { icon: '•', color: 'text-warm-500 dark:text-warm-400' };
  }
}

// ─── Component ────────────────────────────────────────────────────

export default function MatchHistoryScreen({ onClose }: MatchHistoryScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const userId = currentUser?.id;

  // State
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('newest');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalFromApi, setTotalFromApi] = useState(0);

  const PAGE_SIZE = 10;

  // Fetch matches
  const fetchMatches = useCallback(
    async (currentOffset: number, append: boolean) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const params = new URLSearchParams();
        params.set('limit', PAGE_SIZE.toString());
        params.set('offset', currentOffset.toString());
        params.set('status', 'completed');

        if (userId) {
          params.set('userId', userId);
        }

        const res = await fetch(`/api/matches?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch');

        const data = await res.json();
        const fetched: MatchItem[] = data.matches || [];

        if (append) {
          setMatches((prev) => [...prev, ...fetched]);
        } else {
          setMatches(fetched);
        }

        setTotalFromApi(fetched.length);
        setHasMore(fetched.length >= PAGE_SIZE);
      } catch (err) {
        console.error('Match history fetch error:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchMatches(0, false);
  }, [fetchMatches]);

  // Compute stats from all loaded matches (respecting date filter)
  const stats = (() => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalPoints = 0;
    let highestScore = 0;
    let highestScoringMatch: string | null = null;

    const dateFiltered = matches.filter((m) =>
      isWithinDateFilter(m.completedAt || m.createdAt, dateFilter)
    );

    for (const match of dateFiltered) {
      const result = getMatchResult(match, userId);
      if (result === 'won') wins++;
      else if (result === 'lost') losses++;
      else draws++;

      const matchTotal = match.homeScore + match.awayScore;
      totalPoints += matchTotal;

      if (matchTotal > highestScore) {
        highestScore = matchTotal;
        highestScoringMatch = match.id;
      }
    }

    // Current streak
    const streak = (() => {
      const sorted = [...dateFiltered].sort(
        (a, b) =>
          new Date(b.completedAt || b.createdAt).getTime() -
          new Date(a.completedAt || a.createdAt).getTime()
      );
      if (sorted.length === 0) return { type: 'none', count: 0 };

      const firstResult = getMatchResult(sorted[0], userId);
      let streakCount = 0;
      for (const m of sorted) {
        const r = getMatchResult(m, userId);
        if (r === firstResult) {
          streakCount++;
        } else if (r === 'draw' && firstResult !== 'draw') {
          // draws don't break streaks but don't count either
          continue;
        } else {
          break;
        }
      }
      return { type: firstResult, count: streakCount };
    })();

    const avgScore = dateFiltered.length > 0
      ? Math.round(totalPoints / dateFiltered.length)
      : 0;

    return {
      total: dateFiltered.length,
      wins,
      losses,
      draws,
      winRate: dateFiltered.length > 0 ? Math.round((wins / dateFiltered.length) * 100) : 0,
      totalPoints,
      highestScore,
      highestScoringMatch,
      avgScore,
      streak,
    };
  })();

  // Filter and sort matches
  const filteredMatches = (() => {
    let filtered = [...matches];

    // Date filter
    filtered = filtered.filter((m) =>
      isWithinDateFilter(m.completedAt || m.createdAt, dateFilter)
    );

    // Result filter
    if (resultFilter !== 'all') {
      filtered = filtered.filter((m) => getMatchResult(m, userId) === resultFilter);
    }

    // Type filter
    if (typeFilter === 'tournament') {
      filtered = filtered.filter((m) => !m.isPractice);
    } else if (typeFilter === 'practice') {
      filtered = filtered.filter((m) => m.isPractice);
    }

    // Gender filter
    if (genderFilter !== 'all') {
      filtered = filtered.filter(
        (m) => m.gender?.toLowerCase() === genderFilter
      );
    }

    // Sort
    if (sortFilter === 'newest') {
      filtered.sort(
        (a, b) =>
          new Date(b.completedAt || b.createdAt).getTime() -
          new Date(a.completedAt || a.createdAt).getTime()
      );
    } else if (sortFilter === 'oldest') {
      filtered.sort(
        (a, b) =>
          new Date(a.completedAt || a.createdAt).getTime() -
          new Date(b.completedAt || b.createdAt).getTime()
      );
    } else if (sortFilter === 'highest_score') {
      filtered.sort(
        (a, b) => (b.homeScore + b.awayScore) - (a.homeScore + a.awayScore)
      );
    }

    return filtered;
  })();

  // Group matches by date
  const groupedMatches: { label: string; matches: MatchItem[] }[] = (() => {
    const groups: Record<string, MatchItem[]> = {};
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];

    for (const match of filteredMatches) {
      const group = getDateGroup(match.completedAt || match.createdAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(match);
    }

    return order
      .filter((label) => groups[label]?.length > 0)
      .map((label) => ({ label, matches: groups[label] }));
  })();

  // Load more
  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchMatches(newOffset, true);
  };

  // Toggle expand
  const handleMatchClick = (matchId: string) => {
    setExpandedMatchId((prev) => (prev === matchId ? null : matchId));
  };

  // Navigate to Quick Score
  const handleStartMatch = () => {
    useKabaddiStore.getState().setActiveTab('quick-score');
  };

  // ─── Filter Pill Component ──────────────────────────────────────
  function FilterPill<T extends string>({
    options,
    value,
    onChange,
  }: {
    options: { label: string; value: T }[];
    value: T;
    onChange: (val: T) => void;
  }) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {options.map((opt) => (
          <motion.button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 relative ${
              value === opt.value
                ? 'bg-warm-800 dark:bg-warm-100 text-warm-50 dark:text-warm-900 shadow-sm'
                : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
            }`}
            variants={filterPillVariants}
            animate={value === opt.value ? 'active' : 'inactive'}
            whileTap={{ scale: 0.95 }}
          >
            {opt.label}
          </motion.button>
        ))}
      </div>
    );
  }

  // ─── Match Card ─────────────────────────────────────────────────
  function MatchCard({ match, index }: { match: MatchItem; index: number }) {
    const result = getMatchResult(match, userId);
    const winnerId = getWinnerTeamId(match);
    const isExpanded = expandedMatchId === match.id;

    const homeTeamName = match.homeTeam.shortName || match.homeTeam.name;
    const awayTeamName = match.awayTeam.shortName || match.awayTeam.name;
    const homeColor = match.homeTeam.color || '#DC2626';
    const awayColor = match.awayTeam.color || '#1E293B';

    // User contribution
    const userContribution = userId
      ? match.events
          .filter((e) => e.playerId === userId)
          .reduce((sum, e) => sum + e.value, 0)
      : 0;

    // Event summary for expanded view
    const eventSummary = (() => {
      const summary = {
        raids: 0,
        tacklePoints: 0,
        bonusPoints: 0,
        allOuts: 0,
        superRaids: 0,
        superTackles: 0,
        emptyRaids: 0,
      };
      for (const evt of match.events) {
        switch (evt.eventType) {
          case 'raid_point':
            summary.raids += evt.value;
            break;
          case 'tackle_point':
            summary.tacklePoints += evt.value;
            break;
          case 'bonus_point':
            summary.bonusPoints += evt.value;
            break;
          case 'all_out':
            summary.allOuts += 1;
            break;
          case 'super_raid':
            summary.superRaids += 1;
            break;
          case 'super_tackle':
            summary.superTackles += 1;
            break;
          case 'empty_raid':
            summary.emptyRaids += 1;
            break;
        }
      }
      return summary;
    })();

    // Top performers
    const topPerformers = (() => {
      const playerPoints: Record<string, { name: string; points: number; teamSide: 'home' | 'away' }> = {};
      for (const evt of match.events) {
        if (!evt.playerId) continue;
        const scorer = match.scorers.find((s) => s.userId === evt.playerId);
        const name = scorer?.user?.name || 'Player';
        const teamSide = evt.teamId === match.homeTeam.id ? 'home' : 'away';
        if (!playerPoints[evt.playerId]) {
          playerPoints[evt.playerId] = { name, points: 0, teamSide };
        }
        playerPoints[evt.playerId].points += evt.value;
      }
      return Object.entries(playerPoints)
        .sort((a, b) => b[1].points - a[1].points)
        .slice(0, 3);
    })();

    // Home/Away event breakdown
    const homeEvents = match.events.filter((e) => e.teamId === match.homeTeam.id);
    const awayEvents = match.events.filter((e) => e.teamId === match.awayTeam.id);

    const homeRaidPts = homeEvents.filter((e) => e.eventType === 'raid_point' || e.eventType === 'super_raid' || e.eventType === 'do_or_die_raid').reduce((s, e) => s + e.value, 0);
    const homeTacklePts = homeEvents.filter((e) => e.eventType === 'tackle_point' || e.eventType === 'super_tackle').reduce((s, e) => s + e.value, 0);
    const homeBonusPts = homeEvents.filter((e) => e.eventType === 'bonus_point').reduce((s, e) => s + e.value, 0);
    const homeAllOuts = homeEvents.filter((e) => e.eventType === 'all_out').length;

    const awayRaidPts = awayEvents.filter((e) => e.eventType === 'raid_point' || e.eventType === 'super_raid' || e.eventType === 'do_or_die_raid').reduce((s, e) => s + e.value, 0);
    const awayTacklePts = awayEvents.filter((e) => e.eventType === 'tackle_point' || e.eventType === 'super_tackle').reduce((s, e) => s + e.value, 0);
    const awayBonusPts = awayEvents.filter((e) => e.eventType === 'bonus_point').reduce((s, e) => s + e.value, 0);
    const awayAllOuts = awayEvents.filter((e) => e.eventType === 'all_out').length;

    // Match duration
    const matchDuration = (() => {
      if (match.startedAt && match.completedAt) {
        const diff = new Date(match.completedAt).getTime() - new Date(match.startedAt).getTime();
        const minutes = Math.round(diff / 60000);
        return minutes > 0 ? `${minutes} min` : null;
      }
      if (match.halfDuration) {
        return `${match.halfDuration * 2} min`;
      }
      return null;
    })();

    // Key events timeline (last 8 events)
    const keyEvents = match.events
      .filter((e) => ['raid_point', 'tackle_point', 'super_raid', 'super_tackle', 'all_out', 'bonus_point', 'do_or_die_raid'].includes(e.eventType))
      .slice(0, 8);

    const borderClass =
      result === 'won'
        ? 'border-l-4 border-l-emerald-500 dark:border-l-emerald-400'
        : result === 'lost'
          ? 'border-l-4 border-l-red-500 dark:border-l-red-400'
          : 'border-l-4 border-l-amber-500 dark:border-l-amber-400';

    const resultBadgeClass =
      result === 'won'
        ? 'badge-win'
        : result === 'lost'
          ? 'badge-loss'
          : 'bg-amber-500 dark:bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase';

    const resultIcon =
      result === 'won' ? <Trophy className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> :
      result === 'lost' ? <Swords className="w-3.5 h-3.5 text-red-500 dark:text-red-400" /> :
      <Shield className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />;

    return (
      <motion.div variants={itemVariants} custom={index}>
        <Card
          className={`card-elevated ${borderClass} cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.99] bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 overflow-hidden`}
          onClick={() => handleMatchClick(match.id)}
        >
          <CardContent className="p-4">
            {/* Header Row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {resultIcon}
                <span className={resultBadgeClass}>
                  {result}
                </span>
                {!match.isPractice ? (
                  <Badge className="bg-brand-teal/15 text-brand-teal text-[9px] border-0 font-semibold px-1.5 py-0">
                    Tournament
                  </Badge>
                ) : (
                  <Badge className="bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300 text-[9px] border-0 font-semibold px-1.5 py-0">
                    Practice
                  </Badge>
                )}
                {match.gender && (
                  <span className="text-[10px] text-warm-500 dark:text-warm-400">
                    {match.gender.toLowerCase() === 'boys' || match.gender.toLowerCase() === 'male'
                      ? '♂'
                      : '♀'}
                  </span>
                )}
                {match.weightCategory && (
                  <Badge className="text-[9px] font-semibold border-0 px-1.5 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                    {match.weightCategory === 'open' ? '♾️ Open' : `⚖️ ${match.weightCategory}`}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-warm-400 dark:text-warm-500">
                <Calendar className="w-3 h-3" />
                {formatMatchDate(match.completedAt || match.createdAt)}
              </div>
            </div>

            {/* Teams & Score */}
            <div className="flex items-center justify-between">
              {/* Home Team */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm"
                  style={{ backgroundColor: homeColor }}
                >
                  {homeTeamName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold truncate ${
                      winnerId === match.homeTeam.id
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-warm-800 dark:text-warm-100'
                    }`}
                  >
                    {homeTeamName}
                  </p>
                  {match.tournament && (
                    <p className="text-[9px] text-warm-400 dark:text-warm-500 truncate">
                      {match.tournament.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="flex items-center gap-2 px-3 shrink-0">
                <span
                  className={`text-xl font-black tabular-nums ${
                    winnerId === match.homeTeam.id
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-warm-700 dark:text-warm-200'
                  }`}
                >
                  {match.homeScore}
                </span>
                <span className="text-warm-400 dark:text-warm-500 text-xs font-bold">-</span>
                <span
                  className={`text-xl font-black tabular-nums ${
                    winnerId === match.awayTeam.id
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-warm-700 dark:text-warm-200'
                  }`}
                >
                  {match.awayScore}
                </span>
              </div>

              {/* Away Team */}
              <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                <div className="min-w-0 text-right">
                  <p
                    className={`text-sm font-semibold truncate ${
                      winnerId === match.awayTeam.id
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                        : 'text-warm-800 dark:text-warm-100'
                    }`}
                  >
                    {awayTeamName}
                  </p>
                </div>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-sm"
                  style={{ backgroundColor: awayColor }}
                >
                  {awayTeamName.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>

            {/* Score Comparison Bar */}
            <ScoreBar homeScore={match.homeScore} awayScore={match.awayScore} />

            {/* Info Row */}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-warm-500 dark:text-warm-400">
              {match.half > 0 && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  H{match.half}
                </span>
              )}
              {userContribution > 0 && (
                <span className="flex items-center gap-0.5 text-brand-gold dark:text-brand-gold-light font-semibold">
                  <Star className="w-3 h-3" />
                  You: {userContribution} pts
                </span>
              )}
              {match.venue && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" />
                  {match.venue}
                </span>
              )}
              <span className="ml-auto flex items-center gap-0.5">
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                Details
              </span>
            </div>

            {/* Expanded Details */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-warm-200 dark:border-warm-700 space-y-3">
                    {/* Score Breakdown */}
                    <div>
                      <p className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-1.5">
                        Score Breakdown
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-lg border border-warm-200 dark:border-warm-600">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: homeColor }}>
                              {homeTeamName.charAt(0)}
                            </div>
                            <span className="text-[10px] font-bold text-warm-700 dark:text-warm-200 truncate">{homeTeamName}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                            <span className="text-warm-500 dark:text-warm-400">Raid</span>
                            <span className="font-bold text-warm-800 dark:text-warm-100 text-right">{homeRaidPts}</span>
                            <span className="text-warm-500 dark:text-warm-400">Tackle</span>
                            <span className="font-bold text-warm-800 dark:text-warm-100 text-right">{homeTacklePts}</span>
                            <span className="text-warm-500 dark:text-warm-400">Bonus</span>
                            <span className="font-bold text-warm-800 dark:text-warm-100 text-right">{homeBonusPts}</span>
                            {homeAllOuts > 0 && (
                              <>
                                <span className="text-warm-500 dark:text-warm-400">All-Out</span>
                                <span className="font-bold text-warm-800 dark:text-warm-100 text-right">{homeAllOuts}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg border border-warm-200 dark:border-warm-600">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold" style={{ backgroundColor: awayColor }}>
                              {awayTeamName.charAt(0)}
                            </div>
                            <span className="text-[10px] font-bold text-warm-700 dark:text-warm-200 truncate">{awayTeamName}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                            <span className="text-warm-500 dark:text-warm-400">Raid</span>
                            <span className="font-bold text-warm-800 dark:text-warm-100 text-right">{awayRaidPts}</span>
                            <span className="text-warm-500 dark:text-warm-400">Tackle</span>
                            <span className="font-bold text-warm-800 dark:text-warm-100 text-right">{awayTacklePts}</span>
                            <span className="text-warm-500 dark:text-warm-400">Bonus</span>
                            <span className="font-bold text-warm-800 dark:text-warm-100 text-right">{awayBonusPts}</span>
                            {awayAllOuts > 0 && (
                              <>
                                <span className="text-warm-500 dark:text-warm-400">All-Out</span>
                                <span className="font-bold text-warm-800 dark:text-warm-100 text-right">{awayAllOuts}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top Performers */}
                    {topPerformers.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-1.5">
                          Top Performers
                        </p>
                        <div className="flex flex-col gap-1">
                          {topPerformers.map(([pid, data], i) => (
                            <div
                              key={pid}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span className="w-4 h-4 rounded-full bg-brand-gold/20 flex items-center justify-center text-[9px] font-bold text-brand-gold dark:text-brand-gold-light">
                                {i + 1}
                              </span>
                              <span className="text-warm-700 dark:text-warm-200 font-medium flex-1 truncate">
                                {data.name}
                              </span>
                              <span className="text-brand-gold dark:text-brand-gold-light font-bold">
                                {data.points} pts
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Events Timeline */}
                    {keyEvents.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-1.5">
                          Key Events
                        </p>
                        <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                          {keyEvents.map((evt) => {
                            const eventInfo = getEventIcon(evt.eventType);
                            const isHome = evt.teamId === match.homeTeam.id;
                            return (
                              <div key={evt.id} className="flex items-center gap-2 text-[10px]">
                                <span className="text-xs">{eventInfo.icon}</span>
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: isHome ? homeColor : awayColor }}
                                />
                                <span className={`font-medium ${eventInfo.color}`}>
                                  {evt.eventType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                                </span>
                                {evt.value > 0 && (
                                  <Badge className="bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 text-[8px] border-0 font-bold px-1 py-0">
                                    +{evt.value}
                                  </Badge>
                                )}
                                <span className="text-warm-400 dark:text-warm-500 ml-auto">H{evt.half}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Event Summary Grid */}
                    <div>
                      <p className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-1.5">
                        Match Summary
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-1.5 rounded-lg bg-warm-50 dark:bg-warm-700/50">
                          <p className="text-sm font-bold text-warm-800 dark:text-warm-100">
                            {eventSummary.raids}
                          </p>
                          <p className="text-[8px] text-warm-500 dark:text-warm-400 uppercase">Raids</p>
                        </div>
                        <div className="text-center p-1.5 rounded-lg bg-warm-50 dark:bg-warm-700/50">
                          <p className="text-sm font-bold text-warm-800 dark:text-warm-100">
                            {eventSummary.tacklePoints}
                          </p>
                          <p className="text-[8px] text-warm-500 dark:text-warm-400 uppercase">Tackles</p>
                        </div>
                        <div className="text-center p-1.5 rounded-lg bg-warm-50 dark:bg-warm-700/50">
                          <p className="text-sm font-bold text-warm-800 dark:text-warm-100">
                            {eventSummary.bonusPoints}
                          </p>
                          <p className="text-[8px] text-warm-500 dark:text-warm-400 uppercase">Bonus</p>
                        </div>
                        <div className="text-center p-1.5 rounded-lg bg-warm-50 dark:bg-warm-700/50">
                          <p className="text-sm font-bold text-warm-800 dark:text-warm-100">
                            {eventSummary.allOuts}
                          </p>
                          <p className="text-[8px] text-warm-500 dark:text-warm-400 uppercase">All-Outs</p>
                        </div>
                      </div>
                      {(eventSummary.superRaids > 0 || eventSummary.superTackles > 0 || eventSummary.emptyRaids > 0) && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {eventSummary.superRaids > 0 && (
                            <Badge className="bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold-light text-[8px] border-0 font-semibold px-1.5 py-0">
                              {eventSummary.superRaids} Super Raid{eventSummary.superRaids > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {eventSummary.superTackles > 0 && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[8px] border-0 font-semibold px-1.5 py-0">
                              {eventSummary.superTackles} Super Tackle{eventSummary.superTackles > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {eventSummary.emptyRaids > 0 && (
                            <Badge className="bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300 text-[8px] border-0 font-semibold px-1.5 py-0">
                              {eventSummary.emptyRaids} Empty Raid{eventSummary.emptyRaids > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Match Duration & Info */}
                    <div className="flex items-center gap-3 text-[10px] text-warm-500 dark:text-warm-400">
                      {matchDuration && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {matchDuration}
                        </span>
                      )}
                      {match.halfDuration > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {match.halfDuration} min/half
                        </span>
                      )}
                      {match.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {match.venue}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ─── Empty State ────────────────────────────────────────────────
  function EmptyState() {
    const isFilterActive =
      resultFilter !== 'all' || typeFilter !== 'all' || genderFilter !== 'all' || dateFilter !== 'all';

    return (
      <motion.div
        className="flex flex-col items-center justify-center py-16 px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="w-20 h-20 rounded-full bg-warm-100 dark:bg-warm-800 flex items-center justify-center mb-4"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Swords className="w-10 h-10 text-warm-400 dark:text-warm-500" />
        </motion.div>
        <h3 className="text-lg font-bold text-warm-700 dark:text-warm-200 mb-1">
          {isFilterActive ? 'No matches found' : 'No matches yet'}
        </h3>
        <p className="text-sm text-warm-500 dark:text-warm-400 text-center mb-6 max-w-[260px]">
          {isFilterActive
            ? 'Try adjusting your filters to find what you\'re looking for.'
            : 'Start scoring your first kabaddi match and it will appear here.'}
        </p>
        {isFilterActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setResultFilter('all');
              setTypeFilter('all');
              setGenderFilter('all');
              setDateFilter('all');
            }}
            className="text-brand-red border-brand-red/30 hover:bg-brand-red/10"
          >
            <Filter className="w-4 h-4 mr-1.5" />
            Clear Filters
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleStartMatch}
            className="bg-brand-red hover:bg-brand-red-dark text-white shadow-md shadow-brand-red/25"
          >
            <Play className="w-4 h-4 mr-1.5" />
            Start your first match!
          </Button>
        )}
      </motion.div>
    );
  }

  // ─── Skeleton Loader ────────────────────────────────────────────
  function MatchSkeleton() {
    return (
      <Card className="card-elevated border-l-4 border-l-warm-300 dark:border-l-warm-600 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-4 w-12 rounded-full bg-warm-200 dark:bg-warm-700 animate-pulse" />
            <div className="h-4 w-16 rounded-full bg-warm-200 dark:bg-warm-700 animate-pulse" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 animate-pulse" />
              <div className="h-3.5 w-16 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-5 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
              <div className="h-3 w-3 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
              <div className="h-6 w-5 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3.5 w-16 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
              <div className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 animate-pulse" />
            </div>
          </div>
          {/* Score bar skeleton */}
          <div className="h-1.5 rounded-full bg-warm-200 dark:bg-warm-700 animate-pulse mt-3" />
        </CardContent>
      </Card>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto custom-scrollbar"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
    >
      <div className="min-h-screen flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md border-b border-warm-200 dark:border-warm-700">
          <div className="px-4 py-3 flex items-center gap-3">
            <motion.button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-warm-100 dark:hover:bg-warm-800 transition-colors active:scale-90"
              whileTap={{ scale: 0.9 }}
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5 text-warm-700 dark:text-warm-200" />
            </motion.button>
            <div>
              <h1 className="text-lg font-black text-warm-800 dark:text-warm-100">
                Match History
              </h1>
              <p className="text-[10px] text-warm-500 dark:text-warm-400">
                {stats.total} match{stats.total !== 1 ? 'es' : ''} played
              </p>
            </div>
          </div>
        </header>

        {/* Stats Summary Bar */}
        <div className="px-4 pt-4">
          <div className="grid grid-cols-5 gap-2">
            {/* Total */}
            <motion.div
              className="flex flex-col items-center p-2.5 rounded-xl bg-warm-100 dark:bg-warm-800 border border-warm-200 dark:border-warm-700"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Swords className="w-3.5 h-3.5 text-brand-red mb-1" />
              <span className="text-lg font-black text-warm-800 dark:text-warm-100">
                <AnimatedCounter target={stats.total} />
              </span>
              <span className="text-[8px] text-warm-500 dark:text-warm-400 uppercase font-semibold">
                Total
              </span>
            </motion.div>

            {/* Wins */}
            <motion.div
              className="flex flex-col items-center p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Trophy className="w-3.5 h-3.5 text-emerald-500 mb-1" />
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                <AnimatedCounter target={stats.wins} />
              </span>
              <span className="text-[8px] text-emerald-600/70 dark:text-emerald-400/70 uppercase font-semibold">
                Wins
              </span>
            </motion.div>

            {/* Losses */}
            <motion.div
              className="flex flex-col items-center p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Shield className="w-3.5 h-3.5 text-red-500 mb-1" />
              <span className="text-lg font-black text-red-600 dark:text-red-400">
                <AnimatedCounter target={stats.losses} />
              </span>
              <span className="text-[8px] text-red-600/70 dark:text-red-400/70 uppercase font-semibold">
                Lost
              </span>
            </motion.div>

            {/* Draws */}
            <motion.div
              className="flex flex-col items-center p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 mb-1" />
              <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                <AnimatedCounter target={stats.draws} />
              </span>
              <span className="text-[8px] text-amber-600/70 dark:text-amber-400/70 uppercase font-semibold">
                Draw
              </span>
            </motion.div>

            {/* Win Rate */}
            <motion.div
              className="flex flex-col items-center p-2.5 rounded-xl bg-warm-100 dark:bg-warm-800 border border-warm-200 dark:border-warm-700 relative"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                <MiniProgressRing percent={stats.winRate} size={36} />
              </div>
              <div className="relative z-10">
                <Target className="w-3.5 h-3.5 text-brand-teal mb-1" />
                <span className="text-lg font-black text-brand-teal">
                  <AnimatedCounter target={stats.winRate} />%
                </span>
                <span className="text-[8px] text-brand-teal/70 uppercase font-semibold">
                  Rate
                </span>
              </div>
            </motion.div>
          </div>

          {/* Extended Stats Row */}
          <motion.div
            className="mt-2 grid grid-cols-3 gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            {/* Avg Score */}
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-warm-50 dark:bg-warm-800/50 border border-warm-200 dark:border-warm-700">
              <Activity className="w-3 h-3 text-brand-teal shrink-0" />
              <div>
                <p className="text-xs font-bold text-warm-800 dark:text-warm-100">{stats.avgScore}</p>
                <p className="text-[7px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Avg Score</p>
              </div>
            </div>

            {/* Highest Score */}
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-warm-50 dark:bg-warm-800/50 border border-warm-200 dark:border-warm-700">
              <TrendingUp className="w-3 h-3 text-brand-gold shrink-0" />
              <div>
                <p className="text-xs font-bold text-warm-800 dark:text-warm-100">{stats.highestScore}</p>
                <p className="text-[7px] text-warm-500 dark:text-warm-400 uppercase font-semibold">High Score</p>
              </div>
            </div>

            {/* Current Streak */}
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-warm-50 dark:bg-warm-800/50 border border-warm-200 dark:border-warm-700">
              {stats.streak.type === 'won' ? (
                <ArrowUpRight className="w-3 h-3 text-emerald-500 shrink-0" />
              ) : stats.streak.type === 'lost' ? (
                <ArrowDownRight className="w-3 h-3 text-red-500 shrink-0" />
              ) : (
                <Minus className="w-3 h-3 text-warm-400 shrink-0" />
              )}
              <div>
                <p className={`text-xs font-bold ${
                  stats.streak.type === 'won' ? 'text-emerald-600 dark:text-emerald-400' :
                  stats.streak.type === 'lost' ? 'text-red-600 dark:text-red-400' :
                  'text-warm-600 dark:text-warm-300'
                }`}>
                  {stats.streak.count > 0 ? `${stats.streak.count}${stats.streak.type === 'won' ? 'W' : stats.streak.type === 'lost' ? 'L' : 'D'}` : '-'}
                </p>
                <p className="text-[7px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Streak</p>
              </div>
            </div>
          </motion.div>

          {/* Total Points */}
          <motion.div
            className="mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gradient-to-r from-brand-red/5 via-brand-gold/5 to-brand-teal/5 dark:from-brand-red/10 dark:via-brand-gold/10 dark:to-brand-teal/10 border border-warm-200 dark:border-warm-700"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Star className="w-3.5 h-3.5 text-brand-gold" />
            <span className="text-xs text-warm-600 dark:text-warm-300 font-medium">
              Total points across all matches:
            </span>
            <span className="text-sm font-black gradient-text">
              <AnimatedCounter target={stats.totalPoints} />
            </span>
          </motion.div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 mt-4 space-y-2.5">
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider w-10 shrink-0">
              Time
            </span>
            <FilterPill<DateFilter>
              options={[
                { label: 'All Time', value: 'all' as DateFilter },
                { label: 'This Week', value: 'week' as DateFilter },
                { label: 'This Month', value: 'month' as DateFilter },
                { label: 'This Year', value: 'year' as DateFilter },
              ]}
              value={dateFilter}
              onChange={setDateFilter}
            />
          </div>

          {/* Result Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider w-10 shrink-0">
              Result
            </span>
            <FilterPill<ResultFilter>
              options={[
                { label: 'All', value: 'all' as ResultFilter },
                { label: 'Won', value: 'won' as ResultFilter },
                { label: 'Lost', value: 'lost' as ResultFilter },
                { label: 'Draw', value: 'draw' as ResultFilter },
              ]}
              value={resultFilter}
              onChange={setResultFilter}
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider w-10 shrink-0">
              Type
            </span>
            <FilterPill<TypeFilter>
              options={[
                { label: 'All', value: 'all' as TypeFilter },
                { label: 'Tournament', value: 'tournament' as TypeFilter },
                { label: 'Practice', value: 'practice' as TypeFilter },
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
            />
          </div>

          {/* Gender Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider w-10 shrink-0">
              Gender
            </span>
            <FilterPill<GenderFilter>
              options={[
                { label: 'All', value: 'all' as GenderFilter },
                { label: '♂ Boys', value: 'boys' as GenderFilter },
                { label: '♀ Girls', value: 'girls' as GenderFilter },
              ]}
              value={genderFilter}
              onChange={setGenderFilter}
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider w-10 shrink-0">
              Sort
            </span>
            <FilterPill<SortFilter>
              options={[
                { label: 'Newest', value: 'newest' as SortFilter },
                { label: 'Oldest', value: 'oldest' as SortFilter },
                { label: 'Top Score', value: 'highest_score' as SortFilter },
              ]}
              value={sortFilter}
              onChange={setSortFilter}
            />
          </div>
        </div>

        {/* Match Timeline */}
        <div className="px-4 mt-4 pb-6 flex-1">
          {loading ? (
            <motion.div
              className="flex flex-col gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <MatchSkeleton key={i} />
              ))}
            </motion.div>
          ) : filteredMatches.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-5">
              {groupedMatches.map((group) => (
                <div key={group.label}>
                  {/* Date Divider */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-warm-200 dark:bg-warm-700" />
                    <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-widest px-2">
                      {group.label}
                    </span>
                    <div className="h-px flex-1 bg-warm-200 dark:bg-warm-700" />
                  </div>

                  {/* Match Cards */}
                  <motion.div
                    className="flex flex-col gap-3"
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {group.matches.map((match, idx) => (
                      <MatchCard key={match.id} match={match} index={idx} />
                    ))}
                  </motion.div>
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="border-warm-300 dark:border-warm-600 text-warm-600 dark:text-warm-300 hover:bg-warm-100 dark:hover:bg-warm-800"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1.5" />
                        Load More
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Loading more skeleton */}
              <AnimatePresence>
                {loadingMore && (
                  <motion.div
                    className="flex flex-col gap-3 mt-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <MatchSkeleton key={`more-${i}`} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
