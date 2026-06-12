'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Shield, Swords, Star, Users, Award, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import PremiumLock from './PremiumLock';

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

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Trophy; color: string; bgColor: string }> = {
  raid: { label: 'Raid', icon: Swords, color: 'text-brand-red', bgColor: 'bg-brand-red/10' },
  defense: { label: 'Defense', icon: Shield, color: 'text-brand-blue', bgColor: 'bg-brand-blue/10' },
  allround: { label: 'All-Round', icon: Star, color: 'text-brand-gold', bgColor: 'bg-brand-gold/10' },
  social: { label: 'Social', icon: Users, color: 'text-brand-teal', bgColor: 'bg-brand-teal/10' },
  milestone: { label: 'Milestones', icon: Trophy, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
};

const TIER_STYLES: Record<string, { border: string; bg: string; glow: string; label: string }> = {
  bronze: { border: 'border-amber-700/50', bg: 'bg-amber-900/10', glow: 'shadow-amber-900/20', label: 'Bronze' },
  silver: { border: 'border-slate-400/50', bg: 'bg-slate-200/10', glow: 'shadow-slate-400/20', label: 'Silver' },
  gold: { border: 'border-yellow-400/50', bg: 'bg-yellow-400/10', glow: 'shadow-yellow-400/20', label: 'Gold' },
  platinum: { border: 'border-cyan-300/50', bg: 'bg-cyan-300/10', glow: 'shadow-cyan-300/20', label: 'Platinum' },
};

export default function AchievementsScreen({ onClose }: { onClose: () => void }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || false;
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string>('raid');
  const [newlyUnlocked, setNewlyUnlocked] = useState<string[]>([]);

  const loadAchievements = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      // Check and unlock new achievements first
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

      // Then fetch all achievements
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

  // Group by category
  const categories = Object.keys(CATEGORY_CONFIG);
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = achievements.filter(a => a.category === cat);
    return acc;
  }, {} as Record<string, Achievement[]>);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 overflow-y-auto"
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
            <span className="text-white text-sm font-bold">{progressPercent}%</span>
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
            <Card className="bg-gradient-to-r from-brand-gold/20 to-brand-gold-dark/10 border-brand-gold/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🎉</span>
                <h3 className="font-bold text-warm-800">New Achievement{newlyUnlocked.length > 1 ? 's' : ''} Unlocked!</h3>
              </div>
              {newlyUnlocked.map((name, i) => (
                <p key={i} className="text-sm text-brand-gold-dark font-medium">✨ {name}</p>
              ))}
              <button
                onClick={() => setNewlyUnlocked([])}
                className="mt-2 text-xs text-warm-500 hover:text-warm-700"
              >
                Dismiss
              </button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-warm-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          categories.map(cat => {
            const catConfig = CATEGORY_CONFIG[cat];
            const catAchievements = grouped[cat] || [];
            const catUnlocked = catAchievements.filter(a => a.unlocked).length;
            const isExpanded = expandedCategory === cat;
            const CatIcon = catConfig.icon;

            return (
              <div key={cat}>
                <button
                  onClick={() => setExpandedCategory(isExpanded ? '' : cat)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-warm-100 hover:bg-warm-200 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${catConfig.bgColor} flex items-center justify-center`}>
                      <CatIcon className={`w-4 h-4 ${catConfig.color}`} />
                    </div>
                    <span className="font-semibold text-warm-800 text-sm">{catConfig.label}</span>
                    <Badge variant="secondary" className="text-[10px] bg-warm-200 text-warm-600 border-0">
                      {catUnlocked}/{catAchievements.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-warm-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-warm-500" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 space-y-2">
                        {catAchievements.map(achievement => {
                          const tierStyle = TIER_STYLES[achievement.tier] || TIER_STYLES.bronze;

                          return (
                            <motion.div
                              key={achievement.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`relative rounded-xl border ${
                                achievement.unlocked
                                  ? `${tierStyle.border} ${tierStyle.bg}`
                                  : 'border-warm-200 bg-warm-50'
                              } p-3`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
                                  achievement.unlocked ? 'bg-white/50' : 'bg-warm-100'
                                } ${!achievement.unlocked ? 'grayscale opacity-50' : ''}`}>
                                  {achievement.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-sm font-semibold ${
                                      achievement.unlocked ? 'text-warm-800' : 'text-warm-400'
                                    }`}>
                                      {achievement.name}
                                    </span>
                                    {achievement.unlocked && (
                                      <Badge className={`text-[8px] px-1 py-0 border-0 font-bold ${
                                        achievement.tier === 'platinum' ? 'bg-cyan-100 text-cyan-700' :
                                        achievement.tier === 'gold' ? 'bg-yellow-100 text-yellow-700' :
                                        achievement.tier === 'silver' ? 'bg-slate-100 text-slate-600' :
                                        'bg-amber-100 text-amber-700'
                                      }`}>
                                        {tierStyle.label}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className={`text-xs ${
                                    achievement.unlocked ? 'text-warm-600' : 'text-warm-400'
                                  }`}>
                                    {achievement.description}
                                  </p>
                                  {achievement.unlockedAt && (
                                    <p className="text-[10px] text-warm-400 mt-0.5">
                                      Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                {!achievement.unlocked && (
                                  <Lock className="w-4 h-4 text-warm-300" />
                                )}
                                {achievement.unlocked && (
                                  <Award className="w-4 h-4 text-brand-gold" />
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}

        {/* Premium CTA for non-premium users */}
        {!isPremium && !loading && (
          <PremiumLock feature="All Achievements">
            <Card className="p-4 bg-gradient-to-r from-brand-gold/10 to-brand-gold-dark/5 border-brand-gold/20">
              <div className="text-center">
                <Crown className="w-8 h-8 text-brand-gold mx-auto mb-2" />
                <h3 className="font-bold text-warm-800">Unlock All Achievements</h3>
                <p className="text-xs text-warm-500 mt-1">
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

// Import Crown here since it's used in the premium CTA
import { Crown } from 'lucide-react';
