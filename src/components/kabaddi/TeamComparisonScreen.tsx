'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Swords,
  Trophy,
  BarChart3,
  ArrowLeft,
  ChevronDown,
  Zap,
  Shield,
  Target,
  Flame,
  TrendingUp,
  CircleDot,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────

interface TeamData {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  logo?: string | null;
  teamCode?: string | null;
}

interface TeamStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  raidPoints: number;
  tacklePoints: number;
  bonusPoints: number;
  allOuts: number;
  avgScore: number;
  winRate: number;
  consistency: number;
}

interface Encounter {
  id: string;
  homeTeam: TeamData;
  awayTeam: TeamData;
  homeScore: number;
  awayScore: number;
  status: string;
  completedAt: string | null;
  winner: 'home' | 'away' | 'draw';
}

interface ComparisonData {
  teamA: TeamStats;
  teamB: TeamStats;
  encounters: Encounter[];
}

// ─── Stat Comparison Bar ────────────────────────────────────────────

function StatBar({
  label,
  valueA,
  valueB,
  teamAColor,
  teamBColor,
  delay,
}: {
  label: string;
  valueA: number;
  valueB: number;
  teamAColor: string;
  teamBColor: string;
  delay: number;
}) {
  const maxVal = Math.max(valueA, valueB, 1);
  const aWins = valueA >= valueB;
  const bWins = valueB >= valueA;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="mb-3"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold text-warm-800 dark:text-warm-200">
          {valueA}
        </span>
        <span className="text-xs font-medium text-warm-500 dark:text-warm-400">
          {label}
        </span>
        <span className="text-sm font-bold text-warm-800 dark:text-warm-200">
          {valueB}
        </span>
      </div>
      <div className="flex items-center gap-2 h-6">
        {/* Team A bar (right-aligned) */}
        <div className="flex-1 flex justify-end">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(valueA / maxVal) * 100}%` }}
            transition={{ delay: delay + 0.15, duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-l-md min-w-[4px]"
            style={{
              background: aWins
                ? `linear-gradient(90deg, ${teamAColor}40, ${teamAColor})`
                : `linear-gradient(90deg, ${teamAColor}20, ${teamAColor}60)`,
              maxWidth: '100%',
            }}
          />
        </div>
        {/* Team B bar (left-aligned) */}
        <div className="flex-1">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(valueB / maxVal) * 100}%` }}
            transition={{ delay: delay + 0.15, duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-r-md min-w-[4px]"
            style={{
              background: bWins
                ? `linear-gradient(90deg, ${teamBColor}, ${teamBColor}40)`
                : `linear-gradient(90deg, ${teamBColor}60, ${teamBColor}20)`,
              maxWidth: '100%',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Radar Chart ────────────────────────────────────────────────────

function RadarChart({
  statsA,
  statsB,
  teamAColor,
  teamBColor,
  teamAName,
  teamBName,
}: {
  statsA: TeamStats;
  statsB: TeamStats;
  teamAColor: string;
  teamBColor: string;
  teamAName: string;
  teamBName: string;
}) {
  const axes = [
    { key: 'raidPoints' as const, label: 'Raid' },
    { key: 'tacklePoints' as const, label: 'Tackle' },
    { key: 'bonusPoints' as const, label: 'Bonus' },
    { key: 'allOuts' as const, label: 'All Out' },
    { key: 'winRate' as const, label: 'Win Rate' },
    { key: 'consistency' as const, label: 'Consist.' },
  ];

  // Normalize values 0-1
  const normalize = (key: keyof TeamStats, a: number, b: number) => {
    const max = Math.max(a, b, 1);
    return [a / max, b / max];
  };

  const size = 260;
  const center = size / 2;
  const radius = 95;
  const angleStep = (2 * Math.PI) / axes.length;

  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2;
    return {
      x: center + radius * value * Math.cos(angle),
      y: center + radius * value * Math.sin(angle),
    };
  };

  // Build polygon points string
  const buildPoints = (stats: TeamStats, isA: boolean) => {
    return axes
      .map((axis, i) => {
        const [normA, normB] = normalize(axis.key, statsA[axis.key] as number, statsB[axis.key] as number);
        const val = isA ? normA : normB;
        const pt = getPoint(i, Math.max(val, 0.05));
        return `${pt.x},${pt.y}`;
      })
      .join(' ');
  };

  // Grid lines
  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="max-w-full"
      >
        {/* Grid */}
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={axes
              .map((_, i) => {
                const pt = getPoint(i, level);
                return `${pt.x},${pt.y}`;
              })
              .join(' ')}
            fill="none"
            stroke="currentColor"
            className="text-warm-200 dark:text-warm-600"
            strokeWidth={0.5}
          />
        ))}

        {/* Axis lines */}
        {axes.map((_, i) => {
          const pt = getPoint(i, 1);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={pt.x}
              y2={pt.y}
              stroke="currentColor"
              className="text-warm-200 dark:text-warm-600"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Team B polygon */}
        <motion.polygon
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ duration: 0.6 }}
          points={buildPoints(statsB, false)}
          fill={teamBColor}
          stroke={teamBColor}
          strokeWidth={1.5}
        />

        {/* Team A polygon */}
        <motion.polygon
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          points={buildPoints(statsA, true)}
          fill={teamAColor}
          stroke={teamAColor}
          strokeWidth={1.5}
        />

        {/* Axis labels */}
        {axes.map((axis, i) => {
          const pt = getPoint(i, 1.22);
          return (
            <text
              key={axis.key}
              x={pt.x}
              y={pt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-warm-500 dark:fill-warm-400"
              fontSize={10}
              fontWeight={600}
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2">
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: teamAColor }}
          />
          <span className="text-xs font-medium text-warm-600 dark:text-warm-300">
            {teamAName}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: teamBColor }}
          />
          <span className="text-xs font-medium text-warm-600 dark:text-warm-300">
            {teamBName}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Team Selector Dropdown ─────────────────────────────────────────

function TeamSelector({
  teams,
  selected,
  onSelect,
  placeholder,
  side,
}: {
  teams: TeamData[];
  selected: TeamData | null;
  onSelect: (team: TeamData) => void;
  placeholder: string;
  side: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-3 rounded-xl border border-warm-200 dark:border-warm-700 bg-card hover:border-brand-red/30 dark:hover:border-brand-red/30 transition-all duration-200 flex items-center gap-2.5"
      >
        {selected ? (
          <>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ backgroundColor: selected.color || '#DC2626' }}
            >
              {selected.shortName?.slice(0, 2) || selected.name.slice(0, 2)}
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate">
                {selected.name}
              </p>
              <p className="text-[10px] text-warm-500 dark:text-warm-400">
                {selected.shortName || selected.teamCode}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-warm-200 dark:bg-warm-700 flex items-center justify-center">
              <ChevronDown className="w-4 h-4 text-warm-500" />
            </div>
            <span className="text-sm text-warm-400 dark:text-warm-500">
              {placeholder}
            </span>
          </div>
        )}
        <ChevronDown
          className={`w-4 h-4 text-warm-400 ml-auto shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 top-full mt-1.5 w-full rounded-xl border border-warm-200 dark:border-warm-700 bg-card shadow-lg max-h-52 overflow-y-auto custom-scrollbar"
          >
            {teams.length === 0 ? (
              <div className="p-4 text-center text-sm text-warm-500">
                No teams found
              </div>
            ) : (
              teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => {
                    onSelect(team);
                    setOpen(false);
                  }}
                  className="w-full p-2.5 flex items-center gap-2.5 hover:bg-warm-100 dark:hover:bg-warm-800 transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                    style={{ backgroundColor: team.color || '#DC2626' }}
                  >
                    {team.shortName?.slice(0, 2) || team.name.slice(0, 2)}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-warm-800 dark:text-warm-100 truncate">
                      {team.name}
                    </p>
                    <p className="text-[10px] text-warm-500">
                      {team.shortName || team.teamCode}
                    </p>
                  </div>
                  {selected?.id === team.id && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-brand-teal" />
                  )}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function TeamComparisonScreen({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [teamA, setTeamA] = useState<TeamData | null>(null);
  const [teamB, setTeamB] = useState<TeamData | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  // Fetch teams
  useEffect(() => {
    const fetchTeams = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/teams?limit=50');
        if (!res.ok) throw new Error('Failed to fetch teams');
        const data = await res.json();
        setTeams(data.teams || []);
      } catch {
        toast({ title: 'Error', description: 'Failed to load teams' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchTeams();
  }, [toast]);

  // Compute comparison
  const handleCompare = useCallback(async () => {
    if (!teamA || !teamB) {
      toast({ title: 'Select teams', description: 'Please select two teams to compare' });
      return;
    }
    if (teamA.id === teamB.id) {
      toast({ title: 'Same team', description: 'Please select two different teams' });
      return;
    }

    setIsComparing(true);
    try {
      const res = await fetch(
        `/api/teams/compare?teamAId=${teamA.id}&teamBId=${teamB.id}`
      );
      if (!res.ok) throw new Error('Failed to fetch comparison');
      const data = await res.json();
      setComparison(data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load comparison data' });
    } finally {
      setIsComparing(false);
    }
  }, [teamA, teamB, toast]);

  // Gradient header colors
  const headerGradient = useMemo(() => {
    const cA = teamA?.color || '#DC2626';
    const cB = teamB?.color || '#1E293B';
    return `linear-gradient(135deg, ${cA}, ${cB})`;
  }, [teamA, teamB]);

  // Win/loss streak from encounters
  const getStreakIndicator = (teamId: string, encounters: Encounter[]) => {
    const recent = encounters.slice(0, 5);
    const results = recent.map((e) => {
      if (e.winner === 'draw') return 'draw';
      const winnerTeamId =
        e.winner === 'home' ? e.homeTeam.id : e.awayTeam.id;
      return winnerTeamId === teamId ? 'win' : 'loss';
    });
    return results;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-background overflow-y-auto custom-scrollbar"
    >
      {/* ─── Header with gradient ─── */}
      <header
        className="sticky top-0 z-40 text-white"
        style={{ background: headerGradient }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20 h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            <h1 className="text-lg font-bold">Team Comparison</h1>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 pb-24 max-w-lg mx-auto">
        {/* ─── Team Selection ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card-elevated p-4 mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Swords className="w-4 h-4 text-brand-red" />
            <h2 className="text-sm font-bold text-warm-800 dark:text-warm-100">
              Select Teams
            </h2>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <TeamSelector
              teams={teams}
              selected={teamA}
              onSelect={setTeamA}
              placeholder="Team 1"
              side="left"
            />

            {/* VS Badge */}
            <div className="shrink-0">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-md"
              >
                <span className="text-xs font-black text-white">VS</span>
              </motion.div>
            </div>

            <TeamSelector
              teams={teams.filter((t) => t.id !== teamA?.id)}
              selected={teamB}
              onSelect={setTeamB}
              placeholder="Team 2"
              side="right"
            />
          </div>

          <Button
            onClick={handleCompare}
            disabled={!teamA || !teamB || isComparing}
            className="w-full bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-bold"
          >
            {isComparing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Comparing...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Compare
              </div>
            )}
          </Button>
        </motion.div>

        {/* ─── Comparison Results ─── */}
        {comparison && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              {/* Team headers */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center justify-between mb-4 px-1"
              >
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: teamA?.color || '#DC2626' }}
                  >
                    {teamA?.shortName?.slice(0, 3) || 'T1'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">
                      {teamA?.name}
                    </p>
                    <div className="flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-brand-gold" />
                      <span className="text-[10px] text-warm-500">
                        {comparison.teamA.wins}W-{comparison.teamA.losses}L-{comparison.teamA.draws}D
                      </span>
                    </div>
                  </div>
                </div>

                <Badge className="bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold-light border-0 text-[10px] font-bold px-2">
                  H2H
                </Badge>

                <div className="flex items-center gap-2 flex-1 justify-end">
                  <div className="min-w-0 text-right">
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">
                      {teamB?.name}
                    </p>
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-[10px] text-warm-500">
                        {comparison.teamB.wins}W-{comparison.teamB.losses}L-{comparison.teamB.draws}D
                      </span>
                      <Trophy className="w-3 h-3 text-brand-gold" />
                    </div>
                  </div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: teamB?.color || '#1E293B' }}
                  >
                    {teamB?.shortName?.slice(0, 3) || 'T2'}
                  </div>
                </div>
              </motion.div>

              {/* ─── Head-to-Head Stats ─── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card-elevated p-4 mb-4"
              >
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-brand-teal" />
                  <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">
                    Head-to-Head Stats
                  </h3>
                </div>

                <StatBar
                  label="Matches Played"
                  valueA={comparison.teamA.totalMatches}
                  valueB={comparison.teamB.totalMatches}
                  teamAColor={teamA?.color || '#DC2626'}
                  teamBColor={teamB?.color || '#1E293B'}
                  delay={0.1}
                />
                <StatBar
                  label="Wins"
                  valueA={comparison.teamA.wins}
                  valueB={comparison.teamB.wins}
                  teamAColor={teamA?.color || '#DC2626'}
                  teamBColor={teamB?.color || '#1E293B'}
                  delay={0.15}
                />
                <StatBar
                  label="Losses"
                  valueA={comparison.teamA.losses}
                  valueB={comparison.teamB.losses}
                  teamAColor={teamA?.color || '#DC2626'}
                  teamBColor={teamB?.color || '#1E293B'}
                  delay={0.2}
                />
                <StatBar
                  label="Draws"
                  valueA={comparison.teamA.draws}
                  valueB={comparison.teamB.draws}
                  teamAColor={teamA?.color || '#DC2626'}
                  teamBColor={teamB?.color || '#1E293B'}
                  delay={0.25}
                />
                <StatBar
                  label="Raid Points"
                  valueA={comparison.teamA.raidPoints}
                  valueB={comparison.teamB.raidPoints}
                  teamAColor={teamA?.color || '#DC2626'}
                  teamBColor={teamB?.color || '#1E293B'}
                  delay={0.3}
                />
                <StatBar
                  label="Tackle Points"
                  valueA={comparison.teamA.tacklePoints}
                  valueB={comparison.teamB.tacklePoints}
                  teamAColor={teamA?.color || '#DC2626'}
                  teamBColor={teamB?.color || '#1E293B'}
                  delay={0.35}
                />
                <StatBar
                  label="Bonus Points"
                  valueA={comparison.teamA.bonusPoints}
                  valueB={comparison.teamB.bonusPoints}
                  teamAColor={teamA?.color || '#DC2626'}
                  teamBColor={teamB?.color || '#1E293B'}
                  delay={0.4}
                />
                <StatBar
                  label="All Outs"
                  valueA={comparison.teamA.allOuts}
                  valueB={comparison.teamB.allOuts}
                  teamAColor={teamA?.color || '#DC2626'}
                  teamBColor={teamB?.color || '#1E293B'}
                  delay={0.45}
                />
                <StatBar
                  label="Avg Score"
                  valueA={Math.round(comparison.teamA.avgScore * 10) / 10}
                  valueB={Math.round(comparison.teamB.avgScore * 10) / 10}
                  teamAColor={teamA?.color || '#DC2626'}
                  teamBColor={teamB?.color || '#1E293B'}
                  delay={0.5}
                />
              </motion.div>

              {/* ─── Radar Chart ─── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="card-elevated p-4 mb-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-brand-gold" />
                  <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">
                    Performance Radar
                  </h3>
                </div>
                <div className="flex justify-center">
                  <RadarChart
                    statsA={comparison.teamA}
                    statsB={comparison.teamB}
                    teamAColor={teamA?.color || '#DC2626'}
                    teamBColor={teamB?.color || '#1E293B'}
                    teamAName={teamA?.shortName || teamA?.name || 'Team 1'}
                    teamBName={teamB?.shortName || teamB?.name || 'Team 2'}
                  />
                </div>
              </motion.div>

              {/* ─── Recent Encounters ─── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card-elevated p-4 mb-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-brand-red" />
                  <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">
                    Recent Encounters
                  </h3>
                  <Badge className="ml-auto bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300 border-0 text-[10px]">
                    {comparison.encounters.length}
                  </Badge>
                </div>

                {comparison.encounters.length === 0 ? (
                  <div className="text-center py-8">
                    <Swords className="w-10 h-10 text-warm-300 dark:text-warm-600 mx-auto mb-2" />
                    <p className="text-sm text-warm-500 dark:text-warm-400">
                      No matches between these teams yet
                    </p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-2">
                    {comparison.encounters.map((encounter, idx) => {
                      const isHomeWin = encounter.winner === 'home';
                      const isAwayWin = encounter.winner === 'away';
                      const isDraw = encounter.winner === 'draw';

                      return (
                        <motion.div
                          key={encounter.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * idx }}
                          className={`p-3 rounded-xl border ${
                            isHomeWin
                              ? 'card-win'
                              : isAwayWin
                              ? 'card-loss'
                              : 'card-draw'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                                style={{
                                  backgroundColor:
                                    encounter.homeTeam.color || '#DC2626',
                                }}
                              >
                                {encounter.homeTeam.shortName?.slice(0, 2) || 'H'}
                              </div>
                              <span className="text-xs font-semibold text-warm-800 dark:text-warm-100">
                                {encounter.homeTeam.name}
                              </span>
                            </div>
                            <span className="text-lg font-black text-warm-800 dark:text-warm-100">
                              {encounter.homeScore}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-bold"
                                style={{
                                  backgroundColor:
                                    encounter.awayTeam.color || '#1E293B',
                                }}
                              >
                                {encounter.awayTeam.shortName?.slice(0, 2) || 'A'}
                              </div>
                              <span className="text-xs font-semibold text-warm-800 dark:text-warm-100">
                                {encounter.awayTeam.name}
                              </span>
                            </div>
                            <span className="text-lg font-black text-warm-800 dark:text-warm-100">
                              {encounter.awayScore}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-warm-200/50 dark:border-warm-700/50">
                            <span className="text-[10px] text-warm-500">
                              {encounter.completedAt
                                ? new Date(encounter.completedAt).toLocaleDateString(
                                    'en-IN',
                                    {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    }
                                  )
                                : 'N/A'}
                            </span>
                            <div className="flex items-center gap-1">
                              {isDraw ? (
                                <Badge className="bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold-light border-0 text-[9px] px-1.5">
                                  DRAW
                                </Badge>
                              ) : (
                                <Badge
                                  className={`border-0 text-[9px] px-1.5 ${
                                    isHomeWin
                                      ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                                      : 'bg-brand-red/15 text-brand-red dark:text-brand-red-light'
                                  }`}
                                >
                                  {isHomeWin
                                    ? encounter.homeTeam.shortName || encounter.homeTeam.name
                                    : encounter.awayTeam.shortName || encounter.awayTeam.name}{' '}
                                  WON
                                </Badge>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Win/Loss streak indicators */}
                {comparison.encounters.length > 0 && teamA && teamB && (
                  <div className="mt-4 pt-3 border-t border-warm-200/50 dark:border-warm-700/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-warm-500 mb-1">
                          {teamA.shortName || teamA.name} form
                        </p>
                        <div className="flex gap-1">
                          {getStreakIndicator(teamA.id, comparison.encounters).map(
                            (r, i) => (
                              <div
                                key={i}
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
                                  r === 'win'
                                    ? 'bg-green-500'
                                    : r === 'loss'
                                    ? 'bg-brand-red'
                                    : 'bg-brand-gold'
                                }`}
                              >
                                {r === 'win' ? 'W' : r === 'loss' ? 'L' : 'D'}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-warm-500 mb-1">
                          {teamB.shortName || teamB.name} form
                        </p>
                        <div className="flex gap-1 justify-end">
                          {getStreakIndicator(teamB.id, comparison.encounters).map(
                            (r, i) => (
                              <div
                                key={i}
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${
                                  r === 'win'
                                    ? 'bg-green-500'
                                    : r === 'loss'
                                    ? 'bg-brand-red'
                                    : 'bg-brand-gold'
                                }`}
                              >
                                {r === 'win' ? 'W' : r === 'loss' ? 'L' : 'D'}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ─── Empty State ─── */}
        {!comparison && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-red/10 to-brand-gold/10 dark:from-brand-red/20 dark:to-brand-gold/20 flex items-center justify-center">
              <Swords className="w-10 h-10 text-brand-red/50 dark:text-brand-red-light/50" />
            </div>
            <p className="text-sm text-warm-500 dark:text-warm-400 mb-1">
              Select two teams to compare
            </p>
            <p className="text-xs text-warm-400 dark:text-warm-500">
              View head-to-head stats, performance radar &amp; recent encounters
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
