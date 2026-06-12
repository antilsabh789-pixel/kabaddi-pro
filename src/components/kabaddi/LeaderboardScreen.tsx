'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Shield, Swords, Star, Lock, Crown } from 'lucide-react';
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

type Category = 'raiders' | 'defenders' | 'allrounders' | 'mvp';
type GenderFilter = 'all' | 'male' | 'female';

const CATEGORIES: { id: Category; label: string; icon: typeof Swords }[] = [
  { id: 'raiders', label: 'Raiders', icon: Swords },
  { id: 'defenders', label: 'Defenders', icon: Shield },
  { id: 'allrounders', label: 'All-rounders', icon: Star },
  { id: 'mvp', label: 'MVP', icon: Trophy },
];

const GENDER_FILTERS: { id: GenderFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'male', label: '♂ Boys' },
  { id: 'female', label: '♀ Girls' },
];

interface LeaderboardScreenProps {
  onClose: () => void;
}

export default function LeaderboardScreen({ onClose }: LeaderboardScreenProps) {
  const isPremium = useKabaddiStore((s) => s.currentUser?.isPremium) || false;
  const [category, setCategory] = useState<Category>('raiders');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category,
        gender: genderFilter,
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
  }, [category, genderFilter]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          bg: 'bg-gradient-to-r from-yellow-400/20 to-yellow-600/10',
          border: 'border-yellow-500/40',
          text: 'text-yellow-600',
          badge: 'bg-yellow-500 text-white',
          icon: '🥇',
        };
      case 2:
        return {
          bg: 'bg-gradient-to-r from-slate-300/20 to-slate-400/10',
          border: 'border-slate-400/40',
          text: 'text-slate-500',
          badge: 'bg-slate-400 text-white',
          icon: '🥈',
        };
      case 3:
        return {
          bg: 'bg-gradient-to-r from-amber-600/20 to-amber-700/10',
          border: 'border-amber-600/40',
          text: 'text-amber-700',
          badge: 'bg-amber-600 text-white',
          icon: '🥉',
        };
      default:
        return {
          bg: 'bg-warm-100',
          border: 'border-warm-300',
          text: 'text-warm-600',
          badge: 'bg-warm-300 text-warm-700',
          icon: '',
        };
    }
  };

  // Free users see top 3, rest locked
  const visibleEntries = isPremium ? entries : entries.slice(0, 3);
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
        className="fixed inset-0 z-50 bg-warm-50 flex flex-col"
      >
        {/* Header */}
        <header className="sticky top-0 z-10 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center">
                <Trophy className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-base font-black tracking-wider text-warm-800">
                  LEADERBOARD
                </h1>
                <p className="text-[9px] text-warm-400 font-medium">Tournament matches only</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
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
                      : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Gender Filter Pills */}
          <div className="flex items-center gap-2 px-4 pb-3">
            {GENDER_FILTERS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGenderFilter(g.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  genderFilter === g.id
                    ? 'bg-warm-800 text-warm-50'
                    : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </header>

        {/* Leaderboard List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-warm-100 animate-pulse" />
              ))}
            </div>
          ) : visibleEntries.length > 0 ? (
            <motion.div
              className="flex flex-col gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.05 }}
            >
              {visibleEntries.map((entry) => {
                const style = getRankStyle(entry.rank);
                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: entry.rank * 0.04 }}
                  >
                    <Card className={`${style.bg} ${style.border} border py-0 gap-0 overflow-hidden`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        {/* Rank */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                          {entry.rank <= 3 ? (
                            <span className="text-lg">{style.icon}</span>
                          ) : (
                            <span className={`text-sm font-bold ${style.text}`}>
                              #{entry.rank}
                            </span>
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-warm-200 border-2 border-warm-100 flex items-center justify-center overflow-hidden">
                            {entry.avatar ? (
                              <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-warm-500">
                                {entry.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          {entry.rank === 1 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-gold flex items-center justify-center">
                              <Crown className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Name & Team */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm truncate ${
                            entry.rank <= 3 ? 'text-warm-800' : 'text-warm-700'
                          }`}>
                            {entry.name}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {entry.playerCode && (
                              <span className="text-[9px] font-mono font-semibold text-indigo-500 bg-indigo-500/10 px-1 py-0.5 rounded">
                                {entry.playerCode}
                              </span>
                            )}
                            <p className="text-xs text-warm-500 truncate">
                              {entry.teamNames.length > 0
                                ? entry.teamNames.join(', ')
                                : 'No team'}
                            </p>
                          </div>
                        </div>

                        {/* Stat */}
                        <div className="text-right shrink-0">
                          <p className={`font-black text-sm ${
                            entry.rank <= 3 ? 'text-brand-gold-dark' : 'text-warm-700'
                          }`}>
                            {entry.stat}
                          </p>
                          <p className="text-[10px] text-warm-400">{entry.statLabel}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}

              {/* Premium Lock for Free Users */}
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
                      <p className="text-sm font-bold text-warm-800">
                        {lockedCount} more players ranked
                      </p>
                      <p className="text-xs text-warm-500 text-center">
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
              <Trophy className="w-12 h-12 text-warm-300 mb-3" />
              <p className="text-warm-600 text-sm font-medium">No players found</p>
              <p className="text-warm-400 text-xs mt-1">
                Play tournament matches to see players ranked here
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
