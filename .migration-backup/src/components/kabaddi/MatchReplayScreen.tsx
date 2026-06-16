'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Pause, SkipBack, SkipForward, RotateCcw,
  Swords, Shield, Zap, Award, Clock, Flame, AlertTriangle,
  Target, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventFilter = 'all' | 'raid_points' | 'defense_points' | 'special_events' | 'cards';

interface MatchEventDB {
  id: string;
  teamId: string;
  playerId: string | null;
  eventType: string;
  value: number;
  details: string | null;
  half: number;
  timestamp: string;
}

interface TeamInfo {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
}

interface MatchInfo {
  id: string;
  homeScore: number;
  awayScore: number;
  half: number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  tournament: { name: string } | null;
  startedAt: string | null;
  completedAt: string | null;
}

// ─── Event Config with enhanced styling ────────────────────────────────────────

interface EventConfigEntry {
  color: string;
  bgColor: string;
  darkBgColor: string;
  icon: typeof Swords;
  label: string;
  filter: EventFilter[];
}

const EVENT_CONFIG: Record<string, EventConfigEntry> = {
  raid_point:     { color: 'text-brand-red',  bgColor: 'bg-brand-red/10',  darkBgColor: 'dark:bg-brand-red/20',  icon: Swords,         label: 'Raid Point',     filter: ['raid_points'] },
  bonus_point:    { color: 'text-brand-gold', bgColor: 'bg-brand-gold/10', darkBgColor: 'dark:bg-brand-gold/20', icon: Target,         label: 'Bonus Point',    filter: ['raid_points'] },
  tackle_point:   { color: 'text-brand-teal', bgColor: 'bg-brand-teal/10', darkBgColor: 'dark:bg-brand-teal/20', icon: Shield,         label: 'Tackle Point',   filter: ['defense_points'] },
  super_tackle:   { color: 'text-purple-500', bgColor: 'bg-purple-500/10', darkBgColor: 'dark:bg-purple-500/20', icon: Shield,         label: 'Super Tackle',   filter: ['defense_points', 'special_events'] },
  super_raid:     { color: 'text-orange-500', bgColor: 'bg-orange-500/10', darkBgColor: 'dark:bg-orange-500/20', icon: Swords,         label: 'Super Raid',     filter: ['raid_points', 'special_events'] },
  all_out:        { color: 'text-red-600',    bgColor: 'bg-red-600/10',    darkBgColor: 'dark:bg-red-600/20',    icon: Flame,          label: 'All Out',        filter: ['special_events'] },
  do_or_die_raid: { color: 'text-amber-600',  bgColor: 'bg-amber-600/10',  darkBgColor: 'dark:bg-amber-600/20',  icon: Swords,         label: 'Do or Die Raid', filter: ['raid_points', 'special_events'] },
  timeout:        { color: 'text-warm-500',   bgColor: 'bg-warm-200',      darkBgColor: 'dark:bg-warm-700/30',   icon: Clock,          label: 'Timeout',        filter: ['special_events'] },
  yellow_card:    { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', darkBgColor: 'dark:bg-yellow-500/20', icon: Award,          label: 'Yellow Card',    filter: ['cards'] },
  red_card:       { color: 'text-red-600',    bgColor: 'bg-red-600/10',    darkBgColor: 'dark:bg-red-600/20',    icon: AlertTriangle,  label: 'Red Card',       filter: ['cards'] },
  green_card:     { color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', darkBgColor: 'dark:bg-emerald-500/20', icon: Award,         label: 'Green Card',     filter: ['cards'] },
};

const FILTER_OPTIONS: { key: EventFilter; label: string }[] = [
  { key: 'all',             label: 'All' },
  { key: 'raid_points',     label: 'Raid' },
  { key: 'defense_points',  label: 'Defense' },
  { key: 'special_events',  label: 'Special' },
  { key: 'cards',           label: 'Cards' },
];

const SPEED_OPTIONS = [1, 2, 4] as const;

const KEY_MOMENT_TYPES = new Set(['super_raid', 'super_tackle', 'all_out', 'do_or_die_raid']);

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchReplayScreen({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [events, setEvents] = useState<MatchEventDB[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<EventFilter>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // ── Load match ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadMatch() {
      try {
        const res = await fetch(`/api/matches?id=${matchId}`);
        if (res.ok) {
          const data = await res.json();
          setMatch(data);
          if (data.events) {
            setEvents(data.events.sort((a: MatchEventDB, b: MatchEventDB) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            ));
          }
        }
      } catch (err) {
        console.error('Failed to load match:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMatch();
  }, [matchId]);

  // ── Auto-play logic ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || events.length === 0) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2000 / playSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, events.length, playSpeed]);

  // ── Compute running scores ───────────────────────────────────────────────
  const getRunningScore = useCallback((step: number) => {
    let homeScore = 0;
    let awayScore = 0;
    for (let i = 0; i <= step && i < events.length; i++) {
      const evt = events[i];
      if (!match) continue;
      const isHome = evt.teamId === match.homeTeam.id;
      const points = evt.value;
      let bonus = 0;
      if (evt.eventType === 'all_out') bonus = 2;
      if (isHome) homeScore += points + bonus;
      else awayScore += points + bonus;
    }
    return { homeScore, awayScore };
  }, [events, match]);

  const score = getRunningScore(currentStep);

  // ── Filtered events ──────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return events;
    return events.filter(evt => {
      const config = EVENT_CONFIG[evt.eventType];
      return config?.filter.includes(activeFilter) ?? false;
    });
  }, [events, activeFilter]);

  // ── Key moment positions for scrubber ────────────────────────────────────
  const keyMoments = useMemo(() => {
    return events
      .map((evt, idx) => {
        const isKey = KEY_MOMENT_TYPES.has(evt.eventType);
        return isKey ? { index: idx, eventType: evt.eventType, label: EVENT_CONFIG[evt.eventType]?.label || evt.eventType } : null;
      })
      .filter((m): m is { index: number; eventType: string; label: string } => m !== null);
  }, [events]);

  // ── Progress ─────────────────────────────────────────────────────────────
  const progressPercent = events.length > 0 ? ((currentStep + 1) / events.length) * 100 : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (currentStep >= events.length - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const handleScrub = (position: number) => {
    setIsPlaying(false);
    const step = Math.round((position / 100) * (events.length - 1));
    setCurrentStep(step);
  };

  const getTeamShortName = (team: TeamInfo) => {
    if (team.shortName) return team.shortName;
    return team.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
  };

  const getEventConfig = (eventType: string): EventConfigEntry => {
    return EVENT_CONFIG[eventType] || { color: 'text-warm-500', bgColor: 'bg-warm-100', darkBgColor: 'dark:bg-warm-700/30', icon: Award, label: eventType, filter: ['all'] as EventFilter[] };
  };

  // ── Loading State ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex items-center justify-center">
        <p className="text-warm-600 dark:text-warm-400">Match not found</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto flex flex-col"
    >
      {/* ─── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20">
        {/* Title bar */}
        <div className="bg-gradient-to-r from-brand-navy to-brand-blue dark:from-brand-navy-dark dark:to-brand-navy">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-brand-gold" />
              <h1 className="text-lg font-bold text-white">Match Replay</h1>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Score Display with glass-morphism */}
        <div className="px-4 py-3 bg-gradient-to-br from-warm-800/95 to-warm-900/95 dark:from-warm-800 dark:to-warm-900 backdrop-blur-xl">
          {match.tournament && (
            <p className="text-[10px] text-warm-400 text-center mb-2">{match.tournament.name}</p>
          )}
          <div className="flex items-center justify-between">
            {/* Home Team */}
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg ring-2 ring-white/10"
                style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}
              >
                {getTeamShortName(match.homeTeam)}
              </div>
              <span className="text-xs text-warm-300 text-center truncate max-w-[100px]">
                {match.homeTeam.name}
              </span>
            </div>

            {/* Score */}
            <div className="flex items-center gap-4 px-4">
              <motion.span
                key={`home-${score.homeScore}`}
                initial={{ scale: 1.5, color: '#FCD34D' }}
                animate={{ scale: 1, color: '#FFFFFF' }}
                transition={{ duration: 0.4 }}
                className="text-3xl font-black text-white"
              >
                {score.homeScore}
              </motion.span>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-warm-500 text-sm font-medium">-</span>
                {events[currentStep] && (
                  <Badge variant="secondary" className="text-[9px] bg-white/10 text-warm-300 border-0">
                    H{events[currentStep].half}
                  </Badge>
                )}
              </div>
              <motion.span
                key={`away-${score.awayScore}`}
                initial={{ scale: 1.5, color: '#FCD34D' }}
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
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg ring-2 ring-white/10"
                style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}
              >
                {getTeamShortName(match.awayTeam)}
              </div>
              <span className="text-xs text-warm-300 text-center truncate max-w-[100px]">
                {match.awayTeam.name}
              </span>
            </div>
          </div>

          {/* Step indicator & progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-warm-400 mb-1">
              <span>Event {Math.min(currentStep + 1, events.length)} of {events.length}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-1.5 bg-warm-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-brand-red to-brand-gold rounded-full"
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
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

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-4 pb-48">
        {/* Current Event Detail Card */}
        <AnimatePresence mode="wait">
          {events.length > 0 && currentStep < events.length && (() => {
            const evt = events[currentStep];
            const config = getEventConfig(evt.eventType);
            const isHome = evt.teamId === match.homeTeam.id;
            const team = isHome ? match.homeTeam : match.awayTeam;
            const EventIcon = config.icon;
            const teamColor = team.color || '#475569';

            return (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="mb-4"
              >
                <Card
                  className={`border-0 shadow-md overflow-hidden ${config.bgColor} ${config.darkBgColor}`}
                  style={{ borderLeft: `4px solid ${teamColor}` }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl ${config.bgColor} ${config.darkBgColor} flex items-center justify-center shadow-sm`}>
                        <EventIcon className={`w-6 h-6 ${config.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-bold ${config.color}`}>{config.label}</h4>
                          {evt.value > 0 && (
                            <Badge className={`${config.bgColor} ${config.darkBgColor} ${config.color} text-xs border-0 font-bold`}>
                              +{evt.value}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ backgroundColor: teamColor }}
                          >
                            {getTeamShortName(team).charAt(0)}
                          </div>
                          <span className="text-sm text-warm-700 dark:text-warm-300">{team.name}</span>
                        </div>
                        {evt.details && (
                          <p className="text-[11px] text-warm-500 dark:text-warm-400 mt-1">{evt.details}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Event Timeline List */}
        <div>
          <h3 className="font-bold text-warm-800 dark:text-warm-200 mb-3">Event Timeline</h3>
          <div className="space-y-1.5">
            {filteredEvents.map((evt) => {
              const globalIndex = events.indexOf(evt);
              const config = getEventConfig(evt.eventType);
              const isHome = evt.teamId === match.homeTeam.id;
              const team = isHome ? match.homeTeam : match.awayTeam;
              const isActive = globalIndex === currentStep;
              const isPast = globalIndex <= currentStep;
              const isExpanded = expandedEvent === evt.id;
              const teamColor = team.color || '#475569';
              const EventIcon = config.icon;

              return (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: isHome ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                >
                  <Card
                    className={`cursor-pointer transition-all border-0 overflow-hidden ${
                      isActive
                        ? 'shadow-md ring-2 ring-brand-red/30 dark:ring-brand-red-light/30'
                        : isPast
                        ? 'shadow-sm bg-white dark:bg-warm-800'
                        : 'shadow-none bg-warm-100/60 dark:bg-warm-800/40 opacity-50'
                    }`}
                    style={{ borderLeft: `3px solid ${isPast ? teamColor : '#e5e7eb'}` }}
                    onClick={() => { setCurrentStep(globalIndex); setIsPlaying(false); }}
                  >
                    <CardContent className="p-2.5">
                      <div className="flex items-center gap-2.5">
                        {/* Event icon */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isPast ? `${config.bgColor} ${config.darkBgColor}` : 'bg-warm-100 dark:bg-warm-700'
                        }`}>
                          {isPast ? (
                            <EventIcon className={`w-4 h-4 ${config.color}`} />
                          ) : (
                            <span className="text-warm-300 text-xs font-medium">{globalIndex + 1}</span>
                          )}
                        </div>

                        {/* Event info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-semibold ${isPast ? 'text-warm-800 dark:text-warm-200' : 'text-warm-400 dark:text-warm-500'}`}>
                              {config.label}
                            </span>
                            {KEY_MOMENT_TYPES.has(evt.eventType) && isPast && (
                              <Flame className="w-3 h-3 text-brand-gold" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div
                              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: teamColor }}
                            />
                            <span className="text-[10px] text-warm-500 dark:text-warm-400 truncate">{team.name}</span>
                          </div>
                        </div>

                        {/* Points & expand */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {evt.value > 0 && (
                            <span className={`text-sm font-bold ${isPast ? config.color : 'text-warm-300'}`}>
                              +{evt.value}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedEvent(prev => prev === evt.id ? null : evt.id); }}
                            className="p-0.5 rounded hover:bg-warm-100 dark:hover:bg-warm-700 transition-colors"
                          >
                            {isExpanded
                              ? <ChevronUp className="w-3 h-3 text-warm-400" />
                              : <ChevronDown className="w-3 h-3 text-warm-400" />
                            }
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
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
                              {evt.details && (
                                <p className="text-[11px] text-warm-500 dark:text-warm-400">{evt.details}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-warm-400 dark:text-warm-500">Half {evt.half}</span>
                                <span className="text-[9px] text-warm-400 dark:text-warm-500">|</span>
                                <span className="text-[9px] text-warm-400 dark:text-warm-500">Event #{globalIndex + 1}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Bottom Playback Controls (Sticky) ──────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 dark:bg-warm-900/90 backdrop-blur-xl border-t border-warm-200 dark:border-warm-700 shadow-lg">
        {/* Scrubber with key moment markers */}
        <div className="px-4 pt-3 pb-1">
          <div className="relative">
            {/* Key moment markers */}
            <div className="absolute top-0 left-0 right-0 h-4 z-10 pointer-events-none">
              {keyMoments.map(km => {
                const pos = ((km.index + 1) / events.length) * 100;
                return (
                  <div
                    key={km.index}
                    className="absolute -top-0.5"
                    style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
                  >
                    <div
                      className={`w-2 h-2 rounded-full shadow-sm ${
                        km.index <= currentStep ? 'bg-brand-gold' : 'bg-warm-300 dark:bg-warm-600'
                      }`}
                      title={km.label}
                    />
                  </div>
                );
              })}
            </div>

            {/* Progress track */}
            <div
              className="h-2 bg-warm-200 dark:bg-warm-700 rounded-full cursor-pointer relative mt-3"
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
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-warm-200 border-2 border-brand-red rounded-full shadow-md transform translate-x-1/2" />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Playback controls row */}
        <div className="flex items-center justify-center gap-2 px-4 py-2">
          <button
            onClick={handleReset}
            className="p-2 rounded-full bg-warm-100 dark:bg-warm-800 hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors"
            aria-label="Reset"
          >
            <RotateCcw className="w-4 h-4 text-warm-600 dark:text-warm-300" />
          </button>

          <button
            onClick={() => { setCurrentStep(Math.max(0, currentStep - 1)); setIsPlaying(false); }}
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
            onClick={() => { setCurrentStep(Math.min(events.length - 1, currentStep + 1)); setIsPlaying(false); }}
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
            Event {currentStep + 1} of {events.length}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
