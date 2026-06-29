'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Shield, Swords, Star, Lock, Crown, TrendingUp, TrendingDown, Users, Calendar, Award, Dumbbell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  playerCode: string | null;
  teamNames: string[];
  stat: number;
  statLabel: string;
}

type Category = 'raiders' | 'defenders' | 'allrounders' | 'matches' | 'rating';
type TabMode = 'tournament' | 'practice';
type GenderFilter = 'all' | 'male' | 'female';
type TimePeriod = 'week' | 'month' | 'alltime';

const CATEGORIES: { id: Category; label: string; icon: typeof Swords }[] = [
  { id: 'raiders', label: 'Raiders', icon: Swords },
  { id: 'defenders', label: 'Defenders', icon: Shield },
  { id: 'allrounders', label: 'All-Rounders', icon: Star },
  { id: 'matches', label: 'Matches', icon: Calendar },
  { id: 'rating', label: 'Rating', icon: Award },
];

const GENDER_FILTERS: { id: GenderFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'male', label: '♂ Boys' },
  { id: 'female', label: '♀ Girls' },
];

const TIME_PERIODS: { id: TimePeriod; label: string }[] = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'alltime', label: 'All Time' },
];

interface LeaderboardScreenProps {
  onClose: () => void;
  onViewPlayer?: (userId: string) => void;
}

export default function LeaderboardScreen({ onClose, onViewPlayer }: LeaderboardScreenProps) {
  const isPremium = useKabaddiStore((s) => s.currentUser?.isPremium) || useKabaddiStore((s) => s.currentUser?.isAdmin) || false;
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const [tabMode, setTabMode] = useState<TabMode>('tournament');
  const [category, setCategory] = useState<Category>('raiders');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('alltime');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        gender: genderFilter,
        period: timePeriod,
        limit: '20',
        mode: tabMode,
      });
      const res = await fetch(`/api/leaderboard?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [category, genderFilter, timePeriod, tabMode]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Podium entries (top 3)
  const podiumEntries = entries.slice(0, 3);
  // List entries (4+)
  const listEntries = entries.slice(3);

  // Find current user in entries
  const userEntry = currentUser ? entries.find(e => e.userId === currentUser.id) : null;
  const isUserInTop10 = userEntry && userEntry.rank <= 10;

  const getPodiumClass = (rank: number) => {
    switch (rank) {
      case 1: return 'podium-gold gradient-border-gold';
      case 2: return 'podium-silver gradient-border-silver';
      case 3: return 'podium-bronze gradient-border-bronze';
      default: return '';
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getMaxStat = () => {
    if (entries.length === 0) return 1;
    return Math.max(...entries.map(e => e.stat), 1);
  };

  // Free users see top 3 + locked indicator
  const visibleListEntries = isPremium ? listEntries : [];
  const lockedCount = !isPremium ? Math.max(0, entries.length - 3) : 0;

  const isTournament = tabMode === 'tournament';
  const accentColor = isTournament ? 'brand-gold' : 'emerald';
  const modeLabel = isTournament ? 'Tournament' : 'Practice';
  const modeIcon = isTournament ? '🏆' : '🏋️';

  return (
    <AnimatePresence>
      {showUpgrade && (
        <PremiumUpgradeScreen
          onClose={() => setShowUpgrade(false)}
          feature="Full Leaderboard"
        />
      )}
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
              <div className={`w-8 h-8 rounded-lg ${isTournament ? 'bg-gradient-to-br from-brand-gold to-brand-gold-dark' : 'bg-gradient-to-br from-emerald-400 to-teal-500'} flex items-center justify-center`}>
                {isTournament ? (
                  <Trophy className="w-4 h-4 text-white" />
                ) : (
                  <Dumbbell className="w-4 h-4 text-white" />
                )}
              </div>
              <div>
                <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
                  LEADERBOARD
                </h1>
                <p className={`text-[9px] font-medium ${isTournament ? 'text-brand-gold-dark dark:text-brand-gold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {modeIcon} {modeLabel} matches only
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

          {/* Tournament / Practice Tab Toggle */}
          <div className="flex gap-1 px-4 pb-2">
            <button
              onClick={() => setTabMode('tournament')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                tabMode === 'tournament'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-md'
                  : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Tournament
              <span className="text-[9px] font-normal opacity-80">🏆 Counts</span>
            </button>
            <button
              onClick={() => setTabMode('practice')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                tabMode === 'practice'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md'
                  : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
              }`}
            >
              <Dumbbell className="w-3.5 h-3.5" />
              Practice
              <span className="text-[9px] font-normal opacity-80">🏋️ Training</span>
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 px-4 pb-2 overflow-x-auto custom-scrollbar">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                    category === cat.id
                      ? isTournament
                        ? 'bg-brand-red text-white shadow-sm'
                        : 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-3 px-4 pb-3">
            {/* Gender Filter */}
            <div className="flex items-center gap-1.5">
              {GENDER_FILTERS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenderFilter(g.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    genderFilter === g.id
                      ? 'bg-warm-800 dark:bg-warm-200 text-warm-50 dark:text-warm-800'
                      : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-600'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Time Period */}
            <div className="flex items-center gap-1.5 ml-auto">
              {TIME_PERIODS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTimePeriod(t.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                    timePeriod === t.id
                      ? isTournament
                        ? 'bg-brand-gold text-white'
                        : 'bg-emerald-500 text-white'
                      : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Leaderboard Content */}
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
                      <div className={`w-[100px] rounded-2xl p-3 ${getPodiumClass(2)} cursor-pointer`} onClick={() => onViewPlayer?.(podiumEntries[1].userId)}>
                        <div className="flex flex-col items-center text-center">
                          <span className="text-2xl mb-1">{getRankIcon(2)}</span>
                          <div className="relative mb-2">
                            <div className="w-14 h-14 rounded-full bg-warm-200 dark:bg-warm-600 border-2 border-slate-400/40 flex items-center justify-center overflow-hidden">
                              {podiumEntries[1].avatar ? (
                                <img src={podiumEntries[1].avatar} alt={podiumEntries[1].name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg font-bold text-warm-500 dark:text-warm-300">
                                  {podiumEntries[1].name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate w-full">
                            {podiumEntries[1].name}
                          </p>
                          <p className="text-[9px] text-warm-500 dark:text-warm-400 truncate w-full">
                            {podiumEntries[1].teamNames[0] || 'No team'}
                          </p>
                          <p className="text-slate-500 dark:text-slate-300 font-black text-lg mt-1">
                            {podiumEntries[1].stat}
                          </p>
                          <p className="text-[9px] text-warm-400 dark:text-warm-500">{podiumEntries[1].statLabel}</p>
                        </div>
                      </div>
                      <div className={`w-[100px] h-16 rounded-b-lg ${isTournament ? 'bg-gradient-to-t from-slate-300/30 to-slate-200/20 dark:from-slate-500/30 dark:to-slate-600/20 border-t-2 border-slate-400/40' : 'bg-gradient-to-t from-emerald-300/30 to-emerald-200/20 dark:from-emerald-500/30 dark:to-emerald-600/20 border-t-2 border-emerald-400/40'} mt-1`} />
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
                      <div className={`w-[120px] rounded-2xl p-3 ${getPodiumClass(1)} animate-shimmer-slow cursor-pointer`} onClick={() => onViewPlayer?.(podiumEntries[0].userId)}>
                        <div className="flex flex-col items-center text-center">
                          <div className="mb-1">
                            <Crown className={`w-6 h-6 ${isTournament ? 'text-brand-gold' : 'text-emerald-400'} animate-float-gentle`} />
                          </div>
                          <div className="relative mb-2">
                            <div className={`w-16 h-16 rounded-full bg-warm-200 dark:bg-warm-600 border-2 ${isTournament ? 'border-yellow-400/60 shadow-lg shadow-brand-gold/20' : 'border-emerald-400/60 shadow-lg shadow-emerald-400/20'} flex items-center justify-center overflow-hidden`}>
                              {podiumEntries[0].avatar ? (
                                <img src={podiumEntries[0].avatar} alt={podiumEntries[0].name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xl font-bold text-warm-500 dark:text-warm-300">
                                  {podiumEntries[0].name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-lg">🥇</span>
                          </div>
                          <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate w-full">
                            {podiumEntries[0].name}
                          </p>
                          <p className="text-[9px] text-warm-500 dark:text-warm-400 truncate w-full">
                            {podiumEntries[0].teamNames[0] || 'No team'}
                          </p>
                          <p className={`font-black text-2xl mt-1 ${isTournament ? 'text-brand-gold-dark dark:text-brand-gold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {podiumEntries[0].stat}
                          </p>
                          <p className="text-[9px] text-warm-400 dark:text-warm-500">{podiumEntries[0].statLabel}</p>
                        </div>
                      </div>
                      <div className={`w-[120px] h-24 rounded-b-lg ${isTournament ? 'bg-gradient-to-t from-yellow-500/20 to-yellow-400/10 dark:from-yellow-600/20 dark:to-yellow-500/10 border-t-2 border-brand-gold/50' : 'bg-gradient-to-t from-emerald-500/20 to-emerald-400/10 dark:from-emerald-600/20 dark:to-emerald-500/10 border-t-2 border-emerald-400/50'} mt-1`} />
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
                      <div className={`w-[100px] rounded-2xl p-3 ${getPodiumClass(3)} cursor-pointer`} onClick={() => onViewPlayer?.(podiumEntries[2].userId)}>
                        <div className="flex flex-col items-center text-center">
                          <span className="text-2xl mb-1">{getRankIcon(3)}</span>
                          <div className="relative mb-2">
                            <div className="w-14 h-14 rounded-full bg-warm-200 dark:bg-warm-600 border-2 border-amber-600/40 flex items-center justify-center overflow-hidden">
                              {podiumEntries[2].avatar ? (
                                <img src={podiumEntries[2].avatar} alt={podiumEntries[2].name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg font-bold text-warm-500 dark:text-warm-300">
                                  {podiumEntries[2].name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate w-full">
                            {podiumEntries[2].name}
                          </p>
                          <p className="text-[9px] text-warm-500 dark:text-warm-400 truncate w-full">
                            {podiumEntries[2].teamNames[0] || 'No team'}
                          </p>
                          <p className="text-amber-700 dark:text-amber-500 font-black text-lg mt-1">
                            {podiumEntries[2].stat}
                          </p>
                          <p className="text-[9px] text-warm-400 dark:text-warm-500">{podiumEntries[2].statLabel}</p>
                        </div>
                      </div>
                      <div className="w-[100px] h-12 rounded-b-lg bg-gradient-to-t from-amber-600/20 to-amber-500/10 dark:from-amber-700/20 dark:to-amber-600/10 border-t-2 border-amber-600/40 mt-1" />
                    </motion.div>
                  )}
                </div>
              )}

              {/* ═══ List (4+) ═══ */}
              {visibleListEntries.length > 0 && (
                <div className="space-y-2">
                  {visibleListEntries.map((entry, idx) => (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                    >
                      <Card className={`border-warm-200 dark:border-warm-600/30 py-0 gap-0 overflow-hidden transition-colors cursor-pointer ${isTournament ? 'bg-warm-100/60 dark:bg-warm-700/40 hover:border-brand-gold/30' : 'bg-emerald-50/40 dark:bg-emerald-900/10 hover:border-emerald-400/30'}`} onClick={() => onViewPlayer?.(entry.userId)}>
                        <CardContent className="p-3 flex items-center gap-3">
                          {/* Rank */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isTournament ? 'bg-warm-200 dark:bg-warm-600' : 'bg-emerald-100 dark:bg-emerald-800/40'}`}>
                            <span className={`text-sm font-bold ${isTournament ? 'text-warm-600 dark:text-warm-300' : 'text-emerald-700 dark:text-emerald-300'}`}>#{entry.rank}</span>
                          </div>

                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isTournament ? 'bg-warm-200 dark:bg-warm-600 border-2 border-warm-100 dark:border-warm-500' : 'bg-emerald-100 dark:bg-emerald-800/40 border-2 border-emerald-200 dark:border-emerald-700'}`}>
                              {entry.avatar ? (
                                <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className={`text-sm font-bold ${isTournament ? 'text-warm-500 dark:text-warm-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                                  {entry.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Name & Team */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate text-warm-800 dark:text-warm-100">
                              {entry.name}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {entry.playerCode && (
                                <span className={`text-[9px] font-mono font-semibold px-1 py-0.5 rounded ${isTournament ? 'text-brand-red bg-brand-red/10' : 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-800/40'}`}>
                                  {entry.playerCode}
                                </span>
                              )}
                              <p className="text-xs text-warm-500 dark:text-warm-400 truncate">
                                {entry.teamNames.length > 0
                                  ? entry.teamNames.join(', ')
                                  : 'No team'}
                              </p>
                            </div>
                          </div>

                          {/* Stats bar visualization */}
                          <div className="w-14 h-1.5 bg-warm-200 dark:bg-warm-600 rounded-full overflow-hidden shrink-0 hidden sm:block">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(entry.stat / getMaxStat()) * 100}%` }}
                              transition={{ duration: 0.6, delay: idx * 0.05, ease: 'easeOut' }}
                              className={`h-full rounded-full ${isTournament ? 'bg-gradient-to-r from-brand-gold to-brand-gold-light' : 'bg-gradient-to-r from-emerald-400 to-teal-400'}`}
                            />
                          </div>

                          {/* Stat */}
                          <div className="text-right shrink-0">
                            <p className={`font-black text-sm ${isTournament ? 'text-brand-gold-dark dark:text-brand-gold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {entry.stat}
                            </p>
                            <p className="text-[10px] text-warm-400 dark:text-warm-500">{entry.statLabel}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* ═══ User's own card (if not in top 10) ═══ */}
              {userEntry && !isUserInTop10 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-2"
                >
                  <Card className={`border py-0 gap-0 ${isTournament ? 'bg-brand-gold/10 dark:bg-brand-gold/5 border-brand-gold/30' : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-400/30'}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isTournament ? 'bg-brand-gold/20' : 'bg-emerald-100 dark:bg-emerald-800/30'}`}>
                        <span className={`text-sm font-bold ${isTournament ? 'text-brand-gold-dark dark:text-brand-gold' : 'text-emerald-700 dark:text-emerald-300'}`}>#{userEntry.rank}</span>
                      </div>
                      <div className="relative shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${isTournament ? 'bg-warm-200 dark:bg-warm-600 border-2 border-brand-gold/30' : 'bg-emerald-100 dark:bg-emerald-800/40 border-2 border-emerald-400/30'}`}>
                          {userEntry.avatar ? (
                            <img src={userEntry.avatar} alt={userEntry.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-warm-500 dark:text-warm-300">
                              {userEntry.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate text-warm-800 dark:text-warm-100">
                          {userEntry.name}
                          <span className={`text-[10px] font-normal ml-1.5 ${isTournament ? 'text-brand-gold' : 'text-emerald-600 dark:text-emerald-400'}`}>You</span>
                        </p>
                        <p className="text-xs text-warm-500 dark:text-warm-400 truncate">
                          {userEntry.teamNames[0] || 'No team'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-black text-sm ${isTournament ? 'text-brand-gold-dark dark:text-brand-gold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {userEntry.stat}
                        </p>
                        <p className="text-[10px] text-warm-400 dark:text-warm-500">{userEntry.statLabel}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ═══ Premium Lock for Free Users ═══ */}
              {lockedCount > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-2"
                >
                  <Card
                    className={`border py-0 gap-0 cursor-pointer ${isTournament ? 'bg-gradient-to-r from-brand-gold/10 to-brand-gold/5 border-brand-gold/30' : 'bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border-emerald-400/30'}`}
                    onClick={() => setShowUpgrade(true)}
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-3">
                      <div className={`flex items-center gap-2 ${isTournament ? 'text-brand-gold' : 'text-emerald-500'}`}>
                        <Lock className="w-5 h-5" />
                        <Crown className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-warm-800 dark:text-warm-100">
                        {lockedCount} more players ranked
                      </p>
                      <p className="text-xs text-warm-500 dark:text-warm-400 text-center">
                        Upgrade to Premium to see the full leaderboard
                      </p>
                      <Button
                        size="sm"
                        className={`font-bold rounded-xl ${isTournament ? 'bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light text-white' : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowUpgrade(true);
                        }}
                      >
                        <Crown className="w-3.5 h-3.5 mr-1" />
                        Unlock Full Leaderboard
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              {isTournament ? (
                <Trophy className="w-12 h-12 text-warm-300 dark:text-warm-600 mb-3" />
              ) : (
                <Dumbbell className="w-12 h-12 text-warm-300 dark:text-warm-600 mb-3" />
              )}
              <p className="text-warm-600 dark:text-warm-300 text-sm font-medium">No players found</p>
              <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
                {isTournament
                  ? 'Play tournament matches to see players ranked here'
                  : 'Play practice matches to see training stats here'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
