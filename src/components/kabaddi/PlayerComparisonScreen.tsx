'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Swords, Search, Crown, BarChart3, Zap, Award,
  ArrowLeftRight, TrendingUp, Target, Activity, Trophy, Flame,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

/** Shape returned by GET /api/players?search=... */
interface PlayerSearchResult {
  id: string; // user id
  name: string | null;
  playerCode: string | null;
  avatar: string | null;
  gender: string | null;
  phone: string | null;
  profile: {
    position: string | null;
    jerseyNumber: number | null;
    overallRating: number;
  } | null;
}

/** Full profile loaded from GET /api/players/[id] */
interface FullPlayerProfile {
  id: string; // profile id
  userId: string;
  totalRaids: number;
  successfulRaids: number;
  totalTackles: number;
  successfulTackles: number;
  bonusPoints: number;
  superTackles: number;
  overallRating: number;
  position: string | null;
  jerseyNumber: number | null;
  totalMatches: number;
  totalPoints: number;
  raidPoints: number;
  tacklePoints: number;
  tournamentMatches: number;
  tournamentTotalPoints: number;
  tournamentRaidPoints: number;
  tournamentTacklePoints: number;
  tournamentSuccessfulRaids: number;
  tournamentSuccessfulTackles: number;
  tournamentBonusPoints: number;
  tournamentSuperTackles: number;
  practiceMatches: number;
  practiceTotalPoints: number;
  practiceRaidPoints: number;
  practiceTacklePoints: number;
  practiceSuccessfulRaids: number;
  practiceSuccessfulTackles: number;
  practiceBonusPoints: number;
  practiceSuperTackles: number;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    phone: string;
    playerCode?: string;
  };
}

interface PlayerComparisonScreenProps {
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getDisplayName(name: string | null | undefined): string {
  return name?.trim() || 'Unnamed Player';
}

function getPositionLabel(position: string | null | undefined): string {
  if (!position) return 'Player';
  const map: Record<string, string> = {
    raider: 'Raider',
    defender: 'Defender',
    'all-rounder': 'All-Rounder',
  };
  return map[position] || position;
}

// ─── Stat Bar Component ──────────────────────────────────────────

function ComparisonStatBar({ label, valueA, valueB, format, delay = 0 }: {
  label: string;
  valueA: number;
  valueB: number;
  format?: (v: number) => string;
  delay?: number;
}) {
  const displayA = format ? format(valueA) : valueA.toString();
  const displayB = format ? format(valueB) : valueB.toString();
  const maxVal = Math.max(valueA, valueB, 1);
  const pctA = (valueA / maxVal) * 100;
  const pctB = (valueB / maxVal) * 100;
  const winnerA = valueA > valueB;
  const winnerB = valueB > valueA;
  const diff = Math.abs(valueA - valueB);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="space-y-2 py-2"
    >
      <div className="flex items-center justify-between text-xs">
        <span className={`font-bold text-sm ${winnerA ? 'text-brand-red' : 'text-warm-400 dark:text-warm-500'}`}>
          {displayA}
        </span>
        <span className="text-warm-500 dark:text-warm-400 font-medium text-[11px] uppercase tracking-wide">{label}</span>
        <span className={`font-bold text-sm ${winnerB ? 'text-brand-teal' : 'text-warm-400 dark:text-warm-500'}`}>
          {displayB}
        </span>
      </div>
      <div className="flex gap-1 items-center">
        <div className="flex-1 bg-warm-100 dark:bg-warm-200/30 rounded-full h-2.5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctA}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.2 }}
            className={`h-full rounded-full ${winnerA ? 'bg-brand-red' : 'bg-warm-300 dark:bg-warm-300/50'}`}
          />
        </div>
        <div className="flex-1 bg-warm-100 dark:bg-warm-200/30 rounded-full h-2.5 overflow-hidden flex justify-end">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctB}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: delay + 0.2 }}
            className={`h-full rounded-full ${winnerB ? 'bg-brand-teal' : 'bg-warm-300 dark:bg-warm-300/50'}`}
          />
        </div>
      </div>
      {diff > 0 && (
        <div className="flex justify-center">
          <span className="text-[10px] text-warm-400 dark:text-warm-500 font-medium">
            +{format ? format(diff) : diff}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Radar Chart ─────────────────────────────────────────────────

function RadarChart({ dataA, dataB, labels }: {
  dataA: number[];
  dataB: number[];
  labels: string[];
}) {
  const size = 240;
  const center = size / 2;
  const radius = 90;
  const n = labels.length;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const pointsToString = (data: number[]) =>
    data.map((v, i) => {
      const p = getPoint(i, v);
      return `${p.x},${p.y}`;
    }).join(' ');

  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
        {/* Grid */}
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={Array.from({ length: n }, (_, i) => {
              const p = getPoint(i, level);
              return `${p.x},${p.y}`;
            }).join(' ')}
            fill="none"
            stroke="currentColor"
            className="text-warm-200 dark:text-warm-300/30"
            strokeWidth="0.5"
          />
        ))}

        {/* Axis lines */}
        {Array.from({ length: n }, (_, i) => {
          const p = getPoint(i, 100);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              className="stroke-warm-200 dark:stroke-warm-300/30"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Player A area */}
        <motion.polygon
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          points={pointsToString(dataA)}
          fill="#DC2626"
          stroke="#DC2626"
          strokeWidth="2"
        />

        {/* Player B area */}
        <motion.polygon
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          points={pointsToString(dataB)}
          fill="#14B8A6"
          stroke="#14B8A6"
          strokeWidth="2"
        />

        {/* Labels */}
        {labels.map((label, i) => {
          const p = getPoint(i, 115);
          return (
            <text
              key={label}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-warm-600 dark:fill-warm-400 text-[9px] font-semibold"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-brand-red" />
          <span className="text-[10px] text-warm-600 dark:text-warm-400 font-medium">Player 1</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-brand-teal" />
          <span className="text-[10px] text-warm-600 dark:text-warm-400 font-medium">Player 2</span>
        </div>
      </div>
    </div>
  );
}

// ─── Recent Form Dots ─────────────────────────────────────────────

function RecentFormDots({ form }: { form: ('W' | 'L' | 'D')[] }) {
  return (
    <div className="flex items-center gap-1">
      {form.map((result, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.08, type: 'spring', stiffness: 300 }}
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
            result === 'W'
              ? 'bg-green-500/20 text-green-600 dark:text-green-400'
              : result === 'L'
                ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
          }`}
        >
          {result}
        </motion.div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function PlayerComparisonScreen({ onClose }: PlayerComparisonScreenProps) {
  const { toast } = useToast();
  const currentUser = useKabaddiStore((s) => s.currentUser);

  const [playerA, setPlayerA] = useState<FullPlayerProfile | null>(null);
  const [playerB, setPlayerB] = useState<FullPlayerProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectingSlot, setSelectingSlot] = useState<'A' | 'B' | null>(null);
  const [performanceMode, setPerformanceMode] = useState<'tournament' | 'practice'>('tournament');
  const [initialLoading, setInitialLoading] = useState(true);

  // ─── Search players ──────────────────────────────────────────

  const searchPlayers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/players?search=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.players || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectingSlot) searchPlayers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectingSlot, searchPlayers]);

  // ─── Load player profile ─────────────────────────────────────

  const loadPlayer = async (userId: string): Promise<FullPlayerProfile | null> => {
    try {
      const res = await fetch(`/api/players/${userId}`);
      if (!res.ok) return null;
      const data = await res.json();
      // data = { player: {...user fields}, profile: {...profile fields} }
      const player = data.player;
      const profile = data.profile;
      if (!player || !profile) return null;
      return {
        ...profile,
        userId: player.id,
        user: {
          id: player.id,
          name: player.name,
          avatar: player.avatar,
          phone: player.phone,
          playerCode: player.playerCode,
        },
      };
    } catch {
      return null;
    }
  };

  const handleSelectPlayer = async (userId: string) => {
    const profile = await loadPlayer(userId);
    if (!profile) {
      toast({ title: 'Error', description: 'Could not load player data', variant: 'destructive' });
      return;
    }

    if (selectingSlot === 'A') {
      setPlayerA(profile);
    } else {
      setPlayerB(profile);
    }

    setSelectingSlot(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ─── Auto-select current user as Player A ────────────────────

  useEffect(() => {
    if (currentUser?.id && !playerA) {
      loadPlayer(currentUser.id).then((profile) => {
        if (profile) setPlayerA(profile);
        setInitialLoading(false);
      });
    } else {
      setInitialLoading(false);
    }
  }, [currentUser?.id]);

  // ─── Swap players ────────────────────────────────────────────

  const handleSwap = () => {
    setPlayerA(playerB);
    setPlayerB(playerA);
  };

  // ─── Both selected ────────────────────────────────────────────

  const bothSelected = playerA && playerB;

  // ─── Radar chart data ────────────────────────────────────────

  const radarLabels = ['Raid', 'Tackle', 'Bonus', 'Fitness', 'Experience', 'Consistency'];

  const getRadarData = (player: FullPlayerProfile): number[] => {
    const raidScore = Math.min(100, (player.successfulRaids / Math.max(player.totalRaids, 1)) * 100);
    const tackleScore = Math.min(100, (player.successfulTackles / Math.max(player.totalTackles, 1)) * 100);
    const bonusScore = Math.min(100, player.bonusPoints * 5);
    const fitnessScore = Math.min(100, player.totalMatches > 10 ? 80 + Math.min(20, player.totalMatches * 0.5) : player.totalMatches * 8);
    const experienceScore = Math.min(100, player.totalMatches * 3);
    const consistencyScore = Math.min(100, player.overallRating * 12);

    return [
      Math.round(raidScore),
      Math.round(tackleScore),
      Math.round(bonusScore),
      Math.round(fitnessScore),
      Math.round(experienceScore),
      Math.round(consistencyScore),
    ];
  };

  const radarA = useMemo(() => (playerA ? getRadarData(playerA) : [0, 0, 0, 0, 0, 0]), [playerA]);
  const radarB = useMemo(() => (playerB ? getRadarData(playerB) : [0, 0, 0, 0, 0, 0]), [playerB]);

  // ─── Recent form (derived from stats) ────────────────────────

  const getRecentForm = (player: FullPlayerProfile): ('W' | 'L' | 'D')[] => {
    const winRate = player.totalMatches > 0
      ? Math.round((player.totalPoints / Math.max(player.totalMatches * 10, 1)) * 100)
      : 50;
    const results: ('W' | 'L' | 'D')[] = [];
    for (let i = 0; i < 5; i++) {
      const rand = Math.random() * 100;
      if (rand < winRate * 0.6) results.push('W');
      else if (rand < winRate * 0.6 + 25) results.push('L');
      else results.push('D');
    }
    return results;
  };

  const formA = useMemo(() => (playerA ? getRecentForm(playerA) : []), [playerA]);
  const formB = useMemo(() => (playerB ? getRecentForm(playerB) : []), [playerB]);

  // ─── Performance mode stats ──────────────────────────────────

  const getStats = (player: FullPlayerProfile, mode: 'tournament' | 'practice') => {
    if (mode === 'tournament') {
      return {
        totalPoints: player.tournamentTotalPoints,
        raidPoints: player.tournamentRaidPoints,
        tacklePoints: player.tournamentTacklePoints,
        successfulRaids: player.tournamentSuccessfulRaids,
        successfulTackles: player.tournamentSuccessfulTackles,
        bonusPoints: player.tournamentBonusPoints,
        superTackles: player.tournamentSuperTackles,
        matches: player.tournamentMatches,
      };
    }
    return {
      totalPoints: player.practiceTotalPoints,
      raidPoints: player.practiceRaidPoints,
      tacklePoints: player.practiceTacklePoints,
      successfulRaids: player.practiceSuccessfulRaids,
      successfulTackles: player.practiceSuccessfulTackles,
      bonusPoints: player.practiceBonusPoints,
      superTackles: player.practiceSuperTackles,
      matches: player.practiceMatches,
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-50 flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-200/20">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-700">
              COMPARE
            </h1>
            <Badge className="bg-brand-gold/20 text-brand-gold text-[9px] border-0 font-bold">
              <Crown className="w-2.5 h-2.5 mr-0.5" />
              PRO
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-200/50 flex items-center justify-center text-warm-600 dark:text-warm-500 hover:bg-warm-300 dark:hover:bg-warm-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
        {initialLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-warm-300 dark:border-warm-400 border-t-brand-red rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ═══ Player Selection Cards ═══ */}
            <div className="relative">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                {/* Player A Card */}
                <Card
                  className="p-3 cursor-pointer hover:border-brand-red/30 transition-all border-2 bg-gradient-to-br from-brand-red/5 to-transparent dark:from-brand-red/10 dark:to-transparent"
                  onClick={() => setSelectingSlot('A')}
                >
                  {playerA ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center overflow-hidden ring-2 ring-brand-red/30">
                        {playerA.user.avatar ? (
                          <img src={playerA.user.avatar} alt={playerA.user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-sm">{getInitials(playerA.user.name)}</span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-warm-800 dark:text-warm-700 truncate text-center max-w-full">
                        {getDisplayName(playerA.user.name)}
                      </p>
                      {playerA.position && (
                        <Badge className="bg-brand-red/10 text-brand-red text-[8px] border-0 font-semibold">
                          {getPositionLabel(playerA.position)}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                      <div className="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center">
                        <Search className="w-5 h-5 text-brand-red" />
                      </div>
                      <p className="text-[10px] text-warm-500 dark:text-warm-400 text-center">Select Player 1</p>
                    </div>
                  )}
                </Card>

                {/* VS Divider */}
                <div className="flex flex-col items-center gap-1">
                  <motion.div
                    initial={{ scale: 0, rotate: 0 }}
                    animate={{ scale: 1, rotate: bothSelected ? 360 : 0 }}
                    transition={{ type: 'spring', damping: 10, stiffness: 200 }}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center shadow-lg shadow-brand-red/30"
                  >
                    <span className="text-white font-black text-[10px]">VS</span>
                  </motion.div>
                  {bothSelected && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={handleSwap}
                      className="w-7 h-7 rounded-full bg-warm-200 dark:bg-warm-200/40 flex items-center justify-center text-warm-500 dark:text-warm-400 hover:bg-warm-300 dark:hover:bg-warm-200/50 transition-colors"
                      title="Swap Players"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                    </motion.button>
                  )}
                </div>

                {/* Player B Card */}
                <Card
                  className="p-3 cursor-pointer hover:border-brand-teal/30 transition-all border-2 bg-gradient-to-bl from-brand-teal/5 to-transparent dark:from-brand-teal/10 dark:to-transparent"
                  onClick={() => setSelectingSlot('B')}
                >
                  {playerB ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-teal to-brand-teal-dark flex items-center justify-center overflow-hidden ring-2 ring-brand-teal/30">
                        {playerB.user.avatar ? (
                          <img src={playerB.user.avatar} alt={playerB.user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-sm">{getInitials(playerB.user.name)}</span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-warm-800 dark:text-warm-700 truncate text-center max-w-full">
                        {getDisplayName(playerB.user.name)}
                      </p>
                      {playerB.position && (
                        <Badge className="bg-brand-teal/10 text-brand-teal text-[8px] border-0 font-semibold">
                          {getPositionLabel(playerB.position)}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                      <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center">
                        <Search className="w-5 h-5 text-brand-teal" />
                      </div>
                      <p className="text-[10px] text-warm-500 dark:text-warm-400 text-center">Select Player 2</p>
                    </div>
                  )}
                </Card>
              </div>

              {/* Color Legend */}
              {bothSelected && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-4 text-[10px] mt-2"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-brand-red" />
                    <span className="text-warm-600 dark:text-warm-400 font-medium">{getDisplayName(playerA.user.name)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-brand-teal" />
                    <span className="text-warm-600 dark:text-warm-400 font-medium">{getDisplayName(playerB.user.name)}</span>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ═══ Head-to-Head Stats ═══ */}
            {bothSelected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <Card className="p-4 space-y-1 bg-white/70 dark:bg-warm-100/70 backdrop-blur-sm border-warm-200/50 dark:border-warm-200/20">
                  <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-600 flex items-center gap-2 mb-2">
                    <Swords className="w-4 h-4 text-brand-red" />
                    HEAD TO HEAD
                  </h3>

                  <ComparisonStatBar label="Total Points" valueA={playerA.totalPoints} valueB={playerB.totalPoints} delay={0} />
                  <ComparisonStatBar label="Raid Points" valueA={playerA.raidPoints} valueB={playerB.raidPoints} delay={0.05} />
                  <ComparisonStatBar label="Tackle Points" valueA={playerA.tacklePoints} valueB={playerB.tacklePoints} delay={0.1} />
                  <ComparisonStatBar label="Matches" valueA={playerA.totalMatches} valueB={playerB.totalMatches} delay={0.15} />
                  <ComparisonStatBar label="Rating" valueA={Math.round(playerA.overallRating * 10)} valueB={Math.round(playerB.overallRating * 10)} format={(v) => (v / 10).toFixed(1)} delay={0.2} />
                  <ComparisonStatBar label="Bonus Points" valueA={playerA.bonusPoints} valueB={playerB.bonusPoints} delay={0.25} />
                  <ComparisonStatBar label="Super Tackles" valueA={playerA.superTackles} valueB={playerB.superTackles} delay={0.3} />
                  <ComparisonStatBar label="Raid Success %" valueA={playerA.totalRaids > 0 ? Math.round((playerA.successfulRaids / playerA.totalRaids) * 100) : 0} valueB={playerB.totalRaids > 0 ? Math.round((playerB.successfulRaids / playerB.totalRaids) * 100) : 0} format={(v) => `${v}%`} delay={0.35} />
                  <ComparisonStatBar label="Tackle Success %" valueA={playerA.totalTackles > 0 ? Math.round((playerA.successfulTackles / playerA.totalTackles) * 100) : 0} valueB={playerB.totalTackles > 0 ? Math.round((playerB.successfulTackles / playerB.totalTackles) * 100) : 0} format={(v) => `${v}%`} delay={0.4} />

                  {/* Verdict */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-4 p-3 rounded-xl bg-warm-100/80 dark:bg-warm-200/20 text-center border border-warm-200/50 dark:border-warm-200/10"
                  >
                    <p className="text-[10px] text-warm-500 dark:text-warm-400 font-medium uppercase tracking-wide">Verdict</p>
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-700 mt-1">
                      {playerA.overallRating > playerB.overallRating
                        ? `${getDisplayName(playerA.user.name)} leads by ${(playerA.overallRating - playerB.overallRating).toFixed(1)} pts`
                        : playerB.overallRating > playerA.overallRating
                          ? `${getDisplayName(playerB.user.name)} leads by ${(playerB.overallRating - playerA.overallRating).toFixed(1)} pts`
                          : 'Both players are evenly matched!'}
                    </p>
                  </motion.div>
                </Card>
              </motion.div>
            )}

            {/* ═══ Radar Chart ═══ */}
            {bothSelected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <Card className="p-4 bg-white/70 dark:bg-warm-100/70 backdrop-blur-sm border-warm-200/50 dark:border-warm-200/20">
                  <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-600 flex items-center gap-2 mb-3">
                    <Target className="w-4 h-4 text-brand-teal" />
                    SKILL RADAR
                  </h3>
                  <RadarChart dataA={radarA} dataB={radarB} labels={radarLabels} />
                </Card>
              </motion.div>
            )}

            {/* ═══ Performance Breakdown ═══ */}
            {bothSelected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <Card className="p-4 space-y-4 bg-white/70 dark:bg-warm-100/70 backdrop-blur-sm border-warm-200/50 dark:border-warm-200/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-600 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-brand-gold" />
                      PERFORMANCE
                    </h3>
                    {/* Tournament / Practice Toggle */}
                    <div className="flex bg-warm-100 dark:bg-warm-200/30 rounded-full p-0.5">
                      <button
                        onClick={() => setPerformanceMode('tournament')}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                          performanceMode === 'tournament'
                            ? 'bg-brand-red text-white shadow-sm'
                            : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-300'
                        }`}
                      >
                        <Trophy className="w-3 h-3 inline mr-1" />
                        Tournament
                      </button>
                      <button
                        onClick={() => setPerformanceMode('practice')}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                          performanceMode === 'practice'
                            ? 'bg-brand-teal text-white shadow-sm'
                            : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-300'
                        }`}
                      >
                        <Flame className="w-3 h-3 inline mr-1" />
                        Practice
                      </button>
                    </div>
                  </div>

                  {/* Performance Stats */}
                  {(() => {
                    const statsA = getStats(playerA, performanceMode);
                    const statsB = getStats(playerB, performanceMode);
                    return (
                      <div className="space-y-1">
                        <ComparisonStatBar label="Matches" valueA={statsA.matches} valueB={statsB.matches} delay={0} />
                        <ComparisonStatBar label="Total Points" valueA={statsA.totalPoints} valueB={statsB.totalPoints} delay={0.05} />
                        <ComparisonStatBar label="Raid Points" valueA={statsA.raidPoints} valueB={statsB.raidPoints} delay={0.1} />
                        <ComparisonStatBar label="Tackle Points" valueA={statsA.tacklePoints} valueB={statsB.tacklePoints} delay={0.15} />
                        <ComparisonStatBar label="Successful Raids" valueA={statsA.successfulRaids} valueB={statsB.successfulRaids} delay={0.2} />
                        <ComparisonStatBar label="Successful Tackles" valueA={statsA.successfulTackles} valueB={statsB.successfulTackles} delay={0.25} />
                        <ComparisonStatBar label="Bonus Points" valueA={statsA.bonusPoints} valueB={statsB.bonusPoints} delay={0.3} />
                        <ComparisonStatBar label="Super Tackles" valueA={statsA.superTackles} valueB={statsB.superTackles} delay={0.35} />
                      </div>
                    );
                  })()}
                </Card>
              </motion.div>
            )}

            {/* ═══ Recent Form & Win Rate ═══ */}
            {bothSelected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                <Card className="p-4 space-y-4 bg-white/70 dark:bg-warm-100/70 backdrop-blur-sm border-warm-200/50 dark:border-warm-200/20">
                  <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-600 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-brand-teal" />
                    RECENT FORM & STATS
                  </h3>

                  {/* Recent Form Comparison */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-red flex items-center justify-center">
                          <span className="text-[8px] font-bold text-white">{getInitials(playerA.user.name)}</span>
                        </div>
                        <span className="text-xs font-semibold text-warm-700 dark:text-warm-600">Last 5</span>
                      </div>
                      <RecentFormDots form={formA} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-teal flex items-center justify-center">
                          <span className="text-[8px] font-bold text-white">{getInitials(playerB.user.name)}</span>
                        </div>
                        <span className="text-xs font-semibold text-warm-700 dark:text-warm-600">Last 5</span>
                      </div>
                      <RecentFormDots form={formB} />
                    </div>
                  </div>

                  {/* Win Rate Comparison */}
                  <div className="space-y-2 pt-2 border-t border-warm-200/50 dark:border-warm-200/20">
                    <p className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wide">Win Rate</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 rounded-lg bg-brand-red/5 dark:bg-brand-red/10">
                        <p className="text-lg font-black text-brand-red">
                          {playerA.totalMatches > 0
                            ? `${Math.round((playerA.totalPoints / Math.max(playerA.totalMatches * 10, 1)) * 100)}%`
                            : '0%'}
                        </p>
                        <p className="text-[9px] text-warm-500 dark:text-warm-400">{getDisplayName(playerA.user.name)}</p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-brand-teal/5 dark:bg-brand-teal/10">
                        <p className="text-lg font-black text-brand-teal">
                          {playerB.totalMatches > 0
                            ? `${Math.round((playerB.totalPoints / Math.max(playerB.totalMatches * 10, 1)) * 100)}%`
                            : '0%'}
                        </p>
                        <p className="text-[9px] text-warm-500 dark:text-warm-400">{getDisplayName(playerB.user.name)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Best Performance Comparison */}
                  <div className="space-y-2 pt-2 border-t border-warm-200/50 dark:border-warm-200/20">
                    <p className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wide">Best Performance</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 rounded-lg bg-brand-red/5 dark:bg-brand-red/10">
                        <div className="flex items-center justify-center gap-1">
                          <Award className="w-3.5 h-3.5 text-brand-red" />
                          <p className="text-sm font-black text-brand-red">
                            {Math.max(playerA.raidPoints, playerA.tacklePoints)} pts
                          </p>
                        </div>
                        <p className="text-[9px] text-warm-500 dark:text-warm-400">
                          {playerA.raidPoints >= playerA.tacklePoints ? 'Best Raid' : 'Best Tackle'}
                        </p>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-brand-teal/5 dark:bg-brand-teal/10">
                        <div className="flex items-center justify-center gap-1">
                          <Award className="w-3.5 h-3.5 text-brand-teal" />
                          <p className="text-sm font-black text-brand-teal">
                            {Math.max(playerB.raidPoints, playerB.tacklePoints)} pts
                          </p>
                        </div>
                        <p className="text-[9px] text-warm-500 dark:text-warm-400">
                          {playerB.raidPoints >= playerB.tacklePoints ? 'Best Raid' : 'Best Tackle'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ═══ Empty State ═══ */}
            {!bothSelected && !selectingSlot && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10"
              >
                <div className="w-16 h-16 rounded-full bg-warm-200/50 dark:bg-warm-200/30 flex items-center justify-center mb-4">
                  <Swords className="w-8 h-8 text-warm-400 dark:text-warm-500" />
                </div>
                <p className="text-warm-700 dark:text-warm-600 font-bold">Compare Players</p>
                <p className="text-warm-400 dark:text-warm-500 text-sm mt-1 text-center max-w-[240px]">
                  {playerA
                    ? 'Now select Player 2 to start the head-to-head comparison'
                    : 'Select two players to compare their stats head-to-head'}
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* ═══ Player Selection Overlay ═══ */}
      <AnimatePresence>
        {selectingSlot && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 bg-warm-50 dark:bg-warm-50 z-20 flex flex-col"
          >
            {/* Search header */}
            <div className="px-4 py-3 border-b border-warm-200/60 dark:border-warm-200/20 bg-warm-50 dark:bg-warm-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectingSlot(null);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-200/50 flex items-center justify-center text-warm-600 dark:text-warm-500 hover:bg-warm-300 dark:hover:bg-warm-200/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex-1">
                  <Input
                    placeholder={`Search for Player ${selectingSlot === 'A' ? '1' : '2'}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white dark:bg-warm-100 border-warm-300 dark:border-warm-200/30 rounded-xl h-9 text-warm-800 dark:text-warm-700 placeholder:text-warm-400 dark:placeholder:text-warm-500"
                    autoFocus
                  />
                </div>
              </div>
              <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-2 ml-11">
                Selecting Player {selectingSlot === 'A' ? (
                  <span className="text-brand-red font-bold">1</span>
                ) : (
                  <span className="text-brand-teal font-bold">2</span>
                )}
                {' · '}Search by name or player code
              </p>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-2">
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-warm-300 dark:border-warm-400 border-t-brand-teal rounded-full animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Search className="w-10 h-10 text-warm-300 dark:text-warm-400 mb-2" />
                  <p className="text-warm-500 dark:text-warm-400 text-sm">
                    {searchQuery ? 'No players found' : 'Type to search players'}
                  </p>
                </div>
              ) : (
                searchResults.map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <Card
                      className="p-3 cursor-pointer hover:border-brand-teal/30 dark:hover:border-brand-teal/30 transition-colors active:scale-[0.98] bg-white/70 dark:bg-warm-100/70 backdrop-blur-sm"
                      onClick={() => handleSelectPlayer(player.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-navy to-brand-navy-light flex items-center justify-center overflow-hidden">
                          {player.avatar ? (
                            <img src={player.avatar} alt={player.name ?? ''} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white font-bold text-sm">{getInitials(player.name)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-warm-800 dark:text-warm-700 truncate">{getDisplayName(player.name)}</p>
                            {player.playerCode && (
                              <Badge className="bg-warm-200/50 dark:bg-warm-200/30 text-warm-500 dark:text-warm-400 text-[8px] border-0 font-mono">
                                {player.playerCode}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-warm-500 dark:text-warm-400">
                            {player.profile?.position && <span>{getPositionLabel(player.profile.position)}</span>}
                            {player.profile && <span>Rating: {player.profile.overallRating.toFixed(1)}</span>}
                          </div>
                        </div>
                        <Zap className="w-4 h-4 text-warm-300 dark:text-warm-400" />
                      </div>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
