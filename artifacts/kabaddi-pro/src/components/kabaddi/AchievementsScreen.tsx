'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Shield, Swords, Star, Users, Award, Lock, ChevronDown, ChevronUp, Crown, Target, Zap, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import PremiumLock from './PremiumLock';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  threshold: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

interface AchievementStats {
  successfulRaids: number;
  successfulTackles: number;
  superTackles: number;
  bonusPoints: number;
  matchCount: number;
  followerCount: number;
  motmCount: number;
}

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Trophy; color: string; bgColor: string }> = {
  raid: { label: 'Raid Master', icon: Swords, color: 'text-brand-red', bgColor: 'bg-brand-red/10' },
  defense: { label: 'Defense Wall', icon: Shield, color: 'text-brand-teal', bgColor: 'bg-brand-teal/10' },
  tournament: { label: 'Tournament Champion', icon: Trophy, color: 'text-brand-gold', bgColor: 'bg-brand-gold/10' },
  social: { label: 'Social Butterfly', icon: Users, color: 'text-brand-blue', bgColor: 'bg-brand-blue/10' },
  streak: { label: 'Streak Master', icon: Flame, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  allround: { label: 'All-Round', icon: Star, color: 'text-brand-gold', bgColor: 'bg-brand-gold/10' },
  milestone: { label: 'Milestones', icon: Target, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
};

const TIER_STYLES: Record<string, { border: string; bg: string; glow: string; label: string; isRare: boolean }> = {
  bronze: { border: 'border-amber-700/50', bg: 'bg-amber-900/10', glow: '', label: 'Bronze', isRare: false },
  silver: { border: 'border-slate-400/50', bg: 'bg-slate-200/10', glow: '', label: 'Silver', isRare: false },
  gold: { border: 'border-yellow-400/50', bg: 'bg-yellow-400/10', glow: '', label: 'Gold', isRare: false },
  platinum: { border: 'border-cyan-300/50', bg: 'bg-cyan-300/10', glow: 'achievement-rare-glow', label: 'Platinum', isRare: true },
};

// ─── Achievement Progress Calculation ─────────────────────────────────────────

function getAchievementProgress(achievement: Achievement, stats: AchievementStats | null): number {
  if (achievement.unlocked) return achievement.threshold;
  if (!stats) return 0;

  const key = achievement.key;
  switch (key) {
    case 'first_raid_point': return Math.min(stats.successfulRaids, 1);
    case 'century': return Math.min(stats.successfulRaids + stats.successfulTackles + stats.bonusPoints, 100);
    case 'super_raider': return Math.min(Math.floor(stats.successfulRaids / 5), 5);
    case 'iron_wall': return Math.min(stats.superTackles, 10);
    case 'tournament_winner': return 0; // Can't determine from stats alone
    case 'consistent_player': return Math.min(stats.matchCount, 10);
    case 'team_player': return 0;
    case 'predictor': return 0;
    case 'social_star': return Math.min(stats.followerCount, 10);
    case 'streak_5': return 0;
    default: return 0;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AchievementsScreen({ onClose }: { onClose: () => void }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || currentUser?.isAdmin || false;
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('raid');
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);

  const loadAchievements = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const checkRes = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.newlyUnlocked?.length > 0) {
          setNewlyUnlocked(checkData.newlyUnlocked);
        }
      }

      const res = await fetch(`/api/achievements?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setAchievements(data.achievements || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to load achievements:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadAchievements();
  }, [loadAchievements]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const achievementPoints = achievements.filter(a => a.unlocked).reduce((sum, a) => {
    switch (a.tier) {
      case 'bronze': return sum + 10;
      case 'silver': return sum + 25;
      case 'gold': return sum + 50;
      case 'platinum': return sum + 100;
      default: return sum + 10;
    }
  }, 0);

  // Group by category
  const categories = Object.keys(CATEGORY_CONFIG).filter(cat =>
    achievements.some(a => a.category === cat)
  );
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = achievements.filter(a => a.category === cat);
    return acc;
  }, {} as Record<string, Achievement[]>);

  // Recent unlocks (last 3)
  const recentUnlocks = useMemo(() => {
    return achievements
      .filter(a => a.unlocked && a.unlockedAt)
      .sort((a, b) => new Date(b.unlockedAt!).getTime() - new Date(a.unlockedAt!).getTime())
      .slice(0, 3);
  }, [achievements]);

  // Next achievement (closest to unlock)
  const nextAchievement = useMemo(() => {
    const locked = achievements
      .filter(a => !a.unlocked)
      .map(a => ({
        ...a,
        progress: getAchievementProgress(a, stats),
        progressPercent: a.threshold > 0 ? (getAchievementProgress(a, stats) / a.threshold) * 100 : 0,
      }))
      .sort((a, b) => b.progressPercent - a.progressPercent);
    return locked[0] || null;
  }, [achievements, stats]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-800 overflow-y-auto custom-scrollbar"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">Achievements</h1>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/80 text-sm font-medium">
              {unlockedCount} / {totalCount} Unlocked
            </span>
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-[11px]">🏆 {achievementPoints} pts</span>
              <span className="text-white text-sm font-bold">{progressPercent}%</span>
            </div>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-white rounded-full"
            />
          </div>
        </div>
      </div>

      {/* New Unlock Celebration */}
      <AnimatePresence>
        {newlyUnlocked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-4 mt-4"
          >
            <Card className="bg-gradient-to-r from-brand-gold/20 to-brand-gold-dark/10 border-brand-gold/30 p-4 animate-shimmer-slow">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎉</span>
                <h3 className="font-bold text-warm-800 dark:text-warm-100">New Achievement{newlyUnlocked.length > 1 ? 's' : ''} Unlocked!</h3>
              </div>
              {newlyUnlocked.map((name, i) => (
                <p key={i} className="text-sm text-brand-gold-dark dark:text-brand-gold font-medium">✨ {name}</p>
              ))}
              <button
                onClick={() => setNewlyUnlocked([])}
                className="mt-2 text-xs text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-200"
              >
                Dismiss
              </button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Summary */}
      {!loading && achievements.length > 0 && (
        <div className="px-4 pt-4">
          <div className="grid grid-cols-3 gap-2">
            {/* Total Unlocked */}
            <Card className="bg-warm-100/60 dark:bg-warm-700/40 border-warm-200 dark:border-warm-600/30 py-0 gap-0">
              <CardContent className="p-3 text-center">
                <p className="text-brand-gold-dark dark:text-brand-gold font-black text-xl">{unlockedCount}</p>
                <p className="text-[10px] text-warm-500 dark:text-warm-400 font-medium">Unlocked</p>
              </CardContent>
            </Card>

            {/* Achievement Points */}
            <Card className="bg-warm-100/60 dark:bg-warm-700/40 border-warm-200 dark:border-warm-600/30 py-0 gap-0">
              <CardContent className="p-3 text-center">
                <p className="text-brand-red dark:text-brand-red-light font-black text-xl">{achievementPoints}</p>
                <p className="text-[10px] text-warm-500 dark:text-warm-400 font-medium">Points</p>
              </CardContent>
            </Card>

            {/* Remaining */}
            <Card className="bg-warm-100/60 dark:bg-warm-700/40 border-warm-200 dark:border-warm-600/30 py-0 gap-0">
              <CardContent className="p-3 text-center">
                <p className="text-purple-500 dark:text-purple-400 font-black text-xl">{totalCount - unlockedCount}</p>
                <p className="text-[10px] text-warm-500 dark:text-warm-400 font-medium">Remaining</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Unlocks */}
          {recentUnlocks.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-2">Recent Unlocks</p>
              <div className="flex gap-2">
                {recentUnlocks.map(a => (
                  <div key={a.id} className="flex items-center gap-1.5 bg-brand-gold/10 dark:bg-brand-gold/5 border border-brand-gold/20 rounded-lg px-2 py-1">
                    <span className="text-sm">{a.icon}</span>
                    <span className="text-[10px] font-medium text-warm-700 dark:text-warm-200 truncate max-w-[80px]">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Achievement */}
          {nextAchievement && (
            <div className="mt-3">
              <Card className="bg-gradient-to-r from-purple-500/10 to-brand-gold/5 border-purple-500/20 py-0 gap-0">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Next Achievement</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-lg shrink-0">
                      {nextAchievement.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">{nextAchievement.name}</p>
                      <p className="text-[11px] text-warm-500 dark:text-warm-400">{nextAchievement.description}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-warm-200 dark:bg-warm-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-brand-gold rounded-full"
                            style={{ width: `${Math.min(nextAchievement.progressPercent, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400">
                          {getAchievementProgress(nextAchievement, stats)}/{nextAchievement.threshold}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Category Tabs */}
      {!loading && (
        <div className="flex gap-1.5 px-4 pt-4 pb-2 overflow-x-auto custom-scrollbar">
          {categories.map(cat => {
            const catConfig = CATEGORY_CONFIG[cat];
            if (!catConfig) return null;
            const CatIcon = catConfig.icon;
            const catAchievements = grouped[cat] || [];
            const catUnlocked = catAchievements.filter(a => a.unlocked).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  activeCategory === cat
                    ? `${catConfig.bgColor} ${catConfig.color} border border-current/20 shadow-sm`
                    : 'bg-warm-100 dark:bg-warm-700 text-warm-500 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-600 border border-transparent'
                }`}
              >
                <CatIcon className="w-3.5 h-3.5" />
                {catConfig.label}
                <Badge variant="secondary" className={`text-[9px] px-1 py-0 border-0 ${
                  activeCategory === cat
                    ? 'bg-white/30 dark:bg-white/10 text-current'
                    : 'bg-warm-200 dark:bg-warm-600 text-warm-500 dark:text-warm-400'
                }`}>
                  {catUnlocked}/{catAchievements.length}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-2 pb-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-warm-100 dark:bg-warm-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-2 gap-3"
            >
              {(grouped[activeCategory] || []).map((achievement, idx) => {
                const tierStyle = TIER_STYLES[achievement.tier] || TIER_STYLES.bronze;
                const progress = getAchievementProgress(achievement, stats);
                const progressPct = achievement.threshold > 0 ? Math.min((progress / achievement.threshold) * 100, 100) : 0;

                return (
                  <motion.div
                    key={achievement.id}
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: idx * 0.06, type: 'spring', damping: 20, stiffness: 240 }}
                    className={`relative rounded-xl border p-3 ${
                      achievement.unlocked
                        ? tierStyle.isRare
                          ? `achievement-unlocked ${tierStyle.glow}`
                          : `achievement-unlocked ${tierStyle.bg} ${tierStyle.border}`
                        : 'border-warm-200 dark:border-warm-600/30 bg-warm-50 dark:bg-warm-700/30 achievement-locked'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-2 ${
                        achievement.unlocked
                          ? 'bg-white/50 dark:bg-white/10'
                          : 'bg-warm-100 dark:bg-warm-600'
                      } ${!achievement.unlocked ? 'grayscale opacity-50' : ''}`}>
                        {achievement.icon}
                      </div>

                      {/* Title */}
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className={`text-xs font-bold ${
                          achievement.unlocked ? 'text-warm-800 dark:text-warm-100' : 'text-warm-400 dark:text-warm-500'
                        }`}>
                          {achievement.name}
                        </span>
                      </div>

                      {/* Tier badge */}
                      {achievement.unlocked && (
                        <Badge className={`text-[8px] px-1.5 py-0 border-0 font-bold mb-1 ${
                          achievement.tier === 'platinum' ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300' :
                          achievement.tier === 'gold' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                          achievement.tier === 'silver' ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' :
                          'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        }`}>
                          {tierStyle.label}
                        </Badge>
                      )}

                      {/* Description */}
                      <p className={`text-[10px] leading-tight mb-2 ${
                        achievement.unlocked ? 'text-warm-600 dark:text-warm-300' : 'text-warm-400 dark:text-warm-500'
                      }`}>
                        {achievement.description}
                      </p>

                      {/* Progress bar */}
                      {!achievement.unlocked && (
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-warm-400 dark:text-warm-500 font-medium">Progress</span>
                            <span className="text-[9px] font-bold text-warm-500 dark:text-warm-400">{progress}/{achievement.threshold}</span>
                          </div>
                          <div className="h-1.5 bg-warm-200 dark:bg-warm-600 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPct}%` }}
                              transition={{ duration: 0.8, delay: 0.2 + idx * 0.05, ease: 'easeOut' }}
                              className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light dark:from-brand-gold-dark dark:to-brand-gold rounded-full"
                            />
                          </div>
                        </div>
                      )}

                      {/* Unlocked date */}
                      {achievement.unlocked && achievement.unlockedAt && (
                        <p className="text-[9px] text-warm-400 dark:text-warm-500 mt-1">
                          Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                        </p>
                      )}

                      {/* Lock icon overlay */}
                      {!achievement.unlocked && (
                        <div className="absolute top-2 right-2">
                          <Lock className="w-3.5 h-3.5 text-warm-300 dark:text-warm-500" />
                        </div>
                      )}

                      {/* Award icon for unlocked */}
                      {achievement.unlocked && (
                        <div className="absolute top-2 right-2">
                          <Award className="w-3.5 h-3.5 text-brand-gold" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Premium CTA for non-premium users */}
        {!isPremium && !loading && (
          <PremiumLock feature="All Achievements">
            <Card className="p-4 bg-gradient-to-r from-brand-gold/10 to-brand-gold-dark/5 border-brand-gold/20 dark:from-brand-gold/5 dark:to-brand-gold-dark/5 dark:border-brand-gold/10 mt-4">
              <div className="text-center">
                <Crown className="w-8 h-8 text-brand-gold mx-auto mb-2" />
                <h3 className="font-bold text-warm-800 dark:text-warm-100">Unlock All Achievements</h3>
                <p className="text-xs text-warm-500 dark:text-warm-400 mt-1">
                  Go Premium to see detailed progress and all achievement tiers
                </p>
              </div>
            </Card>
          </PremiumLock>
        )}
      </div>
    </motion.div>
  );
}
