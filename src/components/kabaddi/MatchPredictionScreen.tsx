'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Trophy,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle,
  Crown,
  ArrowLeft,
  Flame,
  Star,
  Users,
  Clock,
  Zap,
  Medal,
  BarChart3,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

// ─── Types ───

interface PredictionMatch {
  id: string;
  teamA: { name: string; short: string; color: string };
  teamB: { name: string; short: string; color: string };
  date: string;
  time: string;
  status: 'upcoming' | 'completed';
  result?: 'teamA' | 'draw' | 'teamB';
  scoreA?: number;
  scoreB?: number;
  communityPrediction: { teamA: number; draw: number; teamB: number };
}

interface UserPrediction {
  matchId: string;
  pick: 'teamA' | 'draw' | 'teamB';
  timestamp: number;
  revealed?: boolean;
}

interface LeaderboardEntry {
  name: string;
  points: number;
  accuracy: number;
  predictions: number;
  correctPredictions: number;
  isUser?: boolean;
}

interface PredictionHistoryItem {
  matchId: string;
  teamA: string;
  teamB: string;
  pick: 'teamA' | 'draw' | 'teamB';
  result: 'teamA' | 'draw' | 'teamB' | null;
  points: number;
  correct: boolean | null;
  timestamp: number;
}

// ─── Storage helpers ───

const STORAGE_KEY = 'kabaddi-predictions';

function loadPredictions(): UserPrediction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePredictions(predictions: UserPrediction[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions));
  } catch {
    // ignore storage errors
  }
}

// ─── Mock Data ───

const UPCOMING_MATCHES: PredictionMatch[] = [
  {
    id: 'pred-m1',
    teamA: { name: 'Bengaluru Bulls', short: 'BEN', color: '#DC2626' },
    teamB: { name: 'Patna Pirates', short: 'PAT', color: '#1E293B' },
    date: 'Mar 8, 2026',
    time: '7:30 PM',
    status: 'upcoming',
    communityPrediction: { teamA: 58, draw: 8, teamB: 34 },
  },
  {
    id: 'pred-m2',
    teamA: { name: 'Dabang Delhi', short: 'DEL', color: '#F59E0B' },
    teamB: { name: 'U Mumba', short: 'MUM', color: '#14B8A6' },
    date: 'Mar 9, 2026',
    time: '8:00 PM',
    status: 'upcoming',
    communityPrediction: { teamA: 45, draw: 12, teamB: 43 },
  },
  {
    id: 'pred-m3',
    teamA: { name: 'Jaipur Pink Panthers', short: 'JAI', color: '#EC4899' },
    teamB: { name: 'Bengal Warriors', short: 'BW', color: '#8B5CF6' },
    date: 'Mar 10, 2026',
    time: '7:30 PM',
    status: 'upcoming',
    communityPrediction: { teamA: 52, draw: 10, teamB: 38 },
  },
  {
    id: 'pred-m4',
    teamA: { name: 'Haryana Steelers', short: 'HAR', color: '#22C55E' },
    teamB: { name: 'Gujarat Giants', short: 'GUJ', color: '#3B82F6' },
    date: 'Mar 11, 2026',
    time: '8:30 PM',
    status: 'upcoming',
    communityPrediction: { teamA: 37, draw: 15, teamB: 48 },
  },
];

const COMPLETED_MATCHES: PredictionMatch[] = [
  {
    id: 'pred-c1',
    teamA: { name: 'Bengaluru Bulls', short: 'BEN', color: '#DC2626' },
    teamB: { name: 'U Mumba', short: 'MUM', color: '#14B8A6' },
    date: 'Mar 5, 2026',
    time: '7:30 PM',
    status: 'completed',
    result: 'teamA',
    scoreA: 38,
    scoreB: 32,
    communityPrediction: { teamA: 62, draw: 8, teamB: 30 },
  },
  {
    id: 'pred-c2',
    teamA: { name: 'Patna Pirates', short: 'PAT', color: '#1E293B' },
    teamB: { name: 'Dabang Delhi', short: 'DEL', color: '#F59E0B' },
    date: 'Mar 4, 2026',
    time: '8:00 PM',
    status: 'completed',
    result: 'teamB',
    scoreA: 29,
    scoreB: 35,
    communityPrediction: { teamA: 55, draw: 10, teamB: 35 },
  },
  {
    id: 'pred-c3',
    teamA: { name: 'Jaipur Pink Panthers', short: 'JAI', color: '#EC4899' },
    teamB: { name: 'Haryana Steelers', short: 'HAR', color: '#22C55E' },
    date: 'Mar 3, 2026',
    time: '7:30 PM',
    status: 'completed',
    result: 'draw',
    scoreA: 31,
    scoreB: 31,
    communityPrediction: { teamA: 44, draw: 14, teamB: 42 },
  },
  {
    id: 'pred-c4',
    teamA: { name: 'Gujarat Giants', short: 'GUJ', color: '#3B82F6' },
    teamB: { name: 'Bengal Warriors', short: 'BW', color: '#8B5CF6' },
    date: 'Mar 2, 2026',
    time: '8:30 PM',
    status: 'completed',
    result: 'teamA',
    scoreA: 36,
    scoreB: 28,
    communityPrediction: { teamA: 50, draw: 12, teamB: 38 },
  },
];

const LEADERBOARD_WEEKLY: LeaderboardEntry[] = [
  { name: 'Ravindra K.', points: 85, accuracy: 80, predictions: 5, correctPredictions: 4, isUser: false },
  { name: 'Anup S.', points: 70, accuracy: 75, predictions: 4, correctPredictions: 3, isUser: false },
  { name: 'Deepak N.', points: 60, accuracy: 67, predictions: 3, correctPredictions: 2, isUser: false },
  { name: 'Manjeet R.', points: 50, accuracy: 100, predictions: 2, correctPredictions: 2, isUser: false },
  { name: 'You', points: 0, accuracy: 0, predictions: 0, correctPredictions: 0, isUser: true },
  { name: 'Sachin T.', points: 40, accuracy: 50, predictions: 2, correctPredictions: 1, isUser: false },
  { name: 'Ajay K.', points: 30, accuracy: 50, predictions: 2, correctPredictions: 1, isUser: false },
  { name: 'Vikram P.', points: 20, accuracy: 50, predictions: 2, correctPredictions: 1, isUser: false },
];

const LEADERBOARD_MONTHLY: LeaderboardEntry[] = [
  { name: 'Ravindra K.', points: 285, accuracy: 78, predictions: 42, correctPredictions: 33, isUser: false },
  { name: 'Anup S.', points: 260, accuracy: 74, predictions: 45, correctPredictions: 33, isUser: false },
  { name: 'Deepak N.', points: 245, accuracy: 72, predictions: 40, correctPredictions: 29, isUser: false },
  { name: 'Manjeet R.', points: 230, accuracy: 70, predictions: 38, correctPredictions: 27, isUser: false },
  { name: 'You', points: 0, accuracy: 0, predictions: 0, correctPredictions: 0, isUser: true },
  { name: 'Sachin T.', points: 195, accuracy: 65, predictions: 35, correctPredictions: 23, isUser: false },
  { name: 'Ajay K.', points: 180, accuracy: 62, predictions: 37, correctPredictions: 23, isUser: false },
  { name: 'Vikram P.', points: 165, accuracy: 58, predictions: 33, correctPredictions: 19, isUser: false },
  { name: 'Rohit M.', points: 150, accuracy: 55, predictions: 30, correctPredictions: 17, isUser: false },
  { name: 'Karan S.', points: 135, accuracy: 52, predictions: 28, correctPredictions: 15, isUser: false },
];

const LEADERBOARD_ALLTIME: LeaderboardEntry[] = [
  { name: 'Anup S.', points: 1850, accuracy: 76, predictions: 120, correctPredictions: 91, isUser: false },
  { name: 'Ravindra K.', points: 1720, accuracy: 74, predictions: 115, correctPredictions: 85, isUser: false },
  { name: 'Deepak N.', points: 1580, accuracy: 71, predictions: 108, correctPredictions: 77, isUser: false },
  { name: 'Manjeet R.', points: 1420, accuracy: 68, predictions: 100, correctPredictions: 68, isUser: false },
  { name: 'You', points: 0, accuracy: 0, predictions: 0, correctPredictions: 0, isUser: true },
  { name: 'Sachin T.', points: 1280, accuracy: 64, predictions: 95, correctPredictions: 61, isUser: false },
  { name: 'Ajay K.', points: 1150, accuracy: 61, predictions: 90, correctPredictions: 55, isUser: false },
  { name: 'Vikram P.', points: 1020, accuracy: 58, predictions: 85, correctPredictions: 49, isUser: false },
  { name: 'Rohit M.', points: 900, accuracy: 55, predictions: 80, correctPredictions: 44, isUser: false },
  { name: 'Karan S.', points: 780, accuracy: 51, predictions: 75, correctPredictions: 38, isUser: false },
];

// ─── Confetti Component ───

function ConfettiEffect() {
  const particles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.5,
      color: ['#DC2626', '#F59E0B', '#14B8A6', '#EC4899', '#8B5CF6', '#22C55E'][Math.floor(Math.random() * 6)],
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 360,
    })),
  []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 1, y: -20, x: `${p.left}vw`, rotate: 0 }}
          animate={{
            opacity: 0,
            y: '100vh',
            rotate: p.rotation + 720,
            x: `${p.left + (Math.random() - 0.5) * 20}vw`,
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
          className="absolute rounded-sm"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            left: `${p.left}%`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Accuracy Ring Component ───

function AccuracyRing({ accuracy, size = 64 }: { accuracy: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (accuracy / 100) * circumference;
  const center = size / 2;

  const getColor = (acc: number) => {
    if (acc >= 70) return '#22C55E';
    if (acc >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-warm-200 dark:text-warm-700"
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getColor(accuracy)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: progress }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-black text-warm-800 dark:text-warm-100">{accuracy}%</span>
      </div>
    </div>
  );
}

// ─── Animated Prediction Bar ───

function AnimatedPredictionBar({
  teamA,
  teamB,
  teamAPercent,
  teamBPercent,
  userPick,
}: {
  teamA: PredictionMatch['teamA'];
  teamB: PredictionMatch['teamB'];
  teamAPercent: number;
  teamBPercent: number;
  userPick?: 'teamA' | 'draw' | 'teamB';
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[10px] font-bold">
        <span style={{ color: teamA.color }}>{teamA.short} {teamAPercent}%</span>
        <span className="text-warm-400 dark:text-warm-500">Community</span>
        <span style={{ color: teamB.color }}>{teamBPercent}% {teamB.short}</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex bg-warm-200 dark:bg-warm-700 relative">
        <motion.div
          className="h-full rounded-l-full relative"
          style={{ backgroundColor: teamA.color }}
          initial={{ width: 0 }}
          animate={{ width: `${teamAPercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        >
          {userPick === 'teamA' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <CheckCircle className="w-3.5 h-3.5 text-white drop-shadow-md" />
            </motion.div>
          )}
        </motion.div>
        <motion.div
          className="h-full bg-brand-gold"
          initial={{ width: 0 }}
          animate={{ width: `${100 - teamAPercent - teamBPercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
        <motion.div
          className="h-full rounded-r-full relative"
          style={{ backgroundColor: teamB.color }}
          initial={{ width: 0 }}
          animate={{ width: `${teamBPercent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
        >
          {userPick === 'teamB' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute left-1 top-1/2 -translate-y-1/2"
            >
              <CheckCircle className="w-3.5 h-3.5 text-white drop-shadow-md" />
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main Component ───

interface MatchPredictionScreenProps {
  onClose: () => void;
}

export default function MatchPredictionScreen({ onClose }: MatchPredictionScreenProps) {
  const [predictions, setPredictions] = useState<UserPrediction[]>(() => loadPredictions());
  const [localPicks, setLocalPicks] = useState<Record<string, 'teamA' | 'draw' | 'teamB'>>({});
  const [activeTab, setActiveTab] = useState('predict');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'weekly' | 'monthly' | 'alltime'>('weekly');
  const [showConfetti, setShowConfetti] = useState(false);
  const [revealingMatch, setRevealingMatch] = useState<string | null>(null);
  const [justVoted, setJustVoted] = useState<string | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    const completedPreds = predictions.filter((p) => {
      const match = COMPLETED_MATCHES.find((m) => m.id === p.matchId);
      return match?.status === 'completed';
    });

    const correctCount = completedPreds.filter((p) => {
      const match = COMPLETED_MATCHES.find((m) => m.id === p.matchId);
      return match?.result === p.pick;
    }).length;

    const totalPoints = completedPreds.reduce((sum, p) => {
      const match = COMPLETED_MATCHES.find((m) => m.id === p.matchId);
      if (!match?.result) return sum;
      const correct = match.result === p.pick;
      if (!correct) return sum;

      let points = 10;
      if (p.pick === 'draw') points = 25;
      return sum + points;
    }, 0);

    // Calculate streak
    let streak = 0;
    const sortedCompleted = [...completedPreds].sort((a, b) => b.timestamp - a.timestamp);
    for (const p of sortedCompleted) {
      const match = COMPLETED_MATCHES.find((m) => m.id === p.matchId);
      if (match?.result === p.pick) {
        streak++;
      } else {
        break;
      }
    }

    const streakBonus = streak >= 3 ? (streak - 2) * 5 : 0;

    return {
      totalPoints: totalPoints + streakBonus,
      totalPredictions: completedPreds.length,
      correctCount,
      accuracy: completedPreds.length > 0 ? Math.round((correctCount / completedPreds.length) * 100) : 0,
      streak,
    };
  }, [predictions]);

  // Build prediction history
  const predictionHistory = useMemo((): PredictionHistoryItem[] => {
    const history: PredictionHistoryItem[] = [];
    for (const pred of predictions) {
      const allMatches = [...UPCOMING_MATCHES, ...COMPLETED_MATCHES];
      const match = allMatches.find((m) => m.id === pred.matchId);
      if (!match) continue;

      const isCompleted = match.status === 'completed';
      const result = isCompleted ? match.result ?? null : null;
      const correct = result !== null ? result === pred.pick : null;
      const points = correct ? (pred.pick === 'draw' ? 25 : 10) : 0;

      history.push({
        matchId: pred.matchId,
        teamA: match.teamA.short,
        teamB: match.teamB.short,
        pick: pred.pick,
        result,
        points,
        correct,
        timestamp: pred.timestamp,
      });
    }
    return history.sort((a, b) => b.timestamp - a.timestamp);
  }, [predictions]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return predictionHistory;
    if (historyFilter === 'correct') return predictionHistory.filter((h) => h.correct === true);
    return predictionHistory.filter((h) => h.correct === false);
  }, [predictionHistory, historyFilter]);

  // Get leaderboard data by period
  const leaderboardData = useMemo(() => {
    const source = leaderboardPeriod === 'weekly'
      ? LEADERBOARD_WEEKLY
      : leaderboardPeriod === 'monthly'
      ? LEADERBOARD_MONTHLY
      : LEADERBOARD_ALLTIME;

    const lb = source.map((entry) => {
      if (entry.isUser) {
        return {
          ...entry,
          points: stats.totalPoints,
          accuracy: stats.accuracy,
          predictions: stats.totalPredictions,
          correctPredictions: stats.correctCount,
        };
      }
      return entry;
    });
    return lb.sort((a, b) => b.points - a.points);
  }, [stats, leaderboardPeriod]);

  const userRank = leaderboardData.findIndex((e) => e.isUser) + 1;

  // Submit prediction
  const handleSubmitPrediction = useCallback(
    (matchId: string) => {
      const pick = localPicks[matchId];
      if (!pick) return;

      const newPrediction: UserPrediction = {
        matchId,
        pick,
        timestamp: Date.now(),
      };

      const updated = [...predictions.filter((p) => p.matchId !== matchId), newPrediction];
      setPredictions(updated);
      savePredictions(updated);
      setJustVoted(matchId);
      setTimeout(() => setJustVoted(null), 1500);
      setLocalPicks((prev) => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    },
    [localPicks, predictions],
  );

  // Reveal result animation
  const handleReveal = useCallback(
    (matchId: string) => {
      setRevealingMatch(matchId);
      setTimeout(() => {
        const pred = predictions.find((p) => p.matchId === matchId);
        const match = COMPLETED_MATCHES.find((m) => m.id === matchId);
        if (pred && match?.result === pred.pick) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        }
        setRevealingMatch(null);
      }, 800);
    },
    [predictions],
  );

  // Get prediction for match
  const getPrediction = useCallback(
    (matchId: string) => predictions.find((p) => p.matchId === matchId),
    [predictions],
  );

  return (
    <div className="fixed inset-0 z-40 bg-warm-50 dark:bg-warm-900 overflow-y-auto custom-scrollbar">
      {showConfetti && <ConfettiEffect />}

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/40">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-warm-200 dark:hover:bg-warm-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-gold to-brand-red flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-black gradient-text">Match Predictions</h1>
          </div>
        </div>
      </header>

      {/* ─── Stats Bar with Accuracy Ring ─── */}
      <div className="px-4 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl bg-white/60 dark:bg-warm-800/60 backdrop-blur-lg border border-warm-200/50 dark:border-warm-700/30 shadow-lg"
        >
          {/* Gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-teal" />

          <div className="p-4 flex items-center gap-4">
            {/* Accuracy Ring */}
            <AccuracyRing accuracy={stats.accuracy} size={72} />

            {/* Stats Grid */}
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Trophy className="w-3 h-3 text-brand-gold" />
                  <span className="text-[9px] font-semibold text-warm-500 dark:text-warm-400 uppercase">Points</span>
                </div>
                <motion.p
                  className="text-xl font-black text-warm-800 dark:text-warm-100"
                  key={stats.totalPoints}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  {stats.totalPoints}
                </motion.p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Target className="w-3 h-3 text-brand-teal" />
                  <span className="text-[9px] font-semibold text-warm-500 dark:text-warm-400 uppercase">Predicted</span>
                </div>
                <motion.p
                  className="text-xl font-black text-warm-800 dark:text-warm-100"
                  key={stats.totalPredictions}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  {stats.totalPredictions}
                </motion.p>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Flame className="w-3 h-3 text-brand-red" />
                  <span className="text-[9px] font-semibold text-warm-500 dark:text-warm-400 uppercase">Streak</span>
                </div>
                <motion.p
                  className="text-xl font-black text-warm-800 dark:text-warm-100"
                  key={stats.streak}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  {stats.streak > 0 ? `${stats.streak}🔥` : '0'}
                </motion.p>
              </div>
            </div>
          </div>

          {/* Streak bonus indicator */}
          {stats.streak >= 3 && (
            <div className="px-4 pb-3">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 text-[10px] font-bold text-brand-gold"
              >
                <Zap className="w-3 h-3" />
                Streak bonus active! +{(stats.streak - 2) * 5} bonus points
              </motion.div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ─── Tabs ─── */}
      <div className="px-4 mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-9">
            <TabsTrigger value="predict" className="flex-1 text-xs gap-1">
              <Sparkles className="w-3 h-3" />
              Predict
            </TabsTrigger>
            <TabsTrigger value="results" className="flex-1 text-xs gap-1">
              <Trophy className="w-3 h-3" />
              Results
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex-1 text-xs gap-1">
              <Crown className="w-3 h-3" />
              Board
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1 text-xs gap-1">
              <Clock className="w-3 h-3" />
              History
            </TabsTrigger>
          </TabsList>

          {/* ─── Predict Tab ─── */}
          <TabsContent value="predict">
            <div className="space-y-4 mt-3 pb-6">
              {UPCOMING_MATCHES.length === 0 ? (
                <Card className="card-elevated p-8 text-center">
                  <Sparkles className="w-10 h-10 text-warm-300 dark:text-warm-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-warm-500 dark:text-warm-400">No upcoming matches</p>
                  <p className="text-xs text-warm-400 dark:text-warm-500 mt-1">Check back later for new predictions</p>
                </Card>
              ) : (
                UPCOMING_MATCHES.map((match, idx) => {
                  const existingPred = getPrediction(match.id);
                  const localPick = localPicks[match.id];
                  const selectedPick = existingPred?.pick || localPick;
                  const isJustVoted = justVoted === match.id;

                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.08 }}
                    >
                      <Card className="overflow-hidden bg-white/70 dark:bg-warm-800/70 backdrop-blur-lg border border-warm-200/50 dark:border-warm-700/30 shadow-lg">
                        {/* Team color gradient header */}
                        <div
                          className="h-2"
                          style={{
                            background: `linear-gradient(90deg, ${match.teamA.color}, ${match.teamA.color}80 40%, ${match.teamB.color}80 60%, ${match.teamB.color})`,
                          }}
                        />

                        <CardContent className="p-4">
                          {/* Match time */}
                          <div className="flex items-center justify-center gap-1.5 mb-3">
                            <Calendar className="w-3 h-3 text-warm-400 dark:text-warm-500" />
                            <span className="text-[11px] text-warm-500 dark:text-warm-400 font-medium">
                              {match.date} • {match.time}
                            </span>
                          </div>

                          {/* Team vs Team layout */}
                          <div className="flex items-center gap-2 mb-4">
                            {/* Team A Card */}
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => !existingPred && setLocalPicks((prev) => ({ ...prev, [match.id]: 'teamA' }))}
                              className={`flex-1 relative p-3 rounded-xl border-2 transition-all duration-300 text-center ${
                                selectedPick === 'teamA'
                                  ? 'border-transparent shadow-lg'
                                  : 'border-warm-200 dark:border-warm-700 bg-warm-50/50 dark:bg-warm-800/50 hover:border-warm-300 dark:hover:border-warm-600'
                              } ${existingPred ? 'cursor-default' : 'cursor-pointer'}`}
                              style={
                                selectedPick === 'teamA'
                                  ? {
                                      background: `linear-gradient(135deg, ${match.teamA.color}15, ${match.teamA.color}08)`,
                                      borderColor: match.teamA.color,
                                      boxShadow: `0 4px 14px ${match.teamA.color}25`,
                                    }
                                  : undefined
                              }
                            >
                              <div
                                className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center text-white text-sm font-black shadow-md"
                                style={{ backgroundColor: match.teamA.color }}
                              >
                                {match.teamA.short}
                              </div>
                              <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate">{match.teamA.name}</p>
                              <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-0.5">{match.communityPrediction.teamA}% pick</p>
                              {selectedPick === 'teamA' && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-1.5 -right-1.5"
                                >
                                  <CheckCircle className="w-5 h-5" style={{ color: match.teamA.color }} />
                                </motion.div>
                              )}
                            </motion.button>

                            {/* VS Divider */}
                            <div className="flex flex-col items-center gap-1 px-1">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-gold/20 to-brand-red/20 dark:from-brand-gold/10 dark:to-brand-red/10 border border-warm-200 dark:border-warm-700 flex items-center justify-center">
                                <span className="text-[9px] font-black text-warm-500 dark:text-warm-400">VS</span>
                              </div>
                            </div>

                            {/* Team B Card */}
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => !existingPred && setLocalPicks((prev) => ({ ...prev, [match.id]: 'teamB' }))}
                              className={`flex-1 relative p-3 rounded-xl border-2 transition-all duration-300 text-center ${
                                selectedPick === 'teamB'
                                  ? 'border-transparent shadow-lg'
                                  : 'border-warm-200 dark:border-warm-700 bg-warm-50/50 dark:bg-warm-800/50 hover:border-warm-300 dark:hover:border-warm-600'
                              } ${existingPred ? 'cursor-default' : 'cursor-pointer'}`}
                              style={
                                selectedPick === 'teamB'
                                  ? {
                                      background: `linear-gradient(135deg, ${match.teamB.color}15, ${match.teamB.color}08)`,
                                      borderColor: match.teamB.color,
                                      boxShadow: `0 4px 14px ${match.teamB.color}25`,
                                    }
                                  : undefined
                              }
                            >
                              <div
                                className="w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center text-white text-sm font-black shadow-md"
                                style={{ backgroundColor: match.teamB.color }}
                              >
                                {match.teamB.short}
                              </div>
                              <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate">{match.teamB.name}</p>
                              <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-0.5">{match.communityPrediction.teamB}% pick</p>
                              {selectedPick === 'teamB' && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-1.5 -right-1.5"
                                >
                                  <CheckCircle className="w-5 h-5" style={{ color: match.teamB.color }} />
                                </motion.div>
                              )}
                            </motion.button>
                          </div>

                          {/* Draw option */}
                          {!existingPred && (
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setLocalPicks((prev) => ({ ...prev, [match.id]: 'draw' }))}
                              className={`w-full mb-3 p-2 rounded-xl border-2 transition-all duration-300 text-center ${
                                selectedPick === 'draw'
                                  ? 'border-brand-gold bg-brand-gold/10 dark:bg-brand-gold/15 shadow-md'
                                  : 'border-warm-200 dark:border-warm-700 bg-warm-50/50 dark:bg-warm-800/50 hover:border-warm-300 dark:hover:border-warm-600'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <span className="text-[10px] font-bold text-warm-600 dark:text-warm-300">
                                  🤝 Predict Draw
                                </span>
                                <span className="text-[9px] text-warm-400 dark:text-warm-500">{match.communityPrediction.draw}% pick</span>
                                <span className="text-[9px] text-brand-gold font-bold">+25 pts</span>
                                {selectedPick === 'draw' && (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <CheckCircle className="w-4 h-4 text-brand-gold" />
                                  </motion.div>
                                )}
                              </div>
                            </motion.button>
                          )}

                          {/* Community sentiment animated bar */}
                          <AnimatedPredictionBar
                            teamA={match.teamA}
                            teamB={match.teamB}
                            teamAPercent={match.communityPrediction.teamA}
                            teamBPercent={match.communityPrediction.teamB}
                            userPick={selectedPick}
                          />

                          {/* Already predicted state */}
                          {existingPred ? (
                            <AnimatePresence mode="wait">
                              {isJustVoted ? (
                                <motion.div
                                  key="just-voted"
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-green-500/10 dark:bg-green-500/15 border border-green-500/20"
                                >
                                  <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 0.5 }}
                                  >
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                  </motion.div>
                                  <span className="text-xs font-bold text-green-600 dark:text-green-400">Prediction submitted!</span>
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="already-predicted"
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-brand-teal/10 dark:bg-brand-teal/15 border border-brand-teal/20"
                                >
                                  <CheckCircle className="w-4 h-4 text-brand-teal" />
                                  <span className="text-xs font-semibold text-brand-teal">
                                    You predicted:{' '}
                                    {existingPred.pick === 'teamA'
                                      ? `${match.teamA.name} Wins`
                                      : existingPred.pick === 'draw'
                                      ? 'Draw'
                                      : `${match.teamB.name} Wins`}
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          ) : (
                            /* Submit button */
                            localPick && (
                              <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-3"
                              >
                                <Button
                                  onClick={() => handleSubmitPrediction(match.id)}
                                  className="w-full bg-gradient-to-r from-brand-red to-brand-gold hover:from-brand-red-dark hover:to-brand-gold-dark text-white font-bold text-xs h-9 press-down"
                                >
                                  <Zap className="w-3.5 h-3.5 mr-1" />
                                  Submit Prediction
                                </Button>
                              </motion.div>
                            )
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* ─── Results Tab ─── */}
          <TabsContent value="results">
            <div className="space-y-4 mt-3 pb-6">
              {COMPLETED_MATCHES.length === 0 ? (
                <Card className="card-elevated p-8 text-center">
                  <Trophy className="w-10 h-10 text-warm-300 dark:text-warm-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-warm-500 dark:text-warm-400">No completed matches yet</p>
                </Card>
              ) : (
                COMPLETED_MATCHES.map((match, idx) => {
                  const pred = getPrediction(match.id);
                  const isCorrect = pred ? match.result === pred.pick : null;
                  const isRevealing = revealingMatch === match.id;
                  const winnerTeam = match.result === 'teamA' ? match.teamA : match.result === 'teamB' ? match.teamB : null;

                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.08 }}
                    >
                      <Card
                        className={`overflow-hidden bg-white/70 dark:bg-warm-800/70 backdrop-blur-lg border transition-all duration-500 shadow-lg ${
                          isCorrect === true
                            ? 'border-green-500/40 shadow-green-500/10'
                            : isCorrect === false
                            ? 'border-red-500/30'
                            : 'border-warm-200/50 dark:border-warm-700/30'
                        }`}
                      >
                        {/* Winner team color header */}
                        <div
                          className="h-1.5"
                          style={{
                            background: winnerTeam
                              ? `linear-gradient(90deg, ${winnerTeam.color}80, ${winnerTeam.color})`
                              : 'linear-gradient(90deg, #F59E0B80, #F59E0B)',
                          }}
                        />
                        <CardContent className="p-4">
                          {/* Match date & status */}
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] text-warm-500 dark:text-warm-400 font-medium flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {match.date}
                            </span>
                            <Badge variant="secondary" className="text-[9px] h-5">Completed</Badge>
                          </div>

                          {/* Score display with team colors */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2.5 flex-1">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-md ${match.result === 'teamA' ? 'ring-2 ring-green-400/50' : ''}`}
                                style={{ backgroundColor: match.teamA.color }}
                              >
                                {match.teamA.short}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-warm-800 dark:text-warm-100">{match.teamA.name}</p>
                                <p className="text-2xl font-black text-warm-800 dark:text-warm-100">{match.scoreA}</p>
                              </div>
                            </div>
                            <div className="px-3 text-center">
                              <Badge className="text-[9px] h-5 bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300 border-0">
                                FINAL
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2.5 flex-1 justify-end text-right">
                              <div>
                                <p className="text-xs font-bold text-warm-800 dark:text-warm-100">{match.teamB.name}</p>
                                <p className="text-2xl font-black text-warm-800 dark:text-warm-100">{match.scoreB}</p>
                              </div>
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-md ${match.result === 'teamB' ? 'ring-2 ring-green-400/50' : ''}`}
                                style={{ backgroundColor: match.teamB.color }}
                              >
                                {match.teamB.short}
                              </div>
                            </div>
                          </div>

                          {/* Winner indicator */}
                          <div className="flex items-center justify-center gap-1.5 mb-3">
                            <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400">Winner:</span>
                            <Badge
                              className="text-[10px] h-5 font-bold"
                              style={{
                                backgroundColor: winnerTeam ? winnerTeam.color : '#F59E0B',
                                color: '#FFFFFF',
                              }}
                            >
                              {match.result === 'draw' ? '🤝 Draw' : winnerTeam?.short}
                            </Badge>
                          </div>

                          {/* Prediction result */}
                          {pred ? (
                            <motion.div
                              animate={isRevealing ? { scale: [1, 1.03, 1] } : {}}
                              transition={{ duration: 0.5 }}
                            >
                              <div
                                className={`flex items-center justify-between p-3 rounded-xl ${
                                  isCorrect
                                    ? 'bg-green-500/10 dark:bg-green-500/15 border border-green-500/20'
                                    : 'bg-red-500/10 dark:bg-red-500/15 border border-red-500/20'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isCorrect ? (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                                    >
                                      <CheckCircle className="w-5 h-5 text-green-500" />
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      animate={isCorrect === false ? { x: [0, -3, 3, -3, 3, 0] } : {}}
                                      transition={{ duration: 0.4 }}
                                    >
                                      <XCircle className="w-5 h-5 text-red-500" />
                                    </motion.div>
                                  )}
                                  <div>
                                    <span className={`text-xs font-bold ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      {isCorrect ? '✨ Correct!' : 'Incorrect'}
                                    </span>
                                    <p className="text-[9px] text-warm-400 dark:text-warm-500">
                                      You picked: {pred.pick === 'teamA' ? match.teamA.short : pred.pick === 'draw' ? 'Draw' : match.teamB.short}
                                    </p>
                                  </div>
                                </div>
                                {isCorrect && (
                                  <Badge className="badge-win text-[10px] h-5 gap-0.5 font-bold">
                                    <Star className="w-3 h-3" />
                                    +{pred.pick === 'draw' ? 25 : 10} pts
                                  </Badge>
                                )}
                              </div>

                              {!pred.revealed && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleReveal(match.id)}
                                    className="w-full text-xs h-7 press-down"
                                  >
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    Reveal Result
                                  </Button>
                                </motion.div>
                              )}
                            </motion.div>
                          ) : (
                            <div className="p-3 rounded-xl bg-warm-100/80 dark:bg-warm-800/80 border border-warm-200/50 dark:border-warm-700/30">
                              <p className="text-[11px] text-warm-500 dark:text-warm-400 text-center">
                                You didn&apos;t predict this match
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* ─── Leaderboard Tab ─── */}
          <TabsContent value="leaderboard">
            <div className="mt-3 pb-6">
              {/* Period filter tabs */}
              <div className="flex items-center gap-2 mb-4">
                {(['weekly', 'monthly', 'alltime'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setLeaderboardPeriod(period)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      leaderboardPeriod === period
                        ? 'bg-brand-gold text-white shadow-md shadow-brand-gold/25'
                        : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-700'
                    }`}
                  >
                    {period === 'weekly' && <BarChart3 className="w-3 h-3" />}
                    {period === 'monthly' && <Calendar className="w-3 h-3" />}
                    {period === 'alltime' && <Trophy className="w-3 h-3" />}
                    {period === 'weekly' ? 'Weekly' : period === 'monthly' ? 'Monthly' : 'All-Time'}
                  </button>
                ))}
              </div>

              {/* Your rank card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="relative overflow-hidden mb-4 bg-white/70 dark:bg-warm-800/70 backdrop-blur-lg border border-warm-200/50 dark:border-warm-700/30 shadow-lg">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-gold via-brand-red to-brand-teal" />
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Medal className="w-4 h-4 text-brand-gold" />
                      <span className="text-xs font-bold text-warm-800 dark:text-warm-100">Your Ranking</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-black gradient-text">#{userRank}</p>
                        <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-0.5">
                          {stats.totalPredictions} predictions • {stats.correctCount} correct • {stats.accuracy}% accuracy
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-brand-gold">{stats.totalPoints}</p>
                        <p className="text-[10px] text-warm-500 dark:text-warm-400">points</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Top 3 podium */}
              {leaderboardData.length >= 3 && (
                <div className="flex items-end justify-center gap-3 mb-4 px-4">
                  {/* 2nd place */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center mb-1">
                      <span className="text-[10px] font-black text-white">2</span>
                    </div>
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-t-xl w-22 h-16 flex flex-col items-center justify-end pb-2 border border-warm-200/50 dark:border-warm-700/30">
                      <p className="text-[9px] font-bold text-warm-700 dark:text-warm-200 truncate max-w-[80px] text-center">
                        {leaderboardData[1].name}
                      </p>
                      <p className="text-[10px] font-black text-warm-800 dark:text-warm-100">{leaderboardData[1].points} pts</p>
                    </div>
                  </motion.div>

                  {/* 1st place */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="flex flex-col items-center"
                  >
                    <Crown className="w-6 h-6 text-brand-gold mb-0.5" />
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-gold to-amber-600 flex items-center justify-center mb-1 shadow-lg shadow-brand-gold/30">
                      <span className="text-[10px] font-black text-white">1</span>
                    </div>
                    <div className="bg-brand-gold/20 dark:bg-brand-gold/15 rounded-t-xl w-24 h-28 flex flex-col items-center justify-end pb-2 border-2 border-brand-gold/30">
                      <p className="text-[9px] font-bold text-warm-700 dark:text-warm-200 truncate max-w-[88px] text-center">
                        {leaderboardData[0].name}
                      </p>
                      <p className="text-xs font-black text-brand-gold">{leaderboardData[0].points} pts</p>
                    </div>
                  </motion.div>

                  {/* 3rd place */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center mb-1">
                      <span className="text-[10px] font-black text-white">3</span>
                    </div>
                    <div className="bg-amber-100 dark:bg-amber-900/30 rounded-t-xl w-22 h-12 flex flex-col items-center justify-end pb-2 border border-warm-200/50 dark:border-warm-700/30">
                      <p className="text-[9px] font-bold text-warm-700 dark:text-warm-200 truncate max-w-[80px] text-center">
                        {leaderboardData[2].name}
                      </p>
                      <p className="text-[10px] font-black text-warm-800 dark:text-warm-100">{leaderboardData[2].points} pts</p>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Full leaderboard list */}
              <Card className="overflow-hidden bg-white/70 dark:bg-warm-800/70 backdrop-blur-lg border border-warm-200/50 dark:border-warm-700/30 shadow-lg">
                <CardContent className="p-0">
                  {/* Column headers */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-warm-100/50 dark:bg-warm-800/50 border-b border-warm-200/50 dark:border-warm-700/30">
                    <span className="w-7 text-[9px] font-bold text-warm-400 dark:text-warm-500 uppercase">#</span>
                    <span className="flex-1 text-[9px] font-bold text-warm-400 dark:text-warm-500 uppercase">Predictor</span>
                    <span className="w-14 text-[9px] font-bold text-warm-400 dark:text-warm-500 uppercase text-center">Preds</span>
                    <span className="w-14 text-[9px] font-bold text-warm-400 dark:text-warm-500 uppercase text-center">Correct</span>
                    <span className="w-12 text-[9px] font-bold text-warm-400 dark:text-warm-500 uppercase text-center">Acc%</span>
                    <span className="w-12 text-[9px] font-bold text-warm-400 dark:text-warm-500 uppercase text-right">Pts</span>
                  </div>

                  <div className="divide-y divide-warm-200/50 dark:divide-warm-700/30">
                    {leaderboardData.map((entry, idx) => {
                      const rank = idx + 1;
                      const isUser = entry.isUser;
                      const isTop3 = rank <= 3;

                      return (
                        <motion.div
                          key={`${entry.name}-${leaderboardPeriod}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * idx }}
                          className={`flex items-center gap-3 px-4 py-3 ${
                            isUser
                              ? 'bg-brand-teal/5 dark:bg-brand-teal/10 border-l-3 border-brand-teal'
                              : ''
                          }`}
                        >
                          {/* Rank */}
                          <div className="w-7 flex-shrink-0">
                            {isTop3 ? (
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  rank === 1
                                    ? 'bg-gradient-to-br from-brand-gold to-amber-600'
                                    : rank === 2
                                    ? 'bg-gradient-to-br from-gray-300 to-gray-400'
                                    : 'bg-gradient-to-br from-amber-600 to-amber-700'
                                }`}
                              >
                                {rank === 1 ? (
                                  <Crown className="w-3 h-3 text-white" />
                                ) : (
                                  <span className="text-[9px] font-black text-white">{rank}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-warm-400 dark:text-warm-500 text-center block">{rank}</span>
                            )}
                          </div>

                          {/* Name & accuracy */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold truncate ${isUser ? 'text-brand-teal' : 'text-warm-800 dark:text-warm-100'}`}>
                              {entry.name}
                              {isUser && (
                                <Badge className="badge-new text-[8px] h-3.5 ml-1.5 px-1.5">YOU</Badge>
                              )}
                            </p>
                          </div>

                          {/* Predictions */}
                          <div className="w-14 text-center flex-shrink-0">
                            <p className="text-xs font-bold text-warm-700 dark:text-warm-200">{entry.predictions}</p>
                          </div>

                          {/* Correct */}
                          <div className="w-14 text-center flex-shrink-0">
                            <p className="text-xs font-bold text-green-600 dark:text-green-400">{entry.correctPredictions}</p>
                          </div>

                          {/* Accuracy */}
                          <div className="w-12 text-center flex-shrink-0">
                            <p className={`text-xs font-bold ${
                              entry.accuracy >= 70 ? 'text-green-500' : entry.accuracy >= 50 ? 'text-brand-gold' : 'text-red-500'
                            }`}>
                              {entry.accuracy}%
                            </p>
                          </div>

                          {/* Points */}
                          <div className="w-12 text-right flex-shrink-0">
                            <p className="text-sm font-black text-warm-800 dark:text-warm-100">{entry.points}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── History Tab (My Predictions) ─── */}
          <TabsContent value="history">
            <div className="mt-3 pb-6">
              {/* Stats summary card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="relative overflow-hidden p-4 mb-4 bg-white/70 dark:bg-warm-800/70 backdrop-blur-lg border border-warm-200/50 dark:border-warm-700/30 shadow-lg">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-teal via-brand-gold to-brand-red" />
                  <div className="flex items-center gap-4">
                    {/* Accuracy ring */}
                    <AccuracyRing accuracy={stats.accuracy} size={64} />
                    {/* Stats grid */}
                    <div className="flex-1 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-black text-warm-800 dark:text-warm-100">{stats.totalPredictions}</p>
                        <p className="text-[9px] text-warm-500 dark:text-warm-400 font-semibold">Total</p>
                      </div>
                      <div>
                        <p className="text-lg font-black text-green-500">{stats.correctCount}</p>
                        <p className="text-[9px] text-warm-500 dark:text-warm-400 font-semibold">Correct</p>
                      </div>
                      <div>
                        <p className="text-lg font-black text-brand-gold">{stats.totalPoints}</p>
                        <p className="text-[9px] text-warm-500 dark:text-warm-400 font-semibold">Points</p>
                      </div>
                    </div>
                  </div>

                  {/* Accuracy progress bar */}
                  {stats.totalPredictions > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-semibold text-warm-500 dark:text-warm-400">Accuracy</span>
                        <span className="text-[9px] font-bold text-brand-teal">{stats.accuracy}%</span>
                      </div>
                      <Progress value={stats.accuracy} className="h-1.5" />
                    </div>
                  )}
                </Card>
              </motion.div>

              {/* Filter buttons */}
              <div className="flex items-center gap-2 mb-3">
                {(['all', 'correct', 'incorrect'] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={historyFilter === filter ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHistoryFilter(filter)}
                    className={`text-[10px] h-7 px-3 press-down ${
                      historyFilter === filter
                        ? filter === 'correct'
                          ? 'bg-green-500 hover:bg-green-600'
                          : filter === 'incorrect'
                          ? 'bg-red-500 hover:bg-red-600'
                          : ''
                        : ''
                    }`}
                  >
                    {filter === 'all' && <Target className="w-3 h-3 mr-1" />}
                    {filter === 'correct' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {filter === 'incorrect' && <XCircle className="w-3 h-3 mr-1" />}
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                ))}
              </div>

              {/* History list */}
              {filteredHistory.length === 0 ? (
                <Card className="card-elevated p-8 text-center">
                  <Clock className="w-10 h-10 text-warm-300 dark:text-warm-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-warm-500 dark:text-warm-400">
                    {predictionHistory.length === 0 ? 'No predictions yet' : 'No matching predictions'}
                  </p>
                  <p className="text-xs text-warm-400 dark:text-warm-500 mt-1">
                    Start predicting matches to build your history
                  </p>
                </Card>
              ) : (
                <Card className="overflow-hidden bg-white/70 dark:bg-warm-800/70 backdrop-blur-lg border border-warm-200/50 dark:border-warm-700/30 shadow-lg">
                  <CardContent className="p-0">
                    <div className="divide-y divide-warm-200/50 dark:divide-warm-700/30 max-h-96 overflow-y-auto custom-scrollbar">
                      {filteredHistory.map((item, idx) => {
                        const match = [...UPCOMING_MATCHES, ...COMPLETED_MATCHES].find((m) => m.id === item.matchId);
                        return (
                          <motion.div
                            key={`${item.matchId}-${idx}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.03 * idx }}
                            className={`flex items-center gap-3 px-4 py-3 ${
                              item.correct === true
                                ? 'border-l-3 border-green-500 bg-green-500/5 dark:bg-green-500/5'
                                : item.correct === false
                                ? 'border-l-3 border-red-500 bg-red-500/5 dark:bg-red-500/5'
                                : 'border-l-3 border-warm-300 dark:border-warm-600'
                            }`}
                          >
                            {/* Status icon */}
                            <div className="flex-shrink-0">
                              {item.correct === true ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : item.correct === false ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <Clock className="w-4 h-4 text-warm-400 dark:text-warm-500" />
                              )}
                            </div>

                            {/* Match info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-warm-800 dark:text-warm-100">
                                  {item.teamA} vs {item.teamB}
                                </p>
                                {match && (
                                  <div className="flex items-center gap-0.5">
                                    <div
                                      className="w-3 h-3 rounded-sm"
                                      style={{ backgroundColor: match.teamA.color }}
                                    />
                                    <div
                                      className="w-3 h-3 rounded-sm"
                                      style={{ backgroundColor: match.teamB.color }}
                                    />
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-warm-400 dark:text-warm-500">
                                  You: {item.pick === 'teamA' ? item.teamA : item.pick === 'draw' ? 'Draw' : item.teamB}
                                </span>
                                {item.result && (
                                  <>
                                    <ChevronRight className="w-2.5 h-2.5 text-warm-300 dark:text-warm-600" />
                                    <span className="text-[9px] text-warm-400 dark:text-warm-500">
                                      Result: {item.result === 'teamA' ? item.teamA : item.result === 'draw' ? 'Draw' : item.teamB}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Result badge */}
                            <div className="flex-shrink-0">
                              {item.correct === true && (
                                <Badge className="badge-win text-[9px] h-5 gap-0.5 font-bold">
                                  <Star className="w-2.5 h-2.5" />
                                  +{item.points}
                                </Badge>
                              )}
                              {item.correct === false && (
                                <Badge className="badge-loss text-[9px] h-5">Miss</Badge>
                              )}
                              {item.correct === null && (
                                <Badge variant="secondary" className="text-[9px] h-5">
                                  <Clock className="w-2.5 h-2.5 mr-0.5" />
                                  Pending
                                </Badge>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
