'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Trophy, Shield, TrendingUp, TrendingDown, Minus,
  Crown, Users, Swords, BarChart3, ChevronUp, ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';

interface TeamLeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  logo: string | null;
  teamCode: string | null;
  memberCount: number;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  pointsFor: number;
  pointsAgainst: number;
  scoreDiff: number;
}

type SortField = 'rank' | 'played' | 'wins' | 'losses' | 'points' | 'scoreDiff';
type ViewMode = 'podium' | 'table';

interface TeamsLeaderboardScreenProps {
  onClose: () => void;
}

export default function TeamsLeaderboardScreen({ onClose }: TeamsLeaderboardScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const [entries, setEntries] = useState<TeamLeaderboardEntry[]>([]);
  const [unranked, setUnranked] = useState<TeamLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('podium');
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortAsc, setSortAsc] = useState(false);
  const [showUnranked, setShowUnranked] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/teams-leaderboard?limit=50');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEntries(data.leaderboard || []);
      setUnranked(data.unrankedTeams || []);
      setTotalMatches(data.totalMatchesPlayed || 0);
    } catch (err) {
      console.error('Teams leaderboard fetch error:', err);
      setEntries([]);
      setUnranked([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Get user's team IDs
  const userTeamIds = new Set<string>();
  // This is a placeholder — we could fetch user teams if needed

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-400/30';
      case 2: return 'bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg shadow-slate-300/30';
      case 3: return 'bg-gradient-to-br from-amber-600 to-amber-700 shadow-lg shadow-amber-600/30';
      default: return 'bg-warm-200 dark:bg-warm-600';
    }
  };

  const getPodiumHeight = (rank: number) => {
    switch (rank) {
      case 1: return 'h-28';
      case 2: return 'h-20';
      case 3: return 'h-16';
      default: return 'h-12';
    }
  };

  const getPodiumWidth = (rank: number) => {
    switch (rank) {
      case 1: return 'w-[120px]';
      case 2: return 'w-[105px]';
      case 3: return 'w-[105px]';
      default: return 'w-24';
    }
  };

  const getWinRate = (entry: TeamLeaderboardEntry) => {
    if (entry.played === 0) return 0;
    return Math.round((entry.wins / entry.played) * 100);
  };

  // Sort entries based on sortField
  const sortedEntries = [...entries].sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sortField) {
      case 'rank': aVal = a.rank; bVal = b.rank; break;
      case 'played': aVal = a.played; bVal = b.played; break;
      case 'wins': aVal = a.wins; bVal = b.wins; break;
      case 'losses': aVal = a.losses; bVal = b.losses; break;
      case 'points': aVal = a.points; bVal = b.points; break;
      case 'scoreDiff': aVal = a.scoreDiff; bVal = b.scoreDiff; break;
      default: aVal = a.rank; bVal = b.rank;
    }
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'rank' || field === 'losses');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const podiumEntries = entries.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-800 flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-800/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-600/30">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
                TEAMS LEADERBOARD
              </h1>
              <p className="text-[9px] text-warm-400 dark:text-warm-500 font-medium">
                2 pts/win · -1 pt/loss · {totalMatches} matches played
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-600 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setViewMode('podium')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              viewMode === 'podium'
                ? 'bg-brand-red text-white shadow-sm'
                : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
            }`}
          >
            <Trophy className="w-3 h-3" />
            Podium
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              viewMode === 'table'
                ? 'bg-brand-red text-white shadow-sm'
                : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            Table
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-warm-100 dark:bg-warm-700 animate-pulse" />
            ))}
          </div>
        ) : entries.length > 0 ? (
          <motion.div
            className="flex flex-col gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.05 }}
          >
            {viewMode === 'podium' ? (
              <>
                {/* ═══ Podium (Top 3) ═══ */}
                {podiumEntries.length > 0 && (
                  <div className="flex items-end justify-center gap-3 pt-2 pb-4">
                    {/* 2nd Place (left) */}
                    {podiumEntries[1] && (
                      <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, type: 'spring', damping: 20, stiffness: 240 }}
                        className="flex flex-col items-center"
                      >
                        <div className={`${getPodiumWidth(2)} rounded-2xl p-3 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 border border-slate-300/50 dark:border-slate-500/30`}>
                          <div className="flex flex-col items-center text-center">
                            <span className="text-2xl mb-1">🥈</span>
                            {/* Team Avatar */}
                            <div className="relative mb-2">
                              <div
                                className="w-14 h-14 rounded-full border-2 border-slate-400/40 flex items-center justify-center overflow-hidden"
                                style={{ backgroundColor: podiumEntries[1].color || '#94a3b8' }}
                              >
                                {podiumEntries[1].logo ? (
                                  <img src={podiumEntries[1].logo} alt={podiumEntries[1].name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-lg font-black text-white/90">
                                    {(podiumEntries[1].shortName || podiumEntries[1].name).slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate w-full">
                              {podiumEntries[1].name}
                            </p>
                            <p className="text-[9px] text-warm-500 dark:text-warm-400">
                              {podiumEntries[1].wins}W · {podiumEntries[1].losses}L
                            </p>
                            <p className="text-slate-500 dark:text-slate-300 font-black text-lg mt-1">
                              {podiumEntries[1].points}
                            </p>
                            <p className="text-[9px] text-warm-400 dark:text-warm-500">pts</p>
                          </div>
                        </div>
                        {/* Podium platform */}
                        <div className={`${getPodiumWidth(2)} ${getPodiumHeight(2)} rounded-b-lg bg-gradient-to-t from-slate-300/30 to-slate-200/20 dark:from-slate-500/30 dark:to-slate-600/20 border-t-2 border-slate-400/40 mt-1`} />
                      </motion.div>
                    )}

                    {/* 1st Place (center) */}
                    {podiumEntries[0] && (
                      <motion.div
                        initial={{ opacity: 0, y: 32 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1, type: 'spring', damping: 18, stiffness: 220 }}
                        className="flex flex-col items-center"
                      >
                        <div className={`${getPodiumWidth(1)} rounded-2xl p-3 bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/20 border-2 border-brand-gold/50 animate-shimmer-slow`}>
                          <div className="flex flex-col items-center text-center">
                            {/* Crown */}
                            <div className="mb-1">
                              <Crown className="w-6 h-6 text-brand-gold animate-float-gentle" />
                            </div>
                            {/* Team Avatar */}
                            <div className="relative mb-2">
                              <div
                                className="w-16 h-16 rounded-full border-2 border-yellow-400/60 flex items-center justify-center overflow-hidden shadow-lg shadow-brand-gold/20"
                                style={{ backgroundColor: podiumEntries[0].color || '#DC2626' }}
                              >
                                {podiumEntries[0].logo ? (
                                  <img src={podiumEntries[0].logo} alt={podiumEntries[0].name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xl font-black text-white/90">
                                    {(podiumEntries[0].shortName || podiumEntries[0].name).slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-lg">🥇</span>
                            </div>
                            <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate w-full">
                              {podiumEntries[0].name}
                            </p>
                            <p className="text-[9px] text-warm-500 dark:text-warm-400">
                              {podiumEntries[0].wins}W · {podiumEntries[0].losses}L · {podiumEntries[0].draws}D
                            </p>
                            <p className="text-brand-gold-dark dark:text-brand-gold font-black text-2xl mt-1">
                              {podiumEntries[0].points}
                            </p>
                            <p className="text-[9px] text-warm-400 dark:text-warm-500">pts</p>
                          </div>
                        </div>
                        {/* Podium platform - tallest */}
                        <div className={`${getPodiumWidth(1)} ${getPodiumHeight(1)} rounded-b-lg bg-gradient-to-t from-yellow-500/20 to-yellow-400/10 dark:from-yellow-600/20 dark:to-yellow-500/10 border-t-2 border-brand-gold/50 mt-1`} />
                      </motion.div>
                    )}

                    {/* 3rd Place (right) */}
                    {podiumEntries[2] && (
                      <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, type: 'spring', damping: 20, stiffness: 240 }}
                        className="flex flex-col items-center"
                      >
                        <div className={`${getPodiumWidth(3)} rounded-2xl p-3 bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/15 border border-amber-300/50 dark:border-amber-600/30`}>
                          <div className="flex flex-col items-center text-center">
                            <span className="text-2xl mb-1">🥉</span>
                            {/* Team Avatar */}
                            <div className="relative mb-2">
                              <div
                                className="w-14 h-14 rounded-full border-2 border-amber-600/40 flex items-center justify-center overflow-hidden"
                                style={{ backgroundColor: podiumEntries[2].color || '#d97706' }}
                              >
                                {podiumEntries[2].logo ? (
                                  <img src={podiumEntries[2].logo} alt={podiumEntries[2].name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-lg font-black text-white/90">
                                    {(podiumEntries[2].shortName || podiumEntries[2].name).slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate w-full">
                              {podiumEntries[2].name}
                            </p>
                            <p className="text-[9px] text-warm-500 dark:text-warm-400">
                              {podiumEntries[2].wins}W · {podiumEntries[2].losses}L
                            </p>
                            <p className="text-amber-700 dark:text-amber-500 font-black text-lg mt-1">
                              {podiumEntries[2].points}
                            </p>
                            <p className="text-[9px] text-warm-400 dark:text-warm-500">pts</p>
                          </div>
                        </div>
                        {/* Podium platform - shortest */}
                        <div className={`${getPodiumWidth(3)} ${getPodiumHeight(3)} rounded-b-lg bg-gradient-to-t from-amber-600/20 to-amber-500/10 dark:from-amber-700/20 dark:to-amber-600/10 border-t-2 border-amber-600/40 mt-1`} />
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ═══ Remaining Teams List (4+) ═══ */}
                {entries.length > 3 && (
                  <div className="space-y-2">
                    {entries.slice(3).map((entry, idx) => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                      >
                        <Card className="bg-warm-100/60 dark:bg-warm-700/40 border-warm-200 dark:border-warm-600/30 py-0 gap-0 overflow-hidden hover:border-brand-gold/30 transition-colors">
                          <CardContent className="p-3 flex items-center gap-3">
                            {/* Rank */}
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-warm-200 dark:bg-warm-600">
                              <span className="text-sm font-bold text-warm-600 dark:text-warm-300">#{entry.rank}</span>
                            </div>

                            {/* Team Color & Avatar */}
                            <div className="relative shrink-0">
                              <div
                                className="w-10 h-10 rounded-full border-2 border-warm-100 dark:border-warm-500 flex items-center justify-center overflow-hidden"
                                style={{ backgroundColor: entry.color || '#94a3b8' }}
                              >
                                {entry.logo ? (
                                  <img src={entry.logo} alt={entry.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-xs font-black text-white/90">
                                    {(entry.shortName || entry.name).slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Team Name & Stats */}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm truncate text-warm-800 dark:text-warm-100">
                                {entry.name}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                                  {entry.wins}W
                                </span>
                                <span className="text-[10px] font-semibold text-red-500 dark:text-red-400">
                                  {entry.losses}L
                                </span>
                                {entry.draws > 0 && (
                                  <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400">
                                    {entry.draws}D
                                  </span>
                                )}
                                <span className="text-[10px] text-warm-400 dark:text-warm-500">
                                  · {entry.played} played
                                </span>
                              </div>
                            </div>

                            {/* Win Rate Bar */}
                            <div className="hidden sm:flex flex-col items-center gap-0.5">
                              <div className="w-12 h-1.5 bg-warm-200 dark:bg-warm-600 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${getWinRate(entry)}%` }}
                                  transition={{ duration: 0.6, delay: idx * 0.05, ease: 'easeOut' }}
                                  className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                                />
                              </div>
                              <span className="text-[8px] text-warm-500 dark:text-warm-400">{getWinRate(entry)}%</span>
                            </div>

                            {/* Points */}
                            <div className="text-right shrink-0">
                              <p className="font-black text-sm text-brand-gold-dark dark:text-brand-gold">
                                {entry.points}
                              </p>
                              <p className="text-[10px] text-warm-400 dark:text-warm-500">pts</p>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* ═══ Points Explanation ═══ */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-2"
                >
                  <Card className="bg-warm-100/40 dark:bg-warm-700/20 border-warm-200/50 dark:border-warm-600/20 py-0 gap-0">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="w-4 h-4 text-brand-teal" />
                        <span className="text-xs font-bold text-warm-700 dark:text-warm-200">Points System</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                          <p className="text-lg font-black text-green-600 dark:text-green-400">+2</p>
                          <p className="text-[9px] text-warm-500 dark:text-warm-400">Per Win</p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                          <p className="text-lg font-black text-red-500 dark:text-red-400">-1</p>
                          <p className="text-[9px] text-warm-500 dark:text-warm-400">Per Loss</p>
                        </div>
                        <div className="bg-warm-100 dark:bg-warm-600 rounded-lg p-2">
                          <p className="text-lg font-black text-warm-500 dark:text-warm-300">0</p>
                          <p className="text-[9px] text-warm-500 dark:text-warm-400">Per Draw</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            ) : (
              /* ═══ TABLE VIEW ═══ */
              <>
                {/* Table Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-warm-100 dark:bg-warm-700 rounded-t-xl text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider">
                  <div className="w-8 text-center cursor-pointer flex items-center justify-center gap-0.5" onClick={() => handleSort('rank')}>
                    # <SortIcon field="rank" />
                  </div>
                  <div className="flex-1 min-w-0">Team</div>
                  <div className="w-10 text-center cursor-pointer flex items-center justify-center gap-0.5" onClick={() => handleSort('played')}>
                    P <SortIcon field="played" />
                  </div>
                  <div className="w-10 text-center cursor-pointer flex items-center justify-center gap-0.5" onClick={() => handleSort('wins')}>
                    W <SortIcon field="wins" />
                  </div>
                  <div className="w-10 text-center cursor-pointer flex items-center justify-center gap-0.5" onClick={() => handleSort('losses')}>
                    L <SortIcon field="losses" />
                  </div>
                  <div className="w-10 text-center">D</div>
                  <div className="w-14 text-center cursor-pointer flex items-center justify-center gap-0.5" onClick={() => handleSort('scoreDiff')}>
                    Diff <SortIcon field="scoreDiff" />
                  </div>
                  <div className="w-12 text-center cursor-pointer flex items-center justify-center gap-0.5" onClick={() => handleSort('points')}>
                    Pts <SortIcon field="points" />
                  </div>
                </div>

                {/* Table Body */}
                <div className="space-y-0.5">
                  {sortedEntries.map((entry, idx) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                        idx < 3
                          ? idx === 0
                            ? 'bg-gradient-to-r from-yellow-50/80 to-amber-50/50 dark:from-yellow-900/15 dark:to-amber-900/10 border border-brand-gold/20'
                            : idx === 1
                              ? 'bg-gradient-to-r from-slate-50/80 to-slate-100/50 dark:from-slate-700/20 dark:to-slate-600/10 border border-slate-300/30 dark:border-slate-500/20'
                              : 'bg-gradient-to-r from-amber-50/80 to-orange-50/50 dark:from-amber-900/15 dark:to-orange-900/10 border border-amber-300/30 dark:border-amber-600/20'
                          : 'bg-warm-100/40 dark:bg-warm-700/20 hover:bg-warm-100/70 dark:hover:bg-warm-700/40'
                      }`}
                    >
                      {/* Rank */}
                      <div className="w-8 text-center">
                        <span className={`text-sm font-bold ${
                          idx === 0 ? 'text-brand-gold-dark dark:text-brand-gold' :
                          idx === 1 ? 'text-slate-500 dark:text-slate-300' :
                          idx === 2 ? 'text-amber-600 dark:text-amber-400' :
                          'text-warm-500 dark:text-warm-400'
                        }`}>
                          {getRankIcon(entry.rank)}
                        </span>
                      </div>

                      {/* Team */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                          style={{ backgroundColor: entry.color || '#94a3b8' }}
                        >
                          {entry.logo ? (
                            <img src={entry.logo} alt={entry.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[8px] font-black text-white/90">
                              {(entry.shortName || entry.name).slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-xs truncate text-warm-800 dark:text-warm-100">
                            {entry.name}
                          </p>
                          {entry.teamCode && (
                            <p className="text-[8px] font-mono text-warm-400 dark:text-warm-500">{entry.teamCode}</p>
                          )}
                        </div>
                      </div>

                      {/* Played */}
                      <div className="w-10 text-center">
                        <span className="text-xs font-semibold text-warm-600 dark:text-warm-300">{entry.played}</span>
                      </div>

                      {/* Wins */}
                      <div className="w-10 text-center">
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">{entry.wins}</span>
                      </div>

                      {/* Losses */}
                      <div className="w-10 text-center">
                        <span className="text-xs font-bold text-red-500 dark:text-red-400">{entry.losses}</span>
                      </div>

                      {/* Draws */}
                      <div className="w-10 text-center">
                        <span className="text-xs font-semibold text-warm-500 dark:text-warm-400">{entry.draws}</span>
                      </div>

                      {/* Score Diff */}
                      <div className="w-14 text-center">
                        <span className={`text-xs font-bold flex items-center justify-center gap-0.5 ${
                          entry.scoreDiff > 0 ? 'text-green-600 dark:text-green-400' :
                          entry.scoreDiff < 0 ? 'text-red-500 dark:text-red-400' :
                          'text-warm-500 dark:text-warm-400'
                        }`}>
                          {entry.scoreDiff > 0 ? <TrendingUp className="w-3 h-3" /> :
                           entry.scoreDiff < 0 ? <TrendingDown className="w-3 h-3" /> :
                           <Minus className="w-3 h-3" />}
                          {entry.scoreDiff > 0 ? '+' : ''}{entry.scoreDiff}
                        </span>
                      </div>

                      {/* Points */}
                      <div className="w-12 text-center">
                        <span className={`text-sm font-black ${
                          idx === 0 ? 'text-brand-gold-dark dark:text-brand-gold' :
                          idx === 1 ? 'text-slate-500 dark:text-slate-300' :
                          idx === 2 ? 'text-amber-600 dark:text-amber-400' :
                          'text-warm-700 dark:text-warm-200'
                        }`}>
                          {entry.points}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Points Legend */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4"
                >
                  <div className="flex items-center justify-center gap-4 text-[10px] text-warm-400 dark:text-warm-500">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Win = +2 pts
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Loss = -1 pt
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-warm-400" /> Draw = 0 pts
                    </span>
                  </div>
                </motion.div>
              </>
            )}

            {/* ═══ Unranked Teams (haven't played yet) ═══ */}
            {unranked.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowUnranked(!showUnranked)}
                  className="flex items-center gap-2 text-xs font-semibold text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-200 transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  {unranked.length} team{unranked.length !== 1 ? 's' : ''} yet to play
                  <ChevronDown className={`w-3 h-3 transition-transform ${showUnranked ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showUnranked && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 space-y-1.5 overflow-hidden"
                    >
                      {unranked.map((team) => (
                        <div
                          key={team.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-warm-100/30 dark:bg-warm-700/15 border border-warm-200/30 dark:border-warm-600/15"
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0 opacity-60"
                            style={{ backgroundColor: team.color || '#94a3b8' }}
                          >
                            {team.logo ? (
                              <img src={team.logo} alt={team.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[8px] font-black text-white/80">
                                {(team.shortName || team.name).slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs text-warm-500 dark:text-warm-400 truncate">
                              {team.name}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[9px] text-warm-400 dark:text-warm-500 border-warm-300 dark:border-warm-600">
                            No matches
                          </Badge>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <Shield className="w-12 h-12 text-warm-300 dark:text-warm-600 mb-3" />
            <p className="text-warm-600 dark:text-warm-300 text-sm font-medium">No teams ranked yet</p>
            <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
              Complete matches to see teams ranked here
            </p>
            <p className="text-warm-400 dark:text-warm-500 text-[10px] mt-2">
              Points: +2 per win, -1 per loss
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
