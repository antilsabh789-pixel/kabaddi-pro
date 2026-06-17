'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Swords, Clock, Calendar, Trophy, ChevronRight,
  TrendingUp, TrendingDown, Minus, Zap, Shield,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────

export interface TimelineMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  date: string;
  isPractice: boolean;
  userTeamSide: 'home' | 'away' | 'unknown';
  result?: 'W' | 'L' | 'D';
  completedAt?: string;
  /** Key stats for the match */
  raidPoints?: number;
  tacklePoints?: number;
  bonusPoints?: number;
}

type ResultFilter = 'all' | 'wins' | 'losses';
type MatchResult = 'W' | 'L' | 'D';

interface MatchHistoryTimelineProps {
  matches: TimelineMatch[];
  onViewAll?: () => void;
  onViewMatch?: (matchId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getMatchResult(match: TimelineMatch): MatchResult {
  if (match.userTeamSide === 'unknown') {
    return match.homeScore === match.awayScore ? 'D' : 'D';
  }
  const myScore = match.userTeamSide === 'home' ? match.homeScore : match.awayScore;
  const oppScore = match.userTeamSide === 'home' ? match.awayScore : match.homeScore;
  if (myScore > oppScore) return 'W';
  if (myScore < oppScore) return 'L';
  return 'D';
}

function timeAgo(dateStr: string): string {
  if (!dateStr || dateStr === '—') return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getResultColor(result: MatchResult): string {
  switch (result) {
    case 'W': return 'text-emerald-600 dark:text-emerald-400';
    case 'L': return 'text-red-600 dark:text-red-400';
    case 'D': return 'text-amber-600 dark:text-amber-400';
  }
}

function getResultBg(result: MatchResult): string {
  switch (result) {
    case 'W': return 'bg-emerald-50 dark:bg-emerald-900/15 border-l-emerald-500';
    case 'L': return 'bg-red-50 dark:bg-red-900/15 border-l-red-500';
    case 'D': return 'bg-amber-50 dark:bg-amber-900/15 border-l-amber-500';
  }
}

function getResultBadgeBg(result: MatchResult): string {
  switch (result) {
    case 'W': return 'bg-emerald-500 text-white';
    case 'L': return 'bg-red-500 text-white';
    case 'D': return 'bg-amber-500 text-white';
  }
}

function getResultDotBorder(result: MatchResult): string {
  switch (result) {
    case 'W': return 'bg-emerald-500 border-emerald-300 dark:border-emerald-700';
    case 'L': return 'bg-red-500 border-red-300 dark:border-red-700';
    case 'D': return 'bg-amber-500 border-amber-300 dark:border-amber-700';
  }
}

function getResultIcon(result: MatchResult) {
  switch (result) {
    case 'W': return <TrendingUp className="w-3 h-3" />;
    case 'L': return <TrendingDown className="w-3 h-3" />;
    case 'D': return <Minus className="w-3 h-3" />;
  }
}

// ─── Stagger animation variants ──────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

// ─── Stat Summary Pill ──────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-black ${color}`}>{value}</span>
      <span className="text-[10px] text-warm-500 dark:text-warm-400 font-medium">{label}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function MatchHistoryTimeline({
  matches,
  onViewAll,
  onViewMatch,
}: MatchHistoryTimelineProps) {
  const [filter, setFilter] = useState<ResultFilter>('all');

  // Compute results for all matches
  const matchesWithResults = useMemo(
    () => matches.map((m): TimelineMatch & { result: MatchResult } => ({ ...m, result: getMatchResult(m) })),
    [matches]
  );

  // Filter matches
  const filteredMatches = useMemo(() => {
    if (filter === 'all') return matchesWithResults;
    if (filter === 'wins') return matchesWithResults.filter((m) => m.result === 'W');
    return matchesWithResults.filter((m) => m.result === 'L');
  }, [matchesWithResults, filter]);

  // Stats summary
  const wins = matchesWithResults.filter((m) => m.result === 'W').length;
  const losses = matchesWithResults.filter((m) => m.result === 'L').length;
  const draws = matchesWithResults.filter((m) => m.result === 'D').length;

  // Last 5 summary
  const last5 = matchesWithResults.slice(0, 5);
  const last5Wins = last5.filter((m) => m.result === 'W').length;
  const last5Losses = last5.filter((m) => m.result === 'L').length;
  const last5Draws = last5.filter((m) => m.result === 'D').length;

  // Group matches by date
  const groupedByDate = useMemo(() => {
    type MatchWithResult = TimelineMatch & { result: MatchResult };
    const groups: Record<string, MatchWithResult[]> = {};
    filteredMatches.slice(0, 10).forEach((match) => {
      const dateKey = match.date || 'Unknown';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(match);
    });
    return Object.entries(groups);
  }, [filteredMatches]);

  // Filter tab configuration
  const filterTabs: { key: ResultFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: matchesWithResults.length },
    { key: 'wins', label: 'Wins', count: wins },
    { key: 'losses', label: 'Losses', count: losses },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <h3 className="font-bold text-warm-800 dark:text-warm-700 mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-brand-gold" />
        Match History
      </h3>

      {/* ── Stats Summary Card ── */}
      <Card className="p-4 mb-4 shadow-sm glass-card overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-red/3 via-transparent to-brand-gold/3 pointer-events-none" />
        <div className="relative z-10">
          {/* Overall record */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-center flex-1">
              <p className="text-[10px] text-warm-500 dark:text-warm-400 uppercase tracking-wider font-bold mb-1">Record</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-lg font-black text-emerald-500">{wins}W</span>
                <span className="text-warm-300 dark:text-warm-400 text-sm">-</span>
                <span className="text-lg font-black text-red-500">{losses}L</span>
                {draws > 0 && (
                  <>
                    <span className="text-warm-300 dark:text-warm-400 text-sm">-</span>
                    <span className="text-lg font-black text-amber-500">{draws}D</span>
                  </>
                )}
              </div>
            </div>
            <div className="w-px h-12 bg-warm-200 dark:bg-warm-700" />
            <div className="text-center flex-1">
              <p className="text-[10px] text-warm-500 dark:text-warm-400 uppercase tracking-wider font-bold mb-1">Win Rate</p>
              <p className="text-lg font-black text-warm-800 dark:text-warm-700">
                {matchesWithResults.length > 0
                  ? Math.round((wins / matchesWithResults.length) * 100)
                  : 0}%
              </p>
            </div>
            <div className="w-px h-12 bg-warm-200 dark:bg-warm-700" />
            <div className="text-center flex-1">
              <p className="text-[10px] text-warm-500 dark:text-warm-400 uppercase tracking-wider font-bold mb-1">Last 5</p>
              <div className="flex items-center justify-center gap-1">
                <StatPill label="W" value={`${last5Wins}`} color="text-emerald-500" />
                <StatPill label="L" value={`${last5Losses}`} color="text-red-500" />
                {last5Draws > 0 && (
                  <StatPill label="D" value={`${last5Draws}`} color="text-amber-500" />
                )}
              </div>
            </div>
          </div>

          {/* Recent Form Indicator (last 5 matches) */}
          <div>
            <p className="text-[10px] text-warm-400 dark:text-warm-300 uppercase tracking-wider font-bold mb-2">Recent Form</p>
            <div className="flex items-center gap-2">
              {last5.length === 0 ? (
                <p className="text-xs text-warm-400 dark:text-warm-300">No matches played yet</p>
              ) : (
                last5.map((match, idx) => (
                  <motion.div
                    key={match.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 + idx * 0.08, type: 'spring', stiffness: 300 }}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm ${getResultBadgeBg(match.result)}`}
                  >
                    {match.result}
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1.5 mb-3">
        {filterTabs.map((tab) => (
          <motion.button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              filter === tab.key
                ? 'bg-warm-800 dark:bg-warm-100 text-warm-50 dark:text-warm-900 shadow-sm'
                : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            {tab.label}
            <span className={`text-[9px] px-1 py-0 rounded-full ${
              filter === tab.key
                ? 'bg-white/20 text-white'
                : 'bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-500'
            }`}>
              {tab.count}
            </span>
          </motion.button>
        ))}
      </div>

      {/* ── Vertical Timeline ── */}
      <AnimatePresence mode="wait">
        {filteredMatches.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="p-6 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-warm-100 dark:bg-warm-200 flex items-center justify-center mx-auto mb-3">
                <Swords className="w-6 h-6 text-warm-300 dark:text-warm-400" />
              </div>
              <p className="text-sm text-warm-500 dark:text-warm-400">
                {filter === 'all' ? 'No matches yet' : `No ${filter} found`}
              </p>
              <p className="text-xs text-warm-400 dark:text-warm-300 mt-1">
                {filter === 'all' ? 'Start scoring to see your match history' : 'Try a different filter'}
              </p>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key={`timeline-${filter}`}
            className="relative pl-6"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {/* Timeline vertical line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-brand-red via-brand-gold to-brand-teal dark:from-brand-red-light dark:via-brand-gold-light dark:to-brand-teal-light opacity-40" />

            {groupedByDate.map(([dateKey, dateMatches], groupIdx) => (
              <div key={dateKey} className="mb-4 last:mb-0">
                {/* Date separator */}
                <motion.div
                  variants={itemVariants}
                  className="flex items-center gap-2 mb-2 -ml-6"
                >
                  <div className="w-5 h-5 rounded-full bg-brand-gold/20 border-2 border-brand-gold flex items-center justify-center shrink-0 z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-gold" />
                  </div>
                  <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-widest bg-warm-100 dark:bg-warm-800/50 px-2.5 py-1 rounded-full">
                    {dateKey}
                  </span>
                </motion.div>

                {/* Match cards for this date */}
                {dateMatches.map((match) => {
                  const result = match.result;
                  const isWin = result === 'W';
                  const isDraw = result === 'D';
                  const timeAgoStr = match.completedAt ? timeAgo(match.completedAt) : '';
                  const myScore = match.userTeamSide === 'home' ? match.homeScore : match.awayScore;
                  const oppScore = match.userTeamSide === 'home' ? match.awayScore : match.homeScore;

                  return (
                    <motion.div
                      key={match.id}
                      variants={itemVariants}
                      className={`relative ml-2 mb-3 rounded-xl border-l-4 overflow-hidden shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer ${getResultBg(result)}`}
                      onClick={() => onViewMatch?.(match.id)}
                    >
                      {/* Timeline connector dot */}
                      <div className={`absolute -left-[21px] top-4 w-3 h-3 rounded-full border-2 z-10 ${getResultDotBorder(result)}`} />

                      <div className="p-3.5">
                        {/* Result badge + match type */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${getResultBadgeBg(result)}`}
                            >
                              {getResultIcon(result)}
                              {result === 'W' ? 'WIN' : result === 'L' ? 'LOSS' : 'DRAW'}
                            </motion.span>
                            {match.isPractice ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-teal/10 text-brand-teal font-bold">Practice</span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-gold/10 text-brand-gold font-bold">Tournament</span>
                            )}
                          </div>
                          {timeAgoStr && (
                            <span className="text-[9px] text-warm-400 dark:text-warm-500 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />{timeAgoStr}
                            </span>
                          )}
                        </div>

                        {/* Teams and score */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-warm-800 dark:text-warm-700">
                              <span className="w-2 h-2 rounded-full bg-brand-red shrink-0" />
                              <span className="truncate">{match.homeTeam}</span>
                              {match.userTeamSide === 'home' && (
                                <span className="text-[8px] px-1 py-0 rounded-full bg-brand-teal/15 text-brand-teal font-bold shrink-0">YOU</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-medium text-warm-800 dark:text-warm-700 mt-0.5">
                              <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0" />
                              <span className="truncate">{match.awayTeam}</span>
                              {match.userTeamSide === 'away' && (
                                <span className="text-[8px] px-1 py-0 rounded-full bg-brand-teal/15 text-brand-teal font-bold shrink-0">YOU</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className={`text-xl font-black tabular-nums ${getResultColor(result)}`}>
                              {match.homeScore} - {match.awayScore}
                            </span>
                            {match.userTeamSide !== 'unknown' && (
                              <p className="text-[9px] text-warm-400 dark:text-warm-500 mt-0.5">
                                {isWin ? `+${myScore - oppScore} diff` : isDraw ? 'Level' : `${oppScore - myScore} diff`}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Key stats row */}
                        {(match.raidPoints !== undefined || match.tacklePoints !== undefined || match.bonusPoints !== undefined) && (
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-warm-200/50 dark:border-warm-700/30">
                            {match.raidPoints !== undefined && (
                              <div className="flex items-center gap-1 text-[10px]">
                                <Zap className="w-3 h-3 text-orange-500" />
                                <span className="font-bold text-warm-700 dark:text-warm-300">{match.raidPoints}</span>
                                <span className="text-warm-400">raid</span>
                              </div>
                            )}
                            {match.tacklePoints !== undefined && (
                              <div className="flex items-center gap-1 text-[10px]">
                                <Shield className="w-3 h-3 text-emerald-500" />
                                <span className="font-bold text-warm-700 dark:text-warm-300">{match.tacklePoints}</span>
                                <span className="text-warm-400">tackle</span>
                              </div>
                            )}
                            {match.bonusPoints !== undefined && match.bonusPoints > 0 && (
                              <div className="flex items-center gap-1 text-[10px]">
                                <Badge className="text-[8px] font-bold px-1 py-0 h-4 border-0 bg-brand-gold/15 text-brand-gold">
                                  +{match.bonusPoints} bonus
                                </Badge>
                              </div>
                            )}
                          </div>
                        )}

                        {/* View Match Details button */}
                        <motion.button
                          whileHover={{ x: 3 }}
                          whileTap={{ scale: 0.97 }}
                          className="mt-2 text-[10px] font-semibold text-brand-teal dark:text-brand-teal-light hover:text-brand-teal-dark dark:hover:text-brand-teal flex items-center gap-1 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewMatch?.(match.id);
                          }}
                        >
                          View Match Details
                          <ChevronRight className="w-3 h-3" />
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── View All Button ── */}
      {matches.length > 0 && onViewAll && (
        <div className="mt-3 px-4">
          <button
            onClick={onViewAll}
            className="w-full text-center text-xs font-semibold text-brand-teal hover:text-brand-teal-dark transition-colors flex items-center justify-center gap-1"
          >
            View All Matches
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
