'use client';

import { useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Share2, Download, Trophy, Copy, Check, MessageCircle,
  ExternalLink, Sun, Moon, Eye, EyeOff, MapPin, Calendar, Clock,
  Swords, Shield, Crown, Zap,
} from 'lucide-react';
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
    weightCategory?: string | null;
    topRaider?: { name: string; points: number } | null;
    topDefender?: { name: string; points: number } | null;
    motm?: { name: string; points: number } | null;
    homeHalfScore?: number | null;
    awayHalfScore?: number | null;
    duration?: number | null;
    commentary?: string | null;
  };
}

export default function ShareScorecard({ onClose, matchData }: ShareScorecardProps) {
  const scorecardRef = useRef<HTMLDivElement>(null);
  const [showPlayerStats, setShowPlayerStats] = useState(true);
  const [cardTheme, setCardTheme] = useState<'dark' | 'light'>('dark');
  const [copied, setCopied] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const isHomeWin = matchData.homeScore > matchData.awayScore;
  const isAwayWin = matchData.awayScore > matchData.homeScore;
  const isDraw = matchData.homeScore === matchData.awayScore;
  const isDark = cardTheme === 'dark';

  const captureScorecard = useCallback(async () => {
    if (!scorecardRef.current) return null;
    try {
      return await toPng(scorecardRef.current, {
        quality: 0.95, pixelRatio: 2,
        backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
      });
    } catch (err) {
      console.error('Failed to capture scorecard:', err);
      return null;
    }
  }, [isDark]);

  const handleDownload = useCallback(async () => {
    const dataUrl = await captureScorecard();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `kabaddi-${matchData.homeTeam}-vs-${matchData.awayTeam}.png`;
    link.href = dataUrl;
    link.click();
  }, [captureScorecard, matchData.homeTeam, matchData.awayTeam]);

  const handleCopyToClipboard = useCallback(async () => {
    const dataUrl = await captureScorecard();
    if (!dataUrl) return;
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error('Copy failed:', err); }
  }, [captureScorecard]);

  const handleWebShare = useCallback(async () => {
    const dataUrl = await captureScorecard();
    if (!dataUrl) return;
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'kabaddi-scorecard.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Kabaddi Pro Scorecard',
          text: `${matchData.homeTeam} ${matchData.homeScore} - ${matchData.awayScore} ${matchData.awayTeam}`,
          files: [file],
        });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2000);
      } else { await handleCopyToClipboard(); }
    } catch (err) { console.error('Share failed:', err); }
  }, [captureScorecard, matchData, handleCopyToClipboard]);

  const handleWhatsApp = useCallback(async () => {
    const dataUrl = await captureScorecard();
    if (!dataUrl) return;
    try {
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
        const text = encodeURIComponent(`${matchData.homeTeam} ${matchData.homeScore} - ${matchData.awayScore} ${matchData.awayTeam}\n\nShared via Kabaddi Pro`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }
    } catch {
      const text = encodeURIComponent(`${matchData.homeTeam} ${matchData.homeScore} - ${matchData.awayScore} ${matchData.awayTeam}\n\nShared via Kabaddi Pro`);
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  }, [captureScorecard, matchData]);

  const handleTwitter = useCallback(() => {
    const text = encodeURIComponent(`${matchData.homeTeam} ${matchData.homeScore} - ${matchData.awayScore} ${matchData.awayTeam}\n\n#KabaddiPro #Kabaddi`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  }, [matchData]);

  const matchDate = matchData.date
    ? new Date(matchData.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const txt = (dark: string, light: string) => isDark ? dark : light;
  const bg = (dark: string, light: string) => isDark ? dark : light;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm flex flex-col gap-3 my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <div className="flex justify-end">
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Controls */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowPlayerStats(!showPlayerStats)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${showPlayerStats ? 'bg-brand-teal/20 text-brand-teal' : 'bg-white/10 text-white/40'}`}>
              {showPlayerStats ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Stats
            </button>
            <button onClick={() => setCardTheme(cardTheme === 'dark' ? 'light' : 'dark')} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${cardTheme === 'dark' ? 'bg-brand-gold/20 text-brand-gold' : 'bg-warm-800/20 text-warm-300'}`}>
              {cardTheme === 'dark' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />} {cardTheme === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>

          {/* ═══ SCORECARD ═══ */}
          <div ref={scorecardRef} className="rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: bg('#0F172A', '#FFFFFF'), fontFamily: 'system-ui, -apple-system, sans-serif' }}>

            {/* Header bar with brand */}
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${matchData.homeTeamColor}, ${matchData.awayTeamColor})` }}>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-white" />
                <span className="font-black tracking-widest text-sm text-white">KABADDI PRO</span>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white">FULL TIME</span>
            </div>

            {/* ═══ Teams & Score — Big, bold, team-colored ═══ */}
            <div className="px-5 pt-6 pb-5">
              <div className="flex items-center justify-between gap-3">
                {/* Home Team */}
                <div className="flex-1 text-center">
                  <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-2xl shadow-lg" style={{ backgroundColor: matchData.homeTeamColor, boxShadow: `0 6px 20px ${matchData.homeTeamColor}50` }}>
                    {matchData.homeTeam.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-black text-base mt-2 truncate" style={{ color: isHomeWin ? '#F59E0B' : txt('#FFFFFF', '#1E293B') }}>{matchData.homeTeam}</p>
                  {isHomeWin && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider mt-0.5 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}><Crown className="w-2.5 h-2.5" /> Winner</span>}
                </div>

                {/* Score */}
                <div className="text-center shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-6xl font-black leading-none" style={{ color: isHomeWin ? '#F59E0B' : txt('#FFFFFF', '#1E293B') }}>{matchData.homeScore}</span>
                    <span className="text-3xl font-light" style={{ color: txt('#475569', '#CBD5E1') }}>-</span>
                    <span className="text-6xl font-black leading-none" style={{ color: isAwayWin ? '#F59E0B' : txt('#FFFFFF', '#1E293B') }}>{matchData.awayScore}</span>
                  </div>
                  {isDraw && <span className="text-[10px] font-bold mt-1 block" style={{ color: txt('#94A3B8', '#64748B') }}>DRAW</span>}
                  {matchData.weightCategory && (
                    <span className="text-[9px] mt-1 block font-semibold" style={{ color: '#F59E0B' }}>
                      {matchData.weightCategory === 'open' ? '♾️ Open' : `⚖️ ${matchData.weightCategory}`}
                    </span>
                  )}
                </div>

                {/* Away Team */}
                <div className="flex-1 text-center">
                  <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-2xl shadow-lg" style={{ backgroundColor: matchData.awayTeamColor, boxShadow: `0 6px 20px ${matchData.awayTeamColor}50` }}>
                    {matchData.awayTeam.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-black text-base mt-2 truncate" style={{ color: isAwayWin ? '#F59E0B' : txt('#FFFFFF', '#1E293B') }}>{matchData.awayTeam}</p>
                  {isAwayWin && <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider mt-0.5 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}><Crown className="w-2.5 h-2.5" /> Winner</span>}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="mx-5 h-px" style={{ backgroundColor: txt('rgba(255,255,255,0.08)', 'rgba(0,0,0,0.08)') }} />

            {/* ═══ Top Performers — Card style ═══ */}
            {showPlayerStats && (matchData.topRaider || matchData.topDefender || matchData.motm) && (
              <div className="px-5 py-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: txt('#64748B', '#94A3B8') }}>⭐ Top Performers</p>

                {matchData.motm && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(245,158,11,0.2)' }}>
                        <Trophy className="w-4 h-4" style={{ color: '#F59E0B' }} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: txt('#94A3B8', '#64748B') }}>Man of the Match</p>
                        <p className="text-sm font-bold" style={{ color: '#F59E0B' }}>{matchData.motm.name}</p>
                      </div>
                    </div>
                    <span className="text-lg font-black" style={{ color: '#F59E0B' }}>{matchData.motm.points}<span className="text-[10px] font-normal">pts</span></span>
                  </div>
                )}

                {matchData.topRaider && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(20,184,166,0.1)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(20,184,166,0.2)' }}>
                        <Swords className="w-4 h-4" style={{ color: '#14B8A6' }} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: txt('#94A3B8', '#64748B') }}>Best Raider</p>
                        <p className="text-sm font-bold" style={{ color: txt('#14B8A6', '#0D9488') }}>{matchData.topRaider.name}</p>
                      </div>
                    </div>
                    <span className="text-lg font-black" style={{ color: txt('#14B8A6', '#0D9488') }}>{matchData.topRaider.points}<span className="text-[10px] font-normal">pts</span></span>
                  </div>
                )}

                {matchData.topDefender && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(239,68,68,0.2)' }}>
                        <Shield className="w-4 h-4" style={{ color: '#EF4444' }} />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: txt('#94A3B8', '#64748B') }}>Best Defender</p>
                        <p className="text-sm font-bold" style={{ color: txt('#EF4444', '#DC2626') }}>{matchData.topDefender.name}</p>
                      </div>
                    </div>
                    <span className="text-lg font-black" style={{ color: txt('#EF4444', '#DC2626') }}>{matchData.topDefender.points}<span className="text-[10px] font-normal">pts</span></span>
                  </div>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="mx-5 h-px" style={{ backgroundColor: txt('rgba(255,255,255,0.08)', 'rgba(0,0,0,0.08)') }} />

            {/* ═══ Match Info ═══ */}
            <div className="px-5 py-3 flex items-center justify-center gap-4 flex-wrap text-[10px]" style={{ color: txt('#64748B', '#94A3B8') }}>
              <div className="flex items-center gap-1"><Calendar className="w-3 h-3" />{matchDate}</div>
              {matchData.venue && <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{matchData.venue}</div>}
              {matchData.tournament && <div className="flex items-center gap-1 font-semibold"><Trophy className="w-3 h-3" />{matchData.tournament}</div>}
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 pt-1 flex items-center justify-center gap-1.5 text-[10px]" style={{ color: txt('#475569', '#CBD5E1') }}>
              <Trophy className="w-3 h-3" />
              <span className="font-semibold">Generated by Kabaddi Pro</span>
            </div>
          </div>

          {/* ═══ Share Options ═══ */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3">
            <div className="flex gap-2 mb-2">
              <Button onClick={handleWebShare} className="flex-1 h-10 bg-brand-teal hover:bg-brand-teal-dark text-white font-bold rounded-xl text-xs">
                <Share2 className="w-3.5 h-3.5 mr-1.5" />{shareSuccess ? 'Shared!' : 'Share'}
              </Button>
              <Button onClick={handleDownload} variant="outline" className="flex-1 h-10 border-white/30 text-white hover:bg-white/10 font-bold rounded-xl bg-transparent text-xs">
                <Download className="w-3.5 h-3.5 mr-1.5" />Download
              </Button>
              <Button onClick={handleCopyToClipboard} variant="outline" className="flex-1 h-10 border-white/30 text-white hover:bg-white/10 font-bold rounded-xl bg-transparent text-xs">
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}{copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleWhatsApp} variant="outline" className="flex-1 h-9 border-green-500/40 text-green-400 hover:bg-green-500/10 font-bold rounded-xl bg-transparent text-[11px]">
                <MessageCircle className="w-3.5 h-3.5 mr-1.5" />WhatsApp
              </Button>
              <Button onClick={handleTwitter} variant="outline" className="flex-1 h-9 border-sky-400/40 text-sky-400 hover:bg-sky-500/10 font-bold rounded-xl bg-transparent text-[11px]">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Twitter/X
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
