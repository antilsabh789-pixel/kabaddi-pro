'use client';

import { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Zap } from 'lucide-react';
import { type MatchEvent } from '@/lib/store';
import {
  generateCommentary,
  getCommentaryDotColor,
  getCommentaryType,
  type CommentaryExtras,
} from '@/lib/commentary';

interface CommentaryFeedProps {
  events: MatchEvent[];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamColor: string;
  awayTeamColor: string;
  currentHalf: number;
  homeScore: number;
  awayScore: number;
}

// Key moment event types that get special styling
const KEY_MOMENT_TYPES = new Set([
  'super_raid',
  'super_tackle',
  'all_out',
  'do_or_die_raid',
]);

/** Determine which side a teamId belongs to */
function getSide(
  teamId: string,
  homeTeamId: string,
  awayTeamId: string,
): 'home' | 'away' {
  return teamId === homeTeamId ? 'home' : 'away';
}

/** Format minutes:seconds into a compact timestamp string */
function formatMinutesIntoHalf(secondsElapsed: number): string {
  const mins = Math.floor(secondsElapsed / 60);
  const secs = Math.floor(secondsElapsed % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Build display-ready commentary entries with half separators */
interface FeedEntry {
  id: string;
  type: 'event' | 'half_separator' | 'match_start';
  event?: MatchEvent;
  half?: number;
}

function buildFeedEntries(events: MatchEvent[]): FeedEntry[] {
  const entries: FeedEntry[] = [];

  if (events.length === 0) return entries;

  // Track which halves we've seen
  const seenHalves = new Set<number>();

  // Process events newest-first for display
  const reversed = [...events].reverse();

  for (const event of reversed) {
    // Insert half separator if we haven't seen this half yet
    if (!seenHalves.has(event.half)) {
      seenHalves.add(event.half);
      entries.push({
        id: `half-sep-${event.half}`,
        type: 'half_separator',
        half: event.half,
      });
    }

    entries.push({
      id: event.id,
      type: 'event',
      event,
    });
  }

  // Add match start at the very end (bottom of feed = oldest)
  entries.push({
    id: 'match-start',
    type: 'match_start',
  });

  return entries;
}

/** Get background accent class for key moments */
function getKeyMomentBg(eventType: string): string {
  switch (eventType) {
    case 'super_raid':
      return 'bg-orange-50 dark:bg-orange-950/40 ring-1 ring-orange-200 dark:ring-orange-800';
    case 'super_tackle':
      return 'bg-purple-50 dark:bg-purple-950/40 ring-1 ring-purple-200 dark:ring-purple-800';
    case 'all_out':
      return 'bg-red-50 dark:bg-red-950/40 ring-1 ring-red-200 dark:ring-red-800';
    case 'do_or_die_raid':
      return 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200 dark:ring-amber-800';
    default:
      return '';
  }
}

/** Get icon emoji for event type */
function getEventIcon(eventType: string): string {
  switch (eventType) {
    case 'raid_point':
      return '🏃';
    case 'bonus_point':
      return '⭐';
    case 'tackle_point':
      return '🛡️';
    case 'super_raid':
      return '⚡';
    case 'super_tackle':
      return '💪';
    case 'do_or_die_raid':
      return '🔥';
    case 'all_out':
      return '💥';
    case 'timeout':
      return '⏸️';
    case 'yellow_card':
      return '🟨';
    case 'red_card':
      return '🟥';
    case 'green_card':
      return '🟩';
    default:
      return '📌';
  }
}

// ─── Animated Dots Component ───────────────────────────────────────────
function AnimatedDots() {
  return (
    <span className="inline-flex gap-0.5 ml-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-warm-400 inline-block"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'easeInOut',
          }}
        >
          .
        </motion.span>
      ))}
    </span>
  );
}

export default function CommentaryFeed({
  events,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  homeTeamColor,
  awayTeamColor,
  currentHalf,
  homeScore,
  awayScore,
}: CommentaryFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevEventCountRef = useRef(0);

  // Build feed entries with separators
  const feedEntries = useMemo(() => buildFeedEntries(events), [events]);

  // Calculate half start timestamps for time display
  const halfStarts = useMemo(() => {
    const starts: Record<number, number> = {};
    for (const event of events) {
      if (!(event.half in starts)) {
        starts[event.half] = event.timestamp;
      }
    }
    return starts;
  }, [events]);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (events.length > prevEventCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    prevEventCountRef.current = events.length;
  }, [events.length]);

  // Compute time into half for an event
  const getTimeIntoHalf = (event: MatchEvent): string => {
    const halfStart = halfStarts[event.half];
    if (!halfStart) return '0:00';
    const elapsed = (event.timestamp - halfStart) / 1000;
    return formatMinutesIntoHalf(Math.max(0, elapsed));
  };

  return (
    <div className="flex flex-col h-full bg-warm-50 dark:bg-warm-800 rounded-2xl overflow-hidden">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-brand-red" />
          <span className="text-sm font-bold text-warm-800 dark:text-warm-100">
            Live Commentary
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-warm-500 dark:text-warm-400">
          <span
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: homeTeamColor }}
          >
            {homeScore}
          </span>
          <span className="text-warm-300 dark:text-warm-600">-</span>
          <span
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: awayTeamColor }}
          >
            {awayScore}
          </span>
        </div>
      </div>

      {/* ─── Scrollable Feed ─── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-3 py-2 space-y-1.5"
      >
        <AnimatePresence mode="popLayout">
          {feedEntries.length === 0 ? (
            // ─── Empty State ───
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-warm-100 dark:bg-warm-700 flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-warm-400 dark:text-warm-500" />
              </div>
              <p className="text-sm text-warm-500 dark:text-warm-400 font-medium">
                Waiting for action
                <AnimatedDots />
              </p>
              <p className="text-xs text-warm-400 dark:text-warm-500 mt-1">
                Events will appear here in real-time
              </p>
            </motion.div>
          ) : (
            feedEntries.map((entry) => {
              // ─── Match Start ───
              if (entry.type === 'match_start') {
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center py-2"
                  >
                    <div className="flex items-center gap-2 bg-brand-red/10 dark:bg-brand-red/20 rounded-full px-4 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
                      <span className="text-[11px] font-bold text-brand-red uppercase tracking-wide">
                        Match Started
                      </span>
                      <span className="w-2 h-2 rounded-full bg-brand-red animate-pulse" />
                    </div>
                  </motion.div>
                );
              }

              // ─── Half Separator ───
              if (entry.type === 'half_separator' && entry.half) {
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center py-2"
                  >
                    <div className="flex items-center gap-2 bg-brand-navy/10 dark:bg-brand-navy/20 rounded-full px-4 py-1.5">
                      <span className="text-[11px] font-bold text-brand-navy dark:text-warm-200 uppercase tracking-wide">
                        {entry.half === 1 ? '1st Half' : '2nd Half'}
                      </span>
                    </div>
                  </motion.div>
                );
              }

              // ─── Event Entry ───
              if (entry.type === 'event' && entry.event) {
                const event = entry.event;
                const isKeyMoment = KEY_MOMENT_TYPES.has(event.eventType);
                const side = getSide(event.teamId, homeTeamId, awayTeamId);
                const teamName =
                  side === 'home' ? homeTeamName : awayTeamName;
                const teamColor =
                  side === 'home' ? homeTeamColor : awayTeamColor;

                // Build extras for commentary generator
                const extras: CommentaryExtras = {
                  isSuperRaid: event.eventType === 'super_raid',
                  isSuperTackle: event.eventType === 'super_tackle',
                  isDoOrDie: event.eventType === 'do_or_die_raid',
                  isAllOut: event.eventType === 'all_out',
                };

                const commentaryText = generateCommentary(
                  event.eventType,
                  event.playerName || 'Unknown',
                  teamName,
                  event.value,
                  extras,
                );

                const dotColor = getCommentaryDotColor(
                  getCommentaryType(event.eventType),
                );
                const keyMomentBg = isKeyMoment
                  ? getKeyMomentBg(event.eventType)
                  : '';

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -12, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{
                      type: 'spring',
                      damping: 20,
                      stiffness: 300,
                    }}
                    className={`
                      relative rounded-xl px-3 py-2 transition-colors
                      ${
                        isKeyMoment
                          ? `${keyMomentBg} ${
                              event.eventType === 'super_raid' ||
                              event.eventType === 'all_out'
                                ? 'animate-[pulse_2s_ease-in-out_infinite]'
                                : ''
                            }`
                          : 'bg-white dark:bg-warm-700/50 hover:bg-warm-100 dark:hover:bg-warm-700'
                      }
                    `}
                  >
                    {/* Glow overlay for key moments */}
                    {isKeyMoment && (
                      <div
                        className={`absolute inset-0 rounded-xl opacity-20 pointer-events-none ${
                          event.eventType === 'super_raid'
                            ? 'bg-orange-400'
                            : event.eventType === 'super_tackle'
                              ? 'bg-purple-400'
                              : event.eventType === 'all_out'
                                ? 'bg-brand-red'
                                : 'bg-amber-400'
                        }`}
                        style={{
                          filter: 'blur(8px)',
                          transform: 'scale(1.05)',
                        }}
                      />
                    )}

                    <div className="relative flex items-start gap-2">
                      {/* Color dot */}
                      <div className="flex-shrink-0 mt-1.5">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${dotColor} ${
                            isKeyMoment ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-warm-800' : ''
                          } ${
                            event.eventType === 'super_raid'
                              ? 'ring-orange-300'
                              : event.eventType === 'super_tackle'
                                ? 'ring-purple-300'
                                : event.eventType === 'all_out'
                                  ? 'ring-red-300'
                                  : event.eventType === 'do_or_die_raid'
                                    ? 'ring-amber-300'
                                    : ''
                          }`}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top row: icon + commentary text */}
                        <div className="flex items-start gap-1.5">
                          <span className="text-sm flex-shrink-0 leading-none mt-0.5">
                            {getEventIcon(event.eventType)}
                          </span>
                          <p
                            className={`text-xs leading-relaxed ${
                              isKeyMoment
                                ? 'font-bold text-warm-800 dark:text-warm-100'
                                : 'text-warm-700 dark:text-warm-300'
                            }`}
                          >
                            {commentaryText}
                          </p>
                        </div>

                        {/* Bottom row: team badge + time + points */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {/* Team indicator badge */}
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                            style={{ backgroundColor: teamColor }}
                          >
                            {side === 'home' ? 'H' : 'A'}
                          </span>

                          {/* Timestamp */}
                          <span className="text-[10px] text-warm-400 dark:text-warm-500 font-mono">
                            {getTimeIntoHalf(event)}
                          </span>

                          {/* Point value badge */}
                          {event.value > 0 && (
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-black leading-none ${
                                isKeyMoment
                                  ? 'bg-brand-gold/20 text-brand-gold-dark dark:text-brand-gold'
                                  : 'bg-warm-200 dark:bg-warm-600 text-warm-600 dark:text-warm-300'
                              }`}
                            >
                              +{event.value}
                            </span>
                          )}

                          {/* Key moment label */}
                          {isKeyMoment && (
                            <span
                              className={`text-[9px] font-extrabold uppercase tracking-widest ${
                                event.eventType === 'super_raid'
                                  ? 'text-orange-500'
                                  : event.eventType === 'super_tackle'
                                    ? 'text-purple-500'
                                    : event.eventType === 'all_out'
                                      ? 'text-brand-red'
                                      : 'text-amber-500'
                              }`}
                            >
                              {event.eventType === 'super_raid' && '⚡ SUPER RAID'}
                              {event.eventType === 'super_tackle' && '💪 SUPER TACKLE'}
                              {event.eventType === 'all_out' && '💥 ALL OUT'}
                              {event.eventType === 'do_or_die_raid' && '🔥 DO-OR-DIE'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              return null;
            })
          )}
        </AnimatePresence>
      </div>

      {/* ─── Footer: Half Indicator ─── */}
      <div className="px-4 py-2 border-t border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
            <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400 uppercase">
              Half {currentHalf} · Live
            </span>
          </div>
          <span className="text-[10px] text-warm-400 dark:text-warm-500">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
