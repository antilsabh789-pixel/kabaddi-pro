'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords, Shield, Clock, Award, AlertTriangle,
  Play, Pause, SkipBack, SkipForward,
  RotateCcw, ChevronDown, ChevronUp, X, Timer,
  Flame, Target,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventCategory = 'all' | 'raid_points' | 'defense_points' | 'special_events' | 'cards';

interface TimelineEvent {
  id: string;
  teamId: string;
  playerName: string;
  jerseyNumber: number;
  eventType: string;
  value: number;
  details: string;
  half: number;
  minute: number;
  second: number;
}

interface TeamData {
  id: string;
  name: string;
  shortName: string;
  color: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const HOME_TEAM: TeamData = {
  id: 'home',
  name: 'Bengaluru Bulls',
  shortName: 'BLR',
  color: '#DC2626',
};

const AWAY_TEAM: TeamData = {
  id: 'away',
  name: 'Patna Pirates',
  shortName: 'PAT',
  color: '#1E293B',
};

const MOCK_EVENTS: TimelineEvent[] = [
  { id: 'e1',  teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'raid_point',    value: 1, details: 'Touch point on left corner defender',          half: 1, minute: 0,  second: 45 },
  { id: 'e2',  teamId: 'away', playerName: 'Pardeep Narwal',   jerseyNumber: 10, eventType: 'raid_point',    value: 1, details: 'Running hand touch on right corner',           half: 1, minute: 1,  second: 30 },
  { id: 'e3',  teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'bonus_point',   value: 1, details: 'Crossed the baulk line with control',          half: 1, minute: 2,  second: 15 },
  { id: 'e4',  teamId: 'away', playerName: 'Jaideep',          jerseyNumber: 3,  eventType: 'tackle_point',  value: 1, details: 'Ankle hold on the raider',                     half: 1, minute: 3,  second: 0   },
  { id: 'e5',  teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'super_raid',    value: 3, details: 'Incredible 3-point raid! Touch on 3 defenders', half: 1, minute: 4,  second: 20 },
  { id: 'e6',  teamId: 'away', playerName: 'Pardeep Narwal',   jerseyNumber: 10, eventType: 'raid_point',    value: 1, details: 'Toe touch on the cover defender',              half: 1, minute: 5,  second: 10 },
  { id: 'e7',  teamId: 'home', playerName: 'Mahender Singh',   jerseyNumber: 5,  eventType: 'tackle_point',  value: 1, details: 'Thigh hold on the raider',                     half: 1, minute: 6,  second: 30 },
  { id: 'e8',  teamId: 'away', playerName: 'Monu Goyat',       jerseyNumber: 8,  eventType: 'bonus_point',   value: 1, details: 'Crossed the baulk line under pressure',        half: 1, minute: 7,  second: 45 },
  { id: 'e9',  teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'raid_point',    value: 1, details: 'Escaped the chain tackle attempt',             half: 1, minute: 9,  second: 0   },
  { id: 'e10', teamId: 'away', playerName: 'Pardeep Narwal',   jerseyNumber: 10, eventType: 'do_or_die_raid', value: 2, details: 'Do-or-Die raid! 2-point raid with bonus',     half: 1, minute: 10, second: 15 },
  { id: 'e11', teamId: 'away', playerName: 'Vijay',            jerseyNumber: 6,  eventType: 'yellow_card',   value: 0, details: 'Warning for excessive aggression',             half: 1, minute: 11, second: 30 },
  { id: 'e12', teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'raid_point',    value: 1, details: 'Squat thrust kick on the left defender',       half: 1, minute: 13, second: 0   },
  { id: 'e13', teamId: 'away', playerName: 'Jaideep',          jerseyNumber: 3,  eventType: 'super_tackle',  value: 2, details: 'Super tackle! Only 3 defenders remaining',    half: 1, minute: 14, second: 30 },
  { id: 'e14', teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'raid_point',    value: 1, details: 'Running touch point',                          half: 1, minute: 16, second: 0   },
  { id: 'e15', teamId: 'away', playerName: 'Pardeep Narwal',   jerseyNumber: 10, eventType: 'raid_point',    value: 1, details: 'Dubki under the chain tackle',                half: 1, minute: 17, second: 45 },
  { id: 'e16', teamId: 'away', playerName: 'Pardeep Narwal',   jerseyNumber: 10, eventType: 'all_out',       value: 2, details: 'ALL OUT! Patna Pirates get 2 bonus points',   half: 1, minute: 18, second: 30 },
  { id: 'e17', teamId: 'home', playerName: 'Rohit Kumar',      jerseyNumber: 2,  eventType: 'timeout',       value: 0, details: 'Bengaluru Bulls call for a time-out',         half: 1, minute: 19, second: 0   },
  // ─── 2nd Half ───────────────────────────────────────────────────────
  { id: 'e18', teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'raid_point',    value: 1, details: 'Quick touch point to start the half',         half: 2, minute: 20, second: 30 },
  { id: 'e19', teamId: 'away', playerName: 'Pardeep Narwal',   jerseyNumber: 10, eventType: 'super_raid',    value: 3, details: 'Super raid by Pardeep! 3 defenders touched',  half: 2, minute: 22, second: 15 },
  { id: 'e20', teamId: 'home', playerName: 'Mahender Singh',   jerseyNumber: 5,  eventType: 'tackle_point',  value: 1, details: 'Dash from the left cover position',            half: 2, minute: 24, second: 0   },
  { id: 'e21', teamId: 'away', playerName: 'Jaideep',          jerseyNumber: 3,  eventType: 'tackle_point',  value: 1, details: 'Back hold caught the raider off guard',        half: 2, minute: 25, second: 30 },
  { id: 'e22', teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'all_out',       value: 2, details: 'ALL OUT! Bengaluru Bulls get 2 bonus points', half: 2, minute: 27, second: 0   },
  { id: 'e23', teamId: 'away', playerName: 'Monu Goyat',       jerseyNumber: 8,  eventType: 'raid_point',    value: 1, details: 'Bonus line touch point',                       half: 2, minute: 28, second: 45 },
  { id: 'e24', teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'raid_point',    value: 1, details: 'Multi-point raid attempt, 1 point secured',    half: 2, minute: 30, second: 0   },
  { id: 'e25', teamId: 'away', playerName: 'Vijay',            jerseyNumber: 6,  eventType: 'green_card',    value: 0, details: 'Green card shown for repeated infringement',   half: 2, minute: 31, second: 15 },
  { id: 'e26', teamId: 'home', playerName: 'Mahender Singh',   jerseyNumber: 5,  eventType: 'super_tackle',  value: 2, details: 'Super tackle with just 3 defenders!',          half: 2, minute: 33, second: 0   },
  { id: 'e27', teamId: 'away', playerName: 'Pardeep Narwal',   jerseyNumber: 10, eventType: 'raid_point',    value: 1, details: 'Escaped the thigh hold attempt',              half: 2, minute: 35, second: 30 },
  { id: 'e28', teamId: 'home', playerName: 'Pawan Sehrawat',   jerseyNumber: 7,  eventType: 'raid_point',    value: 1, details: 'Final touch point to seal the match',         half: 2, minute: 38, second: 0   },
];

// ─── Event Config ─────────────────────────────────────────────────────────────

interface EventConfig {
  color: string;
  bgColor: string;
  darkBgColor: string;
  icon: typeof Swords;
  label: string;
  category: EventCategory[];
}

const EVENT_CONFIG: Record<string, EventConfig> = {
  raid_point:      { color: 'text-brand-red',  bgColor: 'bg-brand-red/10',  darkBgColor: 'dark:bg-brand-red/20',  icon: Swords,  label: 'Raid Point',     category: ['raid_points'] },
  bonus_point:     { color: 'text-brand-gold', bgColor: 'bg-brand-gold/10', darkBgColor: 'dark:bg-brand-gold/20', icon: Target,  label: 'Bonus Point',    category: ['raid_points'] },
  tackle_point:    { color: 'text-brand-teal', bgColor: 'bg-brand-teal/10', darkBgColor: 'dark:bg-brand-teal/20', icon: Shield,  label: 'Tackle Point',   category: ['defense_points'] },
  super_tackle:    { color: 'text-purple-500', bgColor: 'bg-purple-500/10', darkBgColor: 'dark:bg-purple-500/20', icon: Shield,  label: 'Super Tackle',   category: ['defense_points', 'special_events'] },
  super_raid:      { color: 'text-orange-500', bgColor: 'bg-orange-500/10', darkBgColor: 'dark:bg-orange-500/20', icon: Swords,  label: 'Super Raid',     category: ['raid_points', 'special_events'] },
  all_out:         { color: 'text-red-600',    bgColor: 'bg-red-600/10',    darkBgColor: 'dark:bg-red-600/20',    icon: Flame,   label: 'All Out',        category: ['special_events'] },
  do_or_die_raid:  { color: 'text-amber-600',  bgColor: 'bg-amber-600/10',  darkBgColor: 'dark:bg-amber-600/20',  icon: Swords,  label: 'Do or Die Raid', category: ['raid_points', 'special_events'] },
  timeout:         { color: 'text-warm-500',   bgColor: 'bg-warm-200',      darkBgColor: 'dark:bg-warm-700/30',   icon: Clock,   label: 'Timeout',        category: ['special_events'] },
  yellow_card:     { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', darkBgColor: 'dark:bg-yellow-500/20', icon: Award,   label: 'Yellow Card',    category: ['cards'] },
  red_card:        { color: 'text-red-600',    bgColor: 'bg-red-600/10',    darkBgColor: 'dark:bg-red-600/20',    icon: AlertTriangle, label: 'Red Card',  category: ['cards'] },
  green_card:      { color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', darkBgColor: 'dark:bg-emerald-500/20', icon: Award, label: 'Green Card',    category: ['cards'] },
};

const FILTER_OPTIONS: { key: EventCategory; label: string }[] = [
  { key: 'all',             label: 'All' },
  { key: 'raid_points',     label: 'Raid Points' },
  { key: 'defense_points',  label: 'Defense' },
  { key: 'special_events',  label: 'Special' },
  { key: 'cards',           label: 'Cards' },
];

const SPEED_OPTIONS = [1, 2, 4] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(minute: number, second: number): string {
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function getTeamById(teamId: string): TeamData {
  return teamId === 'home' ? HOME_TEAM : AWAY_TEAM;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchTimelineScreen({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(MOCK_EVENTS.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [activeFilter, setActiveFilter] = useState<EventCategory>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const eventRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Filtered events ──────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return MOCK_EVENTS;
    return MOCK_EVENTS.filter(evt => {
      const config = EVENT_CONFIG[evt.eventType];
      return config?.category.includes(activeFilter) ?? false;
    });
  }, [activeFilter]);

  // ── Compute running scores ───────────────────────────────────────────────
  const getRunningScore = useCallback((step: number) => {
    let homeScore = 0;
    let awayScore = 0;
    for (let i = 0; i <= step && i < MOCK_EVENTS.length; i++) {
      const evt = MOCK_EVENTS[i];
      if (evt.teamId === 'home') {
        homeScore += evt.value;
      } else {
        awayScore += evt.value;
      }
    }
    return { homeScore, awayScore };
  }, []);

  const score = getRunningScore(currentStep);

  // ── Summary stats ────────────────────────────────────────────────────────
  const summaryStats = useMemo(() => {
    const visibleEvents = MOCK_EVENTS.slice(0, currentStep + 1);
    const totalRaids = visibleEvents.filter(e => e.eventType === 'raid_point' || e.eventType === 'super_raid' || e.eventType === 'do_or_die_raid').length;
    const totalTackles = visibleEvents.filter(e => e.eventType === 'tackle_point' || e.eventType === 'super_tackle').length;
    const totalBonus = visibleEvents.filter(e => e.eventType === 'bonus_point').length;
    const totalAllOuts = visibleEvents.filter(e => e.eventType === 'all_out').length;
    return { totalRaids, totalTackles, totalBonus, totalAllOuts };
  }, [currentStep]);

  // ── Key moment positions (for scrubber markers) ──────────────────────────
  const keyMoments = useMemo(() => {
    return MOCK_EVENTS
      .map((evt, idx) => {
        const isKey = ['super_raid', 'super_tackle', 'all_out', 'do_or_die_raid'].includes(evt.eventType);
        return isKey ? { index: idx, eventType: evt.eventType, label: EVENT_CONFIG[evt.eventType]?.label || evt.eventType } : null;
      })
      .filter((m): m is { index: number; eventType: string; label: string } => m !== null);
  }, []);

  // ── Auto-play logic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= MOCK_EVENTS.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1500 / playSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, playSpeed]);

  // ── Auto-scroll to current event during playback ─────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const currentEvent = MOCK_EVENTS[currentStep];
    if (!currentEvent) return;
    const el = eventRefs.current[currentEvent.id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, isPlaying]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (currentStep >= MOCK_EVENTS.length - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.min(prev + 1, MOCK_EVENTS.length - 1));
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const handleScrub = (position: number) => {
    setIsPlaying(false);
    const step = Math.round((position / 100) * (MOCK_EVENTS.length - 1));
    setCurrentStep(step);
  };

  const toggleExpand = (eventId: string) => {
    setExpandedEvent(prev => prev === eventId ? null : eventId);
  };

  // ── Progress ─────────────────────────────────────────────────────────────
  const progressPercent = MOCK_EVENTS.length > 0
    ? ((currentStep + 1) / MOCK_EVENTS.length) * 100
    : 0;

  // ── Find half transition index ───────────────────────────────────────────
  const halfTwoStartIndex = useMemo(() => {
    return MOCK_EVENTS.findIndex(e => e.half === 2);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
    >
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20">
        {/* Glass-morphism Score Header */}
        <div className="bg-gradient-to-r from-brand-navy/95 to-brand-blue/95 dark:from-brand-navy-dark/95 dark:to-brand-navy/95 backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-brand-gold" />
              <h1 className="text-lg font-bold text-white">Match Timeline</h1>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Score Display */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between">
              {/* Home Team */}
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
                  style={{ backgroundColor: HOME_TEAM.color }}
                >
                  {HOME_TEAM.shortName}
                </div>
                <span className="text-[11px] text-warm-300 text-center truncate max-w-[90px]">
                  {HOME_TEAM.name}
                </span>
              </div>

              {/* Score */}
              <div className="flex items-center gap-3 px-3">
                <motion.span
                  key={`home-${score.homeScore}`}
                  initial={{ scale: 1.4, color: '#FCD34D' }}
                  animate={{ scale: 1, color: '#FFFFFF' }}
                  transition={{ duration: 0.4 }}
                  className="text-3xl font-black text-white"
                >
                  {score.homeScore}
                </motion.span>
                <div className="flex flex-col items-center">
                  <span className="text-warm-400 text-sm font-medium">-</span>
                </div>
                <motion.span
                  key={`away-${score.awayScore}`}
                  initial={{ scale: 1.4, color: '#FCD34D' }}
                  animate={{ scale: 1, color: '#FFFFFF' }}
                  transition={{ duration: 0.4 }}
                  className="text-3xl font-black text-white"
                >
                  {score.awayScore}
                </motion.span>
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg"
                  style={{ backgroundColor: AWAY_TEAM.color }}
                >
                  {AWAY_TEAM.shortName}
                </div>
                <span className="text-[11px] text-warm-300 text-center truncate max-w-[90px]">
                  {AWAY_TEAM.name}
                </span>
              </div>
            </div>

            {/* Half & Time indicator */}
            <div className="mt-2 flex items-center justify-center gap-2">
              <Badge variant="secondary" className="text-[10px] bg-white/10 text-warm-300 border-0">
                {MOCK_EVENTS[currentStep]?.half === 1 ? '1st Half' : '2nd Half'}
              </Badge>
              <span className="text-[10px] text-warm-400">
                {formatTime(MOCK_EVENTS[currentStep]?.minute ?? 0, MOCK_EVENTS[currentStep]?.second ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Stats Bar */}
        <div className="bg-white/80 dark:bg-warm-800/80 backdrop-blur-md border-b border-warm-200 dark:border-warm-700">
          <div className="flex items-center justify-around py-2 px-3">
            <div className="flex flex-col items-center">
              <Swords className="w-3.5 h-3.5 text-brand-red mb-0.5" />
              <span className="text-xs font-bold text-warm-800 dark:text-warm-200">{summaryStats.totalRaids}</span>
              <span className="text-[9px] text-warm-500 dark:text-warm-400">Raids</span>
            </div>
            <div className="w-px h-6 bg-warm-200 dark:bg-warm-700" />
            <div className="flex flex-col items-center">
              <Shield className="w-3.5 h-3.5 text-brand-teal mb-0.5" />
              <span className="text-xs font-bold text-warm-800 dark:text-warm-200">{summaryStats.totalTackles}</span>
              <span className="text-[9px] text-warm-500 dark:text-warm-400">Tackles</span>
            </div>
            <div className="w-px h-6 bg-warm-200 dark:bg-warm-700" />
            <div className="flex flex-col items-center">
              <Target className="w-3.5 h-3.5 text-brand-gold mb-0.5" />
              <span className="text-xs font-bold text-warm-800 dark:text-warm-200">{summaryStats.totalBonus}</span>
              <span className="text-[9px] text-warm-500 dark:text-warm-400">Bonus</span>
            </div>
            <div className="w-px h-6 bg-warm-200 dark:bg-warm-700" />
            <div className="flex flex-col items-center">
              <Flame className="w-3.5 h-3.5 text-purple-500 mb-0.5" />
              <span className="text-xs font-bold text-warm-800 dark:text-warm-200">{summaryStats.totalAllOuts}</span>
              <span className="text-[9px] text-warm-500 dark:text-warm-400">All Outs</span>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-warm-50 dark:bg-warm-900 border-b border-warm-200 dark:border-warm-700">
          <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto">
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setActiveFilter(opt.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  activeFilter === opt.key
                    ? 'bg-brand-red text-white shadow-md'
                    : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Timeline ─────────────────────────────────────────────────────── */}
      <div ref={timelineRef} className="relative px-4 pt-6 pb-4 max-w-2xl mx-auto">
        {/* Timeline center line with gradient */}
        <div className="absolute left-1/2 -translate-x-1/2 top-6 bottom-4 w-0.5 bg-gradient-to-b from-brand-red via-brand-gold to-brand-teal dark:from-brand-red-light dark:via-brand-gold-light dark:to-brand-teal-light opacity-30 rounded-full" />

        <AnimatePresence mode="popLayout">
          {filteredEvents.map((evt, filteredIndex) => {
            const globalIndex = MOCK_EVENTS.indexOf(evt);
            const isLeft = filteredIndex % 2 === 0;
            const isCurrent = globalIndex === currentStep;
            const isPast = globalIndex <= currentStep;
            const config = EVENT_CONFIG[evt.eventType] || EVENT_CONFIG.raid_point;
            const team = getTeamById(evt.teamId);
            const EventIcon = config.icon;
            const isExpanded = expandedEvent === evt.id;

            // Check if this is the first event of 2nd half
            const showHalfDivider = evt.half === 2 && globalIndex === halfTwoStartIndex;

            return (
              <motion.div
                key={evt.id}
                ref={(el) => { eventRefs.current[evt.id] = el; }}
                initial={{ opacity: 0, x: isLeft ? -40 : 40, y: 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={{ opacity: 0, x: isLeft ? -40 : 40 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.02 }}
              >
                {/* Half Divider */}
                {showHalfDivider && (
                  <div className="flex items-center justify-center mb-6 relative z-10">
                    <div className="bg-warm-100 dark:bg-warm-800 border-2 border-brand-gold dark:border-brand-gold rounded-full px-4 py-1.5 shadow-md">
                      <span className="text-xs font-bold text-brand-gold dark:text-brand-gold-light tracking-wider uppercase">
                        2nd Half
                      </span>
                    </div>
                  </div>
                )}

                {/* First Half Label */}
                {globalIndex === 0 && (
                  <div className="flex items-center justify-center mb-6 relative z-10">
                    <div className="bg-warm-100 dark:bg-warm-800 border-2 border-brand-red dark:border-brand-red rounded-full px-4 py-1.5 shadow-md">
                      <span className="text-xs font-bold text-brand-red dark:text-brand-red-light tracking-wider uppercase">
                        1st Half
                      </span>
                    </div>
                  </div>
                )}

                <div className={`flex items-start gap-4 mb-5 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                  {/* Event Card */}
                  <motion.div
                    className={`flex-1 ${isLeft ? 'pr-6' : 'pl-6'}`}
                    animate={isCurrent && isPlaying ? { scale: [1, 1.02, 1] } : {}}
                    transition={isCurrent && isPlaying ? { duration: 1, repeat: Infinity } : {}}
                  >
                    <Card
                      className={`cursor-pointer transition-all border-0 shadow-sm overflow-hidden ${
                        isCurrent
                          ? 'ring-2 ring-brand-red/40 dark:ring-brand-red-light/40 shadow-md'
                          : isPast
                          ? 'bg-white dark:bg-warm-800'
                          : 'bg-warm-100/60 dark:bg-warm-800/40 opacity-60'
                      }`}
                      style={{
                        borderLeft: isLeft ? `3px solid ${team.color}` : undefined,
                        borderRight: !isLeft ? `3px solid ${team.color}` : undefined,
                      }}
                      onClick={() => { setCurrentStep(globalIndex); setIsPlaying(false); }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                          {/* Event Icon */}
                          <div className={`w-8 h-8 rounded-lg ${config.bgColor} ${config.darkBgColor} flex items-center justify-center flex-shrink-0`}>
                            <EventIcon className={`w-4 h-4 ${config.color}`} />
                          </div>

                          {/* Event Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-xs font-bold ${config.color}`}>
                                {config.label}
                              </span>
                              {evt.value > 0 && (
                                <Badge className={`${config.bgColor} ${config.darkBgColor} ${config.color} text-[10px] border-0 font-bold px-1.5 py-0`}>
                                  +{evt.value}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: team.color }}
                              >
                                {evt.jerseyNumber}
                              </div>
                              <span className="text-[11px] text-warm-600 dark:text-warm-300 truncate">
                                {evt.playerName}
                              </span>
                            </div>
                          </div>

                          {/* Timestamp */}
                          <div className="flex flex-col items-end flex-shrink-0">
                            <span className="text-[10px] text-warm-400 dark:text-warm-500 font-mono">
                              {formatTime(evt.minute, evt.second)}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleExpand(evt.id); }}
                              className="p-0.5 rounded hover:bg-warm-100 dark:hover:bg-warm-700 transition-colors"
                            >
                              {isExpanded
                                ? <ChevronUp className="w-3 h-3 text-warm-400" />
                                : <ChevronDown className="w-3 h-3 text-warm-400" />
                              }
                            </button>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 pt-2 border-t border-warm-200 dark:border-warm-700">
                                <p className="text-[11px] text-warm-500 dark:text-warm-400 leading-relaxed">
                                  {evt.details}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[9px] text-warm-400 dark:text-warm-500">
                                    Half {evt.half}
                                  </span>
                                  <span className="text-[9px] text-warm-400 dark:text-warm-500">|</span>
                                  <span className="text-[9px] text-warm-400 dark:text-warm-500">
                                    Event #{globalIndex + 1}
                                  </span>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Timeline Node */}
                  <div className="flex flex-col items-center flex-shrink-0 relative z-10 -mt-1">
                    <motion.div
                      className={`w-7 h-7 rounded-full flex items-center justify-center border-2 ${
                        isCurrent
                          ? 'bg-brand-red border-brand-red shadow-lg shadow-brand-red/30'
                          : isPast
                          ? 'bg-white dark:bg-warm-800 border-brand-red dark:border-brand-red-light'
                          : 'bg-warm-100 dark:bg-warm-700 border-warm-300 dark:border-warm-600'
                      }`}
                      animate={isCurrent ? { scale: [1, 1.15, 1] } : {}}
                      transition={isCurrent ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isCurrent
                            ? 'bg-white'
                            : isPast
                            ? 'bg-brand-red dark:bg-brand-red-light'
                            : 'bg-warm-300 dark:bg-warm-600'
                        }`}
                      />
                    </motion.div>
                  </div>

                  {/* Spacer for the other side */}
                  <div className="flex-1" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ─── Bottom Controls (Sticky) ──────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 bg-white/90 dark:bg-warm-900/90 backdrop-blur-xl border-t border-warm-200 dark:border-warm-700 shadow-lg">
        {/* Scrubber with key moment markers */}
        <div className="px-4 pt-3 pb-1">
          <div className="relative">
            {/* Key moment markers */}
            <div className="absolute top-0 left-0 right-0 h-5 z-10 pointer-events-none">
              {keyMoments.map(km => {
                const pos = ((km.index + 1) / MOCK_EVENTS.length) * 100;
                return (
                  <div
                    key={km.index}
                    className="absolute -top-1"
                    style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-gold shadow-sm" title={km.label} />
                  </div>
                );
              })}
            </div>

            {/* Progress track */}
            <div
              className="h-2 bg-warm-200 dark:bg-warm-700 rounded-full cursor-pointer relative mt-2"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = ((e.clientX - rect.left) / rect.width) * 100;
                handleScrub(Math.max(0, Math.min(100, pos)));
              }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-brand-red to-brand-gold rounded-full relative"
                style={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.2 }}
              >
                {/* Scrubber handle */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-warm-200 border-2 border-brand-red rounded-full shadow-md transform translate-x-1/2" />
              </motion.div>
            </div>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-warm-400 dark:text-warm-500 font-mono">
              {formatTime(MOCK_EVENTS[0]?.minute ?? 0, MOCK_EVENTS[0]?.second ?? 0)}
            </span>
            <span className="text-[9px] text-warm-400 dark:text-warm-500 font-mono">
              {formatTime(MOCK_EVENTS[MOCK_EVENTS.length - 1]?.minute ?? 0, MOCK_EVENTS[MOCK_EVENTS.length - 1]?.second ?? 0)}
            </span>
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-2 px-4 pb-3">
          <button
            onClick={handleReset}
            className="p-2 rounded-full bg-warm-100 dark:bg-warm-800 hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors"
            aria-label="Reset"
          >
            <RotateCcw className="w-4 h-4 text-warm-600 dark:text-warm-300" />
          </button>

          <button
            onClick={handleStepBack}
            className="p-2 rounded-full bg-warm-100 dark:bg-warm-800 hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors"
            aria-label="Step back"
          >
            <SkipBack className="w-4 h-4 text-warm-600 dark:text-warm-300" />
          </button>

          <motion.button
            onClick={handlePlayPause}
            className="p-3 rounded-full bg-brand-red text-white hover:bg-brand-red-dark transition-colors shadow-lg"
            whileTap={{ scale: 0.9 }}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ duration: 0.15 }}
                >
                  <Pause className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  transition={{ duration: 0.15 }}
                >
                  <Play className="w-5 h-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <button
            onClick={handleStepForward}
            className="p-2 rounded-full bg-warm-100 dark:bg-warm-800 hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors"
            aria-label="Step forward"
          >
            <SkipForward className="w-4 h-4 text-warm-600 dark:text-warm-300" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-0.5 ml-1">
            {SPEED_OPTIONS.map(speed => (
              <button
                key={speed}
                onClick={() => setPlaySpeed(speed)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                  playSpeed === speed
                    ? 'bg-brand-red text-white shadow-sm'
                    : 'bg-warm-100 dark:bg-warm-800 text-warm-500 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Event counter */}
        <div className="text-center pb-2">
          <span className="text-[10px] text-warm-400 dark:text-warm-500">
            Event {currentStep + 1} of {MOCK_EVENTS.length}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
