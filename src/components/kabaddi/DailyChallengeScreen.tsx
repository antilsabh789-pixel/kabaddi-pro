'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Flame,
  Trophy,
  Star,
  Zap,
  Shield,
  Swords,
  Heart,
  Users,
  Clock,
  CheckCircle2,
  Lock,
  Crown,
  Target,
  ChevronRight,
  Sparkles,
  Medal,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

// ─── Types ────────────────────────────────────────────────────────

interface DailyChallengeScreenProps {
  onClose: () => void;
}

type Difficulty = 'Easy' | 'Medium' | 'Hard';
type ChallengeCategory = 'raid' | 'defense' | 'fitness' | 'teamwork';

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  category: ChallengeCategory;
  currentProgress: number;
  targetProgress: number;
  rewardXP: number;
  rewardBadge: string | null;
  isCompleted: boolean;
  isLocked: boolean;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  avatar: string | null;
  points: number;
  isCurrentUser: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<Difficulty, { color: string; bg: string; darkBg: string; border: string }> = {
  Easy: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', darkBg: 'dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
  Medium: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', darkBg: 'dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
  Hard: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', darkBg: 'dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
};

const CATEGORY_CONFIG: Record<ChallengeCategory, { icon: typeof Swords; label: string; color: string; bgColor: string }> = {
  raid: { icon: Swords, label: 'Raid Master', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  defense: { icon: Shield, label: 'Tackle King', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  fitness: { icon: Heart, label: 'Endurance', color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-100 dark:bg-pink-900/30' },
  teamwork: { icon: Users, label: 'Team Player', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
};

const MOCK_CHALLENGES: Challenge[] = [
  {
    id: 'ch_1',
    title: 'Raid Streak',
    description: 'Complete 5 successful raids in practice matches',
    difficulty: 'Easy',
    category: 'raid',
    currentProgress: 3,
    targetProgress: 5,
    rewardXP: 50,
    rewardBadge: 'Raider Bronze',
    isCompleted: false,
    isLocked: false,
  },
  {
    id: 'ch_2',
    title: 'Tackle Master',
    description: 'Execute 10 successful tackles in any match type',
    difficulty: 'Medium',
    category: 'defense',
    currentProgress: 4,
    targetProgress: 10,
    rewardXP: 100,
    rewardBadge: null,
    isCompleted: false,
    isLocked: false,
  },
  {
    id: 'ch_3',
    title: 'Endurance Run',
    description: 'Complete 3 full-length practice matches without substitution',
    difficulty: 'Hard',
    category: 'fitness',
    currentProgress: 1,
    targetProgress: 3,
    rewardXP: 200,
    rewardBadge: 'Iron Will',
    isCompleted: false,
    isLocked: false,
  },
  {
    id: 'ch_4',
    title: 'Team Spirit',
    description: 'Play 2 team practice sessions this week',
    difficulty: 'Easy',
    category: 'teamwork',
    currentProgress: 2,
    targetProgress: 2,
    rewardXP: 50,
    rewardBadge: 'Team Player',
    isCompleted: true,
    isLocked: false,
  },
  {
    id: 'ch_5',
    title: 'Super Raid Challenge',
    description: 'Perform 3 super raids in competitive matches',
    difficulty: 'Hard',
    category: 'raid',
    currentProgress: 0,
    targetProgress: 3,
    rewardXP: 250,
    rewardBadge: 'Super Raider',
    isCompleted: false,
    isLocked: true,
  },
];

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: 'Arjun Mehra', avatar: null, points: 2450, isCurrentUser: false },
  { rank: 2, name: 'Deepika Rana', avatar: null, points: 2180, isCurrentUser: false },
  { rank: 3, name: 'Vikram Singh', avatar: null, points: 1920, isCurrentUser: false },
  { rank: 4, name: 'You', avatar: null, points: 1750, isCurrentUser: true },
  { rank: 5, name: 'Rahul Sharma', avatar: null, points: 1600, isCurrentUser: false },
  { rank: 6, name: 'Priya Verma', avatar: null, points: 1450, isCurrentUser: false },
  { rank: 7, name: 'Amit Patel', avatar: null, points: 1320, isCurrentUser: false },
];

const USER_STATS = {
  level: 12,
  currentXP: 1750,
  levelXP: 2000,
  totalPoints: 4250,
  streak: 7,
  challengesCompleted: 34,
};

// ─── Confetti Component ───────────────────────────────────────────

function ConfettiPiece({ delay, color }: { delay: number; color: string }) {
  const leftPos = Math.random() * 100;
  const size = 6 + Math.random() * 6;
  const rotation = Math.random() * 360;
  const duration = 1.5 + Math.random() * 1.5;

  return (
    <motion.div
      initial={{ opacity: 1, y: -20, x: 0, rotate: 0 }}
      animate={{ opacity: 0, y: 300, x: (Math.random() - 0.5) * 200, rotate: rotation + 720 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className="absolute top-0"
      style={{ left: `${leftPos}%`, width: size, height: size, backgroundColor: color, borderRadius: Math.random() > 0.5 ? '50%' : '2px' }}
    />
  );
}

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;

  const colors = ['#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {Array.from({ length: 40 }).map((_, i) => (
        <ConfettiPiece key={i} delay={i * 0.03} color={colors[i % colors.length]} />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function DailyChallengeScreen({ onClose }: DailyChallengeScreenProps) {
  const [challenges, setChallenges] = useState<Challenge[]>(MOCK_CHALLENGES);
  const [showConfetti, setShowConfetti] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  });
  const completedChallengeRef = useRef<string | null>(null);

  // Update countdown every second
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return Math.floor((midnight.getTime() - now.getTime()) / 1000);
    };

    const interval = setInterval(() => {
      setResetCountdown(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatCountdown = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleCompleteChallenge = (challengeId: string) => {
    setChallenges((prev) =>
      prev.map((ch) => {
        if (ch.id !== challengeId) return ch;
        if (ch.currentProgress >= ch.targetProgress) {
          completedChallengeRef.current = challengeId;
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
          return { ...ch, isCompleted: true };
        }
        return ch;
      })
    );
  };

  const handleProgressChallenge = (challengeId: string) => {
    setChallenges((prev) =>
      prev.map((ch) => {
        if (ch.id !== challengeId || ch.isCompleted || ch.isLocked) return ch;
        const newProgress = Math.min(ch.currentProgress + 1, ch.targetProgress);
        return { ...ch, currentProgress: newProgress };
      })
    );
  };

  const activeChallenges = challenges.filter((ch) => !ch.isCompleted && !ch.isLocked);
  const completedChallenges = challenges.filter((ch) => ch.isCompleted);
  const lockedChallenges = challenges.filter((ch) => ch.isLocked);

  const levelProgress = (USER_STATS.currentXP / USER_STATS.levelXP) * 100;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Confetti active={showConfetti} />

      {/* ─── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 backdrop-blur-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-full hover:bg-white/20 text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">Daily Challenges</h1>
              <p className="text-amber-100 text-xs">Complete challenges, earn rewards</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1">
              <Star className="h-3.5 w-3.5 text-amber-200" />
              <span className="text-xs font-bold">{USER_STATS.totalPoints.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Level & XP Bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Crown className="h-4 w-4 text-amber-200" />
              <span className="text-sm font-bold">Level {USER_STATS.level}</span>
            </div>
            <span className="text-xs text-amber-100">
              {USER_STATS.currentXP} / {USER_STATS.levelXP} XP
            </span>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-yellow-300 to-amber-300 rounded-full"
            />
          </div>
        </div>
      </motion.div>

      <div className="px-4 py-4 space-y-6 max-w-lg mx-auto">
        {/* ─── Streak Counter ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="text-3xl"
                  >
                    <Flame className="h-8 w-8 text-orange-500 dark:text-orange-400" />
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      {USER_STATS.streak} Day Streak!
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Keep it going! Complete today&apos;s challenges.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-orange-600 dark:text-orange-400">
                    {USER_STATS.streak}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">days</div>
                </div>
              </div>
              {/* Streak visual dots */}
              <div className="flex items-center gap-1.5 mt-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1 * i }}
                      className={`h-2 rounded-full w-full ${
                        i < USER_STATS.streak
                          ? 'bg-gradient-to-r from-orange-400 to-amber-500'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                    <span className="text-[9px] text-gray-400 dark:text-gray-500">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Reset Countdown ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400"
        >
          <Clock className="h-4 w-4" />
          <span>New challenges in</span>
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
            {formatCountdown(resetCountdown)}
          </span>
        </motion.div>

        {/* ─── Active Challenges ───────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="font-bold text-gray-900 dark:text-white">
              Today&apos;s Challenges
            </h2>
            <Badge variant="secondary" className="text-xs">
              {activeChallenges.length} remaining
            </Badge>
          </div>

          <div className="space-y-3">
            {activeChallenges.map((challenge, index) => {
              const config = CATEGORY_CONFIG[challenge.category];
              const diffConfig = DIFFICULTY_CONFIG[challenge.difficulty];
              const CategoryIcon = config.icon;
              const progressPercent = (challenge.currentProgress / challenge.targetProgress) * 100;

              return (
                <motion.div
                  key={challenge.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + index * 0.08, duration: 0.4 }}
                >
                  <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Category Icon */}
                        <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
                          <CategoryIcon className={`h-5 w-5 ${config.color}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate pr-2">
                              {challenge.title}
                            </h3>
                            <Badge
                              className={`${diffConfig.bg} ${diffConfig.color} ${diffConfig.border} text-[10px] px-2 py-0 border`}
                              variant="outline"
                            >
                              {challenge.difficulty}
                            </Badge>
                          </div>

                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2.5 line-clamp-2">
                            {challenge.description}
                          </p>

                          {/* Progress Bar */}
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                {challenge.currentProgress} / {challenge.targetProgress}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {Math.round(progressPercent)}%
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.8, delay: 0.3 + index * 0.08, ease: 'easeOut' }}
                                className={`h-full rounded-full ${
                                  challenge.difficulty === 'Easy'
                                    ? 'bg-gradient-to-r from-green-400 to-green-500'
                                    : challenge.difficulty === 'Medium'
                                    ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                    : 'bg-gradient-to-r from-red-400 to-red-500'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Reward & Action */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <Zap className="h-3 w-3" />
                                <span className="font-medium">{challenge.rewardXP} XP</span>
                              </div>
                              {challenge.rewardBadge && (
                                <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                                  <Medal className="h-3 w-3" />
                                  <span>{challenge.rewardBadge}</span>
                                </div>
                              )}
                            </div>

                            {challenge.currentProgress >= challenge.targetProgress ? (
                              <Button
                                onClick={() => handleCompleteChallenge(challenge.id)}
                                size="sm"
                                className="h-7 text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full px-4"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Claim
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleProgressChallenge(challenge.id)}
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs rounded-full px-3 border-gray-200 dark:border-gray-700"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Progress
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ─── Completed Challenges ────────────────────────────── */}
        {completedChallenges.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h2 className="font-bold text-gray-900 dark:text-white">Completed</h2>
              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs border-0">
                {completedChallenges.length}
              </Badge>
            </div>

            <div className="space-y-2">
              {completedChallenges.map((challenge, index) => {
                const config = CATEGORY_CONFIG[challenge.category];
                const CategoryIcon = config.icon;

                return (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                  >
                    <Card className="bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${config.bgColor}`}>
                            <CategoryIcon className={`h-4 w-4 ${config.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 truncate">
                                {challenge.title}
                              </h4>
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.5 + index * 0.1 }}
                              >
                                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                              </motion.div>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                +{challenge.rewardXP} XP
                              </span>
                              {challenge.rewardBadge && (
                                <span className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                  <Medal className="h-3 w-3" />
                                  {challenge.rewardBadge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Locked Challenges ───────────────────────────────── */}
        {lockedChallenges.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              <h2 className="font-bold text-gray-500 dark:text-gray-400">Locked</h2>
            </div>
            <div className="space-y-2">
              {lockedChallenges.map((challenge) => {
                const config = CATEGORY_CONFIG[challenge.category];
                const CategoryIcon = config.icon;

                return (
                  <Card key={challenge.id} className="bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 opacity-60">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                          <CategoryIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm text-gray-400 dark:text-gray-500 truncate">
                              {challenge.title}
                            </h4>
                            <Lock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">
                            Complete harder challenges to unlock
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Weekly Leaderboard ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Weekly Leaderboard
                  </h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  This Week
                </Badge>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {MOCK_LEADERBOARD.map((entry, index) => (
                  <motion.div
                    key={entry.rank}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.06 }}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      entry.isCurrentUser
                        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    } transition-colors`}
                  >
                    {/* Rank */}
                    <div className="w-7 text-center flex-shrink-0">
                      {entry.rank === 1 ? (
                        <Crown className="h-5 w-5 text-amber-500 mx-auto" />
                      ) : entry.rank === 2 ? (
                        <Crown className="h-5 w-5 text-gray-400 mx-auto" />
                      ) : entry.rank === 3 ? (
                        <Crown className="h-5 w-5 text-amber-700 mx-auto" />
                      ) : (
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500">
                          {entry.rank}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                        entry.isCurrentUser
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                          : 'bg-gray-400 dark:bg-gray-600'
                      }`}
                    >
                      {entry.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`text-sm font-medium truncate block ${
                          entry.isCurrentUser
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {entry.name}
                        {entry.isCurrentUser && (
                          <span className="text-xs ml-1">(You)</span>
                        )}
                      </span>
                    </div>

                    {/* Points */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {entry.points.toLocaleString()}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* View Full Leaderboard */}
              <Button
                variant="ghost"
                className="w-full mt-3 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm"
              >
                <TrendingUp className="h-4 w-4 mr-1.5" />
                View Full Leaderboard
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Stats Summary ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="pb-8"
        >
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <CardContent className="p-3 text-center">
                <Sparkles className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <div className="text-lg font-black text-gray-900 dark:text-white">
                  {USER_STATS.totalPoints.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Total Points</div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <CardContent className="p-3 text-center">
                <Trophy className="h-5 w-5 text-green-500 mx-auto mb-1" />
                <div className="text-lg font-black text-gray-900 dark:text-white">
                  {USER_STATS.challengesCompleted}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Completed</div>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <CardContent className="p-3 text-center">
                <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                <div className="text-lg font-black text-gray-900 dark:text-white">
                  {USER_STATS.streak}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">Day Streak</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>

      {/* ─── Custom Scrollbar Styles ────────────────────────────── */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 999px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
}
