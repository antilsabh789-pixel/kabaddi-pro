'use client';

import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Download, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toPng } from 'html-to-image';

interface ShareScorecardProps {
  onClose: () => void;
  matchData: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    homeTeamColor: string;
    awayTeamColor: string;
    tournament?: string | null;
    date?: string | null;
    venue?: string | null;
    gender?: string | null;
    topRaider?: { name: string; points: number } | null;
    topDefender?: { name: string; points: number } | null;
    motm?: { name: string; points: number } | null;
  };
}

export default function ShareScorecard({ onClose, matchData }: ShareScorecardProps) {
  const scorecardRef = useRef<HTMLDivElement>(null);

  const captureScorecard = useCallback(async () => {
    if (!scorecardRef.current) return null;
    try {
      const dataUrl = await toPng(scorecardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#1E293B',
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to capture scorecard:', err);
      return null;
    }
  }, []);

  const handleShare = useCallback(async () => {
    const dataUrl = await captureScorecard();
    if (!dataUrl) return;

    try {
      // Convert data URL to blob for sharing
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'kabaddi-scorecard.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Kabaddi Pro Scorecard',
          text: `${matchData.homeTeam} ${matchData.homeScore} - ${matchData.awayScore} ${matchData.awayTeam}`,
          files: [file],
        });
      } else {
        // Fallback: download
        const link = document.createElement('a');
        link.download = 'kabaddi-scorecard.png';
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Share failed:', err);
      // Fallback: download
      const link = document.createElement('a');
      link.download = 'kabaddi-scorecard.png';
      link.href = dataUrl;
      link.click();
    }
  }, [captureScorecard, matchData]);

  const handleDownload = useCallback(async () => {
    const dataUrl = await captureScorecard();
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.download = 'kabaddi-scorecard.png';
    link.href = dataUrl;
    link.click();
  }, [captureScorecard]);

  const isHomeWin = matchData.homeScore > matchData.awayScore;
  const isAwayWin = matchData.awayScore > matchData.homeScore;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm flex flex-col gap-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scorecard */}
          <div
            ref={scorecardRef}
            className="rounded-2xl overflow-hidden bg-gradient-to-b from-brand-navy to-brand-navy-dark text-white"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-red to-brand-red-dark px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-white" />
                <span className="font-black tracking-wider text-sm">KABADDI PRO</span>
              </div>
              <span className="text-white/80 text-xs font-semibold">FULL TIME</span>
            </div>

            {/* Scores */}
            <div className="px-5 py-6">
              <div className="flex items-center justify-between">
                {/* Home Team */}
                <div className="flex-1 text-center">
                  <div
                    className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white font-bold text-xl shadow-lg"
                    style={{ backgroundColor: matchData.homeTeamColor }}
                  >
                    {matchData.homeTeam.charAt(0).toUpperCase()}
                  </div>
                  <p className={`font-bold text-sm mt-2 ${isHomeWin ? 'text-brand-gold' : 'text-white/80'}`}>
                    {matchData.homeTeam}
                  </p>
                  {isHomeWin && (
                    <span className="text-brand-gold text-[10px] font-bold">WINNER</span>
                  )}
                </div>

                {/* Score */}
                <div className="px-4 text-center">
                  <div className="flex items-center gap-3">
                    <span className={`text-4xl font-black ${isHomeWin ? 'text-brand-gold' : 'text-white'}`}>
                      {matchData.homeScore}
                    </span>
                    <span className="text-white/40 text-lg font-medium">-</span>
                    <span className={`text-4xl font-black ${isAwayWin ? 'text-brand-gold' : 'text-white'}`}>
                      {matchData.awayScore}
                    </span>
                  </div>
                  {matchData.gender && (
                    <span className="text-white/40 text-[10px] mt-1 block">
                      {matchData.gender === 'male' ? '♂ Boys' : '♀ Girls'} Match
                    </span>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex-1 text-center">
                  <div
                    className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white font-bold text-xl shadow-lg"
                    style={{ backgroundColor: matchData.awayTeamColor }}
                  >
                    {matchData.awayTeam.charAt(0).toUpperCase()}
                  </div>
                  <p className={`font-bold text-sm mt-2 ${isAwayWin ? 'text-brand-gold' : 'text-white/80'}`}>
                    {matchData.awayTeam}
                  </p>
                  {isAwayWin && (
                    <span className="text-brand-gold text-[10px] font-bold">WINNER</span>
                  )}
                </div>
              </div>
            </div>

            {/* Key Stats */}
            {(matchData.topRaider || matchData.topDefender || matchData.motm) && (
              <div className="px-5 pb-4">
                <div className="bg-white/5 rounded-xl p-3 space-y-2">
                  {matchData.motm && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">👑</span>
                        <span className="text-white/60 text-xs">Man of the Match</span>
                      </div>
                      <span className="text-brand-gold text-xs font-bold">{matchData.motm.name} ({matchData.motm.points}pts)</span>
                    </div>
                  )}
                  {matchData.topRaider && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🏃</span>
                        <span className="text-white/60 text-xs">Top Raider</span>
                      </div>
                      <span className="text-brand-teal text-xs font-bold">{matchData.topRaider.name} ({matchData.topRaider.points}pts)</span>
                    </div>
                  )}
                  {matchData.topDefender && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">🛡️</span>
                        <span className="text-white/60 text-xs">Top Defender</span>
                      </div>
                      <span className="text-brand-red-light text-xs font-bold">{matchData.topDefender.name} ({matchData.topDefender.points}pts)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 pb-4">
              <div className="border-t border-white/10 pt-3 flex items-center justify-between">
                <div className="text-white/40 text-[10px]">
                  {matchData.tournament && <p className="font-semibold text-white/60">{matchData.tournament}</p>}
                  {matchData.date && <p>{new Date(matchData.date).toLocaleDateString()}</p>}
                  {matchData.venue && <p>{matchData.venue}</p>}
                </div>
                <div className="flex items-center gap-1.5 text-white/40 text-[10px]">
                  <Trophy className="w-3 h-3" />
                  <span>Scored on Kabaddi Pro</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleShare}
              className="flex-1 h-12 bg-brand-teal hover:bg-brand-teal-dark text-white font-bold rounded-xl"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1 h-12 border-white/30 text-white hover:bg-white/10 font-bold rounded-xl bg-transparent"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
