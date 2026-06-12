'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, Plus, ChevronRight,
  Loader2, Trophy, Users, ArrowLeft, Crown,
  TrendingUp, Star, Target, Zap, BarChart3, Activity,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import PremiumLock from './PremiumLock';

// ─── Types ────────────────────────────────────────────────────────

interface SeasonScreenProps {
  onClose: () => void;
}

interface Season {
  id: string;
  name: string;
  year: number;
  startDate: string;
  description: string | null;
  status: 'upcoming' | 'active' | 'completed';
  teamCount: number;
  matchCount: number;
  teams: SeasonTeam[];
  matches: SeasonMatch[];
  sponsors: SeasonSponsor[];
}

interface SeasonTeam {
  id: string;
  name: string;
  shortName: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
}

interface SeasonMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  date: string;
}

interface SeasonSponsor {
  id: string;
  name: string;
  tier: string;
}

interface MVPPlayer {
  id: string;
  name: string;
  avatar: string | null;
  totalPoints: number;
  raidPoints: number;
  tacklePoints: number;
  position: string | null;
  overallRating: number;
}

// ─── Config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; gradient: string; textColor: string; dotColor: string; iconBg: string }> = {
  upcoming: {
    label: 'Upcoming',
    gradient: 'from-blue-500/10 to-cyan-500/5',
    textColor: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
    iconBg: 'bg-blue-500/15',
  },
  active: {
    label: 'Active',
    gradient: 'from-emerald-500/10 to-green-500/5',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    iconBg: 'bg-emerald-500/15',
  },
  completed: {
    label: 'Completed',
    gradient: 'from-amber-500/10 to-orange-500/5',
    textColor: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    iconBg: 'bg-amber-500/15',
  },
};

const CARD_GRADIENTS = [
  'from-brand-navy/5 via-brand-navy/3 to-transparent',
  'from-brand-teal/5 via-brand-teal/3 to-transparent',
  'from-brand-red/5 via-brand-red/3 to-transparent',
  'from-amber-500/5 via-amber-500/3 to-transparent',
  'from-emerald-500/5 via-emerald-500/3 to-transparent',
];

// ─── Animation ────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── SVG Bar Chart Component ──────────────────────────────────────

function SeasonComparisonChart({ seasons }: { seasons: Season[] }) {
  const maxTeams = Math.max(...seasons.map((s) => s.teamCount), 1);
  const maxMatches = Math.max(...seasons.map((s) => s.matchCount), 1);
  const barWidth = 28;
  const gap = 12;
  const chartWidth = seasons.length * (barWidth + gap) + 60;
  const chartHeight = 140;
  const barAreaHeight = 100;
  const barAreaY = 20;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={Math.max(chartWidth, 260)}
        height={chartHeight}
        viewBox={`0 0 ${Math.max(chartWidth, 260)} ${chartHeight}`}
        className="mx-auto"
      >
        {/* Y-axis labels */}
        <text x="8" y={barAreaY + 5} className="fill-warm-400 dark:fill-warm-500" fontSize="8" textAnchor="start">
          {maxTeams}T
        </text>
        <text x="8" y={barAreaY + barAreaHeight / 2} className="fill-warm-400 dark:fill-warm-500" fontSize="8" textAnchor="start">
          {Math.round(maxTeams / 2)}T
        </text>
        <text x="8" y={barAreaY + barAreaHeight} className="fill-warm-400 dark:fill-warm-500" fontSize="8" textAnchor="start">
          0
        </text>

        {/* Grid lines */}
        <line
          x1="30" y1={barAreaY} x2={chartWidth - 10} y2={barAreaY}
          stroke="currentColor" strokeWidth="0.5" className="text-warm-200 dark:text-warm-700"
        />
        <line
          x1="30" y1={barAreaY + barAreaHeight / 2} x2={chartWidth - 10} y2={barAreaY + barAreaHeight / 2}
          stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 2" className="text-warm-200 dark:text-warm-700"
        />
        <line
          x1="30" y1={barAreaY + barAreaHeight} x2={chartWidth - 10} y2={barAreaY + barAreaHeight}
          stroke="currentColor" strokeWidth="0.5" className="text-warm-200 dark:text-warm-700"
        />

        {/* Bars */}
        {seasons.map((season, i) => {
          const x = 40 + i * (barWidth + gap);
          const teamHeight = maxTeams > 0 ? (season.teamCount / maxTeams) * barAreaHeight : 0;
          const matchHeight = maxMatches > 0 ? (season.matchCount / maxMatches) * barAreaHeight : 0;

          return (
            <g key={season.id}>
              {/* Teams bar */}
              <motion.rect
                x={x}
                y={barAreaY + barAreaHeight - teamHeight}
                width={barWidth / 2 - 2}
                height={teamHeight}
                rx={3}
                className="fill-brand-teal"
                initial={{ height: 0, y: barAreaY + barAreaHeight }}
                animate={{ height: teamHeight, y: barAreaY + barAreaHeight - teamHeight }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: 'easeOut' }}
              />
              {/* Matches bar */}
              <motion.rect
                x={x + barWidth / 2 + 1}
                y={barAreaY + barAreaHeight - matchHeight}
                width={barWidth / 2 - 2}
                height={matchHeight}
                rx={3}
                className="fill-brand-red"
                initial={{ height: 0, y: barAreaY + barAreaHeight }}
                animate={{ height: matchHeight, y: barAreaY + barAreaHeight - matchHeight }}
                transition={{ delay: i * 0.1 + 0.05, duration: 0.5, ease: 'easeOut' }}
              />
              {/* Season label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - 4}
                className="fill-warm-500 dark:fill-warm-400"
                fontSize="8"
                textAnchor="middle"
                fontWeight="600"
              >
                {String(season.year).slice(2)}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <rect x={chartWidth - 90} y={4} width={8} height={8} rx={2} className="fill-brand-teal" />
        <text x={chartWidth - 79} y={11} className="fill-warm-500 dark:fill-warm-400" fontSize="7">Teams</text>
        <rect x={chartWidth - 50} y={4} width={8} height={8} rx={2} className="fill-brand-red" />
        <text x={chartWidth - 39} y={11} className="fill-warm-500 dark:fill-warm-400" fontSize="7">Matches</text>
      </svg>
    </div>
  );
}

// ─── Progress Tracker Component ───────────────────────────────────

function SeasonProgressTracker({ season }: { season: Season }) {
  const completedMatches = season.matches.filter((m) => m.status === 'completed').length;
  const totalMatches = season.matchCount || 1;
  const matchProgress = (completedMatches / totalMatches) * 100;
  const totalTeams = season.teamCount;

  // Estimate total expected matches (round robin)
  const expectedMatches = totalTeams > 1 ? (totalTeams * (totalTeams - 1)) / 2 : totalMatches;
  const seasonProgress = Math.min(100, (completedMatches / Math.max(expectedMatches, 1)) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white dark:bg-warm-800/50 rounded-2xl border border-warm-200/60 dark:border-warm-700/60 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
          <Activity className="w-3.5 h-3.5 text-brand-teal" />
        </div>
        <h3 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-200">SEASON PROGRESS</h3>
      </div>

      {/* Main Progress Bar */}
      <div>
        <div className="flex justify-between text-[10px] mb-1.5">
          <span className="text-warm-500 dark:text-warm-400">Season Completion</span>
          <span className="font-bold text-brand-teal">{Math.round(seasonProgress)}%</span>
        </div>
        <div className="h-2.5 bg-warm-100 dark:bg-warm-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand-teal to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${seasonProgress}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
      </div>

      {/* Stat Chips */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-warm-50 dark:bg-warm-700/30 rounded-xl">
          <p className="text-lg font-black text-brand-navy dark:text-brand-navy-light">{completedMatches}</p>
          <p className="text-[9px] text-warm-400 dark:text-warm-500 font-medium">Played</p>
        </div>
        <div className="text-center p-2 bg-warm-50 dark:bg-warm-700/30 rounded-xl">
          <p className="text-lg font-black text-brand-teal">{totalMatches}</p>
          <p className="text-[9px] text-warm-400 dark:text-warm-500 font-medium">Total</p>
        </div>
        <div className="text-center p-2 bg-warm-50 dark:bg-warm-700/30 rounded-xl">
          <p className="text-lg font-black text-brand-gold">{totalTeams}</p>
          <p className="text-[9px] text-warm-400 dark:text-warm-500 font-medium">Teams</p>
        </div>
      </div>

      {/* Match Progress Sub-bar */}
      {matchProgress > 0 && (
        <div>
          <div className="flex justify-between text-[9px] mb-1">
            <span className="text-warm-400 dark:text-warm-500">Matches Played</span>
            <span className="text-warm-500 dark:text-warm-400 font-semibold">{completedMatches}/{totalMatches}</span>
          </div>
          <div className="h-1.5 bg-warm-100 dark:bg-warm-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-brand-navy to-brand-navy-light"
              initial={{ width: 0 }}
              animate={{ width: `${matchProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── MVP Section Component ────────────────────────────────────────

function SeasonMVPSection({ season, mvpData }: { season: Season; mvpData: MVPPlayer | null }) {
  if (!mvpData) {
    // Compute MVP from season team data (top scorer)
    const topTeam = [...season.teams].sort((a, b) => b.points - a.points)[0];
    if (!topTeam) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-brand-gold/10 via-brand-gold/5 to-transparent dark:from-brand-gold/15 dark:via-brand-gold/5 rounded-2xl border border-brand-gold/20 dark:border-brand-gold/30 p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-brand-gold/15 flex items-center justify-center">
            <Crown className="w-3.5 h-3.5 text-brand-gold" />
          </div>
          <h3 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-200">TOP TEAM</h3>
          <Badge className="bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold text-[8px] font-bold border-0 ml-auto">
            MVP
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-gold/30 to-brand-gold/10 flex items-center justify-center text-2xl shadow-inner">
            <Trophy className="w-7 h-7 text-brand-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">{topTeam.name}</p>
            <p className="text-[10px] text-warm-500 dark:text-warm-400">{topTeam.wins}W · {topTeam.losses}L · {topTeam.draws}D</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-black text-brand-gold">{topTeam.points}</span>
              <span className="text-[10px] text-warm-400">points</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gradient-to-br from-brand-gold/10 via-brand-gold/5 to-transparent dark:from-brand-gold/15 dark:via-brand-gold/5 rounded-2xl border border-brand-gold/20 dark:border-brand-gold/30 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-brand-gold/15 flex items-center justify-center">
          <Star className="w-3.5 h-3.5 text-brand-gold" />
        </div>
        <h3 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-200">SEASON MVP</h3>
        <Badge className="bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold text-[8px] font-bold border-0 ml-auto">
          ⭐ BEST
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-gold/30 to-brand-gold/10 flex items-center justify-center overflow-hidden shadow-inner">
            {mvpData.avatar ? (
              <img src={mvpData.avatar} alt={mvpData.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-brand-gold">{mvpData.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand-gold flex items-center justify-center">
            <Crown className="w-3 h-3 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">{mvpData.name}</p>
          {mvpData.position && (
            <p className="text-[10px] text-warm-500 dark:text-warm-400 capitalize">{mvpData.position}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-brand-red" />
              <span className="text-xs font-bold text-warm-700 dark:text-warm-300">{mvpData.raidPoints}R</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3 text-brand-teal" />
              <span className="text-xs font-bold text-warm-700 dark:text-warm-300">{mvpData.tacklePoints}T</span>
            </div>
            <span className="text-sm font-black text-brand-gold">{mvpData.totalPoints}pts</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty State Component ────────────────────────────────────────

function EmptySeasonState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200 }}
      className="py-8"
    >
      <div className="text-center">
        {/* Trophy illustration */}
        <div className="relative w-24 h-24 mx-auto mb-4">
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-navy/5 to-brand-teal/5 dark:from-brand-navy/10 dark:to-brand-teal/10"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-brand-navy/10 to-brand-teal/10 dark:from-brand-navy/20 dark:to-brand-teal/20 flex items-center justify-center">
            <svg viewBox="0 0 48 48" className="w-12 h-12">
              {/* Trophy cup */}
              <path
                d="M16 8h16v14c0 6-4 10-8 10s-8-4-8-10V8z"
                fill="currentColor"
                className="text-brand-gold/40 dark:text-brand-gold/30"
              />
              {/* Trophy handles */}
              <path
                d="M16 12c-4 0-8 2-8 6s3 6 8 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-brand-gold/30 dark:text-brand-gold/20"
              />
              <path
                d="M32 12c4 0 8 2 8 6s-3 6-8 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-brand-gold/30 dark:text-brand-gold/20"
              />
              {/* Trophy base */}
              <rect x="18" y="32" width="12" height="3" rx="1" className="fill-brand-gold/30 dark:fill-brand-gold/20" />
              <rect x="16" y="35" width="16" height="3" rx="1.5" className="fill-brand-gold/25 dark:fill-brand-gold/15" />
              {/* Star */}
              <path
                d="M24 14l1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5-2.5-2.5 3.5-.5z"
                fill="currentColor"
                className="text-brand-gold/50 dark:text-brand-gold/40"
              />
            </svg>
          </div>
        </div>

        <h3 className="text-warm-700 dark:text-warm-200 font-bold text-base mb-1">No Seasons Yet</h3>
        <p className="text-warm-400 dark:text-warm-500 text-xs leading-relaxed max-w-[200px] mx-auto">
          Create your first season to organize teams, track matches, and crown champions!
        </p>

        {/* Decorative dots */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-brand-teal/30 dark:bg-brand-teal/20"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function SeasonScreen({ onClose }: SeasonScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || false;
  const { toast } = useToast();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [creating, setCreating] = useState(false);
  const [mvpData, setMvpData] = useState<MVPPlayer | null>(null);

  const [form, setForm] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    startDate: '',
    description: '',
  });

  // ─── Fetch seasons ────────────────────────────────────────────

  const fetchSeasons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/seasons');
      if (res.ok) {
        const data = await res.json();
        setSeasons(data.seasons || []);
      } else {
        setSeasons([]);
      }
    } catch {
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  // ─── Fetch MVP when selected season changes ────────────────────

  useEffect(() => {
    if (!selectedSeason) { setMvpData(null); return; }
    const fetchMVP = async () => {
      try {
        const res = await fetch('/api/leaderboard?limit=1');
        if (res.ok) {
          const data = await res.json();
          const topPlayer = data.leaderboard?.[0];
          if (topPlayer) {
            setMvpData({
              id: topPlayer.userId || topPlayer.id,
              name: topPlayer.name || 'Unknown',
              avatar: topPlayer.avatar || null,
              totalPoints: topPlayer.totalPoints || 0,
              raidPoints: topPlayer.raidPoints || 0,
              tacklePoints: topPlayer.tacklePoints || 0,
              position: topPlayer.position || null,
              overallRating: topPlayer.overallRating || 0,
            });
          }
        }
      } catch {
        // Silently fail
      }
    };
    fetchMVP();
  }, [selectedSeason]);

  // ─── Create Season ────────────────────────────────────────────

  const handleCreateSeason = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          year: parseInt(form.year),
          startDate: form.startDate || undefined,
          description: form.description || undefined,
          userId: currentUser?.id,
        }),
      });

      if (res.ok) {
        toast({ title: 'Season Created!', description: `${form.name} is now set up` });
        setForm({ name: '', year: new Date().getFullYear().toString(), startDate: '', description: '' });
        setShowCreateForm(false);
        fetchSeasons();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to create season', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create season', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // ─── Active Season ────────────────────────────────────────────

  const activeSeason = useMemo(() => seasons.find((s) => s.status === 'active'), [seasons]);

  // ─── Season Detail View ───────────────────────────────────────

  if (selectedSeason) {
    const season = selectedSeason;
    const statusConfig = STATUS_CONFIG[season.status] || STATUS_CONFIG.upcoming;
    const sortedTeams = [...season.teams].sort((a, b) => b.points - a.points);

    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
      >
        {/* Header with gradient */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-navy to-brand-navy-light">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedSeason(null)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">{season.name}</h1>
                <p className="text-[11px] text-white/60">{season.year}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Status & Stats - Enhanced */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-warm-200/60 dark:border-warm-700/60 overflow-hidden">
              <CardContent className="p-0">
                {/* Status Header with gradient */}
                <div className={`bg-gradient-to-r ${statusConfig.gradient} px-4 py-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${statusConfig.dotColor} ${
                      season.status === 'active' ? 'animate-pulse' : ''
                    }`} />
                    <Badge className={`${statusConfig.textColor} text-[10px] font-bold border-0 bg-white/50 dark:bg-warm-800/50`}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-warm-500 dark:text-warm-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {season.teamCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {season.matchCount}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  {season.description && (
                    <p className="text-xs text-warm-600 dark:text-warm-300 leading-relaxed">{season.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Season Progress Tracker (Active seasons) */}
          {(season.status === 'active' || season.status === 'completed') && season.matchCount > 0 && (
            <SeasonProgressTracker season={season} />
          )}

          {/* Season MVP Section */}
          <SeasonMVPSection season={season} mvpData={mvpData} />

          {/* Standings Table */}
          <Card className="border-warm-200/60 dark:border-warm-700/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-brand-gold/10 flex items-center justify-center">
                  <Trophy className="w-3.5 h-3.5 text-brand-gold" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-200">STANDINGS</h2>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-[2rem_1fr_2rem_2rem_2rem_2.5rem] gap-1 text-[9px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-2 px-1">
                <span>#</span>
                <span>Team</span>
                <span>W</span>
                <span>L</span>
                <span>D</span>
                <span className="text-right">Pts</span>
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                {sortedTeams.map((team, i) => (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`grid grid-cols-[2rem_1fr_2rem_2rem_2rem_2.5rem] gap-1 items-center p-2.5 rounded-xl text-xs ${
                      i === 0 ? 'bg-brand-gold/10 border border-brand-gold/20' :
                      i < 4 ? 'bg-warm-100/60 dark:bg-warm-700/30' : 'bg-warm-50 dark:bg-warm-800/30'
                    }`}
                  >
                    <span className={`font-bold ${i === 0 ? 'text-brand-gold' : 'text-warm-500 dark:text-warm-400'}`}>
                      {i === 0 ? '👑' : i + 1}
                    </span>
                    <span className="font-semibold text-warm-800 dark:text-warm-200 truncate">{team.name}</span>
                    <span className="text-green-600 dark:text-green-400 font-bold">{team.wins}</span>
                    <span className="text-brand-red font-bold">{team.losses}</span>
                    <span className="text-warm-500 dark:text-warm-400 font-bold">{team.draws}</span>
                    <span className="text-right font-black text-brand-navy dark:text-brand-navy-light">{team.points}</span>
                  </motion.div>
                ))}
              </div>

              {sortedTeams.length === 0 && (
                <p className="text-xs text-warm-400 dark:text-warm-500 text-center py-4">No teams added yet</p>
              )}
            </CardContent>
          </Card>

          {/* Add Team Button */}
          <Button
            variant="outline"
            className="w-full border-dashed border-brand-teal/40 text-brand-teal hover:bg-brand-teal/5 h-10 dark:border-brand-teal/30 dark:text-brand-teal dark:hover:bg-brand-teal/10"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Team to Season
          </Button>

          {/* Matches List */}
          <Card className="border-warm-200/60 dark:border-warm-700/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-brand-red/10 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-brand-red" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-200">MATCHES</h2>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {season.matches.map((match, i) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-warm-100/60 dark:bg-warm-700/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-warm-800 dark:text-warm-200 truncate">
                        {match.homeTeam} vs {match.awayTeam}
                      </p>
                      <p className="text-[10px] text-warm-400 dark:text-warm-500">{match.date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs font-bold text-warm-700 dark:text-warm-300">
                        {match.homeScore}-{match.awayScore}
                      </span>
                      <Badge className={`text-[8px] font-bold border-0 ${
                        match.status === 'completed' ? 'bg-warm-200 dark:bg-warm-600 text-warm-600 dark:text-warm-300' :
                        match.status === 'live' ? 'bg-brand-red/15 text-brand-red' :
                        'bg-brand-teal/15 text-brand-teal'
                      }`}>
                        {match.status}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>

              {season.matches.length === 0 && (
                <p className="text-xs text-warm-400 dark:text-warm-500 text-center py-4">No matches scheduled yet</p>
              )}
            </CardContent>
          </Card>

          {/* Sponsors */}
          {season.sponsors.length > 0 && (
            <Card className="border-warm-200/60 dark:border-warm-700/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-brand-gold/10 flex items-center justify-center">
                    <Crown className="w-3.5 h-3.5 text-brand-gold" />
                  </div>
                  <h2 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-200">SPONSORS</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {season.sponsors.map((sponsor) => (
                    <Badge key={sponsor.id} className="bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold text-[10px] font-bold border-0">
                      {sponsor.name} ({sponsor.tier})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* YoY Comparison (Premium) */}
          <PremiumLock feature="Season Comparison">
            <Card className="border-warm-200/60 dark:border-warm-700/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <h2 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-200">YEAR-OVER-YEAR</h2>
                  <Badge className="bg-brand-teal/10 text-brand-teal text-[8px] font-bold border-0 ml-auto">
                    PRO
                  </Badge>
                </div>

                {seasons.length > 1 ? (
                  <div className="space-y-3">
                    <SeasonComparisonChart seasons={seasons.slice(0, 5)} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center p-2 bg-brand-teal/5 dark:bg-brand-teal/10 rounded-lg">
                        <p className="text-sm font-black text-brand-teal">
                          {season.teamCount}
                        </p>
                        <p className="text-[9px] text-warm-500 dark:text-warm-400">Teams</p>
                      </div>
                      <div className="text-center p-2 bg-brand-red/5 dark:bg-brand-red/10 rounded-lg">
                        <p className="text-sm font-black text-brand-red">
                          {season.matchCount}
                        </p>
                        <p className="text-[9px] text-warm-500 dark:text-warm-400">Matches</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-warm-500 dark:text-warm-400 text-center py-6">
                    Create more seasons to compare statistics year-over-year.
                  </p>
                )}
              </CardContent>
            </Card>
          </PremiumLock>
        </div>
      </motion.div>
    );
  }

  // ─── Main Season List View ────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
    >
      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-navy to-brand-navy-light">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">SEASONS</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="px-4 py-4">
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Season Comparison Chart (when multiple seasons exist) */}
          {seasons.length > 1 && (
            <motion.div variants={itemVariants}>
              <Card className="border-warm-200/60 dark:border-warm-700/60 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                      <BarChart3 className="w-3.5 h-3.5 text-brand-teal" />
                    </div>
                    <h2 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-200">SEASON OVERVIEW</h2>
                  </div>
                  <SeasonComparisonChart seasons={seasons.slice(0, 5)} />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Active Season Highlight - Enhanced */}
          {activeSeason && (
            <motion.div variants={itemVariants}>
              <button
                onClick={() => setSelectedSeason(activeSeason)}
                className="w-full"
              >
                <Card className="bg-gradient-to-r from-brand-teal/10 to-emerald-500/5 dark:from-brand-teal/20 dark:to-emerald-500/10 border-brand-teal/30 dark:border-brand-teal/40 shadow-md hover:shadow-lg transition-all overflow-hidden">
                  <CardContent className="p-0">
                    {/* Active pulse bar */}
                    <div className="h-1 bg-gradient-to-r from-brand-teal via-emerald-400 to-brand-teal">
                      <motion.div
                        className="h-full bg-white/40"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        style={{ width: '30%' }}
                      />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-teal/30 to-emerald-500/20 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-brand-teal" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{activeSeason.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-warm-500 dark:text-warm-400">{activeSeason.year}</span>
                              <span className="text-[10px] text-warm-300 dark:text-warm-600">·</span>
                              <span className="flex items-center gap-0.5 text-[10px] text-brand-teal font-semibold">
                                <Users className="w-2.5 h-2.5" />
                                {activeSeason.teamCount}
                              </span>
                              <span className="text-[10px] text-warm-300 dark:text-warm-600">·</span>
                              <span className="flex items-center gap-0.5 text-[10px] text-brand-red font-semibold">
                                <Calendar className="w-2.5 h-2.5" />
                                {activeSeason.matchCount}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold border-0 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            ACTIVE
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-warm-400 dark:text-warm-500" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            </motion.div>
          )}

          {/* Create Season Button */}
          <motion.div variants={itemVariants}>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              variant="outline"
              className="w-full border-dashed border-brand-teal/40 text-brand-teal hover:bg-brand-teal/5 h-10 dark:border-brand-teal/30 dark:text-brand-teal dark:hover:bg-brand-teal/10"
            >
              <Plus className="w-4 h-4 mr-2" />
              {showCreateForm ? 'Cancel' : 'Create Season'}
            </Button>
          </motion.div>

          {/* Create Season Form */}
          <AnimatePresence>
            {showCreateForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="border-brand-teal/20 dark:border-brand-teal/30">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-bold text-warm-800 dark:text-warm-200 text-sm">New Season</h3>
                    <Input
                      placeholder="Season name *"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="bg-white dark:bg-warm-800 border-warm-300 dark:border-warm-600"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Year"
                        type="number"
                        value={form.year}
                        onChange={(e) => setForm({ ...form, year: e.target.value })}
                        className="bg-white dark:bg-warm-800 border-warm-300 dark:border-warm-600"
                      />
                      <Input
                        placeholder="Start date"
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                        className="bg-white dark:bg-warm-800 border-warm-300 dark:border-warm-600"
                      />
                    </div>
                    <Input
                      placeholder="Description (optional)"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="bg-white dark:bg-warm-800 border-warm-300 dark:border-warm-600"
                    />
                    <Button
                      onClick={handleCreateSeason}
                      disabled={creating}
                      className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Season
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Season List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-warm-100 dark:bg-warm-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : seasons.length === 0 ? (
            <motion.div variants={itemVariants}>
              <Card className="border-warm-200 dark:border-warm-700">
                <CardContent className="p-6">
                  <EmptySeasonState />
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {seasons.map((season, index) => {
                const statusConfig = STATUS_CONFIG[season.status] || STATUS_CONFIG.upcoming;
                const gradientClass = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
                const isCurrentActive = season.status === 'active';

                return (
                  <motion.div
                    key={season.id}
                    variants={itemVariants}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <button
                      onClick={() => setSelectedSeason(season)}
                      className="w-full text-left"
                    >
                      <Card className={`border-warm-200/60 dark:border-warm-700/60 hover:border-brand-navy/20 dark:hover:border-brand-navy-light/30 hover:shadow-md transition-all overflow-hidden ${
                        isCurrentActive ? 'ring-1 ring-brand-teal/20' : ''
                      }`}>
                        <CardContent className="p-0">
                          {/* Top color strip based on status */}
                          <div className={`h-1 bg-gradient-to-r ${
                            season.status === 'active' ? 'from-brand-teal to-emerald-400' :
                            season.status === 'completed' ? 'from-amber-400 to-orange-400' :
                            'from-blue-400 to-cyan-400'
                          }`} />
                          <div className={`bg-gradient-to-br ${gradientClass} dark:from-transparent dark:to-transparent p-4`}>
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <h4 className="text-sm font-bold text-warm-800 dark:text-warm-200 truncate">
                                    {season.name}
                                  </h4>
                                  <Badge className={`${statusConfig.textColor} text-[9px] font-bold border-0 bg-white/60 dark:bg-warm-800/60 flex items-center gap-1`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotColor} ${
                                      season.status === 'active' ? 'animate-pulse' : ''
                                    }`} />
                                    {statusConfig.label}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-warm-500 dark:text-warm-400 mb-2">
                                  {season.year}
                                </p>
                                {/* Team & Match Count Badges */}
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-brand-teal/10 text-brand-teal dark:bg-brand-teal/15">
                                    <Users className="w-2.5 h-2.5" />
                                    {season.teamCount}
                                  </span>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-brand-red/10 text-brand-red dark:bg-brand-red/15">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {season.matchCount}
                                  </span>
                                  {season.sponsors.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold dark:bg-brand-gold/15">
                                      <Crown className="w-2.5 h-2.5" />
                                      {season.sponsors.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-warm-400 dark:text-warm-500 shrink-0 ml-2" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
