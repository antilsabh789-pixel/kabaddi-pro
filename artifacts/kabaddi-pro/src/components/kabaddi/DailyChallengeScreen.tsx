'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Flame,
  Crown,
  Medal,
  CheckCircle2,
  Lock,
  Gift,
  Loader2,
  Sparkles,
  Calendar,
  Droplet,
  Package,
  Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface DailyChallengeScreenProps {
  onClose: () => void;
}

interface MilestoneReward {
  day: number;
  type: 'premium' | 'badge' | 'physical';
  title: string;
  description: string;
  icon: string;
  premiumDays?: number;
  isClaimed: boolean;
  isClaimable: boolean;
  isLocked: boolean;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalCheckIns: number;
  lastCheckIn: string | null;
  isCheckedInToday: boolean;
  milestones: MilestoneReward[];
  nextMilestone: MilestoneReward | null;
}

// ─── Icon resolver ────────────────────────────────────────────────

function RewardIcon({ icon, className }: { icon: string; className?: string }) {
  switch (icon) {
    case 'crown': return <Crown className={className} />;
    case 'medal': return <Medal className={className} />;
    case 'bottle': return <Droplet className={className} />;
    case 'kit': return <Package className={className} />;
    case 'protein': return <Award className={className} />;
    default: return <Gift className={className} />;
  }
}

function rewardGradient(type: MilestoneReward['type']): string {
  switch (type) {
    case 'premium': return 'from-amber-400 to-yellow-500';
    case 'badge': return 'from-purple-400 to-fuchsia-500';
    case 'physical': return 'from-emerald-400 to-teal-500';
    default: return 'from-gray-400 to-gray-500';
  }
}

// ─── Confetti ─────────────────────────────────────────────────────

function ConfettiPiece({ delay, color }: { delay: number; color: string }) {
  const leftPos = Math.random() * 100;
  const size = 6 + Math.random() * 6;
  const rotation = Math.random() * 360;
  const duration = 1.5 + Math.random() * 1.5;
  return (
    <motion.div
      initial={{ opacity: 1, y: -20, x: 0, rotate: 0 }}
      animate={{ opacity: 0, y: 400, x: (Math.random() - 0.5) * 200, rotate: rotation + 720 }}
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
      {Array.from({ length: 50 }).map((_, i) => (
        <ConfettiPiece key={i} delay={i * 0.025} color={colors[i % colors.length]} />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function DailyChallengeScreen({ onClose }: DailyChallengeScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const updateUser = useKabaddiStore((s) => s.updateUser);
  const { toast } = useToast();

  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [claimingDay, setClaimingDay] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // ─── Fetch streak data ──────────────────────────────────────────
  const fetchStreak = useCallback(async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/streak?userId=${currentUser.id}`);
      if (!res.ok) throw new Error('Failed to fetch streak');
      const data = await res.json();
      setStreak(data);
    } catch (err) {
      console.error('Fetch streak error:', err);
      toast({ title: 'Failed to load streak', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, toast]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  // ─── Daily check-in ─────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!currentUser?.id || checkingIn) return;
    setCheckingIn(true);
    try {
      const res = await fetch('/api/streak/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Check-in failed', description: data.error, variant: 'destructive' });
        return;
      }
      if (data.alreadyCheckedIn) {
        toast({ title: 'Already checked in today! 🔥', description: `You're on a ${data.currentStreak}-day streak.` });
      } else {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        toast({
          title: 'Daily Check-in Complete! 🔥',
          description: data.currentStreak === 1
            ? 'Welcome! Day 1 of your streak. Come back tomorrow.'
            : `You're on a ${data.currentStreak}-day streak! Keep it going.`,
        });
      }
      fetchStreak();
    } catch (err) {
      console.error('Check-in error:', err);
      toast({ title: 'Check-in failed', variant: 'destructive' });
    } finally {
      setCheckingIn(false);
    }
  };

  // ─── Claim milestone reward ─────────────────────────────────────
  const handleClaim = async (milestone: MilestoneReward) => {
    if (!currentUser?.id || claimingDay !== null || !milestone.isClaimable) return;
    setClaimingDay(milestone.day);
    try {
      const res = await fetch('/api/streak/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, day: milestone.day }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Claim failed', description: data.error, variant: 'destructive' });
        return;
      }
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);

      // If premium was granted, refresh the local user state
      if (data.premiumGranted) {
        // Re-fetch user to get updated premiumExpiry
        try {
          const userRes = await fetch(`/api/players/${currentUser.id}`);
          if (userRes.ok) {
            const userData = await userRes.json();
            updateUser({
              isPremium: userData.isPremium ?? true,
              premiumExpiry: userData.premiumExpiry,
              premiumPlan: userData.premiumPlan,
            });
          }
        } catch { /* non-critical */ }
      }

      toast({
        title: `🎉 ${milestone.title} Claimed!`,
        description: data.message,
      });
      fetchStreak();
    } catch (err) {
      console.error('Claim error:', err);
      toast({ title: 'Claim failed', variant: 'destructive' });
    } finally {
      setClaimingDay(null);
    }
  };

  // ─── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading your streak...</p>
        </div>
      </div>
    );
  }

  // ─── Not logged in ──────────────────────────────────────────────
  if (!currentUser?.id) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="text-center">
          <Flame className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">Please log in</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">You need to be logged in to track your streak.</p>
          <Button onClick={onClose} className="mt-4">Go Back</Button>
        </div>
      </div>
    );
  }

  const currentStreak = streak?.currentStreak || 0;
  const longestStreak = streak?.longestStreak || 0;
  const totalCheckIns = streak?.totalCheckIns || 0;
  const isCheckedInToday = streak?.isCheckedInToday || false;
  const milestones = streak?.milestones || [];
  const nextMilestone = streak?.nextMilestone;

  // Progress toward next milestone
  const nextMilestoneDay = nextMilestone?.day || (currentStreak >= 250 ? Math.ceil((currentStreak + 1) / 50) * 50 : 15);
  const prevMilestoneDay = (() => {
    const claimed = milestones.filter((m) => m.isClaimed).map((m) => m.day);
    return claimed.length > 0 ? Math.max(...claimed) : 0;
  })();
  const progressToNext = nextMilestone
    ? Math.min(100, ((currentStreak - prevMilestoneDay) / (nextMilestoneDay - prevMilestoneDay)) * 100)
    : 100;

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 overflow-y-auto">
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
              <h1 className="font-bold text-lg">Daily Check-in</h1>
              <p className="text-amber-100 text-xs">Check in daily, earn rewards</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="px-4 py-4 space-y-5 max-w-lg mx-auto pb-12">
        {/* ─── Streak Counter Card ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800 overflow-hidden">
            <CardContent className="p-5 text-center">
              {/* Flame + streak number */}
              <motion.div
                animate={currentStreak > 0 ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="inline-flex items-center justify-center mb-2"
              >
                <Flame className={`h-16 w-16 ${currentStreak > 0 ? 'text-orange-500' : 'text-gray-300 dark:text-gray-600'}`} />
              </motion.div>
              <div className="text-5xl font-black text-orange-600 dark:text-orange-400 mb-1">
                {currentStreak}
              </div>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                {currentStreak === 1 ? 'Day Streak' : 'Day Streak'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {isCheckedInToday
                  ? '✓ Checked in today. Come back tomorrow!'
                  : currentStreak === 0
                  ? 'Check in to start your streak!'
                  : 'Check in now to keep your streak alive!'}
              </p>

              {/* Check-in button */}
              <Button
                onClick={handleCheckIn}
                disabled={checkingIn || isCheckedInToday}
                className={`mt-4 w-full h-12 rounded-xl font-black text-sm ${
                  isCheckedInToday
                    ? 'bg-green-500 hover:bg-green-500 text-white cursor-default'
                    : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30'
                }`}
              >
                {checkingIn ? (
                  <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Checking in...</>
                ) : isCheckedInToday ? (
                  <><CheckCircle2 className="h-5 w-5 mr-2" /> Checked In Today</>
                ) : (
                  <><Flame className="h-5 w-5 mr-2" /> Check In Today</>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Next Milestone Progress ──────────────────────────── */}
        {nextMilestone && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                      Next Reward
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {currentStreak} / {nextMilestoneDay} days
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {nextMilestone.title}
                </p>
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressToNext}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                  />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
                  {nextMilestoneDay - currentStreak} {nextMilestoneDay - currentStreak === 1 ? 'day' : 'days'} to go
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── Stats Row ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3"
        >
          <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
            <CardContent className="p-3 text-center">
              <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
              <div className="text-lg font-black text-gray-900 dark:text-white">{currentStreak}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Current</div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
            <CardContent className="p-3 text-center">
              <Crown className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <div className="text-lg font-black text-gray-900 dark:text-white">{longestStreak}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Longest</div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
            <CardContent className="p-3 text-center">
              <Calendar className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
              <div className="text-lg font-black text-gray-900 dark:text-white">{totalCheckIns}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Total</div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Reward Roadmap ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="font-bold text-gray-900 dark:text-white">Reward Roadmap</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Keep your streak alive to unlock bigger rewards. Miss a day and your streak resets to 0.
          </p>

          <div className="space-y-3">
            {milestones.map((milestone, index) => {
              const gradient = rewardGradient(milestone.type);
              return (
                <motion.div
                  key={milestone.day}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + index * 0.05, duration: 0.3 }}
                >
                  <Card className={`overflow-hidden transition-all ${
                    milestone.isClaimed
                      ? 'bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-900/30'
                      : milestone.isClaimable
                      ? 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 shadow-md shadow-amber-500/10'
                      : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Day badge / icon */}
                        <div className="relative shrink-0">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md ${
                            milestone.isClaimed
                              ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                              : milestone.isClaimable
                              ? `bg-gradient-to-br ${gradient}`
                              : 'bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700'
                          }`}>
                            {milestone.isClaimed ? (
                              <CheckCircle2 className="h-7 w-7" />
                            ) : (
                              <RewardIcon icon={milestone.icon} className="h-7 w-7" />
                            )}
                          </div>
                          {/* Day number badge */}
                          <div className="absolute -bottom-1.5 -right-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-1.5 py-0.5 text-[9px] font-black text-gray-700 dark:text-gray-200 shadow-sm">
                            {milestone.day}d
                          </div>
                        </div>

                        {/* Reward info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                              {milestone.title}
                            </h3>
                            {milestone.type === 'premium' && (
                              <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[8px] border-0 px-1.5 py-0">PREMIUM</Badge>
                            )}
                            {milestone.type === 'badge' && (
                              <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[8px] border-0 px-1.5 py-0">BADGE</Badge>
                            )}
                            {milestone.type === 'physical' && (
                              <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[8px] border-0 px-1.5 py-0">PHYSICAL</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {milestone.description}
                          </p>
                        </div>

                        {/* Action button */}
                        <div className="shrink-0">
                          {milestone.isClaimed ? (
                            <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              Done
                            </span>
                          ) : milestone.isClaimable ? (
                            <Button
                              onClick={() => handleClaim(milestone)}
                              disabled={claimingDay !== null}
                              size="sm"
                              className={`h-8 text-xs rounded-full px-3 bg-gradient-to-r ${gradient} hover:opacity-90 text-white border-0`}
                            >
                              {claimingDay === milestone.day ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>Claim</>
                              )}
                            </Button>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <Lock className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                              <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">
                                {milestone.day - currentStreak}d left
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ─── How It Works ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/30">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                How It Works
              </h3>
              <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                <li className="flex gap-2">
                  <span className="text-amber-500 font-bold">1.</span>
                  <span>Tap <strong>Check In Today</strong> once every day to grow your streak.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-500 font-bold">2.</span>
                  <span>Reach milestone days (15, 25, 50, 100, 150, 200, 250...) to unlock rewards.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-500 font-bold">3.</span>
                  <span>Tap <strong>Claim</strong> on any unlocked reward to receive it.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-red-500 font-bold">⚠</span>
                  <span>Miss a day and your streak resets to 0. Check in every day!</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
