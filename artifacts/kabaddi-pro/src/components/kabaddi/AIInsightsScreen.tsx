'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Brain, Sparkles, TrendingUp, BarChart3,
  AlertTriangle, Lightbulb, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import PremiumLock from './PremiumLock';

// ─── Types ────────────────────────────────────────────────────────

interface AIInsightsScreenProps {
  onClose: () => void;
  matchId?: string;
}

interface Insight {
  id: string;
  type: 'prediction' | 'form_analysis' | 'recommendation' | 'milestone_alert';
  confidence: number;
  content: string;
  matchContext?: string;
  createdAt: string;
}

// ─── Config ───────────────────────────────────────────────────────

const INSIGHT_TYPE_CONFIG: Record<string, {
  label: string;
  icon: typeof TrendingUp;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  prediction: {
    label: 'Prediction',
    icon: TrendingUp,
    color: 'text-brand-teal',
    bgColor: 'bg-brand-teal/10',
    borderColor: 'border-brand-teal/30',
  },
  form_analysis: {
    label: 'Form Analysis',
    icon: BarChart3,
    color: 'text-brand-navy',
    bgColor: 'bg-brand-navy/10',
    borderColor: 'border-brand-navy/30',
  },
  recommendation: {
    label: 'Recommendation',
    icon: Lightbulb,
    color: 'text-brand-gold',
    bgColor: 'bg-brand-gold/10',
    borderColor: 'border-brand-gold/30',
  },
  milestone_alert: {
    label: 'Milestone Alert',
    icon: AlertTriangle,
    color: 'text-brand-red',
    bgColor: 'bg-brand-red/10',
    borderColor: 'border-brand-red/30',
  },
};

// ─── Animation Variants ──────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function AIInsightsScreen({ onClose, matchId }: AIInsightsScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || false;
  const { toast } = useToast();

  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // ─── Fetch existing insights ──────────────────────────────────

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (matchId) params.set('matchId', matchId);
      const res = await fetch(`/api/ai-insights?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      } else {
        // If API doesn't exist yet, show empty state
        setInsights([]);
      }
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  // ─── Generate new insight ─────────────────────────────────────

  const handleGenerateInsight = async () => {
    if (!isPremium) {
      toast({
        title: 'Premium Feature',
        description: 'Upgrade to Pro to generate AI insights',
        variant: 'destructive',
      });
      return;
    }

    if (!matchId) {
      toast({
        title: 'No Match Selected',
        description: 'Select a match to generate insights',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.insight) {
          setInsights((prev) => [data.insight, ...prev]);
        }
        toast({ title: 'Insight Generated!', description: 'New AI insight is ready' });
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to generate insight', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate insight. Please try again.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
    >
      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-navy to-brand-red">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">AI INSIGHTS</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="px-4 py-4">
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Generate Button */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Generate AI Insights">
              <Button
                onClick={handleGenerateInsight}
                disabled={generating}
                className="w-full h-12 bg-gradient-to-r from-brand-navy to-brand-red hover:opacity-90 text-white font-bold text-sm rounded-xl shadow-lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Insight...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate New Insight
                  </>
                )}
              </Button>
            </PremiumLock>
          </motion.div>

          {/* Loading Skeletons */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-warm-100 dark:bg-warm-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            /* Empty State */
            <motion.div variants={itemVariants}>
              <Card className="p-8 text-center border-warm-200">
                <div className="w-16 h-16 rounded-full bg-brand-navy/10 flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-brand-navy/40" />
                </div>
                <h3 className="text-warm-700 dark:text-warm-200 font-bold text-sm">No insights yet</h3>
                <p className="text-warm-400 text-xs mt-1 max-w-[260px] mx-auto">
                  Generate one from a match! AI analyzes player form, patterns, and trends to deliver actionable insights.
                </p>
              </Card>
            </motion.div>
          ) : (
            /* Insights List */
            <AnimatePresence>
              {insights.map((insight, index) => {
                const config = INSIGHT_TYPE_CONFIG[insight.type] || INSIGHT_TYPE_CONFIG.prediction;
                const Icon = config.icon;

                return (
                  <motion.div
                    key={insight.id}
                    variants={itemVariants}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <Card className={`border ${config.borderColor} overflow-hidden`}>
                      <CardContent className="p-4">
                        {/* Type Badge & Confidence */}
                        <div className="flex items-center justify-between mb-3">
                          <Badge
                            className={`${config.bgColor} ${config.color} text-[10px] font-bold border-0 px-2 py-0.5`}
                          >
                            <Icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-warm-500 font-semibold">
                              Confidence
                            </span>
                            <div className="w-20 h-2 bg-warm-200 rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{
                                  backgroundColor:
                                    insight.confidence >= 80
                                      ? '#14B8A6'
                                      : insight.confidence >= 50
                                        ? '#F59E0B'
                                        : '#DC2626',
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${insight.confidence}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                              />
                            </div>
                            <span className="text-xs font-bold text-warm-700 dark:text-warm-200">
                              {insight.confidence}%
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <p className="text-sm text-warm-800 dark:text-warm-100 leading-relaxed">
                          {insight.content}
                        </p>

                        {/* Match Context */}
                        {insight.matchContext && (
                          <div className="mt-3 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal" />
                            <span className="text-[11px] text-warm-500 font-medium">
                              {insight.matchContext}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
