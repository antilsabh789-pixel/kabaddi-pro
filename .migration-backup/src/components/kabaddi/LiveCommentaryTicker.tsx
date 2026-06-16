'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Shield, Flame, Target, AlertCircle,
  ChevronDown, Filter, Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type MatchEvent, type EventType, type ActiveMatch } from '@/lib/store';
import { generateCommentary, getCommentaryDotColor, type CommentaryExtras } from '@/lib/commentary';
import { cn } from '@/lib/utils';

// ─── Match Info ──────────────────────────────────────────────────────

/** Minimal match info needed for commentary rendering */
export interface CommentaryMatchInfo {
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamColor: string;
  awayTeamColor: string;
  currentHalf?: number;
}

/** Convert ActiveMatch to CommentaryMatchInfo */
export function toCommentaryMatchInfo(match: ActiveMatch): CommentaryMatchInfo {
  return {
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeTeamColor: match.homeTeamColor,
    awayTeamColor: match.awayTeamColor,
    currentHalf: match.currentHalf,
  };
}

// ─── Props ──────────────────────────────────────────────────────────

interface LiveCommentaryTickerProps {
  events: MatchEvent[];
  match: CommentaryMatchInfo;
  mode: 'compact' | 'full';
  className?: string;
  onExpand?: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────

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

/** Build commentary text from event data */
function buildCommentaryText(event: MatchEvent, match: CommentaryMatchInfo): string {
  const isHome = event.teamId === match.homeTeamId;
  const teamName = isHome ? match.homeTeam : match.awayTeam;
  const playerName = event.playerName || 'Player';

  // Parse details for extras
  let extras: CommentaryExtras = {};
  try {
    if (event.details) {
      const parsed = JSON.parse(event.details);
      if (parsed.isSuperRaid) extras.isSuperRaid = true;
      if (parsed.isSuperTackle) extras.isSuperTackle = true;
      if (parsed.isDoOrDie) extras.isDoOrDie = true;
      if (parsed.isAllOut) extras.isAllOut = true;
      if (parsed.touchedPlayerIds) extras.defendersTouched = (parsed.touchedPlayerIds as string[]).length;
    }
  } catch {
    // ignore parse errors
  }

  // Use the commentary helper for standard event types
  if (['raid_point', 'bonus_point', 'tackle_point', 'super_tackle', 'empty_raid', 'all_out', 'do_or_die_raid'].includes(event.eventType)) {
    return generateCommentary(event.eventType, playerName, teamName, event.value, extras);
  }

  // Custom text for remaining types
  switch (event.eventType) {
    case 'super_raid':
      return `SUPER RAID! ${playerName} touches 3+ defenders! - ${event.value} points for ${teamName}!`;
    case 'substitution':
      return `Substitution for ${teamName}`;
    case 'timeout':
      return `Timeout called by ${teamName}`;
    case 'yellow_card':
      return `Yellow Card shown to ${playerName} (${teamName})`;
    case 'red_card':
      return `Red Card! ${playerName} (${teamName}) is sent off!`;
    case 'green_card':
      return `Green Card shown to ${playerName} (${teamName})`;
    default:
      return `${playerName} makes a play for ${teamName}`;
  }
}

/** Get team color for a given event */
function getTeamColor(event: MatchEvent, match: CommentaryMatchInfo): string {
  const isHome = event.teamId === match.homeTeamId;
  return isHome ? match.homeTeamColor : match.awayTeamColor;
}

/** Determine which side an event belongs to */
function getEventSide(event: MatchEvent, match: CommentaryMatchInfo): 'home' | 'away' {
  return event.teamId === match.homeTeamId ? 'home' : 'away';
}

// ─── Event Icon Renderer (avoids component-during-render) ───────────

function EventIcon({ type, className }: { type: EventType; className?: string }) {
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
    case 'timeout':
      return <Filter className={className} />;
    case 'yellow_card':
    case 'red_card':
    case 'green_card':
      return <Target className={className} />;
    default:
      return <Zap className={className} />;
  }
}

// ─── Filter categories ──────────────────────────────────────────────

type FilterCategory = 'all' | 'scoring' | 'cards' | 'other';

function getFilterCategory(type: EventType): FilterCategory {
  if (['raid_point', 'bonus_point', 'tackle_point', 'super_tackle', 'super_raid', 'all_out'].includes(type)) {
    return 'scoring';
  }
  if (['yellow_card', 'red_card', 'green_card'].includes(type)) {
    return 'cards';
  }
  return 'other';
}

// ─── Commentary Event Card (Full Mode) ──────────────────────────────

function CommentaryEventCard({
  event,
  match,
  index,
}: {
  event: MatchEvent;
  match: CommentaryMatchInfo;
  index: number;
}) {
  const iconColor = getEventIconColor(event.eventType);
  const teamColor = getTeamColor(event, match);
  const side = getEventSide(event, match);
  const text = buildCommentaryText(event, match);
  const dotColor = getCommentaryDotColor(event.eventType);

  const halfLabel = event.half === 1 ? '1st Half' : '2nd Half';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.02 }}
      className="group"
    >
      <div className="flex gap-2.5 py-2">
        {/* Left color bar */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div
            className="w-1 rounded-full min-h-[40px] flex-shrink-0"
            style={{ backgroundColor: teamColor }}
          />
        </div>

        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-warm-800', iconColor)}>
            <EventIcon type={event.eventType} className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-gray-800 dark:text-warm-100 leading-snug">
              {text}
            </p>
            {event.value > 0 && (
              <Badge className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0 h-5 border-0 bg-brand-red/15 text-brand-red">
                +{event.value}pt{event.value > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-gray-400 dark:text-warm-500 font-medium">
              {halfLabel}
            </span>
            <span className="text-[10px] text-gray-300 dark:text-warm-600">·</span>
            <span className="text-[10px] text-gray-400 dark:text-warm-500">
              {side === 'home' ? match.homeTeam : match.awayTeam}
            </span>
            <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Half Divider ───────────────────────────────────────────────────

function HalfDivider({ half, count }: { half: number; count: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 h-px bg-gray-200 dark:bg-warm-700" />
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-500 dark:text-warm-400 uppercase tracking-wider">
          {half === 1 ? '1st Half' : '2nd Half'}
        </span>
        <Badge className="text-[9px] font-semibold px-1.5 py-0 h-4 bg-gray-100 dark:bg-warm-700 text-gray-500 dark:text-warm-400 border-0">
          {count}
        </Badge>
      </div>
      <div className="flex-1 h-px bg-gray-200 dark:bg-warm-700" />
    </div>
  );
}

// ─── Compact Ticker (Home Tab) ──────────────────────────────────────

function CompactTicker({ events, match, onExpand }: LiveCommentaryTickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Show latest 5 events, reversed so newest is on the right
  const latestEvents = useMemo(() => {
    return [...events].slice(-5).reverse();
  }, [events]);

  // Auto-scroll to end (latest event)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="h-12 flex items-center px-3 bg-gray-50 dark:bg-warm-800/50 rounded-b-xl border-t border-gray-100 dark:border-warm-700">
        <span className="text-[10px] text-gray-400 dark:text-warm-500 italic">
          No commentary yet — events will appear here
        </span>
      </div>
    );
  }

  return (
    <div
      className="h-12 flex items-center bg-gray-50 dark:bg-warm-800/50 rounded-b-xl border-t border-gray-100 dark:border-warm-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-warm-800 transition-colors"
      onClick={onExpand}
    >
      {/* Live dot */}
      <div className="flex items-center gap-1.5 px-2.5 flex-shrink-0">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-light opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-red" />
        </span>
        <span className="text-[9px] font-bold text-brand-red">LIVE</span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-200 dark:bg-warm-700 flex-shrink-0" />

      {/* Scrolling events */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto flex items-center gap-3 px-2.5 scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <AnimatePresence initial={false}>
          {latestEvents.map((event, i) => {
            const iconColor = getEventIconColor(event.eventType);
            const teamColor = getTeamColor(event, match);
            const text = buildCommentaryText(event, match);

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
                className="flex items-center gap-1.5 flex-shrink-0"
              >
                {i > 0 && (
                  <span className="text-[8px] text-gray-300 dark:text-warm-600">•</span>
                )}
                <div
                  className="w-0.5 h-3.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: teamColor }}
                />
                <EventIcon type={event.eventType} className={cn('w-3 h-3 flex-shrink-0', iconColor)} />
                <span className="text-[10px] text-gray-600 dark:text-warm-300 whitespace-nowrap font-medium truncate max-w-[140px]">
                  {text.length > 40 ? text.slice(0, 38) + '…' : text}
                </span>
                {event.value > 0 && (
                  <Badge className="text-[8px] font-bold px-1 py-0 h-3.5 border-0 bg-brand-red/15 text-brand-red flex-shrink-0">
                    +{event.value}
                  </Badge>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Full Commentary Panel (LiveScoringScreen) ──────────────────────

function FullCommentaryPanel({ events, match }: LiveCommentaryTickerProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Apply filter
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) => getFilterCategory(e.eventType) === filter);
  }, [events, filter]);

  // Split by half
  const firstHalfEvents = useMemo(
    () => filteredEvents.filter((e) => e.half === 1),
    [filteredEvents]
  );
  const secondHalfEvents = useMemo(
    () => filteredEvents.filter((e) => e.half === 2),
    [filteredEvents]
  );

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!isCollapsed && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEvents, isCollapsed]);

  // Total scoring events count
  const scoringCount = events.filter((e) => getFilterCategory(e.eventType) === 'scoring').length;
  const cardsCount = events.filter((e) => getFilterCategory(e.eventType) === 'cards').length;
  const otherCount = events.filter((e) => getFilterCategory(e.eventType) === 'other').length;

  return (
    <div className="border-t border-gray-200 dark:border-warm-700 bg-white dark:bg-warm-900">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-warm-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-brand-red/10 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-brand-red" />
          </div>
          <span className="text-sm font-bold text-gray-800 dark:text-warm-100">
            Commentary
          </span>
          <Badge className="text-[9px] font-bold px-1.5 py-0 h-4 bg-gray-100 dark:bg-warm-700 text-gray-500 dark:text-warm-400 border-0">
            {events.length}
          </Badge>
        </div>
        <motion.div
          animate={{ rotate: isCollapsed ? 0 : 180 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-warm-500" />
        </motion.div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 px-4 pb-2">
              {([
                { key: 'all' as FilterCategory, label: 'All', count: events.length },
                { key: 'scoring' as FilterCategory, label: 'Scoring', count: scoringCount },
                { key: 'cards' as FilterCategory, label: 'Cards', count: cardsCount },
                { key: 'other' as FilterCategory, label: 'Other', count: otherCount },
              ]).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 flex items-center gap-1',
                    filter === key
                      ? 'bg-brand-red text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-warm-800 text-gray-500 dark:text-warm-400 hover:bg-gray-200 dark:hover:bg-warm-700'
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span className={cn(
                      'text-[8px] px-1 py-0 rounded-full',
                      filter === key
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 dark:bg-warm-700 text-gray-400 dark:text-warm-500'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Commentary Feed */}
            <div
              ref={scrollRef}
              className="max-h-64 overflow-y-auto px-4 pb-3 scrollbar-thin"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(156,163,175,0.3) transparent',
              }}
            >
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center py-6">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-warm-800 flex items-center justify-center mb-2">
                    <Zap className="w-5 h-5 text-gray-300 dark:text-warm-600" />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-warm-500">
                    {filter === 'all' ? 'No events yet' : `No ${filter} events`}
                  </p>
                </div>
              ) : (
                <>
                  {/* 1st Half */}
                  {firstHalfEvents.length > 0 && (
                    <>
                      <HalfDivider half={1} count={firstHalfEvents.length} />
                      {firstHalfEvents.map((event, i) => (
                        <CommentaryEventCard
                          key={event.id}
                          event={event}
                          match={match}
                          index={i}
                        />
                      ))}
                    </>
                  )}

                  {/* 2nd Half */}
                  {secondHalfEvents.length > 0 && (
                    <>
                      <HalfDivider half={2} count={secondHalfEvents.length} />
                      {secondHalfEvents.map((event, i) => (
                        <CommentaryEventCard
                          key={event.id}
                          event={event}
                          match={match}
                          index={i}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Export ────────────────────────────────────────────────────

export default function LiveCommentaryTicker(props: LiveCommentaryTickerProps) {
  const { mode } = props;

  if (mode === 'compact') {
    return <CompactTicker {...props} />;
  }

  return <FullCommentaryPanel {...props} />;
}
