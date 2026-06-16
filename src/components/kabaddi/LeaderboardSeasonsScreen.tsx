'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Trophy,
  Medal,
  Clock,
  Calendar,
  Swords,
  Shield,
  Star,
  Crown,
  ChevronDown,
  Users,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useKabaddiStore } from '@/lib/store';

// ─── Types ────────────────────────────────────────────────────────

interface LeaderboardSeasonsScreenProps {
  onBack: () => void;
}

interface Season {
  id: string;
  name: string;
  month: number;
  year: number;
  status: string;
  isCurrent: boolean;
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  playerCode: string | null;
  totalPoints: number;
  raidPoints: number;
  tacklePoints: number;
  matchesPlayed: number;
}

interface SeasonInfo {
  id: string;
  name: string;
  month: number;
  year: number;
  status: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
}

// ─── Animation Variants ───────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 20, stiffness: 180 },
  },
};

// ─── Rank Badge Component ─────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
  if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
  if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
  return (
    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
      <span className="text-xs font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function LeaderboardSeasonsScreen({ onBack }: LeaderboardSeasonsScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const [currentSeason, setCurrentSeason] = useState<SeasonInfo | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  // ─── Fetch Data ──────────────────────────────────────────────

  const fetchData = useCallback(async (seasonId?: string) => {
    setLoading(true);
    try {
      const params = seasonId ? `?seasonId=${seasonId}` : '';
      const res = await fetch(`/api/leaderboard-seasons${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCurrentSeason(data.currentSeason);
      setEntries(data.entries || []);
      setSeasons(data.seasons || []);
    } catch (err) {
      console.error('Leaderboard seasons fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSeasonChange = (seasonId: string) => {
    setSelectedSeasonId(seasonId);
    setShowSeasonPicker(false);
    fetchData(seasonId);
  };

  // ─── Render Loading ──────────────────────────────────────────

  const renderLoading = () => (
    <div className="p-4 space-y-4">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-16 w-full rounded-2xl" />
    </div>
  );

  // ─── Render Content ──────────────────────────────────────────

  const renderContent = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-4 space-y-4"
    >
      {/* Season Info Card */}
      {currentSeason && (
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-red to-brand-gold p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    <h2 className="text-lg font-bold">{currentSeason.name}</h2>
                  </div>
                  {currentSeason.status === 'active' && (
                    <Badge className="mt-1 bg-white/20 text-white border-white/30 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 animate-pulse" />
                      Current Season
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-2xl font-bold">{currentSeason.daysRemaining}</span>
                  </div>
                  <p className="text-xs opacity-80">days remaining</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Season Selector */}
      <motion.div variants={itemVariants}>
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowSeasonPicker(!showSeasonPicker)}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{currentSeason?.name || 'Select Season'}</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${showSeasonPicker ? 'rotate-180' : ''}`} />
        </Button>

        <AnimatePresence>
          {showSeasonPicker && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="mt-2">
                <CardContent className="p-2 space-y-1 max-h-48 overflow-y-auto">
                  {seasons.map((season) => (
                    <button
                      key={season.id}
                      className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
                        season.id === selectedSeasonId || (season.isCurrent && !selectedSeasonId)
                          ? 'bg-brand-red/10 text-brand-red font-medium'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleSeasonChange(season.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span>{season.name}</span>
                        {season.isCurrent && (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px]">
                            Active
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                  {seasons.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">No seasons yet</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Leaderboard Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-brand-gold" />
            <h3 className="font-semibold text-foreground">Season Leaderboard</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {entries.length} players
          </Badge>
        </div>
      </motion.div>

      {/* Leaderboard Table */}
      {entries.length > 0 ? (
        <motion.div variants={itemVariants} className="space-y-2">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Player</div>
            <div className="col-span-2 text-center">Points</div>
            <div className="col-span-2 text-center">Raids</div>
            <div className="col-span-2 text-center">Tackles</div>
            <div className="col-span-1 text-center">M</div>
          </div>

          {/* Table Rows */}
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {entries.map((entry) => {
              const isCurrentUser = entry.userId === currentUser?.id;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: entry.rank * 0.03 }}
                >
                  <Card className={`${isCurrentUser ? 'ring-2 ring-brand-red/40 bg-brand-red/5' : ''}`}>
                    <CardContent className="p-3">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-1 flex items-center justify-center">
                          <RankBadge rank={entry.rank} />
                        </div>
                        <div className="col-span-4 flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            entry.rank <= 3 ? 'bg-brand-gold/10' : 'bg-muted'
                          }`}>
                            {entry.avatar ? (
                              <img src={entry.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-muted-foreground">
                                {entry.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${
                              isCurrentUser ? 'text-brand-red' : 'text-foreground'
                            }`}>
                              {entry.name}
                              {isCurrentUser && ' (You)'}
                            </p>
                            {entry.playerCode && (
                              <p className="text-[10px] text-muted-foreground">{entry.playerCode}</p>
                            )}
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <span className="text-sm font-bold text-foreground">{entry.totalPoints}</span>
                        </div>
                        <div className="col-span-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Swords className="w-3 h-3 text-brand-red" />
                            <span className="text-xs text-foreground">{entry.raidPoints}</span>
                          </div>
                        </div>
                        <div className="col-span-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Shield className="w-3 h-3 text-emerald-500" />
                            <span className="text-xs text-foreground">{entry.tacklePoints}</span>
                          </div>
                        </div>
                        <div className="col-span-1 text-center">
                          <span className="text-xs text-muted-foreground">{entry.matchesPlayed}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center">
              <Trophy className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <h3 className="font-semibold text-foreground mb-1">No Entries Yet</h3>
              <p className="text-sm text-muted-foreground">
                The season just started! Play matches to appear on the leaderboard.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Summary */}
      {entries.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <Target className="w-5 h-5 mx-auto text-brand-red mb-1" />
                  <p className="text-lg font-bold text-foreground">
                    {entries.reduce((sum, e) => sum + e.totalPoints, 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Total Points</p>
                </div>
                <div>
                  <Swords className="w-5 h-5 mx-auto text-brand-gold mb-1" />
                  <p className="text-lg font-bold text-foreground">
                    {entries.reduce((sum, e) => sum + e.raidPoints, 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Raid Points</p>
                </div>
                <div>
                  <Shield className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
                  <p className="text-lg font-bold text-foreground">
                    {entries.reduce((sum, e) => sum + e.tacklePoints, 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Tackle Points</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Info */}
      <motion.div variants={itemVariants}>
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">About Season Leaderboards</p>
                <p>
                  Each month is a new season! Your tournament stats determine your position.
                  Climb the leaderboard by playing more matches and scoring points.
                  Top performers earn special recognition!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );

  // ─── Main Render ──────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground">Season Leaderboard</h1>
            <p className="text-xs text-muted-foreground">Monthly competition rankings</p>
          </div>
          {currentSeason?.status === 'active' && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
              Live
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? renderLoading() : renderContent()}
    </div>
  );
}
