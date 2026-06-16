'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  TrendingUp,
  BarChart3,
  Award,
  Target,
  Shield,
  Swords,
  Star,
  Users,
  Zap,
  Trophy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useKabaddiStore } from '@/lib/store';

// ─── Types ────────────────────────────────────────────────────────

interface PercentileRankingsScreenProps {
  onBack: () => void;
}

interface StatPercentile {
  value: number;
  percentile: number;
  label: string;
  suffix?: string;
}

interface DistributionBucket {
  range: string;
  count: number;
}

// ─── Stat Icon Config ─────────────────────────────────────────────

const STAT_CONFIG: Record<string, { icon: typeof Swords; color: string; bgColor: string }> = {
  'Raid Points': { icon: Swords, color: 'text-brand-red', bgColor: 'bg-brand-red/10' },
  'Tackle Points': { icon: Shield, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' },
  'Total Points': { icon: Star, color: 'text-brand-gold', bgColor: 'bg-brand-gold/10' },
  'Success Rate': { icon: Target, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  'Super Tackles': { icon: Zap, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
};

// ─── Animation Variants ───────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
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

// ─── Component ────────────────────────────────────────────────────

export default function PercentileRankingsScreen({ onBack }: PercentileRankingsScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const [percentiles, setPercentiles] = useState<Record<string, StatPercentile> | null>(null);
  const [overallPercentile, setOverallPercentile] = useState<number>(0);
  const [totalPlayers, setTotalPlayers] = useState<number>(0);
  const [distribution, setDistribution] = useState<DistributionBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch Data ──────────────────────────────────────────────

  const fetchPercentiles = useCallback(async () => {
    if (!currentUser?.id) {
      setError('Please log in to view your rankings');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/percentile-rankings?userId=${currentUser.id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPercentiles(data.percentiles);
      setOverallPercentile(data.overallPercentile);
      setTotalPlayers(data.totalPlayers);
      setDistribution(data.distribution || []);
    } catch (err) {
      console.error('Percentile fetch error:', err);
      setError('Failed to load rankings');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchPercentiles();
  }, [fetchPercentiles]);

  // ─── Get Percentile Label ────────────────────────────────────

  const getPercentileLabel = (p: number) => {
    if (p >= 95) return 'Elite';
    if (p >= 85) return 'Excellent';
    if (p >= 70) return 'Very Good';
    if (p >= 50) return 'Above Average';
    if (p >= 30) return 'Average';
    return 'Developing';
  };

  const getPercentileColor = (p: number) => {
    if (p >= 85) return 'text-brand-gold';
    if (p >= 70) return 'text-green-600 dark:text-green-400';
    if (p >= 50) return 'text-blue-600 dark:text-blue-400';
    if (p >= 30) return 'text-amber-600 dark:text-amber-400';
    return 'text-muted-foreground';
  };

  const getBarColor = (p: number) => {
    if (p >= 85) return 'bg-brand-gold';
    if (p >= 70) return 'bg-green-500';
    if (p >= 50) return 'bg-blue-500';
    if (p >= 30) return 'bg-amber-500';
    return 'bg-muted-foreground/50';
  };

  // ─── Render Loading ──────────────────────────────────────────

  const renderLoading = () => (
    <div className="p-4 space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );

  // ─── Render Error ────────────────────────────────────────────

  const renderError = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <BarChart3 className="w-12 h-12 text-muted-foreground mb-3" />
      <h3 className="font-semibold text-foreground mb-1">Unable to Load Rankings</h3>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      <Button variant="outline" onClick={fetchPercentiles}>
        Try Again
      </Button>
    </div>
  );

  // ─── Render Content ──────────────────────────────────────────

  const renderContent = () => {
    if (!percentiles) return renderError();

    const maxDistCount = Math.max(...distribution.map(d => d.count), 1);

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 space-y-4"
      >
        {/* Overall Percentile Badge */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-red to-brand-gold p-6 text-center text-white">
              <Trophy className="w-10 h-10 mx-auto mb-2" />
              <h2 className="text-sm font-medium opacity-80">Overall Percentile</h2>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-5xl font-bold">{overallPercentile}</span>
                <span className="text-2xl opacity-70">%</span>
              </div>
              <Badge className="mt-2 bg-white/20 text-white border-white/30">
                {getPercentileLabel(overallPercentile)}
              </Badge>
              <p className="text-xs opacity-70 mt-2">
                Compared with {totalPlayers} player{totalPlayers !== 1 ? 's' : ''}
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Individual Stat Percentiles */}
        {Object.entries(percentiles).map(([key, stat]) => {
          const config = STAT_CONFIG[stat.label] || STAT_CONFIG['Total Points'];
          const IconComp = config.icon;

          return (
            <motion.div key={key} variants={itemVariants}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <IconComp className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">{stat.label}</h3>
                        <span className={`font-bold text-lg ${getPercentileColor(stat.percentile)}`}>
                          Top {100 - stat.percentile}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-sm text-muted-foreground">
                          {stat.value}{stat.suffix || ''}
                        </span>
                        <span className={`text-xs font-medium ${getPercentileColor(stat.percentile)}`}>
                          {getPercentileLabel(stat.percentile)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Percentile bar */}
                  <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={`absolute inset-y-0 left-0 rounded-full ${getBarColor(stat.percentile)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.percentile}%` }}
                      transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                    />
                    {/* Marker for current position */}
                    <motion.div
                      className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow"
                      initial={{ left: 0 }}
                      animate={{ left: `${stat.percentile}%` }}
                      transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                    />
                  </div>

                  {/* Percentile markers */}
                  <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Distribution Chart */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-brand-red" />
                <h3 className="font-semibold text-foreground">How You Compare</h3>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Distribution of total points across all {totalPlayers} players
              </p>

              {/* Simple bar chart */}
              <div className="space-y-2">
                {distribution.map((bucket, index) => {
                  const barWidth = maxDistCount > 0 ? (bucket.count / maxDistCount) * 100 : 0;
                  const isYourBucket = overallPercentile >= index * 10 && overallPercentile < (index + 1) * 10;

                  return (
                    <div key={bucket.range} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-10 text-right flex-shrink-0">
                        {bucket.range}
                      </span>
                      <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden relative">
                        <motion.div
                          className={`absolute inset-y-0 left-0 rounded-full ${
                            isYourBucket ? 'bg-brand-red' : 'bg-muted-foreground/30'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                        />
                        {isYourBucket && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white">YOU</span>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground w-6 flex-shrink-0">
                        {bucket.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info card */}
        <motion.div variants={itemVariants}>
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">About Percentile Rankings</p>
                  <p>
                    Your percentile shows how you compare with other players. If you&apos;re in the
                    Top 15%, it means you perform better than 85% of all players in that stat.
                    Play more matches to improve your rankings!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    );
  };

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
            <h1 className="font-bold text-foreground">Percentile Rankings</h1>
            <p className="text-xs text-muted-foreground">See how you compare</p>
          </div>
          <Badge className="bg-brand-red/10 text-brand-red border-brand-red/20">
            <Users className="w-3 h-3 mr-1" />
            {totalPlayers} players
          </Badge>
        </div>
      </div>

      {/* Content */}
      {loading ? renderLoading() : error ? renderError() : renderContent()}
    </div>
  );
}
