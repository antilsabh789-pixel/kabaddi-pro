'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Swords, Trophy, Handshake, TrendingUp,
  ChevronRight, Calendar, BarChart3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamColor: string | null;
  awayTeamColor: string | null;
  homeScore: number;
  awayScore: number;
  winner: 'home' | 'away' | 'draw';
  resultForHome: 'win' | 'loss' | 'draw';
  completedAt: string | null;
  tournamentName: string | null;
}

interface HeadToHeadData {
  totalMatches: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  matchResults: MatchResult[];
}

interface HeadToHeadScreenProps {
  homeTeamId: string;
  awayTeamId: string;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HeadToHeadScreen({ homeTeamId, awayTeamId, onBack }: HeadToHeadScreenProps) {
  const { language } = useKabaddiStore();
  const [data, setData] = useState<HeadToHeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [teamNames, setTeamNames] = useState<{ home: string; away: string }>({ home: 'Home', away: 'Away' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/head-to-head?homeTeamId=${homeTeamId}&awayTeamId=${awayTeamId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result);
      // Extract team names from first result
      if (result.matchResults && result.matchResults.length > 0) {
        const first = result.matchResults[0];
        setTeamNames({ home: first.homeTeam, away: first.awayTeam });
      }
    } catch (err) {
      console.error('Head-to-head fetch error:', err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [homeTeamId, awayTeamId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const homeWinPct = data && data.totalMatches > 0
    ? Math.round((data.homeWins / data.totalMatches) * 100)
    : 0;
  const awayWinPct = data && data.totalMatches > 0
    ? Math.round((data.awayWins / data.totalMatches) * 100)
    : 0;
  const drawPct = data && data.totalMatches > 0
    ? 100 - homeWinPct - awayWinPct
    : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col"
      >
        {/* ─── Header ─── */}
        <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-red-600 flex items-center justify-center">
                <Swords className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
                {t('headToHead.title', language)}
              </h1>
            </div>
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-warm-100 dark:bg-warm-800 animate-pulse" />
              ))}
            </div>
          ) : !data || data.totalMatches === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-warm-500">
              <Swords className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('headToHead.noMatches', language)}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ─── Summary card ─── */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <Card className="border-warm-200 dark:border-warm-700 overflow-hidden">
                  <CardContent className="p-4">
                    {/* Team names */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 text-center">
                        <h3 className="text-lg font-black text-warm-800 dark:text-warm-100">
                          {teamNames.home}
                        </h3>
                      </div>
                      <div className="px-3">
                        <Swords className="w-5 h-5 text-warm-400" />
                      </div>
                      <div className="flex-1 text-center">
                        <h3 className="text-lg font-black text-warm-800 dark:text-warm-100">
                          {teamNames.away}
                        </h3>
                      </div>
                    </div>

                    {/* Win counts */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 text-center">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-4xl font-black text-green-600 dark:text-green-400"
                        >
                          {data.homeWins}
                        </motion.div>
                        <div className="flex items-center justify-center gap-1 text-xs text-warm-500 mt-1">
                          <Trophy className="w-3 h-3" />
                          <span>{t('headToHead.wins', language)}</span>
                        </div>
                      </div>
                      <div className="px-4 text-center">
                        <div className="text-2xl font-black text-warm-400">
                          {data.draws}
                        </div>
                        <div className="flex items-center justify-center gap-1 text-xs text-warm-500 mt-1">
                          <Handshake className="w-3 h-3" />
                          <span>{t('headToHead.draws', language)}</span>
                        </div>
                      </div>
                      <div className="flex-1 text-center">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-4xl font-black text-red-600 dark:text-red-400"
                        >
                          {data.awayWins}
                        </motion.div>
                        <div className="flex items-center justify-center gap-1 text-xs text-warm-500 mt-1">
                          <Trophy className="w-3 h-3" />
                          <span>{t('headToHead.wins', language)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total matches */}
                    <div className="text-center text-xs text-warm-400 mb-3">
                      {t('headToHead.totalMatches', language)}: {data.totalMatches}
                    </div>

                    {/* Win percentage bar */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-warm-600 dark:text-warm-300 w-12">
                          {homeWinPct}%
                        </span>
                        <div className="flex-1 h-3 bg-warm-100 dark:bg-warm-800 rounded-full overflow-hidden flex">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${homeWinPct}%` }}
                            transition={{ duration: 0.8 }}
                            className="bg-green-500 h-full"
                          />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${drawPct}%` }}
                            transition={{ duration: 0.8 }}
                            className="bg-warm-300 dark:bg-warm-600 h-full"
                          />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${awayWinPct}%` }}
                            transition={{ duration: 0.8 }}
                            className="bg-red-500 h-full"
                          />
                        </div>
                        <span className="text-xs font-bold text-warm-600 dark:text-warm-300 w-12 text-right">
                          {awayWinPct}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* ─── Past matches list ─── */}
              <div>
                <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-300 mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {t('headToHead.pastMatches', language)}
                </h3>
                <div className="space-y-2">
                  {data.matchResults.map((match, idx) => (
                    <motion.div
                      key={match.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <Card className={`border-warm-200 dark:border-warm-700 ${
                        match.resultForHome === 'win'
                          ? 'border-l-4 border-l-green-500'
                          : match.resultForHome === 'loss'
                            ? 'border-l-4 border-l-red-500'
                            : 'border-l-4 border-l-warm-300 dark:border-l-warm-600'
                      }`}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-warm-800 dark:text-warm-100">
                                  {match.homeTeam}
                                </span>
                                <span className="text-lg font-black text-warm-800 dark:text-warm-100">
                                  {match.homeScore}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-warm-800 dark:text-warm-100">
                                  {match.awayTeam}
                                </span>
                                <span className="text-lg font-black text-warm-800 dark:text-warm-100">
                                  {match.awayScore}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge
                                className={`text-[10px] font-bold ${
                                  match.resultForHome === 'win'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : match.resultForHome === 'loss'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                      : 'bg-warm-100 text-warm-700 dark:bg-warm-800 dark:text-warm-300'
                                }`}
                              >
                                {match.resultForHome === 'win'
                                  ? t('headToHead.homeWin', language)
                                  : match.resultForHome === 'loss'
                                    ? t('headToHead.awayWin', language)
                                    : t('headToHead.draw', language)}
                              </Badge>
                              {match.completedAt && (
                                <div className="flex items-center gap-1 text-[10px] text-warm-400 mt-1 justify-end">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {formatDate(match.completedAt)}
                                </div>
                              )}
                              {match.tournamentName && (
                                <div className="text-[10px] text-warm-400 mt-0.5">
                                  {match.tournamentName}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
