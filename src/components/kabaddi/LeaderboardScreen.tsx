'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Shield, Swords, Star, Lock, Crown, TrendingUp, TrendingDown, Users, Calendar, Award } from 'lucide-react';
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
}

export default function LeaderboardScreen({ onClose }: LeaderboardScreenProps) {
  const isPremium = useKabaddiStore((s) => s.currentUser?.isPremium) || false;
  const currentUser = useKabaddiStore((s) => s.currentUser);
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
      });
      const res = await fetch(`/api/leaderboard?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEntries(data.leaderboard || []);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [category, genderFilter, timePeriod]);

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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
                  LEADERBOARD
                </h1>
                <p className="text-[9px] text-warm-400 dark:text-warm-500 font-medium">Tournament matches only</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-600 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-500 transition-colors"
            >
              <X className="w-4 h-4" />
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
                      ? 'bg-brand-red text-white shadow-sm'
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
                      ? 'bg-brand-gold text-white'
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
                      <div className={`w-[100px] rounded-2xl p-3 ${getPodiumClass(2)}`}>
                        <div className="flex flex-col items-center text-center">
                          {/* Rank */}
                          <span className="text-2xl mb-1">{getRankIcon(2)}</span>
                          {/* Avatar */}
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
                      {/* Podium platform */}
                      <div className="w-[100px] h-16 rounded-b-lg bg-gradient-to-t from-slate-300/30 to-slate-200/20 dark:from-slate-500/30 dark:to-slate-600/20 border-t-2 border-slate-400/40 mt-1" />
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
                      <div className={`w-[120px] rounded-2xl p-3 ${getPodiumClass(1)} animate-shimmer-slow`}>
                        <div className="flex flex-col items-center text-center">
                          {/* Crown */}
                          <div className="mb-1">
                            <Crown className="w-6 h-6 text-brand-gold animate-float-gentle" />
                          </div>
                          {/* Avatar */}
                          <div className="relative mb-2">
                            <div className="w-16 h-16 rounded-full bg-warm-200 dark:bg-warm-600 border-2 border-yellow-400/60 flex items-center justify-center overflow-hidden shadow-lg shadow-brand-gold/20">
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
                          <p className="text-brand-gold-dark dark:text-brand-gold font-black text-2xl mt-1">
                            {podiumEntries[0].stat}
                          </p>
                          <p className="text-[9px] text-warm-400 dark:text-warm-500">{podiumEntries[0].statLabel}</p>
                        </div>
                      </div>
                      {/* Podium platform - tallest */}
                      <div className="w-[120px] h-24 rounded-b-lg bg-gradient-to-t from-yellow-500/20 to-yellow-400/10 dark:from-yellow-600/20 dark:to-yellow-500/10 border-t-2 border-brand-gold/50 mt-1" />
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
                      <div className={`w-[100px] rounded-2xl p-3 ${getPodiumClass(3)}`}>
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
                      {/* Podium platform - shortest */}
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
                      <Card className="bg-warm-100/60 dark:bg-warm-700/40 border-warm-200 dark:border-warm-600/30 py-0 gap-0 overflow-hidden hover:border-brand-gold/30 transition-colors">
                        <CardContent className="p-3 flex items-center gap-3">
                          {/* Rank */}
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-warm-200 dark:bg-warm-600">
                            <span className="text-sm font-bold text-warm-600 dark:text-warm-300">#{entry.rank}</span>
                          </div>

                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-warm-200 dark:bg-warm-600 border-2 border-warm-100 dark:border-warm-500 flex items-center justify-center overflow-hidden">
                              {entry.avatar ? (
                                <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-bold text-warm-500 dark:text-warm-300">
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
                                <span className="text-[9px] font-mono font-semibold text-brand-red bg-brand-red/10 px-1 py-0.5 rounded">
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
                              className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light rounded-full"
                            />
                          </div>

                          {/* Stat */}
                          <div className="text-right shrink-0">
                            <p className="font-black text-sm text-brand-gold-dark dark:text-brand-gold">
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
                  <Card className="bg-brand-gold/10 dark:bg-brand-gold/5 border-brand-gold/30 border py-0 gap-0">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-brand-gold/20">
                        <span className="text-sm font-bold text-brand-gold-dark dark:text-brand-gold">#{userEntry.rank}</span>
                      </div>
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-warm-200 dark:bg-warm-600 border-2 border-brand-gold/30 flex items-center justify-center overflow-hidden">
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
                          <span className="text-[10px] font-normal text-brand-gold ml-1.5">You</span>
                        </p>
                        <p className="text-xs text-warm-500 dark:text-warm-400 truncate">
                          {userEntry.teamNames[0] || 'No team'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-sm text-brand-gold-dark dark:text-brand-gold">
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
                    className="bg-gradient-to-r from-brand-gold/10 to-brand-gold/5 border-brand-gold/30 border py-0 gap-0 cursor-pointer"
                    onClick={() => setShowUpgrade(true)}
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-3">
                      <div className="flex items-center gap-2 text-brand-gold">
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
                        className="bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light text-white font-bold rounded-xl"
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
              <Trophy className="w-12 h-12 text-warm-300 dark:text-warm-600 mb-3" />
              <p className="text-warm-600 dark:text-warm-300 text-sm font-medium">No players found</p>
              <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
                Play tournament matches to see players ranked here
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
