'use client';

import { useRef, useCallback, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Share2, Download, Trophy, Copy, Check, MessageCircle,
  ExternalLink, Sun, Moon, Eye, EyeOff, MapPin, Calendar, Clock,
  Swords, Shield, Crown, Zap, Sparkles, Flame, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toPng } from 'html-to-image';
import { generateMatchNarrative, type MatchDataForNarrative } from '@/lib/commentary';

interface PlayerStatRow {
  name: string;
  jerseyNumber?: number;
  raidPoints: number;
  tacklePoints: number;
  bonusPoints: number;
  totalPoints: number;
  isCaptain?: boolean;
}

interface CardEntry {
  type: 'yellow' | 'red' | 'green';
  playerName: string;
  teamName: string;
}

interface ScorecardEvent {
  eventType: string;
  playerName?: string;
  teamName?: string;
  value: number;
  half?: number;
  timestamp?: number;
}

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
    // ─── NEW: full-detail fields (all optional — existing callers still work) ───
    events?: ScorecardEvent[];
    homePlayerStats?: PlayerStatRow[];
    awayPlayerStats?: PlayerStatRow[];
    cards?: CardEntry[];
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

  // ─── AI Commentary narrative (generated from events if not provided) ───
  const aiNarrative = useMemo(() => {
    if (matchData.commentary) return matchData.commentary;
    if (!matchData.events || matchData.events.length === 0) return null;
    const narrativeData: MatchDataForNarrative = {
      homeTeam: matchData.homeTeam,
      awayTeam: matchData.awayTeam,
      homeScore: matchData.homeScore,
      awayScore: matchData.awayScore,
      events: matchData.events,
      homeHalfScore: matchData.homeHalfScore,
      awayHalfScore: matchData.awayHalfScore,
      duration: matchData.duration,
    };
    return generateMatchNarrative(narrativeData);
  }, [matchData]);

  // ─── Key Moments timeline (top 5 impactful events) ───
  const keyMoments = useMemo(() => {
    if (!matchData.events || matchData.events.length === 0) return [];
    const impactfulTypes = ['all_out', 'super_tackle', 'do_or_die_raid', 'raid_point', 'tackle_point', 'bonus_point', 'yellow_card', 'red_card'];
    const filtered = matchData.events
      .filter(e => impactfulTypes.includes(e.eventType))
      .filter(e => {
        // Only include raids with value >= 2, or super tackles, or all-outs, or cards
        if (e.eventType === 'raid_point') return e.value >= 2;
        if (e.eventType === 'tackle_point') return false; // too common
        if (e.eventType === 'bonus_point') return false; // too common
        return true;
      })
      .slice(-6) // last 6 key events
      .reverse();
    return filtered;
  }, [matchData.events]);

  // ─── Player stats: merge home + away, sorted by total points, top 5 ───
  const topPlayers = useMemo(() => {
    const all = [
      ...(matchData.homePlayerStats || []).map(p => ({ ...p, team: matchData.homeTeam, teamColor: matchData.homeTeamColor })),
      ...(matchData.awayPlayerStats || []).map(p => ({ ...p, team: matchData.awayTeam, teamColor: matchData.awayTeamColor })),
    ].filter(p => p.totalPoints > 0);
    return all.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5);
  }, [matchData.homePlayerStats, matchData.awayPlayerStats, matchData.homeTeam, matchData.awayTeam, matchData.homeTeamColor, matchData.awayTeamColor]);

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

            {/* ═══ Half-by-Half Breakdown ═══ */}
            {showPlayerStats && matchData.homeHalfScore != null && matchData.awayHalfScore != null && (
              <div className="px-5 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: txt('#64748B', '#94A3B8') }}>📊 Score Progression</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-center">
                    <p className="text-[9px] font-bold uppercase" style={{ color: txt('#94A3B8', '#64748B') }}>1st Half</p>
                    <p className="text-sm font-black" style={{ color: txt('#FFFFFF', '#1E293B') }}>{matchData.homeHalfScore} - {matchData.awayHalfScore}</p>
                  </div>
                  <div className="w-px h-8" style={{ backgroundColor: txt('rgba(255,255,255,0.08)', 'rgba(0,0,0,0.08)') }} />
                  <div className="flex-1 text-center">
                    <p className="text-[9px] font-bold uppercase" style={{ color: txt('#94A3B8', '#64748B') }}>Full Time</p>
                    <p className="text-sm font-black" style={{ color: '#F59E0B' }}>{matchData.homeScore} - {matchData.awayScore}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mx-5 h-px" style={{ backgroundColor: txt('rgba(255,255,255,0.08)', 'rgba(0,0,0,0.08)') }} />

            {/* ═══ AI Commentary Narrative ═══ */}
            {showPlayerStats && aiNarrative && (
              <div className="px-5 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: txt('#64748B', '#94A3B8') }}>
                  <Sparkles className="w-3 h-3" style={{ color: '#F59E0B' }} /> AI Match Summary
                </p>
                <p className="text-[10px] leading-relaxed" style={{ color: txt('#CBD5E1', '#475569') }}>{aiNarrative}</p>
              </div>
            )}

            {/* Divider */}
            {showPlayerStats && (keyMoments.length > 0 || topPlayers.length > 0) && (
              <div className="mx-5 h-px" style={{ backgroundColor: txt('rgba(255,255,255,0.08)', 'rgba(0,0,0,0.08)') }} />
            )}

            {/* ═══ Key Moments Timeline ═══ */}
            {showPlayerStats && keyMoments.length > 0 && (
              <div className="px-5 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: txt('#64748B', '#94A3B8') }}>
                  <Flame className="w-3 h-3" style={{ color: '#EF4444' }} /> Key Moments
                </p>
                <div className="space-y-1">
                  {keyMoments.map((e, i) => {
                    const icon = e.eventType === 'all_out' ? '💥' :
                                 e.eventType === 'super_tackle' ? '💪' :
                                 e.eventType === 'do_or_die_raid' ? '⚠️' :
                                 e.eventType === 'raid_point' ? '⚔️' :
                                 e.eventType === 'yellow_card' ? '🟨' :
                                 e.eventType === 'red_card' ? '🟥' : '•';
                    const label = e.eventType === 'all_out' ? 'All Out' :
                                  e.eventType === 'super_tackle' ? 'Super Tackle' :
                                  e.eventType === 'do_or_die_raid' ? 'Do-or-Die' :
                                  e.eventType === 'raid_point' ? `${e.value}-pt Raid` :
                                  e.eventType === 'yellow_card' ? 'Yellow Card' :
                                  e.eventType === 'red_card' ? 'Red Card' : e.eventType;
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-[9px]">
                        <span>{icon}</span>
                        <span className="font-bold" style={{ color: txt('#E2E8F0', '#334155') }}>{e.playerName || '—'}</span>
                        {e.teamName && <span style={{ color: txt('#64748B', '#94A3B8') }}>· {e.teamName}</span>}
                        <span className="ml-auto font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: txt('rgba(255,255,255,0.06)', 'rgba(0,0,0,0.04)'), color: txt('#94A3B8', '#64748B') }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Divider */}
            {showPlayerStats && topPlayers.length > 0 && (
              <div className="mx-5 h-px" style={{ backgroundColor: txt('rgba(255,255,255,0.08)', 'rgba(0,0,0,0.08)') }} />
            )}

            {/* ═══ Player Stats (Top 5 by points) ═══ */}
            {showPlayerStats && topPlayers.length > 0 && (
              <div className="px-5 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: txt('#64748B', '#94A3B8') }}>
                  <Activity className="w-3 h-3" style={{ color: '#14B8A6' }} /> Top Performers by Points
                </p>
                <div className="space-y-1">
                  {topPlayers.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-[9px]">
                      <span className="w-3 text-center font-black" style={{ color: i === 0 ? '#F59E0B' : txt('#64748B', '#94A3B8') }}>{i + 1}</span>
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.teamColor }} />
                      <span className="font-bold truncate flex-1" style={{ color: txt('#E2E8F0', '#334155') }}>{p.name}</span>
                      {p.isCaptain && <span className="text-[7px] font-bold px-0.5 rounded" style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}>C</span>}
                      <span style={{ color: txt('#EF4444', '#DC2626') }}>⚔{p.raidPoints}</span>
                      <span style={{ color: txt('#3B82F6', '#2563EB') }}>🛡{p.tacklePoints}</span>
                      <span style={{ color: '#F59E0B' }}>✨{p.bonusPoints}</span>
                      <span className="font-black" style={{ color: txt('#FFFFFF', '#0F172A') }}>{p.totalPoints}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[7px]" style={{ color: txt('#64748B', '#94A3B8') }}>
                  <span>⚔ = raid pts</span>
                  <span>🛡 = tackle pts</span>
                  <span>✨ = bonus</span>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="mx-5 h-px" style={{ backgroundColor: txt('rgba(255,255,255,0.08)', 'rgba(0,0,0,0.08)') }} />
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
