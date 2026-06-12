'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, X, Clock, Shield, Swords, Crown, Share2,
  Calendar, Zap, MapPin, Sparkles, Play, Flame,
  Target, Lock, AlertCircle, Users, Timer,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useKabaddiStore, type EventType } from '@/lib/store';
import ShareScorecard from './ShareScorecard';
import MatchHighlightsScreen from './MatchHighlightsScreen';
import MatchReplayScreen from './MatchReplayScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchTeam {
  id: string;
  name: string;
  shortName?: string;
  color?: string;
}

interface MatchEventDB {
  id: string;
  matchId: string;
  teamId: string;
  playerId?: string;
  eventType: string;
  value: number;
  details?: string;
  half: number;
  timestamp: string;
}

interface MotmUser {
  id: string;
  name: string;
  avatar?: string;
}

interface MatchData {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  events: MatchEventDB[];
  scorers: { id: string; matchId: string; userId: string; user: { id: string; name: string; avatar?: string } }[];
  motmUser: MotmUser | null;
  tournament: { id: string; name: string } | null;
  status: string;
  gender?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  halfDuration: number;
  playersPerSide: number;
  isPractice: boolean;
  venue?: string | null;
  ground?: string | null;
}

interface MatchDetailsScreenProps {
  matchId: string;
  onClose: () => void;
}

// ─── Event icon / label map using lucide icon names ──────────────────────────

const EVENT_META: Record<string, { lucideIcon: string; label: string; isRaid: boolean; isTackle: boolean }> = {
  raid_point:       { lucideIcon: 'Zap',     label: 'Raid Point',      isRaid: true,  isTackle: false },
  bonus_point:      { lucideIcon: 'Target',  label: 'Bonus Point',     isRaid: true,  isTackle: false },
  tackle_point:     { lucideIcon: 'Shield',  label: 'Tackle Point',    isRaid: false, isTackle: true  },
  super_raid:       { lucideIcon: 'Flame',   label: 'Super Raid',      isRaid: true,  isTackle: false },
  super_tackle:     { lucideIcon: 'Lock',    label: 'Super Tackle',    isRaid: false, isTackle: true  },
  do_or_die_raid:   { lucideIcon: 'Zap',     label: 'Do-or-Die Raid',  isRaid: true,  isTackle: false },
  all_out:          { lucideIcon: 'Flame',   label: 'All Out',         isRaid: false, isTackle: false },
  timeout:          { lucideIcon: 'Clock',   label: 'Timeout',         isRaid: false, isTackle: false },
  yellow_card:      { lucideIcon: 'AlertCircle', label: 'Yellow Card', isRaid: false, isTackle: false },
  red_card:         { lucideIcon: 'AlertCircle', label: 'Red Card',    isRaid: false, isTackle: false },
  green_card:       { lucideIcon: 'AlertCircle', label: 'Green Card',  isRaid: false, isTackle: false },
};

// Map icon names to components for rendering
function EventIcon({ iconName, className }: { iconName: string; className?: string }) {
  const iconProps = { className };
  switch (iconName) {
    case 'Zap': return <Zap {...iconProps} />;
    case 'Shield': return <Shield {...iconProps} />;
    case 'Flame': return <Flame {...iconProps} />;
    case 'Target': return <Target {...iconProps} />;
    case 'Lock': return <Lock {...iconProps} />;
    case 'Clock': return <Clock {...iconProps} />;
    case 'AlertCircle': return <AlertCircle {...iconProps} />;
    default: return <Zap {...iconProps} />;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '—', time: '' };
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

function formatDuration(isoStart: string | null, isoEnd: string | null): string {
  if (!isoStart || !isoEnd) return '';
  const ms = new Date(isoEnd).getTime() - new Date(isoStart).getTime();
  const totalMins = Math.round(ms / 60000);
  return `${totalMins} min`;
}

function getStatusConfig(status: string): { label: string; color: string; bgColor: string; pulse: boolean } {
  switch (status) {
    case 'LIVE':
    case 'IN_PROGRESS':
      return { label: 'LIVE', color: 'text-red-500', bgColor: 'bg-red-500/10 border-red-500/30', pulse: true };
    case 'COMPLETED':
    case 'FULL_TIME':
      return { label: 'COMPLETED', color: 'text-brand-teal', bgColor: 'bg-brand-teal/10 border-brand-teal/30', pulse: false };
    default:
      return { label: 'UPCOMING', color: 'text-brand-gold', bgColor: 'bg-brand-gold/10 border-brand-gold/30', pulse: false };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchDetailsScreen({ matchId, onClose }: MatchDetailsScreenProps) {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [prevHomeScore, setPrevHomeScore] = useState(0);
  const [prevAwayScore, setPrevAwayScore] = useState(0);
  const [homeScoreFlash, setHomeScoreFlash] = useState(false);
  const [awayScoreFlash, setAwayScoreFlash] = useState(false);

  const { toast } = useToast();
  const activeMatch = useKabaddiStore((s) => s.activeMatch);
  const timelineRef = useRef<HTMLDivElement>(null);

  // ── Fetch match ────────────────────────────────────────────────────────────
  const fetchMatch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches?id=${encodeURIComponent(matchId)}`);
      if (!res.ok) throw new Error('Match not found');
      const data = await res.json();
      setMatch(data.match as MatchData);
    } catch (err) {
      console.error('Match details fetch error:', err);
      setError('Failed to load match details');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  // ── Score change animation ────────────────────────────────────────────────
  useEffect(() => {
    if (!match) return;
    if (match.homeScore !== prevHomeScore && prevHomeScore !== 0) {
      setHomeScoreFlash(true);
      const timer = setTimeout(() => setHomeScoreFlash(false), 800);
      return () => clearTimeout(timer);
    }
    if (match.awayScore !== prevAwayScore && prevAwayScore !== 0) {
      setAwayScoreFlash(true);
      const timer = setTimeout(() => setAwayScoreFlash(false), 800);
      return () => clearTimeout(timer);
    }
    setPrevHomeScore(match.homeScore);
    setPrevAwayScore(match.awayScore);
  }, [match?.homeScore, match?.awayScore, prevHomeScore, prevAwayScore]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const homeColor = match?.homeTeam?.color || '#DC2626';
  const awayColor = match?.awayTeam?.color || '#1E293B';
  const isHomeWin = match ? match.homeScore > match.awayScore : false;
  const isAwayWin = match ? match.awayScore > match.homeScore : false;
  const isDraw = match ? match.homeScore === match.awayScore : false;
  const winnerSide: 'home' | 'away' | 'draw' | null = match
    ? isDraw ? 'draw' : isHomeWin ? 'home' : 'away'
    : null;

  const statusConfig = match ? getStatusConfig(match.status) : getStatusConfig('');

  // ── Player contribution aggregation ────────────────────────────────────────
  const aggregatePlayers = useCallback(() => {
    if (!match) return { topRaiders: [], topDefenders: [] };

    const raidMap: Record<string, { name: string; teamId: string; points: number; raidPoints: number; bonusPoints: number }> = {};
    const tackleMap: Record<string, { name: string; teamId: string; points: number; tacklePoints: number; superTackles: number }> = {};

    // Build player name lookup from scorers
    const scorerNames: Record<string, string> = {};
    for (const s of match.scorers) {
      scorerNames[s.userId] = s.user.name;
    }

    for (const evt of match.events) {
      if (!evt.playerId) continue;
      const meta = EVENT_META[evt.eventType];
      if (!meta) continue;

      const name = scorerNames[evt.playerId] || evt.playerId.slice(0, 6);

      if (meta.isRaid) {
        if (!raidMap[evt.playerId]) raidMap[evt.playerId] = { name, teamId: evt.teamId, points: 0, raidPoints: 0, bonusPoints: 0 };
        raidMap[evt.playerId].points += evt.value;
        if (evt.eventType === 'bonus_point') raidMap[evt.playerId].bonusPoints += evt.value;
        else raidMap[evt.playerId].raidPoints += evt.value;
      }
      if (meta.isTackle) {
        if (!tackleMap[evt.playerId]) tackleMap[evt.playerId] = { name, teamId: evt.teamId, points: 0, tacklePoints: 0, superTackles: 0 };
        tackleMap[evt.playerId].points += evt.value;
        tackleMap[evt.playerId].tacklePoints += evt.value;
        if (evt.eventType === 'super_tackle') tackleMap[evt.playerId].superTackles += 1;
      }
    }

    const topRaiders = Object.values(raidMap).sort((a, b) => b.points - a.points).slice(0, 5);
    const topDefenders = Object.values(tackleMap).sort((a, b) => b.points - a.points).slice(0, 5);

    return { topRaiders, topDefenders };
  }, [match]);

  const { topRaiders, topDefenders } = aggregatePlayers();

  // ── MOTM points ────────────────────────────────────────────────────────────
  const motmPoints = useCallback(() => {
    if (!match?.motmUser) return 0;
    let total = 0;
    for (const evt of match.events) {
      if (evt.playerId === match.motmUser!.id) total += evt.value;
    }
    return total;
  }, [match]);

  // ── Team stats computation ─────────────────────────────────────────────────
  const computeTeamStats = useCallback(() => {
    if (!match) return null;
    let homeRaidPts = 0, awayRaidPts = 0;
    let homeTacklePts = 0, awayTacklePts = 0;
    let homeBonusPts = 0, awayBonusPts = 0;
    let homeAllOuts = 0, awayAllOuts = 0;

    for (const evt of match.events) {
      const isHome = evt.teamId === match.homeTeamId;
      const meta = EVENT_META[evt.eventType];
      if (!meta) continue;

      if (meta.isRaid && evt.eventType !== 'bonus_point') {
        if (isHome) homeRaidPts += evt.value; else awayRaidPts += evt.value;
      }
      if (meta.isTackle) {
        if (isHome) homeTacklePts += evt.value; else awayTacklePts += evt.value;
      }
      if (evt.eventType === 'bonus_point') {
        if (isHome) homeBonusPts += evt.value; else awayBonusPts += evt.value;
      }
      if (evt.eventType === 'all_out') {
        if (isHome) homeAllOuts += 1; else awayAllOuts += 1;
      }
    }

    return {
      home: { total: match.homeScore, raidPoints: homeRaidPts, tacklePoints: homeTacklePts, bonusPoints: homeBonusPts, allOuts: homeAllOuts },
      away: { total: match.awayScore, raidPoints: awayRaidPts, tacklePoints: awayTacklePts, bonusPoints: awayBonusPts, allOuts: awayAllOuts },
    };
  }, [match]);

  const teamStats = computeTeamStats();

  // ── Share data ─────────────────────────────────────────────────────────────
  const buildShareData = useCallback(() => {
    if (!match) return null;
    const motm = match.motmUser ? { name: match.motmUser.name, points: motmPoints() } : null;
    const tr = topRaiders[0] ? { name: topRaiders[0].name, points: topRaiders[0].points } : null;
    const td = topDefenders[0] ? { name: topDefenders[0].name, points: topDefenders[0].points } : null;
    return {
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeTeamColor: homeColor,
      awayTeamColor: awayColor,
      tournament: match.tournament?.name || null,
      date: match.startedAt,
      venue: match.venue || null,
      gender: match.gender || null,
      topRaider: tr,
      topDefender: td,
      motm,
    };
  }, [match, homeColor, awayColor, motmPoints, topRaiders, topDefenders]);

  // ── Sorted events (chronological, oldest first) ────────────────────────────
  const sortedEvents = match
    ? [...match.events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
    : [];

  // ── Half progress calculation ──────────────────────────────────────────────
  const getHalfProgress = useCallback(() => {
    if (!match?.startedAt) return 0;
    const start = new Date(match.startedAt).getTime();
    const now = match.completedAt
      ? new Date(match.completedAt).getTime()
      : Date.now();
    const halfDurationMs = match.halfDuration * 60 * 1000;
    const totalMatchMs = halfDurationMs * 2;
    const elapsed = Math.min(now - start, totalMatchMs);
    return Math.round((elapsed / totalMatchMs) * 100);
  }, [match]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-50 flex flex-col"
      >
        {/* ── Header bar ── */}
        <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-200/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
                <Swords className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-800">MATCH DETAILS</h1>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-200 flex items-center justify-center text-warm-600 dark:text-warm-600 hover:bg-warm-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="px-4 py-8 space-y-4">
              <div className="h-48 rounded-2xl bg-warm-100 dark:bg-warm-100 animate-pulse" />
              <div className="h-24 rounded-2xl bg-warm-100 dark:bg-warm-100 animate-pulse" />
              <div className="h-64 rounded-2xl bg-warm-100 dark:bg-warm-100 animate-pulse" />
            </div>
          ) : error || !match ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <Shield className="w-12 h-12 text-warm-300 dark:text-warm-300 mb-3" />
              <p className="text-warm-600 dark:text-warm-600 text-sm font-medium">{error || 'Match not found'}</p>
              <Button onClick={fetchMatch} variant="outline" className="mt-4 rounded-xl">
                Retry
              </Button>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-4 pb-28">

              {/* ════════════════════════════════════════════════════════════════
                  1. ENHANCED MATCH HEADER
                  ════════════════════════════════════════════════════════════════ */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="overflow-hidden border-0 shadow-lg text-white py-0 gap-0">
                  {/* Team color gradient banner */}
                  <div
                    className="relative px-5 pt-4 pb-2"
                    style={{
                      background: `linear-gradient(135deg, ${homeColor} 0%, ${homeColor}cc 35%, ${awayColor}cc 65%, ${awayColor} 100%)`,
                    }}
                  >
                    {/* Match status badge */}
                    <div className="flex items-center justify-between mb-4">
                      <Badge className={`text-[10px] font-black tracking-wider border px-2.5 py-1 ${statusConfig.bgColor} ${statusConfig.color}`}>
                        {statusConfig.pulse && (
                          <span className="relative flex h-2 w-2 mr-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                          </span>
                        )}
                        {statusConfig.label}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-white/20 text-white text-[10px] font-semibold border-0 px-2 py-0.5">
                          {match.isPractice ? 'Practice' : 'Tournament'}
                        </Badge>
                        <Badge className={`text-[10px] font-semibold border-0 px-2 py-0.5 ${
                          match.gender === 'male' ? 'bg-brand-blue/40 text-brand-blue-light' : 'bg-pink-500/30 text-pink-200'
                        }`}>
                          {match.gender === 'male' ? '♂ Boys' : '♀ Girls'}
                        </Badge>
                      </div>
                    </div>

                    {/* Teams & Score */}
                    <div className="flex items-center justify-between pb-3">
                      {/* Home Team */}
                      <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="flex-1 text-center"
                      >
                        <div className="relative inline-block">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10, stiffness: 150, delay: 0.2 }}
                            className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-xl mx-auto ring-4 ring-white/20"
                            style={{ backgroundColor: homeColor }}
                          >
                            {match.homeTeam.shortName?.charAt(0).toUpperCase() || match.homeTeam.name.charAt(0).toUpperCase()}
                          </motion.div>
                          {winnerSide === 'home' && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.5 }}
                              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-brand-gold flex items-center justify-center shadow-lg"
                            >
                              <Trophy className="w-3.5 h-3.5 text-white" />
                            </motion.div>
                          )}
                        </div>
                        <p className={`font-bold text-sm mt-2.5 truncate px-1 ${
                          isHomeWin ? 'text-brand-gold' : 'text-white/90'
                        }`}>
                          {match.homeTeam.name}
                        </p>
                        {match.homeTeam.shortName && (
                          <span className="text-[10px] font-bold text-white/50 tracking-wide">{match.homeTeam.shortName}</span>
                        )}
                        {isHomeWin && (
                          <span className="text-brand-gold text-[10px] font-bold tracking-wider block mt-0.5">WINNER</span>
                        )}
                      </motion.div>

                      {/* VS Divider & Score */}
                      <div className="px-2 text-center flex flex-col items-center">
                        {/* VS badge */}
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', damping: 8, stiffness: 150, delay: 0.3 }}
                          className="mb-3"
                        >
                          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                            <span className="text-xs font-black text-white/70">VS</span>
                          </div>
                        </motion.div>

                        {/* Score */}
                        <div className="flex items-center gap-2">
                          <motion.span
                            key={`home-${match.homeScore}`}
                            initial={homeScoreFlash ? { scale: 1.3 } : {}}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 8 }}
                            className={`text-5xl font-black tabular-nums ${
                              isHomeWin ? 'text-brand-gold' : 'text-white'
                            }`}
                            style={homeScoreFlash ? {
                              textShadow: '0 0 20px rgba(245,158,11,0.6), 0 0 40px rgba(245,158,11,0.3)',
                            } : {}}
                          >
                            {match.homeScore}
                          </motion.span>
                          <span className="text-white/30 text-xl font-medium">-</span>
                          <motion.span
                            key={`away-${match.awayScore}`}
                            initial={awayScoreFlash ? { scale: 1.3 } : {}}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 8 }}
                            className={`text-5xl font-black tabular-nums ${
                              isAwayWin ? 'text-brand-gold' : 'text-white'
                            }`}
                            style={awayScoreFlash ? {
                              textShadow: '0 0 20px rgba(245,158,11,0.6), 0 0 40px rgba(245,158,11,0.3)',
                            } : {}}
                          >
                            {match.awayScore}
                          </motion.span>
                        </div>
                        {isDraw && (
                          <Badge className="bg-brand-gold/20 text-brand-gold text-[10px] font-bold border-0 mt-2">
                            DRAW
                          </Badge>
                        )}
                      </div>

                      {/* Away Team */}
                      <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="flex-1 text-center"
                      >
                        <div className="relative inline-block">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10, stiffness: 150, delay: 0.2 }}
                            className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-xl mx-auto ring-4 ring-white/20"
                            style={{ backgroundColor: awayColor }}
                          >
                            {match.awayTeam.shortName?.charAt(0).toUpperCase() || match.awayTeam.name.charAt(0).toUpperCase()}
                          </motion.div>
                          {winnerSide === 'away' && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.5 }}
                              className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-brand-gold flex items-center justify-center shadow-lg"
                            >
                              <Trophy className="w-3.5 h-3.5 text-white" />
                            </motion.div>
                          )}
                        </div>
                        <p className={`font-bold text-sm mt-2.5 truncate px-1 ${
                          isAwayWin ? 'text-brand-gold' : 'text-white/90'
                        }`}>
                          {match.awayTeam.name}
                        </p>
                        {match.awayTeam.shortName && (
                          <span className="text-[10px] font-bold text-white/50 tracking-wide">{match.awayTeam.shortName}</span>
                        )}
                        {isAwayWin && (
                          <span className="text-brand-gold text-[10px] font-bold tracking-wider block mt-0.5">WINNER</span>
                        )}
                      </motion.div>
                    </div>
                  </div>

                  {/* Half indicator with progress bar */}
                  <div className="bg-brand-navy-dark px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white/50 text-[10px] font-bold tracking-wider">MATCH PROGRESS</span>
                      <span className="text-white/50 text-[10px] font-semibold">
                        {match.halfDuration}min halves · {match.playersPerSide}v{match.playersPerSide}
                      </span>
                    </div>
                    <Progress
                      value={getHalfProgress()}
                      className="h-1.5 bg-white/10"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-white/40 text-[9px]">1st Half</span>
                      <span className="text-white/40 text-[9px]">2nd Half</span>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* ════════════════════════════════════════════════════════════════
                  2. MAN OF THE MATCH (Enhanced)
                  ════════════════════════════════════════════════════════════════ */}
              {match.motmUser && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <Card className="card-shine border-2 border-brand-gold/40 bg-gradient-to-r from-brand-gold/10 via-brand-gold/5 to-brand-gold-dark/10 py-0 gap-0 overflow-hidden dark:from-brand-gold/15 dark:via-brand-gold/5 dark:to-brand-gold-dark/15">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar with golden ring */}
                        <div className="relative shrink-0">
                          <div className="w-16 h-16 rounded-full bg-warm-100 dark:bg-warm-100 border-[3px] border-brand-gold/60 flex items-center justify-center overflow-hidden shadow-lg shadow-brand-gold/20">
                            {match.motmUser.avatar ? (
                              <img
                                src={match.motmUser.avatar}
                                alt={match.motmUser.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xl font-bold text-warm-500 dark:text-warm-500">
                                {match.motmUser.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.3 }}
                            className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-brand-gold flex items-center justify-center shadow-lg"
                          >
                            <Crown className="w-3.5 h-3.5 text-white" />
                          </motion.div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <Badge className="bg-brand-gold/20 text-brand-gold-dark dark:text-brand-gold text-[10px] font-semibold border-0 px-2 py-0.5 mb-1">
                            <Crown className="w-2.5 h-2.5 mr-0.5" />
                            Man of the Match
                          </Badge>
                          <p className="text-warm-800 dark:text-warm-800 font-bold text-sm truncate">
                            {match.motmUser.name}
                          </p>
                          {(() => {
                            const motmEvents = match.events.filter(e => e.playerId === match.motmUser!.id);
                            const teamId = motmEvents[0]?.teamId;
                            const teamName = teamId === match.homeTeamId ? match.homeTeam.name
                              : teamId === match.awayTeamId ? match.awayTeam.name : null;
                            return teamName ? (
                              <p className="text-warm-500 dark:text-warm-500 text-xs">{teamName}</p>
                            ) : null;
                          })()}
                        </div>

                        {/* Points */}
                        <div className="text-right shrink-0">
                          <motion.p
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.4 }}
                            className="text-brand-gold font-black text-2xl"
                          >
                            {motmPoints()}
                          </motion.p>
                          <p className="text-warm-400 dark:text-warm-400 text-[10px]">points</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  3. ENHANCED EVENT TIMELINE
                  ════════════════════════════════════════════════════════════════ */}
              {sortedEvents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                >
                  <Card className="border-warm-200/60 dark:border-warm-200/60 py-0 gap-0 overflow-hidden">
                    <div className="px-4 pt-4 pb-2">
                      <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-700 flex items-center gap-2">
                        <Timer className="w-4 h-4 text-brand-red" />
                        MATCH TIMELINE
                      </h3>
                    </div>
                    <div ref={timelineRef} className="max-h-96 overflow-y-auto custom-scrollbar px-4 pb-4 scroll-smooth">
                      <div className="relative">
                        {/* Timeline vertical line */}
                        <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-warm-200 dark:bg-warm-200" />

                        {sortedEvents.map((evt, idx) => {
                          const meta = EVENT_META[evt.eventType] || { lucideIcon: 'Zap', label: evt.eventType, isRaid: false, isTackle: false };
                          const isHome = evt.teamId === match.homeTeamId;
                          const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;
                          const teamColor = isHome ? homeColor : awayColor;
                          const evtTime = new Date(evt.timestamp);
                          const timeStr = evtTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                          // Find player name
                          const scorer = match.scorers.find(s => s.userId === evt.playerId);
                          const playerName = scorer?.user?.name || null;

                          // Half separator
                          const showHalfSeparator =
                            idx === 0
                              ? true
                              : evt.half !== sortedEvents[idx - 1].half;

                          return (
                            <div key={evt.id}>
                              {/* Half divider - sticky */}
                              {showHalfSeparator && (
                                <div className="sticky top-0 z-10 flex items-center gap-2 mb-2 mt-2 first:mt-0 bg-warm-50 dark:bg-warm-50 py-1">
                                  <div className="flex-1 h-px bg-warm-200 dark:bg-warm-200" />
                                  <Badge className="bg-brand-navy/10 dark:bg-brand-navy/10 text-brand-navy dark:text-brand-navy text-[10px] font-bold border-0 px-3 py-0.5 rounded-full">
                                    {evt.half === 1 ? '1st Half' : '2nd Half'}
                                  </Badge>
                                  <div className="flex-1 h-px bg-warm-200 dark:bg-warm-200" />
                                </div>
                              )}

                              {/* Event row - color-coded by team */}
                              <motion.div
                                initial={{ opacity: 0, x: isHome ? -16 : 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.6) }}
                                className={`flex items-start gap-3 mb-2.5 ${!isHome ? 'flex-row-reverse' : ''}`}
                              >
                                {/* Timeline dot */}
                                <div
                                  className="w-[14px] h-[14px] rounded-full border-[3px] border-white dark:border-warm-50 shadow-sm shrink-0 mt-1.5 z-[1]"
                                  style={{ backgroundColor: teamColor }}
                                />

                                {/* Event card */}
                                <div className={`flex-1 max-w-[85%] rounded-xl px-3 py-2.5 transition-shadow hover:shadow-md ${
                                  isHome
                                    ? 'bg-gradient-to-r from-warm-100 to-warm-100/60 dark:from-warm-100 dark:to-warm-100/60 border border-warm-200/60 dark:border-warm-200/60'
                                    : 'bg-gradient-to-l from-warm-100 to-warm-100/60 dark:from-warm-100 dark:to-warm-100/60 border border-warm-200/60 dark:border-warm-200/60'
                                }`}>
                                  <div className={`flex items-center gap-1.5 ${!isHome ? 'flex-row-reverse' : ''}`}>
                                    <EventIcon
                                      iconName={meta.lucideIcon}
                                      className="w-3.5 h-3.5"
                                      // Use team color for the icon
                                    />
                                    <span className="text-xs font-semibold text-warm-800 dark:text-warm-800">
                                      {meta.label}
                                    </span>
                                    {evt.value > 0 && (
                                      <Badge className="bg-brand-teal/15 text-brand-teal-dark dark:text-brand-teal text-[9px] font-bold border-0 px-1.5 py-0">
                                        +{evt.value}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className={`flex items-center gap-2 mt-0.5 ${!isHome ? 'flex-row-reverse' : ''}`}>
                                    {playerName && (
                                      <span className="text-[11px] text-warm-600 dark:text-warm-600 font-medium">
                                        {playerName}
                                      </span>
                                    )}
                                    <span
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                      style={{ backgroundColor: teamColor }}
                                    >
                                      {teamName}
                                    </span>
                                    <span className="text-[10px] text-warm-400 dark:text-warm-400">{timeStr}</span>
                                  </div>
                                </div>
                              </motion.div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  4. TEAM COMPARISON SECTION
                  ════════════════════════════════════════════════════════════════ */}
              {teamStats && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <Card className="border-warm-200/60 dark:border-warm-200/60 py-0 gap-0 overflow-hidden">
                    <div className="px-4 pt-4 pb-2">
                      <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-700 flex items-center gap-2">
                        <Swords className="w-4 h-4 text-brand-red" />
                        TEAM COMPARISON
                      </h3>
                    </div>
                    <div className="px-4 pb-4 space-y-3">
                      {/* Team headers */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: homeColor }}
                          >
                            {match.homeTeam.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-warm-700 dark:text-warm-700 truncate max-w-[100px]">{match.homeTeam.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-warm-700 dark:text-warm-700 truncate max-w-[100px]">{match.awayTeam.name}</span>
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                            style={{ backgroundColor: awayColor }}
                          >
                            {match.awayTeam.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                      </div>

                      {/* Stats comparison bars */}
                      {[
                        { label: 'Total Points', home: teamStats.home.total, away: teamStats.away.total },
                        { label: 'Raid Points', home: teamStats.home.raidPoints, away: teamStats.away.raidPoints },
                        { label: 'Tackle Points', home: teamStats.home.tacklePoints, away: teamStats.away.tacklePoints },
                        { label: 'Bonus Points', home: teamStats.home.bonusPoints, away: teamStats.away.bonusPoints },
                        { label: 'All Outs', home: teamStats.home.allOuts, away: teamStats.away.allOuts },
                      ].map((stat, statIdx) => {
                        const maxVal = Math.max(stat.home, stat.away, 1);
                        const homeWin = stat.home > stat.away;
                        const awayWin = stat.away > stat.home;

                        return (
                          <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + statIdx * 0.06 }}
                            className="space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-black ${
                                homeWin ? 'text-brand-gold-dark dark:text-brand-gold' : 'text-warm-600 dark:text-warm-600'
                              }`}>
                                {stat.home}
                              </span>
                              <span className="text-[10px] font-bold text-warm-500 dark:text-warm-500 tracking-wide">{stat.label}</span>
                              <span className={`text-sm font-black ${
                                awayWin ? 'text-brand-gold-dark dark:text-brand-gold' : 'text-warm-600 dark:text-warm-600'
                              }`}>
                                {stat.away}
                              </span>
                            </div>
                            <div className="flex gap-1 h-2.5">
                              {/* Home bar (right-aligned) */}
                              <div className="flex-1 flex justify-end">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(stat.home / maxVal) * 100}%` }}
                                  transition={{ duration: 0.6, delay: 0.3 + statIdx * 0.06 }}
                                  className={`h-full rounded-l-full ${
                                    homeWin
                                      ? 'bg-gradient-to-r from-brand-gold/40 to-brand-gold'
                                      : 'bg-warm-300 dark:bg-warm-300'
                                  }`}
                                />
                              </div>
                              {/* Away bar (left-aligned) */}
                              <div className="flex-1">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(stat.away / maxVal) * 100}%` }}
                                  transition={{ duration: 0.6, delay: 0.3 + statIdx * 0.06 }}
                                  className={`h-full rounded-r-full ${
                                    awayWin
                                      ? 'bg-gradient-to-l from-brand-gold/40 to-brand-gold'
                                      : 'bg-warm-300 dark:bg-warm-300'
                                  }`}
                                />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  5. TOP PERFORMERS (Enhanced)
                  ════════════════════════════════════════════════════════════════ */}
              {(topRaiders.length > 0 || topDefenders.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 }}
                  className="space-y-3"
                >
                  {/* Top Raiders */}
                  {topRaiders.length > 0 && (
                    <Card className="border-warm-200/60 dark:border-warm-200/60 py-0 gap-0 overflow-hidden">
                      <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-700 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-brand-red" />
                          TOP RAIDERS
                        </h3>
                      </div>
                      <div className="px-4 pb-3 space-y-1.5">
                        {topRaiders.map((p, idx) => {
                          const isHome = p.teamId === match.homeTeamId;
                          const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;
                          const teamColor = isHome ? homeColor : awayColor;
                          const bonusPts = p.bonusPoints || 0;
                          const raidPts = p.raidPoints || 0;
                          return (
                            <motion.div
                              key={p.name + p.teamId}
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 + idx * 0.06 }}
                              className="flex items-center gap-3 bg-warm-50 dark:bg-warm-50 rounded-xl px-3 py-2.5 hover:bg-warm-100 dark:hover:bg-warm-100 transition-colors"
                            >
                              {/* Avatar with red raider ring */}
                              <div className="relative shrink-0">
                                <div className="w-9 h-9 rounded-full bg-warm-200 dark:bg-warm-200 flex items-center justify-center ring-2 ring-brand-red/50 text-sm font-bold text-warm-600 dark:text-warm-600">
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div className={`absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white ${
                                  idx === 0 ? 'bg-brand-gold' : idx === 1 ? 'bg-warm-400 dark:bg-warm-400' : 'bg-warm-300 dark:bg-warm-300'
                                }`}>
                                  {idx + 1}
                                </div>
                              </div>

                              {/* Name & team */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-warm-800 dark:text-warm-800 truncate">{p.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: teamColor }}
                                  >
                                    {teamName}
                                  </span>
                                  <span className="text-[9px] text-warm-400 dark:text-warm-400">
                                    {raidPts}R {bonusPts}B
                                  </span>
                                </div>
                              </div>

                              {/* Points */}
                              <div className="text-right shrink-0">
                                <p className="text-brand-red font-black text-base">{p.points}</p>
                                <p className="text-warm-400 dark:text-warm-400 text-[9px] -mt-0.5">raid pts</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {/* Top Defenders */}
                  {topDefenders.length > 0 && (
                    <Card className="border-warm-200/60 dark:border-warm-200/60 py-0 gap-0 overflow-hidden">
                      <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-700 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-brand-blue" />
                          TOP DEFENDERS
                        </h3>
                      </div>
                      <div className="px-4 pb-3 space-y-1.5">
                        {topDefenders.map((p, idx) => {
                          const isHome = p.teamId === match.homeTeamId;
                          const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;
                          const teamColor = isHome ? homeColor : awayColor;
                          const superTackles = p.superTackles || 0;
                          const tacklePts = p.tacklePoints || 0;
                          return (
                            <motion.div
                              key={p.name + p.teamId}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 + idx * 0.06 }}
                              className="flex items-center gap-3 bg-warm-50 dark:bg-warm-50 rounded-xl px-3 py-2.5 hover:bg-warm-100 dark:hover:bg-warm-100 transition-colors"
                            >
                              {/* Avatar with blue defender ring */}
                              <div className="relative shrink-0">
                                <div className="w-9 h-9 rounded-full bg-warm-200 dark:bg-warm-200 flex items-center justify-center ring-2 ring-brand-blue/50 text-sm font-bold text-warm-600 dark:text-warm-600">
                                  {p.name.charAt(0).toUpperCase()}
                                </div>
                                <div className={`absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white ${
                                  idx === 0 ? 'bg-brand-gold' : idx === 1 ? 'bg-warm-400 dark:bg-warm-400' : 'bg-warm-300 dark:bg-warm-300'
                                }`}>
                                  {idx + 1}
                                </div>
                              </div>

                              {/* Name & team */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-warm-800 dark:text-warm-800 truncate">{p.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: teamColor }}
                                  >
                                    {teamName}
                                  </span>
                                  <span className="text-[9px] text-warm-400 dark:text-warm-400">
                                    {tacklePts}T {superTackles > 0 ? `${superTackles}ST` : ''}
                                  </span>
                                </div>
                              </div>

                              {/* Points */}
                              <div className="text-right shrink-0">
                                <p className="text-brand-blue font-black text-base">{p.points}</p>
                                <p className="text-warm-400 dark:text-warm-400 text-[9px] -mt-0.5">tackle pts</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  6. MATCH INFO FOOTER
                  ════════════════════════════════════════════════════════════════ */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <Card className="border-warm-200/60 dark:border-warm-200/60 py-0 gap-0 overflow-hidden">
                  <div className="px-4 pt-4 pb-2">
                    <h3 className="text-sm font-black tracking-wider text-warm-700 dark:text-warm-700 flex items-center gap-2">
                      <Users className="w-4 h-4 text-warm-400 dark:text-warm-400" />
                      MATCH INFO
                    </h3>
                  </div>
                  <div className="px-4 pb-4 space-y-2.5">
                    {/* Venue */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-brand-red" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-warm-400 dark:text-warm-400 tracking-wide">VENUE</p>
                        <p className="text-sm font-semibold text-warm-800 dark:text-warm-800 truncate">
                          {match.venue || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    {/* Date & Time */}
                    {match.startedAt && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4 text-brand-teal" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-warm-400 dark:text-warm-400 tracking-wide">DATE & TIME</p>
                          <p className="text-sm font-semibold text-warm-800 dark:text-warm-800">
                            {formatDateTime(match.startedAt).date} · {formatDateTime(match.startedAt).time}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Duration */}
                    {match.startedAt && match.completedAt && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 text-brand-gold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-warm-400 dark:text-warm-400 tracking-wide">DURATION</p>
                          <p className="text-sm font-semibold text-warm-800 dark:text-warm-800">
                            {formatDuration(match.startedAt, match.completedAt)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tournament */}
                    {match.tournament && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-brand-navy/10 dark:bg-brand-navy/10 flex items-center justify-center shrink-0">
                          <Trophy className="w-4 h-4 text-brand-navy dark:text-brand-navy" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-warm-400 dark:text-warm-400 tracking-wide">TOURNAMENT</p>
                          <p className="text-sm font-semibold text-warm-800 dark:text-warm-800 truncate">
                            {match.tournament.name}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Gender Category */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-pink-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-warm-400 dark:text-warm-400 tracking-wide">CATEGORY</p>
                        <Badge className={`text-[10px] font-semibold border-0 px-2 py-0.5 mt-0.5 ${
                          match.gender === 'male'
                            ? 'bg-brand-blue/10 text-brand-blue-light dark:text-brand-blue-light'
                            : 'bg-pink-500/10 text-pink-600 dark:text-pink-500'
                        }`}>
                          {match.gender === 'male' ? '♂ Boys' : '♀ Girls'}
                        </Badge>
                      </div>
                    </div>

                    {/* Ground */}
                    {match.ground && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-warm-200/60 dark:bg-warm-200/60 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-warm-500 dark:text-warm-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-warm-400 dark:text-warm-400 tracking-wide">GROUND</p>
                          <p className="text-sm font-semibold text-warm-800 dark:text-warm-800 truncate">
                            {match.ground}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>

            </div>
          )}
        </div>

        {/* ── Enhanced Bottom Action Bar ── */}
        {!loading && match && (
          <div className="sticky bottom-0 bg-white/95 dark:bg-warm-50/95 backdrop-blur-md border-t border-warm-200/60 dark:border-warm-200/60 px-4 py-3 safe-bottom">
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const data = buildShareData();
                  if (data) {
                    setShowShare(true);
                  } else {
                    toast({ title: 'Cannot share', description: 'Match data unavailable' });
                  }
                }}
                className="flex-1 h-11 bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-bold rounded-xl text-xs shadow-md shadow-brand-red/20 transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4 mr-1.5" />
                Share Scorecard
              </Button>
              <Button
                onClick={() => setShowReplay(true)}
                className="flex-1 h-11 bg-gradient-to-r from-brand-navy to-brand-navy-dark hover:from-brand-navy-light hover:to-brand-navy text-white font-bold rounded-xl text-xs shadow-md shadow-brand-navy/20 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 mr-1.5" />
                Watch Replay
              </Button>
              <Button
                onClick={() => setShowHighlights(true)}
                className="flex-1 h-11 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-white font-bold rounded-xl text-xs shadow-md shadow-brand-gold/20 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Highlights
              </Button>
            </div>
          </div>
        )}

        {/* ── Share Scorecard overlay ── */}
        <AnimatePresence>
          {showShare && (() => {
            const data = buildShareData();
            if (!data) return null;
            return (
              <ShareScorecard
                onClose={() => setShowShare(false)}
                matchData={data}
              />
            );
          })()}
        </AnimatePresence>

        {/* ── Match Highlights overlay ── */}
        {showHighlights && matchId && (
          <MatchHighlightsScreen
            matchId={matchId}
            onClose={() => setShowHighlights(false)}
          />
        )}
        {/* ── Match Replay overlay ── */}
        {showReplay && matchId && (
          <MatchReplayScreen
            matchId={matchId}
            onClose={() => setShowReplay(false)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
