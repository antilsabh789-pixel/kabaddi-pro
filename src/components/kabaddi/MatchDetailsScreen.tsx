'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, X, Clock, Shield, Swords, Crown, Share2,
  Calendar, Zap, MapPin, Sparkles, Play,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}

interface MatchDetailsScreenProps {
  matchId: string;
  onClose: () => void;
}

// ─── Event icon / label map ──────────────────────────────────────────────────

const EVENT_META: Record<string, { icon: string; label: string; isRaid: boolean; isTackle: boolean }> = {
  raid_point:       { icon: '⚔️', label: 'Raid Point',      isRaid: true,  isTackle: false },
  bonus_point:      { icon: '🎯', label: 'Bonus Point',      isRaid: true,  isTackle: false },
  tackle_point:     { icon: '🛡️', label: 'Tackle Point',     isRaid: false, isTackle: true  },
  super_raid:       { icon: '💥', label: 'Super Raid',        isRaid: true,  isTackle: false },
  super_tackle:     { icon: '🔒', label: 'Super Tackle',      isRaid: false, isTackle: true  },
  do_or_die_raid:   { icon: '⚡', label: 'Do-or-Die Raid',    isRaid: true,  isTackle: false },
  all_out:          { icon: '🔥', label: 'All Out',           isRaid: false, isTackle: false },
  timeout:          { icon: '⏸️', label: 'Timeout',           isRaid: false, isTackle: false },
  yellow_card:      { icon: '🟨', label: 'Yellow Card',       isRaid: false, isTackle: false },
  red_card:         { icon: '🟥', label: 'Red Card',          isRaid: false, isTackle: false },
  green_card:       { icon: '🟩', label: 'Green Card',        isRaid: false, isTackle: false },
};

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchDetailsScreen({ matchId, onClose }: MatchDetailsScreenProps) {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showReplay, setShowReplay] = useState(false);

  const { toast } = useToast();
  const activeMatch = useKabaddiStore((s) => s.activeMatch);

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

  // ── Derived data ───────────────────────────────────────────────────────────
  const homeColor = match?.homeTeam?.color || '#DC2626';
  const awayColor = match?.awayTeam?.color || '#1E293B';
  const isHomeWin = match ? match.homeScore > match.awayScore : false;
  const isAwayWin = match ? match.awayScore > match.homeScore : false;
  const isDraw = match ? match.homeScore === match.awayScore : false;
  const winnerSide: 'home' | 'away' | 'draw' | null = match
    ? isDraw ? 'draw' : isHomeWin ? 'home' : 'away'
    : null;

  // ── Player contribution aggregation ────────────────────────────────────────
  const aggregatePlayers = useCallback(() => {
    if (!match) return { topRaiders: [], topDefenders: [] };

    const raidMap: Record<string, { name: string; teamId: string; points: number }> = {};
    const tackleMap: Record<string, { name: string; teamId: string; points: number }> = {};

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
        if (!raidMap[evt.playerId]) raidMap[evt.playerId] = { name, teamId: evt.teamId, points: 0 };
        raidMap[evt.playerId].points += evt.value;
      }
      if (meta.isTackle) {
        if (!tackleMap[evt.playerId]) tackleMap[evt.playerId] = { name, teamId: evt.teamId, points: 0 };
        tackleMap[evt.playerId].points += evt.value;
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-warm-50 flex flex-col"
      >
        {/* ── Header bar ── */}
        <header className="sticky top-0 z-10 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
                <Swords className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-sm font-black tracking-wider text-warm-800">MATCH DETAILS</h1>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="px-4 py-8 space-y-4">
              <div className="h-48 rounded-2xl bg-warm-100 animate-pulse" />
              <div className="h-24 rounded-2xl bg-warm-100 animate-pulse" />
              <div className="h-64 rounded-2xl bg-warm-100 animate-pulse" />
            </div>
          ) : error || !match ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <Shield className="w-12 h-12 text-warm-300 mb-3" />
              <p className="text-warm-600 text-sm font-medium">{error || 'Match not found'}</p>
              <Button onClick={fetchMatch} variant="outline" className="mt-4 rounded-xl">
                Retry
              </Button>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-4 pb-28">
              {/* ════════════════════════════════════════════════════════════════
                  1. MATCH HEADER
                  ════════════════════════════════════════════════════════════════ */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-b from-brand-navy to-brand-navy-dark text-white py-0 gap-0">
                  {/* Top ribbon */}
                  <div className="bg-gradient-to-r from-brand-red to-brand-red-dark px-5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-white/90" />
                      <span className="font-black tracking-wider text-xs">FULL TIME</span>
                    </div>
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

                  {/* Scoreboard */}
                  <div className="px-5 pt-6 pb-5">
                    <div className="flex items-center justify-between">
                      {/* Home Team */}
                      <div className="flex-1 text-center">
                        <div className="relative inline-block">
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg mx-auto"
                            style={{ backgroundColor: homeColor }}
                          >
                            {match.homeTeam.name.charAt(0).toUpperCase()}
                          </div>
                          {winnerSide === 'home' && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.3 }}
                              className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center shadow"
                            >
                              <Trophy className="w-3 h-3 text-white" />
                            </motion.div>
                          )}
                        </div>
                        <p className={`font-bold text-sm mt-2 truncate px-1 ${
                          isHomeWin ? 'text-brand-gold' : 'text-white/80'
                        }`}>
                          {match.homeTeam.name}
                        </p>
                        {isHomeWin && (
                          <span className="text-brand-gold text-[10px] font-bold tracking-wide">WINNER</span>
                        )}
                      </div>

                      {/* Score */}
                      <div className="px-4 text-center">
                        <div className="flex items-center gap-3">
                          <span className={`text-5xl font-black tabular-nums ${
                            isHomeWin ? 'text-brand-gold' : 'text-white'
                          }`}>
                            {match.homeScore}
                          </span>
                          <span className="text-white/30 text-xl font-medium">-</span>
                          <span className={`text-5xl font-black tabular-nums ${
                            isAwayWin ? 'text-brand-gold' : 'text-white'
                          }`}>
                            {match.awayScore}
                          </span>
                        </div>
                        {isDraw && (
                          <Badge className="bg-brand-gold/20 text-brand-gold text-[10px] font-bold border-0 mt-2">
                            DRAW
                          </Badge>
                        )}
                      </div>

                      {/* Away Team */}
                      <div className="flex-1 text-center">
                        <div className="relative inline-block">
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg mx-auto"
                            style={{ backgroundColor: awayColor }}
                          >
                            {match.awayTeam.name.charAt(0).toUpperCase()}
                          </div>
                          {winnerSide === 'away' && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.3 }}
                              className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center shadow"
                            >
                              <Trophy className="w-3 h-3 text-white" />
                            </motion.div>
                          )}
                        </div>
                        <p className={`font-bold text-sm mt-2 truncate px-1 ${
                          isAwayWin ? 'text-brand-gold' : 'text-white/80'
                        }`}>
                          {match.awayTeam.name}
                        </p>
                        {isAwayWin && (
                          <span className="text-brand-gold text-[10px] font-bold tracking-wide">WINNER</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="px-5 pb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-white/50 text-[11px]">
                    {match.startedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateTime(match.startedAt).date} · {formatDateTime(match.startedAt).time}
                      </span>
                    )}
                    {match.startedAt && match.completedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(match.startedAt, match.completedAt)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {match.halfDuration}min halves · {match.playersPerSide}v{match.playersPerSide}
                    </span>
                    {match.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {match.venue}
                      </span>
                    )}
                  </div>

                  {/* Tournament */}
                  {match.tournament && (
                    <div className="px-5 pb-4">
                      <Badge className="bg-brand-teal/20 text-brand-teal-light text-[10px] font-semibold border-0">
                        🏟️ {match.tournament.name}
                      </Badge>
                    </div>
                  )}
                </Card>
              </motion.div>

              {/* ════════════════════════════════════════════════════════════════
                  2. MAN OF THE MATCH
                  ════════════════════════════════════════════════════════════════ */}
              {match.motmUser && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <Card className="bg-gradient-to-r from-brand-gold/10 to-brand-gold-dark/5 border-brand-gold/30 py-0 gap-0 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-full bg-warm-100 border-2 border-brand-gold/40 flex items-center justify-center overflow-hidden">
                            {match.motmUser.avatar ? (
                              <img
                                src={match.motmUser.avatar}
                                alt={match.motmUser.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-bold text-warm-500">
                                {match.motmUser.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center shadow">
                            <Crown className="w-3 h-3 text-white" />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <Badge className="bg-brand-gold/20 text-brand-gold-dark text-[10px] font-semibold border-0 px-2 py-0.5 mb-1">
                            <Crown className="w-2.5 h-2.5 mr-0.5" />
                            Man of the Match
                          </Badge>
                          <p className="text-warm-800 font-bold text-sm truncate">
                            {match.motmUser.name}
                          </p>
                          {/* Find team name for MOTM */}
                          {(() => {
                            const motmEvents = match.events.filter(e => e.playerId === match.motmUser!.id);
                            const teamId = motmEvents[0]?.teamId;
                            const teamName = teamId === match.homeTeamId ? match.homeTeam.name
                              : teamId === match.awayTeamId ? match.awayTeam.name : null;
                            return teamName ? (
                              <p className="text-warm-500 text-xs">{teamName}</p>
                            ) : null;
                          })()}
                        </div>

                        {/* Points */}
                        <div className="text-right shrink-0">
                          <p className="text-brand-gold font-black text-xl">{motmPoints()}</p>
                          <p className="text-warm-400 text-[10px]">points</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  3. EVENT TIMELINE
                  ════════════════════════════════════════════════════════════════ */}
              {sortedEvents.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                >
                  <Card className="border-warm-200/60 py-0 gap-0 overflow-hidden">
                    <div className="px-4 pt-4 pb-2">
                      <h3 className="text-sm font-black tracking-wider text-warm-700 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-warm-400" />
                        EVENT TIMELINE
                      </h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar px-4 pb-4">
                      <div className="relative">
                        {/* Timeline vertical line */}
                        <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-warm-200" />

                        {sortedEvents.map((evt, idx) => {
                          const meta = EVENT_META[evt.eventType] || { icon: '📌', label: evt.eventType, isRaid: false, isTackle: false };
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
                              {/* Half divider */}
                              {showHalfSeparator && (
                                <div className="flex items-center gap-2 mb-2 mt-2 first:mt-0">
                                  <div className="flex-1 h-px bg-warm-200" />
                                  <Badge className="bg-warm-200 text-warm-600 text-[10px] font-bold border-0 px-3 py-0.5 rounded-full">
                                    {evt.half === 1 ? '1st Half' : '2nd Half'}
                                  </Badge>
                                  <div className="flex-1 h-px bg-warm-200" />
                                </div>
                              )}

                              {/* Event row */}
                              <motion.div
                                initial={{ opacity: 0, x: isHome ? -12 : 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.25, delay: idx * 0.02 }}
                                className={`flex items-start gap-3 mb-2 ${!isHome ? 'flex-row-reverse' : ''}`}
                              >
                                {/* Timeline dot */}
                                <div
                                  className="w-[14px] h-[14px] rounded-full border-2 border-white shadow-sm shrink-0 mt-1 z-[1]"
                                  style={{ backgroundColor: teamColor }}
                                />

                                {/* Event card */}
                                <div className={`flex-1 max-w-[85%] rounded-xl px-3 py-2 ${
                                  isHome
                                    ? 'bg-warm-100 border border-warm-200/60'
                                    : 'bg-warm-100 border border-warm-200/60'
                                }`}>
                                  <div className={`flex items-center gap-1.5 ${!isHome ? 'flex-row-reverse' : ''}`}>
                                    <span className="text-sm">{meta.icon}</span>
                                    <span className="text-xs font-semibold text-warm-800">
                                      {meta.label}
                                    </span>
                                    {evt.value > 0 && (
                                      <Badge className="bg-brand-teal/15 text-brand-teal-dark text-[9px] font-bold border-0 px-1.5 py-0">
                                        +{evt.value}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className={`flex items-center gap-2 mt-0.5 ${!isHome ? 'flex-row-reverse' : ''}`}>
                                    {playerName && (
                                      <span className="text-[11px] text-warm-600 font-medium">
                                        {playerName}
                                      </span>
                                    )}
                                    <span
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                      style={{ backgroundColor: teamColor }}
                                    >
                                      {teamName}
                                    </span>
                                    <span className="text-[10px] text-warm-400">{timeStr}</span>
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
                  4. PLAYER CONTRIBUTIONS
                  ════════════════════════════════════════════════════════════════ */}
              {(topRaiders.length > 0 || topDefenders.length > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="space-y-3"
                >
                  {/* Top Raiders */}
                  {topRaiders.length > 0 && (
                    <Card className="border-warm-200/60 py-0 gap-0 overflow-hidden">
                      <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-black tracking-wider text-warm-700 flex items-center gap-2">
                          <Swords className="w-4 h-4 text-brand-red" />
                          TOP RAIDERS
                        </h3>
                      </div>
                      <div className="px-4 pb-3 space-y-1.5">
                        {topRaiders.map((p, idx) => {
                          const isHome = p.teamId === match.homeTeamId;
                          const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;
                          const teamColor = isHome ? homeColor : awayColor;
                          return (
                            <motion.div
                              key={p.name + p.teamId}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="flex items-center gap-3 bg-warm-50 rounded-xl px-3 py-2"
                            >
                              {/* Rank */}
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                                idx === 0 ? 'bg-brand-gold' : idx === 1 ? 'bg-warm-400' : 'bg-warm-300'
                              }`}>
                                {idx + 1}
                              </div>

                              {/* Name & team */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-warm-800 truncate">{p.name}</p>
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white inline-block"
                                  style={{ backgroundColor: teamColor }}
                                >
                                  {teamName}
                                </span>
                              </div>

                              {/* Points */}
                              <div className="text-right shrink-0">
                                <p className="text-brand-red font-black text-base">{p.points}</p>
                                <p className="text-warm-400 text-[9px] -mt-0.5">raid pts</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {/* Top Defenders */}
                  {topDefenders.length > 0 && (
                    <Card className="border-warm-200/60 py-0 gap-0 overflow-hidden">
                      <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-black tracking-wider text-warm-700 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-brand-blue" />
                          TOP DEFENDERS
                        </h3>
                      </div>
                      <div className="px-4 pb-3 space-y-1.5">
                        {topDefenders.map((p, idx) => {
                          const isHome = p.teamId === match.homeTeamId;
                          const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;
                          const teamColor = isHome ? homeColor : awayColor;
                          return (
                            <motion.div
                              key={p.name + p.teamId}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="flex items-center gap-3 bg-warm-50 rounded-xl px-3 py-2"
                            >
                              {/* Rank */}
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                                idx === 0 ? 'bg-brand-gold' : idx === 1 ? 'bg-warm-400' : 'bg-warm-300'
                              }`}>
                                {idx + 1}
                              </div>

                              {/* Name & team */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-warm-800 truncate">{p.name}</p>
                                <span
                                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white inline-block"
                                  style={{ backgroundColor: teamColor }}
                                >
                                  {teamName}
                                </span>
                              </div>

                              {/* Points */}
                              <div className="text-right shrink-0">
                                <p className="text-brand-blue font-black text-base">{p.points}</p>
                                <p className="text-warm-400 text-[9px] -mt-0.5">tackle pts</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom bar ── */}
        {!loading && match && (
          <div className="sticky bottom-0 bg-white/90 backdrop-blur-md border-t border-warm-200/60 px-4 py-3 safe-bottom flex gap-2">
            <Button
              onClick={() => setShowReplay(true)}
              className="flex-1 h-12 bg-brand-navy hover:bg-brand-blue text-white font-bold rounded-xl text-sm"
            >
              <Play className="w-4 h-4 mr-2" />
              Replay
            </Button>
            <Button
              onClick={() => setShowHighlights(true)}
              className="flex-1 h-12 bg-brand-gold hover:bg-brand-gold-dark text-white font-bold rounded-xl text-sm"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Highlights
            </Button>
            <Button
              onClick={() => {
                const data = buildShareData();
                if (data) {
                  setShowShare(true);
                } else {
                  toast({ title: 'Cannot share', description: 'Match data unavailable' });
                }
              }}
              className="flex-1 h-12 bg-brand-teal hover:bg-brand-teal-dark text-white font-bold rounded-xl text-sm"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
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
