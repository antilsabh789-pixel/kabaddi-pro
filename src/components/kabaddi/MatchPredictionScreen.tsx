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

const UPCOMPING_MATCHES: PredictionMatch[] = [
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

const LEADERBOARD: LeaderboardEntry[] = [
  { name: 'Ravindra K.', points: 285, accuracy: 78, predictions: 42, isUser: false },
  { name: 'Anup S.', points: 260, accuracy: 74, predictions: 45, isUser: false },
  { name: 'Deepak N.', points: 245, accuracy: 72, predictions: 40, isUser: false },
  { name: 'Manjeet R.', points: 230, accuracy: 70, predictions: 38, isUser: false },
  { name: 'You', points: 0, accuracy: 0, predictions: 0, isUser: true },
  { name: 'Sachin T.', points: 195, accuracy: 65, predictions: 35, isUser: false },
  { name: 'Ajay K.', points: 180, accuracy: 62, predictions: 37, isUser: false },
  { name: 'Vikram P.', points: 165, accuracy: 58, predictions: 33, isUser: false },
  { name: 'Rohit M.', points: 150, accuracy: 55, predictions: 30, isUser: false },
  { name: 'Karan S.', points: 135, accuracy: 52, predictions: 28, isUser: false },
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

// ─── Main Component ───

interface MatchPredictionScreenProps {
  onClose: () => void;
}

export default function MatchPredictionScreen({ onClose }: MatchPredictionScreenProps) {
  const [predictions, setPredictions] = useState<UserPrediction[]>(() => loadPredictions());
  const [localPicks, setLocalPicks] = useState<Record<string, 'teamA' | 'draw' | 'teamB'>>({});
  const [activeTab, setActiveTab] = useState('predict');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'correct' | 'incorrect'>('all');
  const [showConfetti, setShowConfetti] = useState(false);
  const [revealingMatch, setRevealingMatch] = useState<string | null>(null);

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

      let points = 10; // Base points for correct winner

      // Bonus for draw prediction
      if (p.pick === 'draw') points = 25;

      // Streak bonus
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

    // Add streak bonus
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
      const allMatches = [...UPCOMPING_MATCHES, ...COMPLETED_MATCHES];
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

  // Updated leaderboard with user stats
  const updatedLeaderboard = useMemo(() => {
    const lb = LEADERBOARD.map((entry) => {
      if (entry.isUser) {
        return {
          ...entry,
          points: stats.totalPoints,
          accuracy: stats.accuracy,
          predictions: stats.totalPredictions,
        };
      }
      return entry;
    });
    return lb.sort((a, b) => b.points - a.points);
  }, [stats]);

  const userRank = updatedLeaderboard.findIndex((e) => e.isUser) + 1;

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

      {/* ─── Stats Bar ─── */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="card-elevated p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Trophy className="w-3.5 h-3.5 text-brand-gold" />
                <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wide">Points</span>
              </div>
              <p className="text-xl font-black text-warm-800 dark:text-warm-100 number-ticker">{stats.totalPoints}</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="card-elevated p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Target className="w-3.5 h-3.5 text-brand-teal" />
                <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wide">Accuracy</span>
              </div>
              <p className="text-xl font-black text-warm-800 dark:text-warm-100 number-ticker">{stats.accuracy}%</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="card-elevated p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Flame className="w-3.5 h-3.5 text-brand-red" />
                <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wide">Streak</span>
              </div>
              <p className="text-xl font-black text-warm-800 dark:text-warm-100 number-ticker">{stats.streak}</p>
            </Card>
          </motion.div>
        </div>
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
            <div className="space-y-3 mt-3 pb-6">
              {UPCOMPING_MATCHES.length === 0 ? (
                <Card className="card-elevated p-8 text-center">
                  <Sparkles className="w-10 h-10 text-warm-300 dark:text-warm-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-warm-500 dark:text-warm-400">No upcoming matches</p>
                  <p className="text-xs text-warm-400 dark:text-warm-500 mt-1">Check back later for new predictions</p>
                </Card>
              ) : (
                UPCOMPING_MATCHES.map((match, idx) => {
                  const existingPred = getPrediction(match.id);
                  const localPick = localPicks[match.id];
                  const selectedPick = existingPred?.pick || localPick;

                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.08 }}
                    >
                      <Card className="card-elevated overflow-hidden">
                        {/* Match header with team colors */}
                        <div
                          className="h-1.5"
                          style={{
                            background: `linear-gradient(90deg, ${match.teamA.color}, ${match.teamB.color})`,
                          }}
                        />
                        <CardContent className="p-4">
                          {/* Teams and date */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 flex-1">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                                style={{ backgroundColor: match.teamA.color }}
                              >
                                {match.teamA.short}
                              </div>
                              <span className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate">
                                {match.teamA.name}
                              </span>
                            </div>
                            <div className="px-2">
                              <span className="text-xs font-black text-warm-400 dark:text-warm-500">VS</span>
                            </div>
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <span className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate text-right">
                                {match.teamB.name}
                              </span>
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black"
                                style={{ backgroundColor: match.teamB.color }}
                              >
                                {match.teamB.short}
                              </div>
                            </div>
                          </div>

                          {/* Date/time */}
                          <div className="flex items-center justify-center gap-1.5 mb-3">
                            <Clock className="w-3 h-3 text-warm-400 dark:text-warm-500" />
                            <span className="text-[11px] text-warm-500 dark:text-warm-400 font-medium">
                              {match.date} • {match.time}
                            </span>
                          </div>

                          {/* Prediction options */}
                          {!existingPred ? (
                            <>
                              <div className="grid grid-cols-3 gap-2 mb-3">
                                {/* Team A wins */}
                                <motion.button
                                  whileHover={{ y: -1 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => setLocalPicks((prev) => ({ ...prev, [match.id]: 'teamA' }))}
                                  className={`relative p-2.5 rounded-xl border-2 transition-all duration-200 text-center press-down ${
                                    selectedPick === 'teamA'
                                      ? 'border-transparent shadow-lg'
                                      : 'border-warm-200 dark:border-warm-700 bg-warm-50 dark:bg-warm-800 hover:border-warm-300 dark:hover:border-warm-600'
                                  }`}
                                  style={
                                    selectedPick === 'teamA'
                                      ? {
                                          background: `linear-gradient(135deg, ${match.teamA.color}20, ${match.teamA.color}10)`,
                                          borderColor: match.teamA.color,
                                        }
                                      : undefined
                                  }
                                >
                                  <p className="text-[10px] font-bold text-warm-800 dark:text-warm-100">{match.teamA.short} Wins</p>
                                  <p className="text-[9px] text-warm-500 dark:text-warm-400 mt-0.5">{match.communityPrediction.teamA}%</p>
                                  {selectedPick === 'teamA' && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="absolute -top-1 -right-1"
                                    >
                                      <CheckCircle className="w-4 h-4" style={{ color: match.teamA.color }} />
                                    </motion.div>
                                  )}
                                </motion.button>

                                {/* Draw */}
                                <motion.button
                                  whileHover={{ y: -1 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => setLocalPicks((prev) => ({ ...prev, [match.id]: 'draw' }))}
                                  className={`relative p-2.5 rounded-xl border-2 transition-all duration-200 text-center press-down ${
                                    selectedPick === 'draw'
                                      ? 'border-transparent shadow-lg'
                                      : 'border-warm-200 dark:border-warm-700 bg-warm-50 dark:bg-warm-800 hover:border-warm-300 dark:hover:border-warm-600'
                                  }`}
                                  style={
                                    selectedPick === 'draw'
                                      ? {
                                          background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))',
                                          borderColor: '#F59E0B',
                                        }
                                      : undefined
                                  }
                                >
                                  <p className="text-[10px] font-bold text-warm-800 dark:text-warm-100">Draw</p>
                                  <p className="text-[9px] text-warm-500 dark:text-warm-400 mt-0.5">{match.communityPrediction.draw}%</p>
                                  {selectedPick === 'draw' && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="absolute -top-1 -right-1"
                                    >
                                      <CheckCircle className="w-4 h-4 text-brand-gold" />
                                    </motion.div>
                                  )}
                                </motion.button>

                                {/* Team B wins */}
                                <motion.button
                                  whileHover={{ y: -1 }}
                                  whileTap={{ scale: 0.97 }}
                                  onClick={() => setLocalPicks((prev) => ({ ...prev, [match.id]: 'teamB' }))}
                                  className={`relative p-2.5 rounded-xl border-2 transition-all duration-200 text-center press-down ${
                                    selectedPick === 'teamB'
                                      ? 'border-transparent shadow-lg'
                                      : 'border-warm-200 dark:border-warm-700 bg-warm-50 dark:bg-warm-800 hover:border-warm-300 dark:hover:border-warm-600'
                                  }`}
                                  style={
                                    selectedPick === 'teamB'
                                      ? {
                                          background: `linear-gradient(135deg, ${match.teamB.color}20, ${match.teamB.color}10)`,
                                          borderColor: match.teamB.color,
                                        }
                                      : undefined
                                  }
                                >
                                  <p className="text-[10px] font-bold text-warm-800 dark:text-warm-100">{match.teamB.short} Wins</p>
                                  <p className="text-[9px] text-warm-500 dark:text-warm-400 mt-0.5">{match.communityPrediction.teamB}%</p>
                                  {selectedPick === 'teamB' && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="absolute -top-1 -right-1"
                                    >
                                      <CheckCircle className="w-4 h-4" style={{ color: match.teamB.color }} />
                                    </motion.div>
                                  )}
                                </motion.button>
                              </div>

                              {/* Community sentiment bar */}
                              <div className="mb-3">
                                <div className="flex items-center gap-1 mb-1">
                                  <Users className="w-3 h-3 text-warm-400 dark:text-warm-500" />
                                  <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400">Community</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden flex bg-warm-200 dark:bg-warm-700">
                                  <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                      width: `${match.communityPrediction.teamA}%`,
                                      backgroundColor: match.teamA.color,
                                    }}
                                  />
                                  <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                      width: `${match.communityPrediction.draw}%`,
                                      backgroundColor: '#F59E0B',
                                    }}
                                  />
                                  <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                      width: `${match.communityPrediction.teamB}%`,
                                      backgroundColor: match.teamB.color,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Submit button */}
                              {localPick && !existingPred && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                  <Button
                                    onClick={() => handleSubmitPrediction(match.id)}
                                    className="w-full bg-gradient-to-r from-brand-red to-brand-gold hover:from-brand-red-dark hover:to-brand-gold-dark text-white font-bold text-xs h-9 press-down"
                                  >
                                    <Zap className="w-3.5 h-3.5 mr-1" />
                                    Submit Prediction
                                  </Button>
                                </motion.div>
                              )}
                            </>
                          ) : (
                            /* Already predicted */
                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-brand-teal/10 dark:bg-brand-teal/15 border border-brand-teal/20">
                              <CheckCircle className="w-4 h-4 text-brand-teal" />
                              <span className="text-xs font-semibold text-brand-teal">
                                You predicted:{' '}
                                {existingPred.pick === 'teamA'
                                  ? `${match.teamA.name} Wins`
                                  : existingPred.pick === 'draw'
                                  ? 'Draw'
                                  : `${match.teamB.name} Wins`}
                              </span>
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

          {/* ─── Results Tab ─── */}
          <TabsContent value="results">
            <div className="space-y-3 mt-3 pb-6">
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

                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.08 }}
                    >
                      <Card
                        className={`card-elevated overflow-hidden transition-all duration-500 ${
                          isCorrect === true
                            ? 'border-green-500/50 shadow-green-500/10 shadow-lg'
                            : isCorrect === false
                            ? 'border-red-500/30'
                            : ''
                        }`}
                      >
                        <div
                          className="h-1.5"
                          style={{
                            background: `linear-gradient(90deg, ${match.teamA.color}, ${match.teamB.color})`,
                          }}
                        />
                        <CardContent className="p-4">
                          {/* Match info */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-warm-500 dark:text-warm-400 font-medium">{match.date}</span>
                            <Badge variant="secondary" className="text-[9px] h-5">Completed</Badge>
                          </div>

                          {/* Score display */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 flex-1">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-black"
                                style={{ backgroundColor: match.teamA.color }}
                              >
                                {match.teamA.short}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-warm-800 dark:text-warm-100">{match.teamA.name}</p>
                                <p className="text-lg font-black text-warm-800 dark:text-warm-100">{match.scoreA}</p>
                              </div>
                            </div>
                            <div className="px-2 text-center">
                              <span className="text-[10px] font-bold text-warm-400 dark:text-warm-500">FINAL</span>
                            </div>
                            <div className="flex items-center gap-2 flex-1 justify-end text-right">
                              <div>
                                <p className="text-xs font-bold text-warm-800 dark:text-warm-100">{match.teamB.name}</p>
                                <p className="text-lg font-black text-warm-800 dark:text-warm-100">{match.scoreB}</p>
                              </div>
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-black"
                                style={{ backgroundColor: match.teamB.color }}
                              >
                                {match.teamB.short}
                              </div>
                            </div>
                          </div>

                          {/* Result and prediction */}
                          {pred ? (
                            <motion.div
                              animate={
                                isRevealing
                                  ? { scale: [1, 1.03, 1] }
                                  : {}
                              }
                              transition={{ duration: 0.5 }}
                            >
                              <div
                                className={`flex items-center justify-between p-2.5 rounded-xl ${
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
                                      <CheckCircle className="w-4 h-4 text-green-500" />
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      animate={isCorrect === false ? { x: [0, -3, 3, -3, 3, 0] } : {}}
                                      transition={{ duration: 0.4 }}
                                    >
                                      <XCircle className="w-4 h-4 text-red-500" />
                                    </motion.div>
                                  )}
                                  <span className={`text-xs font-semibold ${isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {isCorrect ? 'Correct!' : 'Incorrect'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-warm-500 dark:text-warm-400">
                                    You picked: {pred.pick === 'teamA' ? match.teamA.short : pred.pick === 'draw' ? 'Draw' : match.teamB.short}
                                  </span>
                                  {isCorrect && (
                                    <Badge className="badge-win text-[9px] h-4 gap-0.5">
                                      <Star className="w-2.5 h-2.5" />
                                      +{pred.pick === 'draw' ? 25 : 10} pts
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {/* Reveal button if not yet revealed */}
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
                            <div className="p-2.5 rounded-xl bg-warm-100 dark:bg-warm-800 border border-warm-200 dark:border-warm-700">
                              <p className="text-[11px] text-warm-500 dark:text-warm-400 text-center">
                                You didn&apos;t predict this match
                              </p>
                            </div>
                          )}

                          {/* Winner indicator */}
                          <div className="mt-2 flex items-center justify-center gap-1">
                            <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400">Winner:</span>
                            <Badge
                              className="text-[9px] h-5"
                              style={{
                                backgroundColor:
                                  match.result === 'teamA'
                                    ? match.teamA.color
                                    : match.result === 'teamB'
                                    ? match.teamB.color
                                    : '#F59E0B',
                                color: '#FFFFFF',
                              }}
                            >
                              {match.result === 'teamA'
                                ? match.teamA.short
                                : match.result === 'draw'
                                ? 'Draw'
                                : match.teamB.short}
                            </Badge>
                          </div>
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
              {/* Your rank card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="card-premium overflow-hidden mb-4">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Medal className="w-4 h-4 text-brand-gold" />
                      <span className="text-xs font-bold text-warm-800 dark:text-warm-100">Your Ranking</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-3xl font-black gradient-text">#{userRank}</p>
                        <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-0.5">
                          {stats.totalPredictions} predictions • {stats.accuracy}% accuracy
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
              {updatedLeaderboard.length >= 3 && (
                <div className="flex items-end justify-center gap-2 mb-4 px-4">
                  {/* 2nd place */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center mb-1">
                      <span className="text-[10px] font-black text-white">2</span>
                    </div>
                    <div className="bg-gray-200 dark:bg-gray-700 rounded-t-lg w-20 h-16 flex flex-col items-center justify-end pb-2">
                      <p className="text-[9px] font-bold text-warm-700 dark:text-warm-200 truncate max-w-[72px] text-center">
                        {updatedLeaderboard[1].name}
                      </p>
                      <p className="text-[10px] font-black text-warm-800 dark:text-warm-100">{updatedLeaderboard[1].points}</p>
                    </div>
                  </motion.div>

                  {/* 1st place */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="flex flex-col items-center"
                  >
                    <Crown className="w-5 h-5 text-brand-gold mb-0.5" />
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center mb-1">
                      <span className="text-[10px] font-black text-white">1</span>
                    </div>
                    <div className="bg-brand-gold/20 dark:bg-brand-gold/15 rounded-t-lg w-20 h-24 flex flex-col items-center justify-end pb-2 border-2 border-brand-gold/30">
                      <p className="text-[9px] font-bold text-warm-700 dark:text-warm-200 truncate max-w-[72px] text-center">
                        {updatedLeaderboard[0].name}
                      </p>
                      <p className="text-xs font-black text-brand-gold">{updatedLeaderboard[0].points}</p>
                    </div>
                  </motion.div>

                  {/* 3rd place */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex flex-col items-center"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center mb-1">
                      <span className="text-[10px] font-black text-white">3</span>
                    </div>
                    <div className="bg-amber-100 dark:bg-amber-900/30 rounded-t-lg w-20 h-12 flex flex-col items-center justify-end pb-2">
                      <p className="text-[9px] font-bold text-warm-700 dark:text-warm-200 truncate max-w-[72px] text-center">
                        {updatedLeaderboard[2].name}
                      </p>
                      <p className="text-[10px] font-black text-warm-800 dark:text-warm-100">{updatedLeaderboard[2].points}</p>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Full leaderboard list */}
              <Card className="card-elevated overflow-hidden">
                <CardContent className="p-0">
                  <div className="divide-y divide-warm-200 dark:divide-warm-700">
                    {updatedLeaderboard.map((entry, idx) => {
                      const rank = idx + 1;
                      const isUser = entry.isUser;
                      const isTop3 = rank <= 3;

                      return (
                        <motion.div
                          key={entry.name}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * idx }}
                          className={`flex items-center gap-3 px-4 py-3 ${
                            isUser
                              ? 'bg-brand-teal/5 dark:bg-brand-teal/10 border-l-2 border-brand-teal'
                              : ''
                          }`}
                        >
                          {/* Rank */}
                          <div className="w-7 flex-shrink-0">
                            {isTop3 ? (
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  rank === 1
                                    ? 'bg-gradient-to-br from-brand-gold to-brand-gold-dark'
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
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[9px] text-warm-400 dark:text-warm-500">{entry.predictions} preds</span>
                              <span className="text-[9px] text-warm-400 dark:text-warm-500">•</span>
                              <span className="text-[9px] text-warm-400 dark:text-warm-500">{entry.accuracy}% acc</span>
                            </div>
                          </div>

                          {/* Points */}
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-black text-warm-800 dark:text-warm-100">{entry.points}</p>
                            <p className="text-[9px] text-warm-400 dark:text-warm-500">pts</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── History Tab ─── */}
          <TabsContent value="history">
            <div className="mt-3 pb-6">
              {/* Stats summary */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="card-elevated p-4 mb-3">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-lg font-black text-warm-800 dark:text-warm-100">{stats.totalPredictions}</p>
                      <p className="text-[9px] text-warm-500 dark:text-warm-400 font-semibold">Total</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-green-500">{stats.correctCount}</p>
                      <p className="text-[9px] text-warm-500 dark:text-warm-400 font-semibold">Correct</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-warm-800 dark:text-warm-100">{stats.accuracy}%</p>
                      <p className="text-[9px] text-warm-500 dark:text-warm-400 font-semibold">Accuracy</p>
                    </div>
                    <div>
                      <p className="text-lg font-black text-brand-gold">{stats.totalPoints}</p>
                      <p className="text-[9px] text-warm-500 dark:text-warm-400 font-semibold">Points</p>
                    </div>
                  </div>
                  {stats.totalPredictions > 0 && (
                    <div className="mt-3">
                      <Progress
                        value={stats.accuracy}
                        className="h-1.5"
                      />
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
                <Card className="card-elevated overflow-hidden">
                  <CardContent className="p-0">
                    <div className="divide-y divide-warm-200 dark:divide-warm-700 max-h-96 overflow-y-auto custom-scrollbar">
                      {filteredHistory.map((item, idx) => {
                        const match = [...UPCOMPING_MATCHES, ...COMPLETED_MATCHES].find((m) => m.id === item.matchId);
                        return (
                          <motion.div
                            key={`${item.matchId}-${idx}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.03 * idx }}
                            className={`flex items-center gap-3 px-4 py-3 ${
                              item.correct === true
                                ? 'border-l-2 border-green-500 bg-green-500/5 dark:bg-green-500/5'
                                : item.correct === false
                                ? 'border-l-2 border-red-500 bg-red-500/5 dark:bg-red-500/5'
                                : 'border-l-2 border-warm-300 dark:border-warm-600'
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
                              <p className="text-xs font-bold text-warm-800 dark:text-warm-100">
                                {item.teamA} vs {item.teamB}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] text-warm-400 dark:text-warm-500">
                                  You: {item.pick === 'teamA' ? item.teamA : item.pick === 'draw' ? 'Draw' : item.teamB}
                                </span>
                                {item.result && (
                                  <>
                                    <span className="text-[9px] text-warm-300 dark:text-warm-600">•</span>
                                    <span className="text-[9px] text-warm-400 dark:text-warm-500">
                                      Result: {item.result === 'teamA' ? item.teamA : item.result === 'draw' ? 'Draw' : item.teamB}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Points */}
                            <div className="flex-shrink-0 text-right">
                              {item.correct !== null && (
                                <Badge
                                  className={`text-[9px] h-4 ${
                                    item.correct ? 'badge-win' : 'badge-loss'
                                  }`}
                                >
                                  {item.correct ? `+${item.points}` : '0'}
                                </Badge>
                              )}
                              {item.correct === null && (
                                <Badge variant="secondary" className="text-[9px] h-4">
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
