'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Share2, Maximize2, Minimize2, Volume2, VolumeX,
  Zap, Shield, Flame, Target, AlertCircle, Clock,
  ChevronRight, Swords, Trophy, Star, Crown, Users,
  Timer, ArrowLeft, Radio, TrendingUp, Award,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LiveCommentaryTicker, {
  toCommentaryMatchInfo,
  type CommentaryMatchInfo,
} from './LiveCommentaryTicker';
import { type MatchEvent, type EventType } from '@/lib/store';
import { generateCommentary, type CommentaryExtras } from '@/lib/commentary';

// ─── Props ──────────────────────────────────────────────────────────

interface MatchDayExperienceProps {
  matchId: string;
  onClose: () => void;
}

// ─── API Response Types ─────────────────────────────────────────────

interface MatchTeamInfo {
  id: string;
  name: string;
  color: string | null;
}

interface MatchEventAPI {
  id: string;
  matchId: string;
  teamId: string;
  playerId?: string;
  eventType: string;
  value: number;
  details?: string;
  half: number;
  timestamp: number;
}

interface MatchDataAPI {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamColor: string;
  awayTeamColor: string;
  currentHalf: number;
  halfDuration: number;
  homeScore: number;
  awayScore: number;
}

interface MatchEventsAPIResponse {
  match: MatchDataAPI;
  events: MatchEventAPI[];
}

// ─── Tab Types ──────────────────────────────────────────────────────

type TabType = 'feed' | 'stats' | 'moments' | 'performers';

// ─── Helper: Event Icon Component ───────────────────────────────────

function EventIconComponent({ type, className }: { type: EventType; className?: string }) {
  switch (type) {
    case 'raid_point':
    case 'bonus_point':
    case 'do_or_die_raid':
      return <Zap className={className} />;
    case 'tackle_point':
    case 'super_tackle':
      return <Shield className={className} />;
    case 'super_raid':
      return <Flame className={className} />;
    case 'all_out':
      return <AlertCircle className={className} />;
    case 'empty_raid':
      return <Clock className={className} />;
    case 'substitution':
      return <Users className={className} />;
    case 'timeout':
      return <Timer className={className} />;
    case 'yellow_card':
    case 'red_card':
    case 'green_card':
      return <Target className={className} />;
    default:
      return <Zap className={className} />;
  }
}

/** Get event icon color class */
function getEventIconColor(type: EventType): string {
  switch (type) {
    case 'raid_point':
    case 'bonus_point':
    case 'do_or_die_raid':
      return 'text-red-500';
    case 'tackle_point':
    case 'super_tackle':
      return 'text-teal-600';
    case 'super_raid':
      return 'text-amber-500';
    case 'all_out':
      return 'text-orange-500';
    case 'empty_raid':
      return 'text-gray-400';
    case 'yellow_card':
      return 'text-yellow-500';
    case 'red_card':
      return 'text-red-600';
    case 'green_card':
      return 'text-green-500';
    case 'substitution':
    case 'timeout':
      return 'text-blue-400';
    default:
      return 'text-gray-400';
  }
}

/** Get event background color class */
function getEventBgColor(type: EventType): string {
  switch (type) {
    case 'raid_point':
    case 'bonus_point':
    case 'do_or_die_raid':
      return 'bg-red-500/10';
    case 'tackle_point':
    case 'super_tackle':
      return 'bg-teal-500/10';
    case 'super_raid':
      return 'bg-amber-500/10';
    case 'all_out':
      return 'bg-orange-500/10';
    case 'empty_raid':
      return 'bg-gray-500/10';
    default:
      return 'bg-gray-500/10';
  }
}

/** Get event label */
function getEventLabel(type: EventType): string {
  switch (type) {
    case 'raid_point': return 'Raid Point';
    case 'bonus_point': return 'Bonus Point';
    case 'tackle_point': return 'Tackle Point';
    case 'super_raid': return 'Super Raid';
    case 'super_tackle': return 'Super Tackle';
    case 'all_out': return 'All Out';
    case 'empty_raid': return 'Empty Raid';
    case 'do_or_die_raid': return 'Do-or-Die';
    case 'substitution': return 'Substitution';
    case 'timeout': return 'Timeout';
    case 'yellow_card': return 'Yellow Card';
    case 'red_card': return 'Red Card';
    case 'green_card': return 'Green Card';
    default: return 'Event';
  }
}

/** Is it a big event? */
function isBigEvent(type: EventType): boolean {
  return ['all_out', 'super_raid', 'super_tackle'].includes(type);
}

/** Is it a key moment? */
function isKeyMoment(type: EventType): boolean {
  return ['all_out', 'super_raid', 'super_tackle'].includes(type);
}

/** Format time as MM:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Format relative timestamp */
function formatEventTime(timestamp: number, matchStart: number): string {
  const diff = Math.max(0, Math.floor((timestamp - matchStart) / 1000));
  return formatTime(diff);
}

// ─── Circular Timer Component ───────────────────────────────────────

function CircularTimer({
  seconds,
  totalSeconds,
  teamColor,
}: {
  seconds: number;
  totalSeconds: number;
  teamColor: string;
}) {
  const radius = 28;
  const stroke = 3;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = totalSeconds > 0 ? Math.max(0, seconds) / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke="currentColor"
          className="text-gray-200 dark:text-warm-700"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke={teamColor}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-gray-800 dark:text-warm-100 tabular-nums">
          {formatTime(seconds)}
        </span>
      </div>
    </div>
  );
}

// ─── Live Event Card ────────────────────────────────────────────────

function LiveEventCard({
  event,
  match,
  matchStart,
  index,
}: {
  event: MatchEventAPI;
  match: MatchDataAPI;
  matchStart: number;
  index: number;
}) {
  const isHome = event.teamId === match.homeTeamId;
  const teamName = isHome ? match.homeTeam : match.awayTeam;
  const teamColor = isHome ? match.homeTeamColor : match.awayTeamColor;
  const eventType = event.eventType as EventType;
  const big = isBigEvent(eventType);
  const iconColor = getEventIconColor(eventType);
  const bgColor = getEventBgColor(eventType);

  // Build commentary text
  let commentaryText = '';
  try {
    let extras: CommentaryExtras = {};
    if (event.details) {
      const parsed = JSON.parse(event.details);
      if (parsed.isSuperRaid) extras.isSuperRaid = true;
      if (parsed.isSuperTackle) extras.isSuperTackle = true;
      if (parsed.isDoOrDie) extras.isDoOrDie = true;
      if (parsed.isAllOut) extras.isAllOut = true;
      if (parsed.touchedPlayerIds) extras.defendersTouched = (parsed.touchedPlayerIds as string[]).length;
    }
    commentaryText = generateCommentary(event.eventType, event.playerId || 'Player', teamName, event.value, extras);
  } catch {
    commentaryText = `${event.playerId || 'Player'} made a play for ${teamName}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.03, type: 'spring', stiffness: 200 }}
    >
      <div
        className={cn(
          'relative flex items-start gap-3 p-3 rounded-xl border transition-all',
          big
            ? 'border-amber-300/50 dark:border-amber-600/40 bg-amber-50/80 dark:bg-amber-900/20'
            : 'border-gray-100 dark:border-warm-700 bg-white dark:bg-warm-800/60'
        )}
      >
        {/* Big event glow */}
        {big && (
          <div
            className="absolute inset-0 rounded-xl opacity-20 animate-pulse"
            style={{ boxShadow: `0 0 20px ${teamColor}40` }}
          />
        )}

        {/* Left color bar */}
        <div
          className="w-1 rounded-full min-h-[40px] flex-shrink-0 self-stretch"
          style={{ backgroundColor: teamColor }}
        />

        {/* Icon */}
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', bgColor)}>
          <EventIconComponent type={eventType} className={cn('w-4 h-4', iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Badge
                  className={cn(
                    'text-[9px] font-bold px-1.5 py-0 h-4 border-0',
                    big ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400' : 'bg-gray-100 dark:bg-warm-700 text-gray-500 dark:text-warm-400'
                  )}
                >
                  {getEventLabel(eventType)}
                </Badge>
                {event.half === 1 ? (
                  <span className="text-[9px] text-gray-400">1H</span>
                ) : (
                  <span className="text-[9px] text-gray-400">2H</span>
                )}
              </div>
              <p className="text-xs font-medium text-gray-700 dark:text-warm-200 leading-snug line-clamp-2">
                {commentaryText}
              </p>
            </div>
            {event.value > 0 && (
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className="flex-shrink-0"
              >
                <Badge
                  className="text-sm font-black px-2 py-0 h-6 border-0"
                  style={{ backgroundColor: teamColor + '20', color: teamColor }}
                >
                  +{event.value}
                </Badge>
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400 dark:text-warm-500 font-medium">
              {formatEventTime(event.timestamp, matchStart)}
            </span>
            <span className="text-[10px] text-gray-300 dark:text-warm-600">·</span>
            <span className="text-[10px] font-medium" style={{ color: teamColor }}>
              {teamName}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Stat Bar ───────────────────────────────────────────────────────

function StatBar({
  label,
  homeValue,
  awayValue,
  homeColor,
  awayColor,
  isPercentage = false,
}: {
  label: string;
  homeValue: number;
  awayValue: number;
  homeColor: string;
  awayColor: string;
  isPercentage?: boolean;
}) {
  const total = homeValue + awayValue;
  const homePercent = total > 0 ? (homeValue / total) * 100 : 50;
  const awayPercent = total > 0 ? (awayValue / total) * 100 : 50;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-bold" style={{ color: homeColor }}>
          {isPercentage ? `${homeValue}%` : homeValue}
        </span>
        <span className="text-[10px] font-semibold text-gray-500 dark:text-warm-400 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-sm font-bold" style={{ color: awayColor }}>
          {isPercentage ? `${awayValue}%` : awayValue}
        </span>
      </div>
      <div className="flex items-center gap-1 h-2.5">
        <div className="flex-1 bg-gray-100 dark:bg-warm-700 rounded-full overflow-hidden flex justify-end">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${homePercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: homeColor }}
          />
        </div>
        <div className="flex-1 bg-gray-100 dark:bg-warm-700 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${awayPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: awayColor }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Top Performer Card ─────────────────────────────────────────────

function TopPerformerCard({
  title,
  playerName,
  teamName,
  teamColor,
  stats,
  icon: Icon,
  index,
}: {
  title: string;
  playerName: string;
  teamName: string;
  teamColor: string;
  stats: { label: string; value: string | number }[];
  icon: typeof Star;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.15 }}
    >
      <Card
        className="relative overflow-hidden border-gray-100 dark:border-warm-700 bg-white dark:bg-warm-800/80"
      >
        {/* Glow effect */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${teamColor}, transparent 70%)`,
          }}
        />

        <CardContent className="p-4 relative">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: teamColor + '15' }}
            >
              <Icon className="w-4 h-4" style={{ color: teamColor }} />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 dark:text-warm-500 uppercase tracking-wider">
                {title}
              </p>
              <p className="text-sm font-bold text-gray-800 dark:text-warm-100">
                {playerName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: teamColor }} />
            <span className="text-xs font-medium" style={{ color: teamColor }}>
              {teamName}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="bg-gray-50 dark:bg-warm-700/50 rounded-lg p-2 text-center">
                <p className="text-lg font-black" style={{ color: teamColor }}>{s.value}</p>
                <p className="text-[9px] text-gray-400 dark:text-warm-500 font-medium uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Key Moment ─────────────────────────────────────────────────────

interface KeyMomentData {
  id: string;
  type: EventType;
  teamName: string;
  teamColor: string;
  time: string;
  half: number;
  description: string;
}

function KeyMomentMarker({
  moment,
  isSelected,
  onClick,
}: {
  moment: KeyMomentData;
  isSelected: boolean;
  onClick: () => void;
}) {
  const iconColor = getEventIconColor(moment.type);
  const isBig = isKeyMoment(moment.type);

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 flex-shrink-0 px-3 py-2 rounded-xl transition-all',
        isSelected
          ? 'bg-gray-100 dark:bg-warm-700 scale-105'
          : 'hover:bg-gray-50 dark:hover:bg-warm-800'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center border-2',
          isBig ? 'animate-pulse' : ''
        )}
        style={{
          borderColor: moment.teamColor,
          backgroundColor: moment.teamColor + '15',
        }}
      >
        <EventIconComponent type={moment.type} className={cn('w-4 h-4', iconColor)} />
      </div>
      <span className="text-[9px] font-bold uppercase" style={{ color: moment.teamColor }}>
        {getEventLabel(moment.type)}
      </span>
      <span className="text-[9px] text-gray-400">{moment.time}</span>
    </button>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function MatchDayExperience({ matchId, onClose }: MatchDayExperienceProps) {
  // ─── State ───────────────────────────────────────────────────
  const [matchData, setMatchData] = useState<MatchDataAPI | null>(null);
  const [events, setEvents] = useState<MatchEventAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [selectedMoment, setSelectedMoment] = useState<string | null>(null);
  const prevHomeScoreRef = useRef(0);
  const prevAwayScoreRef = useRef(0);
  const [homeScoreAnim, setHomeScoreAnim] = useState(false);
  const [awayScoreAnim, setAwayScoreAnim] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch Match Data ────────────────────────────────────────
  const fetchMatchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/match-events?matchId=${matchId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: MatchEventsAPIResponse = await res.json();

      setMatchData(data.match);
      setEvents(data.events);

      // Calculate timer from match data
      if (data.match.currentHalf && data.match.halfDuration) {
        // Use current half duration to compute timer
        const totalSeconds = data.match.halfDuration * 60;
        // We don't have the exact elapsed time, so show full time
        setTimerSeconds(totalSeconds);
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch match data:', err);
      setLoading(false);
    }
  }, [matchId]);

  // ─── Polling ─────────────────────────────────────────────────
  useEffect(() => {
    fetchMatchData();

    // Poll every 5 seconds
    pollIntervalRef.current = setInterval(fetchMatchData, 5000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [fetchMatchData]);

  // ─── Timer countdown ─────────────────────────────────────────
  useEffect(() => {
    if (!matchData) return;
    // Only tick down if match appears live
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [matchData]);

  // ─── Score change animation ──────────────────────────────────
  useEffect(() => {
    if (!matchData) return;
    if (prevHomeScoreRef.current !== 0 && matchData.homeScore !== prevHomeScoreRef.current) {
      setHomeScoreAnim(true);
      setTimeout(() => setHomeScoreAnim(false), 500);
    }
    if (prevAwayScoreRef.current !== 0 && matchData.awayScore !== prevAwayScoreRef.current) {
      setAwayScoreAnim(true);
      setTimeout(() => setAwayScoreAnim(false), 500);
    }
    prevHomeScoreRef.current = matchData.homeScore;
    prevAwayScoreRef.current = matchData.awayScore;
  }, [matchData?.homeScore, matchData?.awayScore]);

  // ─── Auto-scroll feed ────────────────────────────────────────
  useEffect(() => {
    if (feedRef.current && activeTab === 'feed') {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events, activeTab]);

  // ─── Computed Values ─────────────────────────────────────────
  const matchStart = useMemo(() => {
    if (events.length === 0) return Date.now();
    return events[0].timestamp;
  }, [events]);

  const commentaryMatchInfo: CommentaryMatchInfo | null = useMemo(() => {
    if (!matchData) return null;
    return {
      homeTeamId: matchData.homeTeamId,
      awayTeamId: matchData.awayTeamId,
      homeTeam: matchData.homeTeam,
      awayTeam: matchData.awayTeam,
      homeTeamColor: matchData.homeTeamColor,
      awayTeamColor: matchData.awayTeamColor,
      currentHalf: matchData.currentHalf,
    };
  }, [matchData]);

  const storeEvents: MatchEvent[] = useMemo(() => {
    return events.map((e) => ({
      ...e,
      playerName: undefined,
    }));
  }, [events]);

  // ─── Stats Computation ───────────────────────────────────────
  const stats = useMemo(() => {
    const homeRaidPts = events.filter((e) => e.teamId === matchData?.homeTeamId && ['raid_point', 'super_raid', 'do_or_die_raid'].includes(e.eventType)).reduce((sum, e) => sum + e.value, 0);
    const awayRaidPts = events.filter((e) => e.teamId === matchData?.awayTeamId && ['raid_point', 'super_raid', 'do_or_die_raid'].includes(e.eventType)).reduce((sum, e) => sum + e.value, 0);
    const homeTacklePts = events.filter((e) => e.teamId === matchData?.homeTeamId && ['tackle_point', 'super_tackle'].includes(e.eventType)).reduce((sum, e) => sum + e.value, 0);
    const awayTacklePts = events.filter((e) => e.teamId === matchData?.awayTeamId && ['tackle_point', 'super_tackle'].includes(e.eventType)).reduce((sum, e) => sum + e.value, 0);
    const homeBonusPts = events.filter((e) => e.teamId === matchData?.homeTeamId && e.eventType === 'bonus_point').reduce((sum, e) => sum + e.value, 0);
    const awayBonusPts = events.filter((e) => e.teamId === matchData?.awayTeamId && e.eventType === 'bonus_point').reduce((sum, e) => sum + e.value, 0);
    const homeAllOuts = events.filter((e) => e.teamId === matchData?.homeTeamId && e.eventType === 'all_out').length;
    const awayAllOuts = events.filter((e) => e.teamId === matchData?.awayTeamId && e.eventType === 'all_out').length;
    const homeTimeouts = events.filter((e) => e.teamId === matchData?.homeTeamId && e.eventType === 'timeout').length;
    const awayTimeouts = events.filter((e) => e.teamId === matchData?.awayTeamId && e.eventType === 'timeout').length;

    const homeRaidAttempts = events.filter((e) => e.teamId === matchData?.homeTeamId && ['raid_point', 'super_raid', 'do_or_die_raid', 'bonus_point', 'empty_raid'].includes(e.eventType)).length;
    const awayRaidAttempts = events.filter((e) => e.teamId === matchData?.awayTeamId && ['raid_point', 'super_raid', 'do_or_die_raid', 'bonus_point', 'empty_raid'].includes(e.eventType)).length;
    const homeSuccessfulRaids = events.filter((e) => e.teamId === matchData?.homeTeamId && ['raid_point', 'super_raid', 'do_or_die_raid', 'bonus_point'].includes(e.eventType)).length;
    const awaySuccessfulRaids = events.filter((e) => e.teamId === matchData?.awayTeamId && ['raid_point', 'super_raid', 'do_or_die_raid', 'bonus_point'].includes(e.eventType)).length;

    const homeRaidRate = homeRaidAttempts > 0 ? Math.round((homeSuccessfulRaids / homeRaidAttempts) * 100) : 0;
    const awayRaidRate = awayRaidAttempts > 0 ? Math.round((awaySuccessfulRaids / awayRaidAttempts) * 100) : 0;

    const homeTackleAttempts = events.filter((e) => e.teamId === matchData?.homeTeamId && ['tackle_point', 'super_tackle'].includes(e.eventType)).length;
    const awayTackleAttempts = events.filter((e) => e.teamId === matchData?.awayTeamId && ['tackle_point', 'super_tackle'].includes(e.eventType)).length;
    // For tackle rate, we consider all raids by opposing team as tackle opportunities
    const homeTackleRate = awayRaidAttempts > 0 ? Math.round((homeTackleAttempts / awayRaidAttempts) * 100) : 0;
    const awayTackleRate = homeRaidAttempts > 0 ? Math.round((awayTackleAttempts / homeRaidAttempts) * 100) : 0;

    return {
      homeRaidPts, awayRaidPts,
      homeTacklePts, awayTacklePts,
      homeBonusPts, awayBonusPts,
      homeAllOuts, awayAllOuts,
      homeTimeouts, awayTimeouts,
      homeRaidRate, awayRaidRate,
      homeTackleRate, awayTackleRate,
    };
  }, [events, matchData]);

  // ─── Key Moments ─────────────────────────────────────────────
  const keyMoments: KeyMomentData[] = useMemo(() => {
    return events
      .filter((e) => isKeyMoment(e.eventType as EventType))
      .map((e) => {
        const isHome = e.teamId === matchData?.homeTeamId;
        return {
          id: e.id,
          type: e.eventType as EventType,
          teamName: isHome ? (matchData?.homeTeam || '') : (matchData?.awayTeam || ''),
          teamColor: isHome ? (matchData?.homeTeamColor || '#DC2626') : (matchData?.awayTeamColor || '#1E293B'),
          time: formatEventTime(e.timestamp, matchStart),
          half: e.half,
          description: getEventLabel(e.eventType as EventType),
        };
      });
  }, [events, matchData, matchStart]);

  // ─── Top Performers ──────────────────────────────────────────
  const topPerformers = useMemo(() => {
    if (!matchData) return { topRaider: null, topDefender: null };

    // Aggregate by playerId
    const playerStats: Record<string, { raidPts: number; tacklePts: number; totalRaids: number; totalTackles: number; teamId: string }> = {};

    for (const e of events) {
      if (!e.playerId) continue;
      if (!playerStats[e.playerId]) {
        playerStats[e.playerId] = { raidPts: 0, tacklePts: 0, totalRaids: 0, totalTackles: 0, teamId: e.teamId };
      }
      const ps = playerStats[e.playerId];
      if (['raid_point', 'super_raid', 'do_or_die_raid', 'bonus_point'].includes(e.eventType)) {
        ps.raidPts += e.value;
        ps.totalRaids += 1;
      }
      if (['tackle_point', 'super_tackle'].includes(e.eventType)) {
        ps.tacklePts += e.value;
        ps.totalTackles += 1;
      }
    }

    // Find top raider
    let topRaider: { id: string; name: string; raidPts: number; totalRaids: number; teamId: string; teamName: string; teamColor: string } | null = null;
    let topDefender: { id: string; name: string; tacklePts: number; totalTackles: number; teamId: string; teamName: string; teamColor: string } | null = null;

    for (const [playerId, ps] of Object.entries(playerStats)) {
      if (ps.raidPts > (topRaider?.raidPts ?? 0)) {
        const isHome = ps.teamId === matchData.homeTeamId;
        topRaider = {
          id: playerId,
          name: `Player #${playerId.slice(-3)}`,
          raidPts: ps.raidPts,
          totalRaids: ps.totalRaids,
          teamId: ps.teamId,
          teamName: isHome ? matchData.homeTeam : matchData.awayTeam,
          teamColor: isHome ? matchData.homeTeamColor : matchData.awayTeamColor,
        };
      }
      if (ps.tacklePts > (topDefender?.tacklePts ?? 0)) {
        const isHome = ps.teamId === matchData.homeTeamId;
        topDefender = {
          id: playerId,
          name: `Player #${playerId.slice(-3)}`,
          tacklePts: ps.tacklePts,
          totalTackles: ps.totalTackles,
          teamId: ps.teamId,
          teamName: isHome ? matchData.homeTeam : matchData.awayTeam,
          teamColor: isHome ? matchData.homeTeamColor : matchData.awayTeamColor,
        };
      }
    }

    return { topRaider, topDefender };
  }, [events, matchData]);

  // ─── Commentary Items ────────────────────────────────────────
  const commentaryItems = useMemo(() => {
    return events.slice(-8).reverse().map((e) => {
      const isHome = e.teamId === matchData?.homeTeamId;
      const teamName = isHome ? (matchData?.homeTeam || '') : (matchData?.awayTeam || '');
      const teamColor = isHome ? (matchData?.homeTeamColor || '#DC2626') : (matchData?.awayTeamColor || '#1E293B');

      let text = '';
      try {
        let extras: CommentaryExtras = {};
        if (e.details) {
          const parsed = JSON.parse(e.details);
          if (parsed.isSuperRaid) extras.isSuperRaid = true;
          if (parsed.isSuperTackle) extras.isSuperTackle = true;
          if (parsed.isDoOrDie) extras.isDoOrDie = true;
          if (parsed.isAllOut) extras.isAllOut = true;
        }
        text = generateCommentary(e.eventType, e.playerId || 'Player', teamName, e.value, extras);
      } catch {
        text = `${e.playerId || 'Player'} made a play`;
      }

      return { text, teamColor };
    });
  }, [events, matchData]);

  // ─── Share Handler ───────────────────────────────────────────
  const handleShare = useCallback(() => {
    if (!matchData) return;
    const text = `🏟️ ${matchData.homeTeam} ${matchData.homeScore} - ${matchData.awayScore} ${matchData.awayTeam}\n🔴 LIVE on Kabaddi Pro!`;
    if (navigator.share) {
      navigator.share({ title: 'Kabaddi Pro - Live Match', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [matchData]);

  // ─── Loading State ───────────────────────────────────────────
  if (loading || !matchData) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-white dark:bg-warm-900 flex items-center justify-center"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
          <p className="text-sm text-gray-500 dark:text-warm-400 font-medium">Loading Match Experience...</p>
        </div>
      </motion.div>
    );
  }

  const halfDurationSeconds = matchData.halfDuration * 60;
  const halfLabel = matchData.currentHalf === 1 ? '1st Half' : '2nd Half';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'fixed inset-0 z-50 bg-white dark:bg-warm-900 flex flex-col overflow-hidden',
        isFullscreen && 'fixed inset-0'
      )}
    >
      {/* ─── Match Header with Live Timer ────────────────────── */}
      <div
        className="relative flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${matchData.homeTeamColor}30, ${matchData.awayTeamColor}30)`,
        }}
      >
        {/* Top bar with controls */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/20 dark:bg-white/10 flex items-center justify-center hover:bg-black/30 dark:hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>

          {/* LIVE Badge */}
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 shadow-lg shadow-red-600/30"
            >
              <Radio className="w-3 h-3 text-white" />
              <span className="text-xs font-black text-white tracking-wider">LIVE</span>
            </motion.div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-full bg-black/20 dark:bg-white/10 flex items-center justify-center hover:bg-black/30 dark:hover:bg-white/20 transition-colors"
            >
              <Share2 className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-9 h-9 rounded-full bg-black/20 dark:bg-white/10 flex items-center justify-center hover:bg-black/30 dark:hover:bg-white/20 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-9 h-9 rounded-full bg-black/20 dark:bg-white/10 flex items-center justify-center hover:bg-black/30 dark:hover:bg-white/20 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
            </button>
          </div>
        </div>

        {/* Score Section */}
        <div className="flex items-center justify-between px-6 py-4">
          {/* Home Team */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                backgroundColor: matchData.homeTeamColor + '20',
                border: `2px solid ${matchData.homeTeamColor}40`,
              }}
            >
              <Swords className="w-6 h-6" style={{ color: matchData.homeTeamColor }} />
            </div>
            <p className="text-sm font-bold text-gray-800 dark:text-warm-100 text-center truncate max-w-[100px]">
              {matchData.homeTeam}
            </p>
          </div>

          {/* Score & Timer Center */}
          <div className="flex flex-col items-center gap-2 px-4">
            {/* Half indicator */}
            <motion.div
              key={matchData.currentHalf}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-bold text-gray-700 dark:text-warm-200 uppercase tracking-wider">
                {halfLabel}
              </span>
            </motion.div>

            {/* Score Display */}
            <div className="flex items-center gap-4">
              <motion.div
                animate={homeScoreAnim ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <span
                  className="text-5xl font-black tabular-nums"
                  style={{ color: matchData.homeTeamColor }}
                >
                  {matchData.homeScore}
                </span>
              </motion.div>

              {/* VS Divider */}
              <div className="flex flex-col items-center gap-0.5">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-lg font-black text-gray-400 dark:text-warm-500"
                >
                  VS
                </motion.div>
              </div>

              <motion.div
                animate={awayScoreAnim ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <span
                  className="text-5xl font-black tabular-nums"
                  style={{ color: matchData.awayTeamColor }}
                >
                  {matchData.awayScore}
                </span>
              </motion.div>
            </div>

            {/* Circular Timer */}
            <CircularTimer
              seconds={timerSeconds}
              totalSeconds={halfDurationSeconds}
              teamColor={matchData.currentHalf === 1 ? matchData.homeTeamColor : matchData.awayTeamColor}
            />
          </div>

          {/* Away Team */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                backgroundColor: matchData.awayTeamColor + '20',
                border: `2px solid ${matchData.awayTeamColor}40`,
              }}
            >
              <Shield className="w-6 h-6" style={{ color: matchData.awayTeamColor }} />
            </div>
            <p className="text-sm font-bold text-gray-800 dark:text-warm-100 text-center truncate max-w-[100px]">
              {matchData.awayTeam}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Tab Navigation ──────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-gray-100 dark:border-warm-700 bg-white dark:bg-warm-900 px-2">
        <div className="flex items-center">
          {([
            { key: 'feed' as TabType, label: 'Live Feed', icon: Zap },
            { key: 'stats' as TabType, label: 'Stats', icon: BarChart3Icon },
            { key: 'moments' as TabType, label: 'Moments', icon: Flame },
            { key: 'performers' as TabType, label: 'Top Players', icon: Crown },
          ]).map(({ key, label, icon: TabIcon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all relative',
                activeTab === key
                  ? 'text-brand-red'
                  : 'text-gray-400 dark:text-warm-500 hover:text-gray-600 dark:hover:text-warm-300'
              )}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {label}
              {activeTab === key && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-red rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab Content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {/* ─── Live Event Feed ────────────────────────────── */}
          {activeTab === 'feed' && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto px-4 py-3 space-y-2"
              ref={feedRef}
            >
              {events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-warm-800 flex items-center justify-center mb-4">
                    <Zap className="w-7 h-7 text-gray-300 dark:text-warm-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-400 dark:text-warm-500">
                    Waiting for match events...
                  </p>
                  <p className="text-xs text-gray-300 dark:text-warm-600 mt-1">
                    Events will appear here in real-time
                  </p>
                </div>
              ) : (
                events.map((event, i) => (
                  <LiveEventCard
                    key={event.id}
                    event={event}
                    match={matchData}
                    matchStart={matchStart}
                    index={i}
                  />
                ))
              )}
            </motion.div>
          )}

          {/* ─── Statistics Panel ───────────────────────────── */}
          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto px-4 py-4"
            >
              {/* Team headers */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: matchData.homeTeamColor }} />
                  <span className="text-sm font-bold text-gray-700 dark:text-warm-200">{matchData.homeTeam}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-700 dark:text-warm-200">{matchData.awayTeam}</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: matchData.awayTeamColor }} />
                </div>
              </div>

              <StatBar label="Total Points" homeValue={matchData.homeScore} awayValue={matchData.awayScore} homeColor={matchData.homeTeamColor} awayColor={matchData.awayTeamColor} />
              <StatBar label="Raid Points" homeValue={stats.homeRaidPts} awayValue={stats.awayRaidPts} homeColor={matchData.homeTeamColor} awayColor={matchData.awayTeamColor} />
              <StatBar label="Tackle Points" homeValue={stats.homeTacklePts} awayValue={stats.awayTacklePts} homeColor={matchData.homeTeamColor} awayColor={matchData.awayTeamColor} />
              <StatBar label="Bonus Points" homeValue={stats.homeBonusPts} awayValue={stats.awayBonusPts} homeColor={matchData.homeTeamColor} awayColor={matchData.awayTeamColor} />
              <StatBar label="All Outs" homeValue={stats.homeAllOuts} awayValue={stats.awayAllOuts} homeColor={matchData.homeTeamColor} awayColor={matchData.awayTeamColor} />
              <StatBar label="Timeouts" homeValue={stats.homeTimeouts} awayValue={stats.awayTimeouts} homeColor={matchData.homeTeamColor} awayColor={matchData.awayTeamColor} />

              {/* Success Rate Section */}
              <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-warm-800/50 border border-gray-100 dark:border-warm-700">
                <h4 className="text-xs font-bold text-gray-500 dark:text-warm-400 uppercase tracking-wider mb-3">
                  Success Rates
                </h4>
                <StatBar label="Raid Success %" homeValue={stats.homeRaidRate} awayValue={stats.awayRaidRate} homeColor={matchData.homeTeamColor} awayColor={matchData.awayTeamColor} isPercentage />
                <StatBar label="Tackle Success %" homeValue={stats.homeTackleRate} awayValue={stats.awayTackleRate} homeColor={matchData.homeTeamColor} awayColor={matchData.awayTeamColor} isPercentage />
              </div>
            </motion.div>
          )}

          {/* ─── Key Moments Timeline ──────────────────────── */}
          {activeTab === 'moments' && (
            <motion.div
              key="moments"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto py-4"
            >
              {keyMoments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-warm-800 flex items-center justify-center mb-4">
                    <Flame className="w-7 h-7 text-gray-300 dark:text-warm-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-400 dark:text-warm-500">
                    No key moments yet
                  </p>
                  <p className="text-xs text-gray-300 dark:text-warm-600 mt-1">
                    All Outs, Super Raids & Super Tackles will appear here
                  </p>
                </div>
              ) : (
                <>
                  {/* Horizontal timeline */}
                  <div className="px-4 mb-4">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-warm-400 uppercase tracking-wider mb-3">
                      Key Moments
                    </h3>
                    <div className="overflow-x-auto flex gap-2 pb-2 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
                      {keyMoments.map((moment) => (
                        <KeyMomentMarker
                          key={moment.id}
                          moment={moment}
                          isSelected={selectedMoment === moment.id}
                          onClick={() => setSelectedMoment(selectedMoment === moment.id ? null : moment.id)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Selected moment detail */}
                  <AnimatePresence>
                    {selectedMoment && (() => {
                      const moment = keyMoments.find((m) => m.id === selectedMoment);
                      if (!moment) return null;
                      return (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-4"
                        >
                          <Card
                            className="border-2 overflow-hidden"
                            style={{ borderColor: moment.teamColor + '40' }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3 mb-2">
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                                  style={{ backgroundColor: moment.teamColor + '15' }}
                                >
                                  <EventIconComponent type={moment.type} className={cn('w-5 h-5', getEventIconColor(moment.type))} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold" style={{ color: moment.teamColor }}>
                                    {getEventLabel(moment.type)}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-warm-400">
                                    {moment.half === 1 ? '1st Half' : '2nd Half'} · {moment.time}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: moment.teamColor }} />
                                <span className="text-sm font-medium" style={{ color: moment.teamColor }}>
                                  {moment.teamName}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })()}
                  </AnimatePresence>

                  {/* All moments list */}
                  <div className="px-4 mt-4 space-y-2">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-warm-400 uppercase tracking-wider mb-2">
                      All Moments
                    </h3>
                    {keyMoments.map((moment, i) => (
                      <motion.div
                        key={moment.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-warm-800/60 border border-gray-100 dark:border-warm-700"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: moment.teamColor + '15' }}
                        >
                          <EventIconComponent type={moment.type} className={cn('w-4 h-4', getEventIconColor(moment.type))} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold" style={{ color: moment.teamColor }}>
                            {getEventLabel(moment.type)}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-warm-500">
                            {moment.teamName} · {moment.time}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-warm-600 flex-shrink-0" />
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ─── Top Performers ────────────────────────────── */}
          {activeTab === 'performers' && (
            <motion.div
              key="performers"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto px-4 py-4 space-y-4"
            >
              <h3 className="text-xs font-bold text-gray-500 dark:text-warm-400 uppercase tracking-wider">
                Top Performers
              </h3>

              {topPerformers.topRaider ? (
                <TopPerformerCard
                  title="Top Raider"
                  playerName={topPerformers.topRaider.name}
                  teamName={topPerformers.topRaider.teamName}
                  teamColor={topPerformers.topRaider.teamColor}
                  stats={[
                    { label: 'Raid Pts', value: topPerformers.topRaider.raidPts },
                    { label: 'Raids', value: topPerformers.topRaider.totalRaids },
                  ]}
                  icon={Zap}
                  index={0}
                />
              ) : (
                <Card className="border-gray-100 dark:border-warm-700">
                  <CardContent className="p-6 flex flex-col items-center">
                    <Zap className="w-8 h-8 text-gray-300 dark:text-warm-600 mb-2" />
                    <p className="text-xs text-gray-400 dark:text-warm-500">No raid data yet</p>
                  </CardContent>
                </Card>
              )}

              {topPerformers.topDefender ? (
                <TopPerformerCard
                  title="Top Defender"
                  playerName={topPerformers.topDefender.name}
                  teamName={topPerformers.topDefender.teamName}
                  teamColor={topPerformers.topDefender.teamColor}
                  stats={[
                    { label: 'Tackle Pts', value: topPerformers.topDefender.tacklePts },
                    { label: 'Tackles', value: topPerformers.topDefender.totalTackles },
                  ]}
                  icon={Shield}
                  index={1}
                />
              ) : (
                <Card className="border-gray-100 dark:border-warm-700">
                  <CardContent className="p-6 flex flex-col items-center">
                    <Shield className="w-8 h-8 text-gray-300 dark:text-warm-600 mb-2" />
                    <p className="text-xs text-gray-400 dark:text-warm-500">No tackle data yet</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Commentary Ticker ──────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-warm-700">
        {commentaryMatchInfo && storeEvents.length > 0 ? (
          <LiveCommentaryTicker
            events={storeEvents}
            match={commentaryMatchInfo}
            mode="compact"
          />
        ) : (
          <div className="h-12 flex items-center px-4 bg-gray-50 dark:bg-warm-800/50">
            <div className="flex items-center gap-2">
              <Radio className="w-3 h-3 text-brand-red animate-pulse" />
              <span className="text-[10px] text-gray-400 dark:text-warm-500 font-medium">
                Commentary will appear here...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Scrolling Commentary Ticker Bar ────────────────── */}
      {commentaryItems.length > 0 && (
        <div className="flex-shrink-0 h-8 bg-gray-900 dark:bg-warm-950 flex items-center overflow-hidden">
          <div className="flex items-center gap-6 animate-marquee whitespace-nowrap px-4">
            {commentaryItems.map((item, i) => (
              <span key={i} className="flex items-center gap-2 text-[10px]">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.teamColor }}
                />
                <span className="text-gray-300 font-medium">{item.text}</span>
              </span>
            ))}
            {/* Duplicate for seamless loop */}
            {commentaryItems.map((item, i) => (
              <span key={`dup-${i}`} className="flex items-center gap-2 text-[10px]">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.teamColor }}
                />
                <span className="text-gray-300 font-medium">{item.text}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── BarChart3 Icon (inline to avoid conflicts) ─────────────────────

function BarChart3Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}
