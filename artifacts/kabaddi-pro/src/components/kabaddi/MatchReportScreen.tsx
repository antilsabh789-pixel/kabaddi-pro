'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, FileText, Sparkles, Clock, Trophy, Swords,
  Calendar, MapPin, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchReportInfo {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeTeamColor: string | null;
  awayTeamColor: string | null;
  status: string;
  tournamentName: string;
  completedAt: string | null;
}

interface MatchReportScreenProps {
  matchId: string;
  onBack: () => void;
}

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // H2 header
    if (line.startsWith('## ')) {
      elements.push(
        <h2
          key={i}
          className="text-lg font-black text-warm-800 dark:text-warm-100 mt-6 mb-2 pb-1 border-b border-warm-200 dark:border-warm-700"
        >
          {line.replace('## ', '')}
        </h2>
      );
      continue;
    }

    // H3 header
    if (line.startsWith('### ')) {
      elements.push(
        <h3
          key={i}
          className="text-base font-bold text-warm-700 dark:text-warm-200 mt-4 mb-2"
        >
          {line.replace('### ', '')}
        </h3>
      );
      continue;
    }

    // Bold
    const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic
    const italicProcessed = boldProcessed.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Empty line = paragraph break
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    elements.push(
      <p
        key={i}
        className="text-sm text-warm-700 dark:text-warm-200 leading-relaxed mb-1"
        dangerouslySetInnerHTML={{ __html: italicProcessed }}
      />
    );
  }

  return elements;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchReportScreen({ matchId, onBack }: MatchReportScreenProps) {
  const { language } = useKabaddiStore();
  const [report, setReport] = useState<string | null>(null);
  const [matchInfo, setMatchInfo] = useState<MatchReportInfo | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/match-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate report');
      }

      const data = await res.json();
      setReport(data.report);
      setMatchInfo(data.matchInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [matchId]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col"
      >
        {/* ─── Header ─── */}
        <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-red-600 flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
                {t('matchReport.title', language)}
              </h1>
            </div>
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!report && !generating && !error && (
            /* ─── Empty state with generate button ─── */
            <div className="flex flex-col items-center justify-center py-16">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-red/10 to-brand-gold/10 flex items-center justify-center mb-4"
              >
                <Sparkles className="w-10 h-10 text-brand-gold" />
              </motion.div>
              <h2 className="text-lg font-black text-warm-800 dark:text-warm-100 mb-2">
                {t('matchReport.generateTitle', language)}
              </h2>
              <p className="text-sm text-warm-500 text-center max-w-xs mb-6">
                {t('matchReport.generateDesc', language)}
              </p>
              <Button
                onClick={generateReport}
                className="bg-gradient-to-r from-brand-red to-brand-gold hover:from-brand-red/90 hover:to-brand-gold/90 text-white font-bold rounded-xl px-6"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {t('matchReport.generateBtn', language)}
              </Button>
            </div>
          )}

          {/* ─── Loading / Generating state ─── */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-16">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="w-16 h-16 rounded-full border-4 border-brand-gold/20 border-t-brand-gold mb-4"
              />
              <h2 className="text-lg font-black text-warm-800 dark:text-warm-100 mb-2">
                {t('matchReport.generating', language)}
              </h2>
              <p className="text-sm text-warm-500 text-center">
                {t('matchReport.generatingDesc', language)}
              </p>

              {/* Skeleton preview */}
              <div className="w-full max-w-lg mt-8 space-y-3">
                <div className="h-6 rounded-lg bg-warm-100 dark:bg-warm-800 animate-pulse w-3/4" />
                <div className="h-4 rounded-lg bg-warm-100 dark:bg-warm-800 animate-pulse w-full" />
                <div className="h-4 rounded-lg bg-warm-100 dark:bg-warm-800 animate-pulse w-5/6" />
                <div className="h-4 rounded-lg bg-warm-100 dark:bg-warm-800 animate-pulse w-4/5" />
                <div className="h-6 rounded-lg bg-warm-100 dark:bg-warm-800 animate-pulse w-2/3 mt-4" />
                <div className="h-4 rounded-lg bg-warm-100 dark:bg-warm-800 animate-pulse w-full" />
                <div className="h-4 rounded-lg bg-warm-100 dark:bg-warm-800 animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {/* ─── Error state ─── */}
          {error && !generating && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-lg font-black text-warm-800 dark:text-warm-100 mb-2">
                {t('matchReport.errorTitle', language)}
              </h2>
              <p className="text-sm text-warm-500 text-center max-w-xs mb-6">{error}</p>
              <Button
                onClick={generateReport}
                variant="outline"
                className="rounded-xl"
              >
                {t('matchReport.retry', language)}
              </Button>
            </div>
          )}

          {/* ─── Report content ─── */}
          {report && matchInfo && (
            <div className="space-y-4">
              {/* Match header card */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                <Card className="border-warm-200 dark:border-warm-700 overflow-hidden">
                  <CardContent className="p-0">
                    {/* Score header */}
                    <div className="flex items-center">
                      <div
                        className="flex-1 p-4 flex flex-col items-center justify-center min-h-[80px]"
                        style={{ background: `linear-gradient(135deg, ${matchInfo.homeTeamColor || '#DC2626'}cc, ${matchInfo.homeTeamColor || '#DC2626'}66)` }}
                      >
                        <span className="text-white/80 text-xs font-bold mb-1">{matchInfo.homeTeam}</span>
                        <span className="text-white text-3xl font-black">{matchInfo.homeScore}</span>
                      </div>
                      <div className="px-3 flex flex-col items-center justify-center bg-warm-50 dark:bg-warm-900 min-h-[80px]">
                        <Swords className="w-5 h-5 text-warm-400 mb-1" />
                        <span className="text-[10px] text-warm-400 font-bold">VS</span>
                      </div>
                      <div
                        className="flex-1 p-4 flex flex-col items-center justify-center min-h-[80px]"
                        style={{ background: `linear-gradient(135deg, ${matchInfo.awayTeamColor || '#1E293B'}cc, ${matchInfo.awayTeamColor || '#1E293B'}66)` }}
                      >
                        <span className="text-white/80 text-xs font-bold mb-1">{matchInfo.awayTeam}</span>
                        <span className="text-white text-3xl font-black">{matchInfo.awayScore}</span>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="px-4 py-2 flex items-center justify-between text-xs text-warm-500 bg-warm-50 dark:bg-warm-900 border-t border-warm-200/60 dark:border-warm-700/60">
                      <div className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        <span>{matchInfo.tournamentName}</span>
                      </div>
                      {matchInfo.completedAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(matchInfo.completedAt)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* AI-generated badge */}
              <div className="flex items-center justify-center gap-2">
                <Badge className="bg-brand-gold/10 text-brand-gold-dark text-[10px]">
                  <Sparkles className="w-2.5 h-2.5 mr-1" />
                  {t('matchReport.aiGenerated', language)}
                </Badge>
              </div>

              {/* Report article */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-warm-200 dark:border-warm-700">
                  <CardContent className="p-4 sm:p-6">
                    <div className="prose-warm">
                      {renderMarkdown(report)}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Regenerate button */}
              <div className="flex justify-center pb-4">
                <Button
                  onClick={generateReport}
                  disabled={generating}
                  variant="outline"
                  className="rounded-xl text-warm-500"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {t('matchReport.regenerate', language)}
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
