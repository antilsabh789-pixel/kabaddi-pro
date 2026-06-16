'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, X, Clock, MapPin, Zap, Crown, Share2,
  Flame, Swords, Shield, Target, TrendingUp, TrendingDown,
  ChevronRight, Star, Play, BarChart3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import PremiumLock from './PremiumLock';
import ShareScorecard from './ShareScorecard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchHighlightsScreenProps {
  matchId: string;
  onClose: () => void;
}

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

interface KeyMoment {
  id: string;
  eventType: string;
  label: string;
  icon: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  playerName?: string;
  value: number;
  half: number;
  timestamp: string;
  description: string;
  homeScoreAtTime: number;
  awayScoreAtTime: number;
}

interface TurningPoint {
  id: string;
  type: 'all_out_lead_change' | 'do_or_die_shift' | 'comeback';
  label: string;
  icon: string;
  description: string;
  teamName: string;
  teamColor: string;
  timestamp: string;
  half: number;
}

interface TopPerformer {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  points: number;
  raidPoints?: number;
  tacklePoints?: number;
  bonusPoints?: number;
}

interface AllOutEvent {
  id: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  homeScoreAtTime: number;
  awayScoreAtTime: number;
  half: number;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HIGHLIGHT_EVENTS = new Set([
  'super_raid',
  'super_tackle',
  'all_out',
  'do_or_die_raid',
]);

const EVENT_META: Record<string, { icon: string; label: string; color: string; dotClass: string }> = {
  raid_point:       { icon: '⚔️', label: 'Raid Point',      color: 'text-brand-red',  dotClass: 'timeline-dot-raid' },
  bonus_point:      { icon: '🎯', label: 'Bonus Point',      color: 'text-brand-gold', dotClass: 'timeline-dot-bonus' },
  tackle_point:     { icon: '🛡️', label: 'Tackle Point',     color: 'text-brand-teal', dotClass: 'timeline-dot-tackle' },
  super_raid:       { icon: '💥', label: 'Super Raid',        color: 'text-brand-gold', dotClass: 'timeline-dot-raid' },
  super_tackle:     { icon: '🔒', label: 'Super Tackle',      color: 'text-brand-gold', dotClass: 'timeline-dot-tackle' },
  do_or_die_raid:   { icon: '⚡', label: 'Do-or-Die Raid',    color: 'text-brand-gold', dotClass: 'timeline-dot-raid' },
  all_out:          { icon: '🔥', label: 'All Out',           color: 'text-purple-500', dotClass: 'timeline-dot-allout' },
  timeout:          { icon: '⏸️', label: 'Timeout',           color: 'text-warm-400',   dotClass: 'timeline-dot' },
  yellow_card:      { icon: '🟨', label: 'Yellow Card',       color: 'text-yellow-500', dotClass: 'timeline-dot' },
  red_card:         { icon: '🟥', label: 'Red Card',          color: 'text-red-500',    dotClass: 'timeline-dot' },
  green_card:       { icon: '🟩', label: 'Green Card',        color: 'text-green-500',  dotClass: 'timeline-dot' },
};

const EVENT_BORDER_COLOR: Record<string, string> = {
  raid_point: 'border-l-brand-red',
  bonus_point: 'border-l-brand-gold',
  tackle_point: 'border-l-brand-teal',
  super_raid: 'border-l-brand-red',
  super_tackle: 'border-l-brand-teal',
  do_or_die_raid: 'border-l-brand-red',
  all_out: 'border-l-purple-500',
  timeout: 'border-l-warm-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(isoStart: string | null, isoEnd: string | null): string {
  if (!isoStart || !isoEnd) return '';
  const ms = new Date(isoEnd).getTime() - new Date(isoStart).getTime();
  const totalMins = Math.round(ms / 60000);
  return `${totalMins} min`;
}

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', damping: 20, stiffness: 260 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 22, stiffness: 240 },
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchHighlightsScreen({ matchId, onClose }: MatchHighlightsScreenProps) {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [activeHalf, setActiveHalf] = useState<1 | 2 | 'all'>('all');

  const { toast } = useToast();

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
      console.error('Match highlights fetch error:', err);
      setError('Failed to load match highlights');
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

  // Build scorer name lookup
  const scorerNames = useMemo(() => {
    if (!match) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const s of match.scorers) {
      map[s.userId] = s.user.name;
    }
    return map;
  }, [match]);

  // ── Sorted events (chronological) ──────────────────────────────────────────
  const sortedEvents = useMemo(() => {
    if (!match) return [];
    return [...match.events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [match]);

  // ── Filtered events by half ────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (activeHalf === 'all') return sortedEvents;
    return sortedEvents.filter(e => e.half === activeHalf);
  }, [sortedEvents, activeHalf]);

  // ── Key Moments (with score at time) ───────────────────────────────────────
  const keyMoments = useMemo((): KeyMoment[] => {
    if (!match) return [];

    const moments: KeyMoment[] = [];
    let homeScore = 0;
    let awayScore = 0;
    let leadingTeamId: string | null = null;

    for (const evt of sortedEvents) {
      const isHome = evt.teamId === match.homeTeamId;
      const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;
      const teamColor = isHome ? homeColor : awayColor;
      const playerName = evt.playerId ? scorerNames[evt.playerId] : undefined;

      if (isHome) {
        homeScore += evt.value;
      } else {
        awayScore += evt.value;
      }

      const currentLeader = homeScore > awayScore
        ? match.homeTeamId
        : awayScore > homeScore
          ? match.awayTeamId
          : null;

      const isComeback = currentLeader !== null
        && leadingTeamId !== null
        && currentLeader !== leadingTeamId
        && sortedEvents.indexOf(evt) > 0;

      leadingTeamId = currentLeader;

      if (HIGHLIGHT_EVENTS.has(evt.eventType)) {
        const meta = EVENT_META[evt.eventType] || { icon: '📌', label: evt.eventType, color: 'text-warm-500', dotClass: 'timeline-dot' };
        let description = '';

        switch (evt.eventType) {
          case 'super_raid':
            description = `${playerName || teamName} scores 3+ points in a single raid!`;
            break;
          case 'super_tackle':
            description = `${playerName || teamName} executes a super tackle with 3 or fewer defenders!`;
            break;
          case 'all_out':
            description = `${teamName} inflicts an All Out — entire opposition sent off the mat!`;
            break;
          case 'do_or_die_raid':
            description = `${playerName || teamName} delivers in the crucial Do-or-Die raid!`;
            break;
        }

        moments.push({
          id: evt.id,
          eventType: evt.eventType,
          label: meta.label,
          icon: meta.icon,
          teamId: evt.teamId,
          teamName,
          teamColor,
          playerName,
          value: evt.value,
          half: evt.half,
          timestamp: evt.timestamp,
          description,
          homeScoreAtTime: homeScore,
          awayScoreAtTime: awayScore,
        });
      }

      if (isComeback && currentLeader !== null) {
        const comebackTeam = currentLeader === match.homeTeamId ? match.homeTeam : match.awayTeam;
        const comebackColor = currentLeader === match.homeTeamId ? homeColor : awayColor;
        moments.push({
          id: `comeback_${evt.id}`,
          eventType: 'comeback',
          label: 'Comeback!',
          icon: '🔄',
          teamId: currentLeader,
          teamName: comebackTeam.name,
          teamColor: comebackColor,
          value: 0,
          half: evt.half,
          timestamp: evt.timestamp,
          description: `${comebackTeam.name} takes the lead! The momentum shifts!`,
          homeScoreAtTime: homeScore,
          awayScoreAtTime: awayScore,
        });
      }
    }

    return moments;
  }, [match, sortedEvents, homeColor, awayColor, scorerNames]);

  // ── Filtered key moments by half ───────────────────────────────────────────
  const filteredKeyMoments = useMemo(() => {
    if (activeHalf === 'all') return keyMoments;
    return keyMoments.filter(m => m.half === activeHalf);
  }, [keyMoments, activeHalf]);

  // ── Top Raiders ────────────────────────────────────────────────────────────
  const topRaiders = useMemo((): TopPerformer[] => {
    if (!match) return [];
    const map: Record<string, TopPerformer> = {};
    for (const evt of match.events) {
      if (!evt.playerId) continue;
      const name = scorerNames[evt.playerId] || evt.playerId.slice(0, 6);
      const isHome = evt.teamId === match.homeTeamId;
      if (['raid_point', 'super_raid', 'do_or_die_raid'].includes(evt.eventType)) {
        if (!map[evt.playerId]) {
          map[evt.playerId] = {
            playerId: evt.playerId,
            name,
            teamId: evt.teamId,
            teamName: isHome ? match.homeTeam.name : match.awayTeam.name,
            teamColor: isHome ? homeColor : awayColor,
            points: 0,
            raidPoints: 0,
            tacklePoints: 0,
            bonusPoints: 0,
          };
        }
        map[evt.playerId].points += evt.value;
        map[evt.playerId].raidPoints! += evt.value;
      }
    }
    return Object.values(map).sort((a, b) => b.points - a.points).slice(0, 5);
  }, [match, scorerNames, homeColor, awayColor]);

  // ── Top Defenders ──────────────────────────────────────────────────────────
  const topDefenders = useMemo((): TopPerformer[] => {
    if (!match) return [];
    const map: Record<string, TopPerformer> = {};
    for (const evt of match.events) {
      if (!evt.playerId) continue;
      const name = scorerNames[evt.playerId] || evt.playerId.slice(0, 6);
      const isHome = evt.teamId === match.homeTeamId;
      if (['tackle_point', 'super_tackle'].includes(evt.eventType)) {
        if (!map[evt.playerId]) {
          map[evt.playerId] = {
            playerId: evt.playerId,
            name,
            teamId: evt.teamId,
            teamName: isHome ? match.homeTeam.name : match.awayTeam.name,
            teamColor: isHome ? homeColor : awayColor,
            points: 0,
            raidPoints: 0,
            tacklePoints: 0,
            bonusPoints: 0,
          };
        }
        map[evt.playerId].points += evt.value;
        map[evt.playerId].tacklePoints! += evt.value;
      }
    }
    return Object.values(map).sort((a, b) => b.points - a.points).slice(0, 5);
  }, [match, scorerNames, homeColor, awayColor]);

  // ── Super Raids ────────────────────────────────────────────────────────────
  const superRaids = useMemo(() => {
    if (!match) return [];
    return match.events
      .filter(e => e.eventType === 'super_raid')
      .map(e => {
        const isHome = e.teamId === match.homeTeamId;
        const playerName = e.playerId ? scorerNames[e.playerId] : undefined;
        return {
          id: e.id,
          playerName: playerName || 'Unknown',
          teamName: isHome ? match.homeTeam.name : match.awayTeam.name,
          teamColor: isHome ? homeColor : awayColor,
          points: e.value,
          half: e.half,
        };
      });
  }, [match, scorerNames, homeColor, awayColor]);

  // ── All Outs ───────────────────────────────────────────────────────────────
  const allOuts = useMemo((): AllOutEvent[] => {
    if (!match) return [];
    const outs: AllOutEvent[] = [];
    let homeScore = 0;
    let awayScore = 0;
    for (const evt of sortedEvents) {
      const isHome = evt.teamId === match.homeTeamId;
      if (isHome) homeScore += evt.value;
      else awayScore += evt.value;
      if (evt.eventType === 'all_out') {
        const teamName = isHome ? match.homeTeam.name : match.awayTeam.name;
        const teamColor = isHome ? homeColor : awayColor;
        outs.push({
          id: evt.id,
          teamId: evt.teamId,
          teamName,
          teamColor,
          homeScoreAtTime: homeScore,
          awayScoreAtTime: awayScore,
          half: evt.half,
          timestamp: evt.timestamp,
        });
      }
    }
    return outs;
  }, [match, sortedEvents, homeColor, awayColor]);

  // ── MVP Breakdown ──────────────────────────────────────────────────────────
  const mvpBreakdown = useMemo(() => {
    if (!match?.motmUser) return null;

    let raidPoints = 0;
    let tacklePoints = 0;
    let bonusPoints = 0;

    for (const evt of match.events) {
      if (evt.playerId !== match.motmUser.id) continue;
      switch (evt.eventType) {
        case 'raid_point':
        case 'super_raid':
        case 'do_or_die_raid':
          raidPoints += evt.value;
          break;
        case 'tackle_point':
        case 'super_tackle':
          tacklePoints += evt.value;
          break;
        case 'bonus_point':
          bonusPoints += evt.value;
          break;
      }
    }

    const totalPoints = raidPoints + tacklePoints + bonusPoints;
    const motmTeamId = match.events.find(e => e.playerId === match.motmUser!.id)?.teamId;
    const teamName = motmTeamId === match.homeTeamId
      ? match.homeTeam.name
      : motmTeamId === match.awayTeamId
        ? match.awayTeam.name
        : '';

    return {
      raidPoints,
      tacklePoints,
      bonusPoints,
      totalPoints,
      teamName,
    };
  }, [match]);

  // ── Score Progression (for momentum graph) ─────────────────────────────────
  const scoreProgression = useMemo(() => {
    if (!match) return [];

    let homeScore = 0;
    let awayScore = 0;
    const progression: { index: number; homeScore: number; awayScore: number; gap: number; half: number }[] = [];

    progression.push({ index: 0, homeScore: 0, awayScore: 0, gap: 0, half: 1 });

    sortedEvents.forEach((evt, idx) => {
      const isHome = evt.teamId === match.homeTeamId;
      if (isHome) {
        homeScore += evt.value;
      } else {
        awayScore += evt.value;
      }
      progression.push({
        index: idx + 1,
        homeScore,
        awayScore,
        gap: homeScore - awayScore,
        half: evt.half,
      });
    });

    return progression;
  }, [match, sortedEvents]);

  // ── Turning Points ─────────────────────────────────────────────────────────
  const turningPoints = useMemo((): TurningPoint[] => {
    if (!match) return [];

    const points: TurningPoint[] = [];
    let homeScore = 0;
    let awayScore = 0;
    let prevLeader: 'home' | 'away' | 'draw' = 'draw';

    for (const evt of sortedEvents) {
      const isHome = evt.teamId === match.homeTeamId;
      if (isHome) {
        homeScore += evt.value;
      } else {
        awayScore += evt.value;
      }

      const currentLeader: 'home' | 'away' | 'draw' =
        homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';

      if (evt.eventType === 'all_out' && currentLeader !== prevLeader && currentLeader !== 'draw') {
        const team = currentLeader === 'home' ? match.homeTeam : match.awayTeam;
        const color = currentLeader === 'home' ? homeColor : awayColor;
        points.push({
          id: `tp_ao_${evt.id}`,
          type: 'all_out_lead_change',
          label: 'All Out Lead Change',
          icon: '🔥',
          description: `${team.name}'s All Out flipped the lead! ${homeScore}-${awayScore}`,
          teamName: team.name,
          teamColor: color,
          timestamp: evt.timestamp,
          half: evt.half,
        });
      }

      if (evt.eventType === 'do_or_die_raid' && currentLeader !== prevLeader && currentLeader !== 'draw') {
        const team = currentLeader === 'home' ? match.homeTeam : match.awayTeam;
        const color = currentLeader === 'home' ? homeColor : awayColor;
        points.push({
          id: `tp_dod_${evt.id}`,
          type: 'do_or_die_shift',
          label: 'Do-or-Die Shift',
          icon: '⚡',
          description: `${team.name} seized the lead in a Do-or-Die raid! ${homeScore}-${awayScore}`,
          teamName: team.name,
          teamColor: color,
          timestamp: evt.timestamp,
          half: evt.half,
        });
      }

      if (currentLeader !== 'draw' && currentLeader !== prevLeader) {
        const prevGap = Math.abs(homeScore - awayScore);
        if (prevGap >= 3) {
          const team = currentLeader === 'home' ? match.homeTeam : match.awayTeam;
          const color = currentLeader === 'home' ? homeColor : awayColor;
          points.push({
            id: `tp_cb_${evt.id}`,
            type: 'comeback',
            label: 'Comeback Moment',
            icon: '🔄',
            description: `${team.name} fights back from ${prevGap} points down to take the lead!`,
            teamName: team.name,
            teamColor: color,
            timestamp: evt.timestamp,
            half: evt.half,
          });
        }
      }

      prevLeader = currentLeader;
    }

    return points;
  }, [match, sortedEvents, homeColor, awayColor]);

  // ── Half scores ────────────────────────────────────────────────────────────
  const halfScores = useMemo(() => {
    if (!match) return { h1Home: 0, h1Away: 0, h2Home: 0, h2Away: 0 };
    let h1Home = 0, h1Away = 0, h2Home = 0, h2Away = 0;
    for (const evt of sortedEvents) {
      const isHome = evt.teamId === match.homeTeamId;
      if (evt.half === 1) {
        if (isHome) h1Home += evt.value;
        else h1Away += evt.value;
      } else {
        if (isHome) h2Home += evt.value;
        else h2Away += evt.value;
      }
    }
    return { h1Home, h1Away, h2Home, h2Away };
  }, [match, sortedEvents]);

  // ── Share data ─────────────────────────────────────────────────────────────
  const buildShareData = useCallback(() => {
    if (!match) return null;

    const raidMap: Record<string, { name: string; points: number }> = {};
    const tackleMap: Record<string, { name: string; points: number }> = {};
    for (const evt of match.events) {
      if (!evt.playerId) continue;
      const name = scorerNames[evt.playerId] || evt.playerId.slice(0, 6);
      if (['raid_point', 'super_raid', 'do_or_die_raid'].includes(evt.eventType)) {
        if (!raidMap[evt.playerId]) raidMap[evt.playerId] = { name, points: 0 };
        raidMap[evt.playerId].points += evt.value;
      }
      if (['tackle_point', 'super_tackle'].includes(evt.eventType)) {
        if (!tackleMap[evt.playerId]) tackleMap[evt.playerId] = { name, points: 0 };
        tackleMap[evt.playerId].points += evt.value;
      }
    }

    const topRaidersList = Object.values(raidMap).sort((a, b) => b.points - a.points);
    const topDefendersList = Object.values(tackleMap).sort((a, b) => b.points - a.points);

    const motm = match.motmUser
      ? { name: match.motmUser.name, points: mvpBreakdown?.totalPoints || 0 }
      : null;

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
      topRaider: topRaidersList[0] || null,
      topDefender: topDefendersList[0] || null,
      motm,
    };
  }, [match, homeColor, awayColor, scorerNames, mvpBreakdown]);

  // ── Get event dot class ────────────────────────────────────────────────────
  const getDotClass = (eventType: string) => {
    const meta = EVENT_META[eventType];
    return meta?.dotClass || 'timeline-dot';
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-brand-navy-dark flex flex-col"
      >
        {/* ── Header bar with team color gradient ── */}
        <header className="sticky top-0 z-10 backdrop-blur-md border-b border-white/10" style={{ background: `linear-gradient(135deg, ${homeColor}30, ${awayColor}30)` }}>
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center">
                <Play className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-black tracking-wider text-white">MATCH REPLAY</h1>
                <p className="text-[9px] text-white/40 font-medium">Full highlights & analysis</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Half-by-half tabs */}
          <div className="flex px-4 pb-2 gap-2">
            {([['all', 'Full Match'], ['1', '1st Half'], ['2', '2nd Half']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setActiveHalf(val === 'all' ? 'all' : Number(val) as 1 | 2)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeHalf === (val === 'all' ? 'all' : Number(val))
                    ? 'bg-brand-gold text-white shadow-sm'
                    : 'bg-white/10 text-white/50 hover:bg-white/15'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="px-4 py-8 space-y-4">
              <div className="h-56 rounded-2xl bg-white/5 animate-pulse" />
              <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
              <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
              <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
            </div>
          ) : error || !match ? (
            <div className="flex flex-col items-center justify-center py-20 px-6">
              <Shield className="w-12 h-12 text-white/20 mb-3" />
              <p className="text-white/50 text-sm font-medium">{error || 'Match not found'}</p>
              <Button onClick={fetchMatch} variant="outline" className="mt-4 rounded-xl border-white/20 text-white hover:bg-white/10">
                Retry
              </Button>
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="px-4 py-4 space-y-4 pb-28"
            >
              {/* ════════════════════════════════════════════════════════════════
                  1. CINEMATIC HEADER CARD
                  ════════════════════════════════════════════════════════════════ */}
              <motion.div variants={cardVariants}>
                <div className="relative rounded-2xl overflow-hidden" style={{ background: `linear-gradient(180deg, ${homeColor}20, ${awayColor}20, #0F172A)` }}>
                  {/* Decorative glow */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-brand-red/5 rounded-full blur-3xl" />
                  </div>

                  {/* Top ribbon */}
                  <div className="relative bg-gradient-to-r from-brand-gold/90 to-brand-gold-dark/90 px-5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-white" />
                      <span className="font-black tracking-widest text-xs text-white">FULL TIME</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {match.tournament && (
                        <Badge className="bg-white/25 text-white text-[10px] font-semibold border-0 px-2 py-0.5">
                          {match.tournament.name}
                        </Badge>
                      )}
                      <Badge className={`text-[10px] font-semibold border-0 px-2 py-0.5 ${
                        match.gender === 'male' ? 'bg-brand-blue/40 text-white' : 'bg-pink-500/30 text-pink-200'
                      }`}>
                        {match.gender === 'male' ? '♂ Boys' : '♀ Girls'}
                      </Badge>
                    </div>
                  </div>

                  {/* Scoreboard */}
                  <div className="relative px-5 pt-8 pb-6">
                    <div className="flex items-center justify-between">
                      {/* Home Team */}
                      <div className="flex-1 text-center">
                        <div className="relative inline-block">
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg mx-auto ring-2 ring-white/10"
                            style={{ backgroundColor: homeColor }}
                          >
                            {match.homeTeam.name.charAt(0).toUpperCase()}
                          </div>
                          {winnerSide === 'home' && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.5 }}
                              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center shadow-lg"
                            >
                              <Trophy className="w-4 h-4 text-white" />
                            </motion.div>
                          )}
                        </div>
                        <p className={`font-bold text-sm mt-3 truncate px-1 ${
                          isHomeWin ? 'text-brand-gold' : 'text-white/70'
                        }`}>
                          {match.homeTeam.name}
                        </p>
                        {isHomeWin && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                          >
                            <Badge className="bg-brand-gold/20 text-brand-gold text-[10px] font-bold border-0 mt-1">
                              WINNER
                            </Badge>
                          </motion.div>
                        )}
                      </div>

                      {/* Score */}
                      <div className="px-4 text-center">
                        <div className="flex items-center gap-3">
                          <motion.span
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.3 }}
                            className={`text-6xl font-black tabular-nums ${
                              isHomeWin ? 'text-brand-gold' : 'text-white'
                            }`}
                          >
                            {match.homeScore}
                          </motion.span>
                          <span className="text-white/20 text-2xl font-medium">-</span>
                          <motion.span
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.4 }}
                            className={`text-6xl font-black tabular-nums ${
                              isAwayWin ? 'text-brand-gold' : 'text-white'
                            }`}
                          >
                            {match.awayScore}
                          </motion.span>
                        </div>
                        {isDraw && (
                          <Badge className="bg-brand-gold/20 text-brand-gold text-[10px] font-bold border-0 mt-3">
                            DRAW
                          </Badge>
                        )}
                      </div>

                      {/* Away Team */}
                      <div className="flex-1 text-center">
                        <div className="relative inline-block">
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg mx-auto ring-2 ring-white/10"
                            style={{ backgroundColor: awayColor }}
                          >
                            {match.awayTeam.name.charAt(0).toUpperCase()}
                          </div>
                          {winnerSide === 'away' && (
                            <motion.div
                              initial={{ scale: 0, rotate: -180 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.5 }}
                              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center shadow-lg"
                            >
                              <Trophy className="w-4 h-4 text-white" />
                            </motion.div>
                          )}
                        </div>
                        <p className={`font-bold text-sm mt-3 truncate px-1 ${
                          isAwayWin ? 'text-brand-gold' : 'text-white/70'
                        }`}>
                          {match.awayTeam.name}
                        </p>
                        {isAwayWin && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 }}
                          >
                            <Badge className="bg-brand-gold/20 text-brand-gold text-[10px] font-bold border-0 mt-1">
                              WINNER
                            </Badge>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Score progression bar */}
                  <div className="px-5 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-white/40">Score Share</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden bg-white/10 flex">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${match.homeScore + match.awayScore > 0 ? (match.homeScore / (match.homeScore + match.awayScore)) * 100 : 50}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
                        className="h-full rounded-l-full"
                        style={{ background: `linear-gradient(90deg, ${homeColor}, ${homeColor}AA)` }}
                      />
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${match.homeScore + match.awayScore > 0 ? (match.awayScore / (match.homeScore + match.awayScore)) * 100 : 50}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: 0.6 }}
                        className="h-full rounded-r-full"
                        style={{ background: `linear-gradient(90deg, ${awayColor}AA, ${awayColor})` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] text-white/40">{match.homeScore} pts</span>
                      <span className="text-[10px] text-white/40">{match.awayScore} pts</span>
                    </div>
                  </div>

                  {/* Half scores */}
                  <div className="px-5 pb-4 flex items-center justify-center gap-4">
                    <div className="text-center bg-white/5 rounded-lg px-3 py-1.5">
                      <p className="text-[9px] text-white/40 font-medium">1ST HALF</p>
                      <p className="text-white font-bold text-sm tabular-nums">{halfScores.h1Home} - {halfScores.h1Away}</p>
                    </div>
                    <div className="text-center bg-white/5 rounded-lg px-3 py-1.5">
                      <p className="text-[9px] text-white/40 font-medium">2ND HALF</p>
                      <p className="text-white font-bold text-sm tabular-nums">{halfScores.h2Home} - {halfScores.h2Away}</p>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="relative px-5 pb-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-white/40 text-[11px]">
                    {match.startedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(match.startedAt, match.completedAt)}
                      </span>
                    )}
                    {match.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {match.venue}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {match.halfDuration}min halves
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* ════════════════════════════════════════════════════════════════
                  2. KEY MOMENTS (Timeline)
                  ════════════════════════════════════════════════════════════════ */}
              {filteredKeyMoments.length > 0 && (
                <motion.div variants={cardVariants}>
                  <Card className="bg-brand-navy/80 border-white/10 py-0 gap-0 overflow-hidden backdrop-blur-sm">
                    <div className="px-4 pt-4 pb-2">
                      <h3 className="text-sm font-black tracking-wider text-white flex items-center gap-2">
                        <Flame className="w-4 h-4 text-brand-gold" />
                        KEY MOMENTS
                      </h3>
                      <p className="text-white/40 text-[11px] mt-0.5">
                        {filteredKeyMoments.length} exciting moment{filteredKeyMoments.length !== 1 ? 's' : ''}
                        {activeHalf !== 'all' ? ` in Half ${activeHalf}` : ''}
                      </p>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar px-4 pb-4">
                      <div className="relative">
                        {/* Timeline line */}
                        <div className="timeline-line" />
                        <div className="space-y-3">
                          {filteredKeyMoments.map((moment, idx) => (
                            <motion.div
                              key={moment.id}
                              initial={{ opacity: 0, x: -16 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.06, type: 'spring', damping: 20, stiffness: 240 }}
                              className="relative flex items-start gap-3 ml-8"
                            >
                              {/* Timeline dot */}
                              <div className={`absolute -left-8 top-3 ${getDotClass(moment.eventType)} shrink-0`} />

                              {/* Glass-morphism moment card */}
                              <div className={`flex-1 glass-card-dark rounded-xl px-3 py-2.5 border-l-2 ${EVENT_BORDER_COLOR[moment.eventType] || 'border-l-brand-gold'} hover:border-brand-gold/40 transition-colors`}>
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{moment.icon}</span>
                                  <span className="text-white font-bold text-xs">{moment.label}</span>
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: moment.teamColor }}
                                  >
                                    {moment.teamName}
                                  </span>
                                  {moment.playerName && (
                                    <span className="text-[10px] text-white/50 font-medium">
                                      {moment.playerName}
                                    </span>
                                  )}
                                  <Badge className="bg-white/10 text-white/50 text-[9px] font-semibold border-0 px-1.5 py-0 ml-auto shrink-0">
                                    H{moment.half}
                                  </Badge>
                                </div>
                                <p className="text-white/50 text-[11px] mt-0.5 line-clamp-2">
                                  {moment.description}
                                </p>
                                {/* Score at that moment */}
                                <div className="mt-1.5 flex items-center gap-1">
                                  <span className="text-[10px] font-bold text-white/30">Score:</span>
                                  <span className="text-[11px] font-bold tabular-nums" style={{ color: homeColor }}>
                                    {moment.homeScoreAtTime}
                                  </span>
                                  <span className="text-[10px] text-white/20">-</span>
                                  <span className="text-[11px] font-bold tabular-nums" style={{ color: awayColor }}>
                                    {moment.awayScoreAtTime}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  3. TOP RAIDS
                  ════════════════════════════════════════════════════════════════ */}
              {topRaiders.length > 0 && (
                <motion.div variants={cardVariants}>
                  <PremiumLock feature="Top Raiders">
                    <Card className="bg-brand-navy/80 border-white/10 py-0 gap-0 overflow-hidden backdrop-blur-sm">
                      <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-black tracking-wider text-white flex items-center gap-2">
                          <Swords className="w-4 h-4 text-brand-red" />
                          TOP RAIDS
                        </h3>
                      </div>
                      <CardContent className="px-4 pb-4 space-y-2">
                        {topRaiders.map((raider, idx) => (
                          <motion.div
                            key={raider.playerId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2 border border-white/5"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: raider.teamColor }}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold text-xs truncate">{raider.name}</p>
                              <p className="text-[10px] text-white/40">{raider.teamName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-brand-gold font-bold text-sm">{raider.raidPoints}</p>
                              <p className="text-[9px] text-white/30">raid pts</p>
                            </div>
                            {/* Points breakdown bar */}
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${topRaiders[0] ? (raider.raidPoints! / topRaiders[0].raidPoints!) * 100 : 0}%` }}
                                transition={{ duration: 0.8, delay: 0.3 + idx * 0.1, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-brand-red to-brand-red-light rounded-full"
                              />
                            </div>
                          </motion.div>
                        ))}
                      </CardContent>
                    </Card>
                  </PremiumLock>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  4. TOP TACKLES
                  ════════════════════════════════════════════════════════════════ */}
              {topDefenders.length > 0 && (
                <motion.div variants={cardVariants}>
                  <PremiumLock feature="Top Defenders">
                    <Card className="bg-brand-navy/80 border-white/10 py-0 gap-0 overflow-hidden backdrop-blur-sm">
                      <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-black tracking-wider text-white flex items-center gap-2">
                          <Shield className="w-4 h-4 text-brand-teal" />
                          TOP TACKLES
                        </h3>
                      </div>
                      <CardContent className="px-4 pb-4 space-y-2">
                        {topDefenders.map((defender, idx) => (
                          <motion.div
                            key={defender.playerId}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.08 }}
                            className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2 border border-white/5"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ backgroundColor: defender.teamColor }}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-semibold text-xs truncate">{defender.name}</p>
                              <p className="text-[10px] text-white/40">{defender.teamName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-brand-teal font-bold text-sm">{defender.tacklePoints}</p>
                              <p className="text-[9px] text-white/30">tackle pts</p>
                            </div>
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${topDefenders[0] ? (defender.tacklePoints! / topDefenders[0].tacklePoints!) * 100 : 0}%` }}
                                transition={{ duration: 0.8, delay: 0.3 + idx * 0.1, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-brand-teal to-brand-teal-light rounded-full"
                              />
                            </div>
                          </motion.div>
                        ))}
                      </CardContent>
                    </Card>
                  </PremiumLock>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  5. SUPER RAIDS CALLOUT
                  ════════════════════════════════════════════════════════════════ */}
              {superRaids.length > 0 && (
                <motion.div variants={cardVariants}>
                  <Card className="bg-gradient-to-r from-brand-red/15 to-brand-gold/10 border-brand-red/20 py-0 gap-0 overflow-hidden">
                    <div className="px-4 pt-4 pb-2">
                      <h3 className="text-sm font-black tracking-wider text-white flex items-center gap-2">
                        <Zap className="w-4 h-4 text-brand-gold animate-float-gentle" />
                        SUPER RAIDS
                      </h3>
                      <p className="text-white/40 text-[11px] mt-0.5">3+ points in a single raid!</p>
                    </div>
                    <CardContent className="px-4 pb-4 space-y-2">
                      {superRaids.map((raid, idx) => (
                        <motion.div
                          key={raid.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5 border border-brand-gold/20 animate-shimmer-slow"
                        >
                          <div className="text-2xl">💥</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-xs">{raid.playerName}</p>
                            <p className="text-[10px] text-white/40">{raid.teamName} · Half {raid.half}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-brand-gold font-black text-lg">{raid.points}</p>
                            <p className="text-[9px] text-white/30">points</p>
                          </div>
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  6. ALL OUTS
                  ════════════════════════════════════════════════════════════════ */}
              {allOuts.length > 0 && (
                <motion.div variants={cardVariants}>
                  <Card className="bg-brand-navy/80 border-purple-500/20 py-0 gap-0 overflow-hidden backdrop-blur-sm">
                    <div className="px-4 pt-4 pb-2">
                      <h3 className="text-sm font-black tracking-wider text-white flex items-center gap-2">
                        <Flame className="w-4 h-4 text-purple-400" />
                        ALL OUTS
                      </h3>
                      <p className="text-white/40 text-[11px] mt-0.5">{allOuts.length} all out{allOuts.length !== 1 ? 's' : ''} inflicted</p>
                    </div>
                    <CardContent className="px-4 pb-4 space-y-2">
                      {allOuts.map((out, idx) => (
                        <motion.div
                          key={out.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center gap-3 bg-purple-500/5 rounded-xl px-3 py-2.5 border border-purple-500/15"
                        >
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 border-2 border-purple-500/30" style={{ backgroundColor: out.teamColor }}>
                            🔥
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-xs">{out.teamName}</p>
                            <p className="text-[10px] text-white/40">Half {out.half}</p>
                          </div>
                          <div className="text-right bg-white/5 rounded-lg px-2 py-1">
                            <p className="text-[11px] font-bold tabular-nums">
                              <span style={{ color: homeColor }}>{out.homeScoreAtTime}</span>
                              <span className="text-white/30"> - </span>
                              <span style={{ color: awayColor }}>{out.awayScoreAtTime}</span>
                            </p>
                            <p className="text-[8px] text-white/30">score at time</p>
                          </div>
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  7. MVP BREAKDOWN
                  ════════════════════════════════════════════════════════════════ */}
              {match.motmUser && mvpBreakdown && (
                <motion.div variants={cardVariants}>
                  <PremiumLock feature="MVP Breakdown">
                    <Card className="bg-gradient-to-br from-brand-gold/10 to-brand-gold-dark/5 border-brand-gold/20 py-0 gap-0 overflow-hidden">
                      <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-black tracking-wider text-warm-800 flex items-center gap-2">
                          <Crown className="w-4 h-4 text-brand-gold" />
                          MVP BREAKDOWN
                        </h3>
                      </div>
                      <CardContent className="px-4 pb-4">
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <div className="w-16 h-16 rounded-full bg-warm-100 border-2 border-brand-gold/40 flex items-center justify-center overflow-hidden">
                              {match.motmUser.avatar ? (
                                <img
                                  src={match.motmUser.avatar}
                                  alt={match.motmUser.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-2xl font-bold text-warm-500">
                                  {match.motmUser.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-gold flex items-center justify-center shadow">
                              <Crown className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>

                          {/* Name & Team */}
                          <div className="flex-1 min-w-0">
                            <Badge className="bg-brand-gold/20 text-brand-gold-dark text-[10px] font-semibold border-0 px-2 py-0.5 mb-1">
                              <Crown className="w-2.5 h-2.5 mr-0.5" />
                              Man of the Match
                            </Badge>
                            <p className="text-warm-800 font-bold text-base truncate">
                              {match.motmUser.name}
                            </p>
                            {mvpBreakdown.teamName && (
                              <p className="text-warm-500 text-xs">{mvpBreakdown.teamName}</p>
                            )}
                          </div>

                          {/* Total Points */}
                          <div className="text-right shrink-0">
                            <motion.p
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.3 }}
                              className="text-brand-gold font-black text-3xl"
                            >
                              {mvpBreakdown.totalPoints}
                            </motion.p>
                            <p className="text-warm-400 text-[10px]">points</p>
                          </div>
                        </div>

                        {/* Stat Bars */}
                        <div className="mt-4 space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-warm-700 flex items-center gap-1.5">
                                <Swords className="w-3 h-3 text-brand-red" />
                                Raid Points
                              </span>
                              <span className="text-xs font-bold text-brand-red">{mvpBreakdown.raidPoints}</span>
                            </div>
                            <div className="h-2 bg-warm-200 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${mvpBreakdown.totalPoints > 0 ? (mvpBreakdown.raidPoints / mvpBreakdown.totalPoints) * 100 : 0}%` }}
                                transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-brand-red to-brand-red-light rounded-full"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-warm-700 flex items-center gap-1.5">
                                <Shield className="w-3 h-3 text-brand-teal" />
                                Tackle Points
                              </span>
                              <span className="text-xs font-bold text-brand-teal">{mvpBreakdown.tacklePoints}</span>
                            </div>
                            <div className="h-2 bg-warm-200 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${mvpBreakdown.totalPoints > 0 ? (mvpBreakdown.tacklePoints / mvpBreakdown.totalPoints) * 100 : 0}%` }}
                                transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-brand-teal to-brand-teal-light rounded-full"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-warm-700 flex items-center gap-1.5">
                                <Target className="w-3 h-3 text-brand-gold" />
                                Bonus Points
                              </span>
                              <span className="text-xs font-bold text-brand-gold">{mvpBreakdown.bonusPoints}</span>
                            </div>
                            <div className="h-2 bg-warm-200 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${mvpBreakdown.totalPoints > 0 ? (mvpBreakdown.bonusPoints / mvpBreakdown.totalPoints) * 100 : 0}%` }}
                                transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-brand-gold to-brand-gold-light rounded-full"
                              />
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </PremiumLock>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  8. MATCH MOMENTUM (Line chart)
                  ════════════════════════════════════════════════════════════════ */}
              {scoreProgression.length > 1 && (
                <motion.div variants={cardVariants}>
                  <PremiumLock feature="Match Momentum">
                    <Card className="bg-brand-navy/80 border-white/10 py-0 gap-0 overflow-hidden backdrop-blur-sm">
                      <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-black tracking-wider text-white flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-brand-teal" />
                          MATCH MOMENTUM
                        </h3>
                        <p className="text-white/40 text-[11px] mt-0.5">Score gap progression over time</p>
                      </div>
                      <CardContent className="px-4 pb-4">
                        {/* Graph */}
                        <div className="relative">
                          {/* Center line (0 gap) */}
                          <div className="absolute left-0 right-0 top-1/2 h-px bg-white/10" />

                          <div className="flex items-end gap-px h-40">
                            {scoreProgression.map((point, idx) => {
                              const maxGap = Math.max(
                                ...scoreProgression.map(p => Math.abs(p.gap)),
                                1
                              );
                              const normalizedGap = point.gap / maxGap;
                              const barHeight = Math.abs(normalizedGap) * 50;
                              const isHomeLeading = point.gap > 0;
                              const isNeutral = point.gap === 0;

                              return (
                                <motion.div
                                  key={idx}
                                  initial={{ height: 0 }}
                                  animate={{ height: `${isNeutral ? 2 : barHeight}%` }}
                                  transition={{ duration: 0.5, delay: idx * 0.03, ease: 'easeOut' }}
                                  className="flex-1 min-w-[3px] max-w-[8px] rounded-sm"
                                  style={{
                                    backgroundColor: isNeutral
                                      ? 'rgba(255,255,255,0.15)'
                                      : isHomeLeading
                                        ? homeColor
                                        : awayColor,
                                    alignSelf: isHomeLeading ? 'flex-end' : 'flex-start',
                                    marginTop: isHomeLeading ? 'auto' : 0,
                                    marginBottom: isHomeLeading ? 0 : 'auto',
                                    opacity: isNeutral ? 0.3 : 0.7,
                                  }}
                                />
                              );
                            })}
                          </div>

                          {/* Half separator */}
                          {(() => {
                            const half2Start = scoreProgression.findIndex(p => p.half === 2);
                            if (half2Start <= 0) return null;
                            const halfPercent = (half2Start / scoreProgression.length) * 100;
                            return (
                              <div
                                className="absolute top-0 bottom-0 w-px bg-brand-gold/30"
                                style={{ left: `${halfPercent}%` }}
                              >
                                <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                                  <span className="text-brand-gold/60 text-[8px] font-bold">H2</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* Legend */}
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: homeColor }} />
                              <span className="text-white/50 text-[10px] font-medium">{match.homeTeam.name} leading</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-white/50 text-[10px] font-medium">{match.awayTeam.name} leading</span>
                              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: awayColor }} />
                            </div>
                          </div>
                        </div>

                        {/* Final gap indicator */}
                        <div className="mt-3 bg-white/5 rounded-xl px-3 py-2 flex items-center justify-between">
                          <span className="text-white/40 text-[11px]">Final Gap</span>
                          <span className={`font-bold text-sm ${
                            match.homeScore > match.awayScore
                              ? 'text-white'
                              : match.awayScore > match.homeScore
                                ? 'text-white'
                                : 'text-brand-gold'
                          }`}>
                            {isDraw ? 'Level' : `${Math.abs(match.homeScore - match.awayScore)} pts`}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </PremiumLock>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  9. TURNING POINTS
                  ════════════════════════════════════════════════════════════════ */}
              {turningPoints.length > 0 && (
                <motion.div variants={cardVariants}>
                  <PremiumLock feature="Turning Points">
                    <Card className="bg-brand-navy/80 border-white/10 py-0 gap-0 overflow-hidden backdrop-blur-sm">
                      <div className="px-4 pt-4 pb-2">
                        <h3 className="text-sm font-black tracking-wider text-white flex items-center gap-2">
                          <Zap className="w-4 h-4 text-brand-gold" />
                          TURNING POINTS
                        </h3>
                        <p className="text-white/40 text-[11px] mt-0.5">
                          {turningPoints.length} moment{turningPoints.length !== 1 ? 's' : ''} that shifted the match
                        </p>
                      </div>
                      <div className="px-4 pb-4 space-y-2">
                        {turningPoints.map((tp, idx) => (
                          <motion.div
                            key={tp.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.1, type: 'spring', damping: 20, stiffness: 240 }}
                            className="relative bg-gradient-to-r from-brand-gold/10 to-transparent rounded-xl px-4 py-3 border border-brand-gold/20"
                          >
                            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-brand-gold" />
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-brand-gold/20 flex items-center justify-center shrink-0 text-base">
                                {tp.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-brand-gold font-bold text-xs">{tp.label}</span>
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: tp.teamColor }}
                                  >
                                    {tp.teamName}
                                  </span>
                                  <Badge className="bg-white/10 text-white/40 text-[9px] font-semibold border-0 px-1.5 py-0 ml-auto shrink-0">
                                    H{tp.half}
                                  </Badge>
                                </div>
                                <p className="text-white/60 text-[11px] mt-0.5">{tp.description}</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </Card>
                  </PremiumLock>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════════
                  10. NO HIGHLIGHTS FALLBACK
                  ════════════════════════════════════════════════════════════════ */}
              {keyMoments.length === 0 && turningPoints.length === 0 && (
                <motion.div variants={cardVariants}>
                  <Card className="bg-brand-navy/80 border-white/10 py-0 gap-0 overflow-hidden backdrop-blur-sm">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <Flame className="w-7 h-7 text-white/20" />
                      </div>
                      <p className="text-white/60 font-semibold text-sm">No Key Highlights</p>
                      <p className="text-white/30 text-xs mt-1">
                        This match didn&apos;t have any Super Raids, Super Tackles, All Outs, or Do-or-Die raids.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </motion.div>
          )}
        </div>

        {/* ── Bottom share bar ── */}
        {!loading && match && (
          <div className="sticky bottom-0 bg-brand-navy-dark/95 backdrop-blur-md border-t border-white/10 px-4 py-3 safe-bottom">
            <Button
              onClick={() => {
                const data = buildShareData();
                if (data) {
                  setShowShare(true);
                } else {
                  toast({ title: 'Cannot share', description: 'Match data unavailable' });
                }
              }}
              className="w-full h-12 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold-light hover:to-brand-gold text-white font-bold rounded-xl text-sm shadow-lg shadow-brand-gold/20"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Highlights
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
      </motion.div>
    </AnimatePresence>
  );
}
