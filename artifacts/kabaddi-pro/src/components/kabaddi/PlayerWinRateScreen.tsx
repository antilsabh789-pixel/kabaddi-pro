'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Trophy,
  Shield,
  Swords,
  BarChart3,
  Loader2,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface PlayerWinRateScreenProps {
  playerId?: string;
  onBack: () => void;
}

interface TeamWinRate {
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  teamLogo: string | null;
  teamColor: string | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}

interface WinRateSummary {
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  overallWinRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getWinRateColor(winRate: number): string {
  if (winRate >= 70) return 'text-green-600 dark:text-green-400';
  if (winRate >= 50) return 'text-brand-gold-dark dark:text-brand-gold';
  if (winRate >= 30) return 'text-orange-500';
  return 'text-red-500';
}

function getWinRateBarColor(winRate: number): string {
  if (winRate >= 70) return 'bg-green-500';
  if (winRate >= 50) return 'bg-brand-gold';
  if (winRate >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

function getWinLossIcon(winRate: number): React.ReactNode {
  if (winRate >= 60) return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
  if (winRate <= 40) return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-warm-400" />;
}

// ─── Skeleton ─────────────────────────────────────────────────────

function TeamRowSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-warm-200 dark:bg-warm-700" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-warm-200 dark:bg-warm-700 rounded" />
          <div className="h-2 w-full bg-warm-100 dark:bg-warm-700 rounded-full" />
        </div>
        <div className="h-6 w-10 bg-warm-200 dark:bg-warm-700 rounded" />
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function PlayerWinRateScreen({ playerId, onBack }: PlayerWinRateScreenProps) {
  const { currentUser, language } = useKabaddiStore();
  const { toast } = useToast();

  const effectivePlayerId = playerId || currentUser?.id;

  const [stats, setStats] = useState<TeamWinRate[]>([]);
  const [summary, setSummary] = useState<WinRateSummary>({
    totalMatches: 0,
    totalWins: 0,
    totalLosses: 0,
    totalDraws: 0,
    overallWinRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'mostPlayed' | 'winRate' | 'lossRate'>('mostPlayed');

  // Fetch win rate data
  useEffect(() => {
    if (!effectivePlayerId) {
      setLoading(false);
      return;
    }

    const fetchWinRate = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/player-win-rate?playerId=${effectivePlayerId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setStats(data.stats || []);
        setSummary(data.summary || { totalMatches: 0, totalWins: 0, totalLosses: 0, totalDraws: 0, overallWinRate: 0 });
      } catch (err) {
        console.error('Fetch win rate error:', err);
        toast({ title: t('winRate.fetchError', language as 'en' | 'hi'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchWinRate();
  }, [effectivePlayerId, language, toast]);

  // Sort stats
  const sortedStats = [...stats].sort((a, b) => {
    if (sortBy === 'mostPlayed') return b.matchesPlayed - a.matchesPlayed;
    if (sortBy === 'winRate') return b.winRate - a.winRate;
    return (b.losses / (b.matchesPlayed || 1)) - (a.losses / (a.matchesPlayed || 1));
  });

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-warm-50 to-white dark:from-warm-800 dark:to-warm-900 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-warm-800/90 backdrop-blur-md border-b border-warm-200 dark:border-warm-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-brand-red" />
              <h1 className="text-lg font-bold text-warm-800 dark:text-warm-100">
                {t('winRate.title', language as 'en' | 'hi')}
              </h1>
            </div>
            <p className="text-xs text-warm-500 dark:text-warm-400">
              {t('winRate.subtitle', language as 'en' | 'hi')}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 space-y-4">
        {/* Summary Card */}
        {!loading && stats.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-gradient-to-br from-brand-red to-brand-red/80 dark:from-brand-red/90 dark:to-brand-red/70 border-0 text-white overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-brand-gold" />
                  <span className="text-sm font-semibold text-white/90">
                    {t('winRate.overallRecord', language as 'en' | 'hi')}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-bold">{summary.totalMatches}</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-wide">
                      {t('winRate.played', language as 'en' | 'hi')}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-300">{summary.totalWins}</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-wide">
                      {t('winRate.wins', language as 'en' | 'hi')}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-300">{summary.totalLosses}</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-wide">
                      {t('winRate.losses', language as 'en' | 'hi')}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white/70">{summary.totalDraws}</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-wide">
                      {t('winRate.draws', language as 'en' | 'hi')}
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-brand-gold">{summary.overallWinRate}%</p>
                    <p className="text-[10px] text-white/70 uppercase tracking-wide">
                      {t('winRate.winRate', language as 'en' | 'hi')}
                    </p>
                  </div>
                </div>

                {/* Overall Win Rate Bar */}
                <div className="mt-3">
                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden flex">
                    {summary.totalMatches > 0 && (
                      <>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(summary.totalWins / summary.totalMatches) * 100}%` }}
                          transition={{ duration: 0.8 }}
                          className="h-full bg-green-400"
                        />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(summary.totalDraws / summary.totalMatches) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }}
                          className="h-full bg-white/40"
                        />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(summary.totalLosses / summary.totalMatches) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.4 }}
                          className="h-full bg-red-400"
                        />
                      </>
                    )}
                  </div>
                  <div className="flex justify-between mt-1">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-[9px] text-white/60">{t('winRate.wins', language as 'en' | 'hi')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-white/40" />
                      <span className="text-[9px] text-white/60">{t('winRate.draws', language as 'en' | 'hi')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-[9px] text-white/60">{t('winRate.losses', language as 'en' | 'hi')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Sort Options */}
        {!loading && stats.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-warm-500 dark:text-warm-400">
              {t('winRate.sortBy', language as 'en' | 'hi')}:
            </span>
            {[
              { key: 'mostPlayed' as const, label: t('winRate.mostPlayed', language as 'en' | 'hi') },
              { key: 'winRate' as const, label: t('winRate.highestWinRate', language as 'en' | 'hi') },
              { key: 'lossRate' as const, label: t('winRate.highestLossRate', language as 'en' | 'hi') },
            ].map((opt) => (
              <Button
                key={opt.key}
                size="sm"
                variant={sortBy === opt.key ? 'default' : 'outline'}
                onClick={() => setSortBy(opt.key)}
                className={`h-7 text-[10px] ${
                  sortBy === opt.key
                    ? 'bg-brand-red hover:bg-brand-red/90 text-white'
                    : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-300'
                }`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        )}

        {/* Team Stats List */}
        {loading ? (
          <div className="space-y-2">
            <TeamRowSkeleton />
            <TeamRowSkeleton />
            <TeamRowSkeleton />
            <TeamRowSkeleton />
          </div>
        ) : stats.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <Target className="w-12 h-12 mx-auto text-warm-300 dark:text-warm-600 mb-3" />
            <p className="text-warm-500 dark:text-warm-400 text-sm">
              {t('winRate.noData', language as 'en' | 'hi')}
            </p>
            <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
              {t('winRate.playMoreMatches', language as 'en' | 'hi')}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {sortedStats.map((teamStat, index) => {
                const isExpanded = expandedTeamId === teamStat.teamId;
                return (
                  <motion.div
                    key={teamStat.teamId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 overflow-hidden">
                      <CardContent className="p-0">
                        {/* Main Row */}
                        <div
                          className="p-4 cursor-pointer hover:bg-warm-50 dark:hover:bg-warm-700/20 transition-colors"
                          onClick={() => setExpandedTeamId(isExpanded ? null : teamStat.teamId)}
                        >
                          <div className="flex items-center gap-3">
                            {/* Team Logo */}
                            <div className="shrink-0">
                              {teamStat.teamLogo ? (
                                <img
                                  src={teamStat.teamLogo}
                                  alt={teamStat.teamName}
                                  className="w-10 h-10 rounded-lg object-cover border border-warm-200 dark:border-warm-600"
                                />
                              ) : (
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm border border-warm-200 dark:border-warm-600"
                                  style={{ backgroundColor: teamStat.teamColor || '#6B7280' }}
                                >
                                  {teamStat.teamShortName ? teamStat.teamShortName[0] : teamStat.teamName[0]}
                                </div>
                              )}
                            </div>

                            {/* Team Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                                  {teamStat.teamName}
                                </h3>
                                {getWinLossIcon(teamStat.winRate)}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-warm-500 dark:text-warm-400">
                                <span>{teamStat.matchesPlayed} {t('winRate.matches', language as 'en' | 'hi')}</span>
                                <span className="text-green-600 dark:text-green-400">{teamStat.wins}W</span>
                                <span className="text-red-500">{teamStat.losses}L</span>
                                <span className="text-warm-400">{teamStat.draws}D</span>
                              </div>

                              {/* Win Rate Bar */}
                              <div className="mt-2">
                                <div className="w-full h-1.5 bg-warm-100 dark:bg-warm-700 rounded-full overflow-hidden flex">
                                  {teamStat.matchesPlayed > 0 && (
                                    <>
                                      <div
                                        className="h-full bg-green-500 rounded-l-full"
                                        style={{ width: `${(teamStat.wins / teamStat.matchesPlayed) * 100}%` }}
                                      />
                                      <div
                                        className="h-full bg-warm-300 dark:bg-warm-500"
                                        style={{ width: `${(teamStat.draws / teamStat.matchesPlayed) * 100}%` }}
                                      />
                                      <div
                                        className="h-full bg-red-500 rounded-r-full"
                                        style={{ width: `${(teamStat.losses / teamStat.matchesPlayed) * 100}%` }}
                                      />
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Win Rate */}
                            <div className="shrink-0 text-right">
                              <p className={`text-xl font-bold ${getWinRateColor(teamStat.winRate)}`}>
                                {teamStat.winRate}%
                              </p>
                              <p className="text-[10px] text-warm-400 dark:text-warm-500 uppercase tracking-wide">
                                {t('winRate.winRate', language as 'en' | 'hi')}
                              </p>
                            </div>

                            {/* Expand Icon */}
                            <div className="shrink-0 ml-1">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-warm-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-warm-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Detail */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-0 border-t border-warm-100 dark:border-warm-700/50">
                                <div className="grid grid-cols-3 gap-3 mt-3">
                                  {/* Wins */}
                                  <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{teamStat.wins}</p>
                                    <p className="text-[10px] text-green-700 dark:text-green-500 uppercase tracking-wide">
                                      {t('winRate.wins', language as 'en' | 'hi')}
                                    </p>
                                  </div>
                                  {/* Losses */}
                                  <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{teamStat.losses}</p>
                                    <p className="text-[10px] text-red-700 dark:text-red-500 uppercase tracking-wide">
                                      {t('winRate.losses', language as 'en' | 'hi')}
                                    </p>
                                  </div>
                                  {/* Draws */}
                                  <div className="text-center p-2 bg-warm-50 dark:bg-warm-700/30 rounded-lg">
                                    <p className="text-lg font-bold text-warm-600 dark:text-warm-300">{teamStat.draws}</p>
                                    <p className="text-[10px] text-warm-600 dark:text-warm-500 uppercase tracking-wide">
                                      {t('winRate.draws', language as 'en' | 'hi')}
                                    </p>
                                  </div>
                                </div>

                                {/* Win Rate Visual */}
                                <div className="mt-3 p-3 bg-warm-50 dark:bg-warm-700/20 rounded-lg">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs text-warm-500 dark:text-warm-400">
                                      {t('winRate.winRateVisual', language as 'en' | 'hi')}
                                    </span>
                                    <span className={`text-xs font-bold ${getWinRateColor(teamStat.winRate)}`}>
                                      {teamStat.wins}/{teamStat.matchesPlayed} {t('winRate.won', language as 'en' | 'hi')}
                                    </span>
                                  </div>
                                  <div className="w-full h-3 bg-warm-100 dark:bg-warm-700 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${teamStat.winRate}%` }}
                                      transition={{ duration: 0.6 }}
                                      className={`h-full rounded-full ${getWinRateBarColor(teamStat.winRate)}`}
                                    />
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
