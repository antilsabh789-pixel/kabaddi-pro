'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, Variants } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  FileText,
  Trophy,
  Swords,
  Shield,
  Star,
  Calendar,
  MapPin,
  Users,
  Clock,
  Award,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ─── Types ────────────────────────────────────────────────────────

interface ScorecardPDFScreenProps {
  matchId: string;
  onBack: () => void;
}

interface TeamScorecard {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  logo: string | null;
  score: number;
  firstHalfScore: number;
  secondHalfScore: number;
}

interface TopPerformer {
  name: string;
  points: number;
  teamName: string;
}

interface Scorecard {
  matchId: string;
  date: string;
  venue: string;
  tournament: string | null;
  gender: string | null;
  weightCategory: string | null;
  status: string;
  isPractice: boolean;
  halfDuration: number;
  playersPerSide: number;
  homeTeam: TeamScorecard;
  awayTeam: TeamScorecard;
  eventsSummary: Record<string, { home: number; away: number }>;
  topPerformers: TopPerformer[];
  totalEvents: number;
}

// ─── Event Type Labels ────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  raid_point: 'Raid Points',
  bonus_point: 'Bonus Points',
  tackle_point: 'Tackle Points',
  super_raid: 'Super Raids',
  super_tackle: 'Super Tackles',
  all_out: 'All Outs',
  empty_raid: 'Empty Raids',
  do_or_die_raid: 'Do-or-Die',
  self_out: 'Self Outs',
  yellow_card: 'Yellow Cards',
  red_card: 'Red Cards',
  green_card: 'Green Cards',
  timeout: 'Timeouts',
  substitution: 'Substitutions',
};

// ─── Animation Variants ───────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 20, stiffness: 180 },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function ScorecardPDFScreen({ matchId, onBack }: ScorecardPDFScreenProps) {
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch Data ──────────────────────────────────────────────

  const fetchScorecard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scorecard-pdf?matchId=${matchId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setScorecard(data.scorecard);
    } catch (err) {
      console.error('Scorecard fetch error:', err);
      setError('Failed to load scorecard');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchScorecard();
  }, [fetchScorecard]);

  // ─── Download PDF ────────────────────────────────────────────

  const handleDownloadPDF = () => {
    if (!scorecard) return;

    const homeColor = scorecard.homeTeam.color || '#DC2626';
    const awayColor = scorecard.awayTeam.color || '#2563EB';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Match Scorecard - ${scorecard.homeTeam.name} vs ${scorecard.awayTeam.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; color: #1a1a1a; }
          .page { max-width: 800px; margin: 0 auto; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #DC2626; padding-bottom: 20px; }
          .header h1 { font-size: 28px; color: #DC2626; margin-bottom: 5px; }
          .header .subtitle { color: #666; font-size: 14px; }
          .match-info { display: flex; justify-content: center; gap: 20px; margin-top: 10px; font-size: 13px; color: #555; }
          .match-info span { display: flex; align-items: center; gap: 4px; }
          .score-section { display: flex; align-items: center; justify-content: center; gap: 30px; margin: 30px 0; padding: 20px; background: #f9f9f9; border-radius: 12px; }
          .team-block { text-align: center; flex: 1; }
          .team-name { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
          .team-score { font-size: 48px; font-weight: 900; }
          .vs { font-size: 20px; font-weight: 700; color: #999; }
          .half-scores { display: flex; justify-content: center; gap: 40px; margin-top: 8px; font-size: 13px; color: #777; }
          .half-scores span { background: #eee; padding: 2px 8px; border-radius: 4px; }
          .result { text-align: center; margin: 10px 0 20px; font-size: 16px; font-weight: 600; color: #DC2626; }
          .section { margin: 20px 0; }
          .section-title { font-size: 16px; font-weight: 700; color: #DC2626; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #eee; display: flex; align-items: center; gap: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
          td { padding: 8px 12px; border-bottom: 1px solid #eee; }
          tr:hover { background: #fafafa; }
          .home-val { text-align: center; font-weight: 600; color: ${homeColor}; }
          .away-val { text-align: center; font-weight: 600; color: ${awayColor}; }
          .performer { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #eee; }
          .performer:hover { background: #fafafa; }
          .performer-rank { font-size: 12px; font-weight: 700; color: #999; width: 24px; }
          .performer-name { flex: 1; font-weight: 500; }
          .performer-team { color: #777; font-size: 12px; }
          .performer-pts { font-weight: 700; color: #DC2626; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; color: #999; font-size: 12px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
          .badge-practice { background: #FEF3C7; color: #92400E; }
          .badge-tournament { background: #DBEAFE; color: #1E40AF; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { padding: 20px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <h1>KABADDI PRO</h1>
            <div class="subtitle">Match Scorecard</div>
            <div class="match-info">
              <span>📅 ${scorecard.date}</span>
              <span>📍 ${scorecard.venue}</span>
              ${scorecard.tournament ? `<span>🏆 ${scorecard.tournament}</span>` : ''}
              ${scorecard.isPractice ? '<span class="badge badge-practice">Practice Match</span>' : '<span class="badge badge-tournament">Tournament</span>'}
            </div>
          </div>

          <div class="score-section">
            <div class="team-block">
              <div class="team-name" style="color: ${homeColor}">${scorecard.homeTeam.name}</div>
              <div class="team-score" style="color: ${homeColor}">${scorecard.homeTeam.score}</div>
              <div class="half-scores">
                <span>1H: ${scorecard.homeTeam.firstHalfScore}</span>
                <span>2H: ${scorecard.homeTeam.secondHalfScore}</span>
              </div>
            </div>
            <div class="vs">VS</div>
            <div class="team-block">
              <div class="team-name" style="color: ${awayColor}">${scorecard.awayTeam.name}</div>
              <div class="team-score" style="color: ${awayColor}">${scorecard.awayTeam.score}</div>
              <div class="half-scores">
                <span>1H: ${scorecard.awayTeam.firstHalfScore}</span>
                <span>2H: ${scorecard.awayTeam.secondHalfScore}</span>
              </div>
            </div>
          </div>

          ${
            scorecard.status === 'completed'
              ? `<div class="result">${
                  scorecard.homeTeam.score > scorecard.awayTeam.score
                    ? `${scorecard.homeTeam.name} wins by ${scorecard.homeTeam.score - scorecard.awayTeam.score} points!`
                    : scorecard.awayTeam.score > scorecard.homeTeam.score
                    ? `${scorecard.awayTeam.name} wins by ${scorecard.awayTeam.score - scorecard.homeTeam.score} points!`
                    : 'Match Drawn!'
                }</div>`
              : `<div class="result">Match ${scorecard.status}</div>`
          }

          <div class="section">
            <div class="section-title">📊 Match Events Summary</div>
            <table>
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th style="text-align: center">${scorecard.homeTeam.shortName || scorecard.homeTeam.name}</th>
                  <th style="text-align: center">${scorecard.awayTeam.shortName || scorecard.awayTeam.name}</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(scorecard.eventsSummary)
                  .filter(([_, vals]) => vals.home > 0 || vals.away > 0)
                  .map(([type, vals]) => `
                    <tr>
                      <td>${EVENT_LABELS[type] || type}</td>
                      <td class="home-val">${vals.home}</td>
                      <td class="away-val">${vals.away}</td>
                    </tr>
                  `).join('')}
                ${Object.keys(scorecard.eventsSummary).filter(k => scorecard.eventsSummary[k].home > 0 || scorecard.eventsSummary[k].away > 0).length === 0 ? '<tr><td colspan="3" style="text-align:center;color:#999;">No events recorded</td></tr>' : ''}
              </tbody>
            </table>
          </div>

          ${
            scorecard.topPerformers.length > 0
              ? `<div class="section">
                  <div class="section-title">⭐ Top Performers</div>
                  ${scorecard.topPerformers.map((p, i) => `
                    <div class="performer">
                      <span class="performer-rank">#${i + 1}</span>
                      <span class="performer-name">${p.name}</span>
                      <span class="performer-team">${p.teamName}</span>
                      <span class="performer-pts">${p.points} pts</span>
                    </div>
                  `).join('')}
                </div>`
              : ''
          }

          <div class="section">
            <div class="section-title">📋 Match Details</div>
            <table>
              <tr><td>Half Duration</td><td style="text-align:right">${scorecard.halfDuration} minutes</td></tr>
              <tr><td>Players Per Side</td><td style="text-align:right">${scorecard.playersPerSide}</td></tr>
              ${scorecard.gender ? `<tr><td>Category</td><td style="text-align:right">${scorecard.gender}</td></tr>` : ''}
              ${scorecard.weightCategory ? `<tr><td>Weight Category</td><td style="text-align:right">${scorecard.weightCategory}</td></tr>` : ''}
              <tr><td>Total Events</td><td style="text-align:right">${scorecard.totalEvents}</td></tr>
            </table>
          </div>

          <div class="footer">
            <p>Generated by Kabaddi Pro • ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  // ─── Render Loading ──────────────────────────────────────────

  const renderLoading = () => (
    <div className="p-4 space-y-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );

  // ─── Render Error ────────────────────────────────────────────

  const renderError = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <FileText className="w-12 h-12 text-muted-foreground mb-3" />
      <h3 className="font-semibold text-foreground mb-1">Unable to Load Scorecard</h3>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      <Button variant="outline" onClick={fetchScorecard}>
        Try Again
      </Button>
    </div>
  );

  // ─── Render Content ──────────────────────────────────────────

  const renderContent = () => {
    if (!scorecard) return renderError();

    const isHomeWinning = scorecard.homeTeam.score > scorecard.awayTeam.score;
    const isDraw = scorecard.homeTeam.score === scorecard.awayTeam.score;

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 space-y-4"
      >
        {/* Download Button */}
        <motion.div variants={itemVariants}>
          <Button
            className="w-full bg-brand-red hover:bg-brand-red/90 text-white"
            onClick={handleDownloadPDF}
          >
            <Download className="w-4 h-4 mr-2" />
            Download as PDF
          </Button>
        </motion.div>

        {/* Score Header */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-red to-brand-gold p-4 text-white">
              {/* Match info */}
              <div className="flex items-center justify-center gap-3 mb-3 text-xs opacity-80">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {scorecard.date}</span>
                <span>•</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {scorecard.venue}</span>
              </div>

              {/* Score display */}
              <div className="flex items-center justify-center gap-4">
                <div className="text-center flex-1">
                  <p className="text-sm font-medium opacity-80">{scorecard.homeTeam.shortName || scorecard.homeTeam.name}</p>
                  <p className="text-4xl font-bold">{scorecard.homeTeam.score}</p>
                  <div className="flex items-center justify-center gap-2 mt-1 text-xs opacity-70">
                    <span>1H: {scorecard.homeTeam.firstHalfScore}</span>
                    <span>2H: {scorecard.homeTeam.secondHalfScore}</span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Swords className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] mt-1 opacity-60">VS</p>
                </div>

                <div className="text-center flex-1">
                  <p className="text-sm font-medium opacity-80">{scorecard.awayTeam.shortName || scorecard.awayTeam.name}</p>
                  <p className="text-4xl font-bold">{scorecard.awayTeam.score}</p>
                  <div className="flex items-center justify-center gap-2 mt-1 text-xs opacity-70">
                    <span>1H: {scorecard.awayTeam.firstHalfScore}</span>
                    <span>2H: {scorecard.awayTeam.secondHalfScore}</span>
                  </div>
                </div>
              </div>

              {/* Result */}
              {scorecard.status === 'completed' && !isDraw && (
                <p className="text-center mt-2 text-sm font-medium">
                  {isHomeWinning ? scorecard.homeTeam.name : scorecard.awayTeam.name} wins by {Math.abs(scorecard.homeTeam.score - scorecard.awayTeam.score)} points!
                </p>
              )}
              {isDraw && scorecard.status === 'completed' && (
                <p className="text-center mt-2 text-sm font-medium">Match Drawn!</p>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Match Info Badges */}
        <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
          {scorecard.isPractice && (
            <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
              Practice Match
            </Badge>
          )}
          {scorecard.tournament && (
            <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
              🏆 {scorecard.tournament}
            </Badge>
          )}
          {scorecard.gender && (
            <Badge variant="outline">{scorecard.gender === 'boys' ? '♂ Boys' : '♀ Girls'}</Badge>
          )}
          {scorecard.weightCategory && (
            <Badge variant="outline">{scorecard.weightCategory}</Badge>
          )}
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {scorecard.halfDuration} min halves
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="w-3 h-3" /> {scorecard.playersPerSide}v{scorecard.playersPerSide}
          </Badge>
        </motion.div>

        {/* Events Summary */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-brand-red" />
                <h3 className="font-semibold text-foreground">Events Summary</h3>
              </div>

              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground px-2">
                  <span>Event</span>
                  <span className="text-center">{scorecard.homeTeam.shortName || scorecard.homeTeam.name}</span>
                  <span className="text-center">{scorecard.awayTeam.shortName || scorecard.awayTeam.name}</span>
                </div>

                {Object.entries(scorecard.eventsSummary)
                  .filter(([_, vals]) => vals.home > 0 || vals.away > 0)
                  .map(([type, vals]) => (
                    <div key={type} className="grid grid-cols-3 gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 text-sm">
                      <span className="text-foreground">{EVENT_LABELS[type] || type}</span>
                      <span className="text-center font-semibold text-brand-red">{vals.home}</span>
                      <span className="text-center font-semibold text-emerald-600 dark:text-emerald-400">{vals.away}</span>
                    </div>
                  ))}

                {Object.keys(scorecard.eventsSummary).filter(k => scorecard.eventsSummary[k].home > 0 || scorecard.eventsSummary[k].away > 0).length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">No events recorded</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Top Performers */}
        {scorecard.topPerformers.length > 0 && (
          <motion.div variants={itemVariants}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-5 h-5 text-brand-gold" />
                  <h3 className="font-semibold text-foreground">Top Performers</h3>
                </div>

                <div className="space-y-2">
                  {scorecard.topPerformers.map((performer, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        index === 0 ? 'bg-brand-gold/10' : index === 1 ? 'bg-gray-100 dark:bg-gray-800' : 'bg-amber-50 dark:bg-amber-900/20'
                      }`}>
                        <span className={`text-sm font-bold ${
                          index === 0 ? 'text-brand-gold' : index === 1 ? 'text-gray-500' : 'text-amber-600'
                        }`}>{index + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{performer.name}</p>
                        <p className="text-xs text-muted-foreground">{performer.teamName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-brand-red">{performer.points} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Match Details */}
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-brand-red" />
                <h3 className="font-semibold text-foreground">Match Details</h3>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium text-foreground">{scorecard.date}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Venue</span>
                  <span className="font-medium text-foreground">{scorecard.venue}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Half Duration</span>
                  <span className="font-medium text-foreground">{scorecard.halfDuration} minutes</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Players Per Side</span>
                  <span className="font-medium text-foreground">{scorecard.playersPerSide}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Total Events</span>
                  <span className="font-medium text-foreground">{scorecard.totalEvents}</span>
                </div>
                {scorecard.tournament && (
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Tournament</span>
                    <span className="font-medium text-foreground">{scorecard.tournament}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Download button at bottom */}
        <motion.div variants={itemVariants}>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleDownloadPDF}
          >
            <Download className="w-4 h-4 mr-2" />
            Download as PDF
          </Button>
        </motion.div>
      </motion.div>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground">Match Scorecard</h1>
            <p className="text-xs text-muted-foreground">Preview and download</p>
          </div>
          {scorecard && (
            <Button size="sm" className="bg-brand-red hover:bg-brand-red/90 text-white" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? renderLoading() : error ? renderError() : renderContent()}
    </div>
  );
}
