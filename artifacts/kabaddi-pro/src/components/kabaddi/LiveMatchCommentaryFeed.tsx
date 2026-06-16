'use client';

import { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Shield, Flame, Target, AlertCircle,
  Clock, Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type MatchEvent, type EventType } from '@/lib/store';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────

export interface LiveMatchCommentaryInfo {
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamColor: string;
  awayTeamColor: string;
  currentHalf?: number;
}

interface LiveMatchCommentaryFeedProps {
  events: MatchEvent[];
  match: LiveMatchCommentaryInfo;
  maxEvents?: number;
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

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

function getEventLabel(type: EventType): string {
  switch (type) {
    case 'raid_point': return 'Raid Point';
    case 'bonus_point': return 'Bonus Point';
    case 'tackle_point': return 'Tackle Point';
    case 'super_raid': return 'Super Raid';
    case 'super_tackle': return 'Super Tackle';
    case 'do_or_die_raid': return 'Do-or-Die';
    case 'all_out': return 'All Out';
    case 'empty_raid': return 'Empty Raid';
    case 'substitution': return 'Substitution';
    case 'timeout': return 'Timeout';
    case 'yellow_card': return 'Yellow Card';
    case 'red_card': return 'Red Card';
    case 'green_card': return 'Green Card';
    default: return type;
  }
}

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

function getTeamSide(event: MatchEvent, match: LiveMatchCommentaryInfo): 'home' | 'away' {
  return event.teamId === match.homeTeamId ? 'home' : 'away';
}

// ─── Component ────────────────────────────────────────────────────

export default function LiveMatchCommentaryFeed({
  events,
  match,
  maxEvents = 5,
  className,
}: LiveMatchCommentaryFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Show latest N events, most recent first
  const latestEvents = useMemo(() => {
    return [...events].slice(-maxEvents).reverse();
  }, [events, maxEvents]);

  // Auto-scroll to top (newest event)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className={cn(
        'flex items-center justify-center px-3 py-3 bg-gray-50 dark:bg-warm-800/50 border-t border-gray-100 dark:border-warm-700',
        className,
      )}>
        <span className="relative flex h-2 w-2 mr-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-light opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red" />
        </span>
        <span className="text-[10px] text-gray-400 dark:text-warm-500 italic">
          Waiting for events...
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-t border-gray-100 dark:border-warm-700 bg-gray-50 dark:bg-warm-800/50',
        className,
      )}
    >
      {/* Header with LIVE indicator */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-warm-700/50">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-light opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red" />
          </span>
          <span className="text-[9px] font-bold text-brand-red uppercase tracking-wider">LIVE</span>
          <span className="text-[8px] text-gray-400 dark:text-warm-500">Commentary</span>
        </div>
        <span className="text-[9px] text-gray-400 dark:text-warm-500">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Scrollable event feed */}
      <div
        ref={scrollRef}
        className="max-h-32 overflow-y-auto scrollbar-thin"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(156,163,175,0.3) transparent',
        }}
      >
        <AnimatePresence initial={false}>
          {latestEvents.map((event, i) => {
            const iconColor = getEventIconColor(event.eventType);
            const side = getTeamSide(event, match);
            const teamColor = side === 'home' ? match.homeTeamColor : match.awayTeamColor;
            const teamName = side === 'home' ? match.homeTeam : match.awayTeam;
            const playerName = event.playerName || 'Player';
            const eventLabel = getEventLabel(event.eventType);
            const halfLabel = event.half === 1 ? '1H' : '2H';

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -12, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: 12, height: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03, ease: 'easeOut' }}
                className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-50 dark:border-warm-700/30 last:border-b-0 hover:bg-gray-100/50 dark:hover:bg-warm-700/30 transition-colors"
              >
                {/* Team color indicator */}
                <div
                  className="w-0.5 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: teamColor }}
                />

                {/* Event icon */}
                <div className={cn(
                  'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
                  'bg-gray-100 dark:bg-warm-700',
                  iconColor,
                )}>
                  <EventIcon type={event.eventType} className="w-3 h-3" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-gray-800 dark:text-warm-200 truncate">
                      {playerName}
                    </span>
                    <span className="text-[8px] font-bold text-gray-400 dark:text-warm-500 uppercase">
                      {eventLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-[8px] font-bold px-1 py-0 rounded text-white"
                      style={{ backgroundColor: teamColor }}
                    >
                      {teamName.slice(0, 3).toUpperCase()}
                    </span>
                    <span className="text-[8px] text-gray-400 dark:text-warm-500">{halfLabel}</span>
                  </div>
                </div>

                {/* Points badge */}
                {event.value > 0 && (
                  <Badge className="text-[8px] font-bold px-1.5 py-0 h-4 border-0 bg-brand-red/15 text-brand-red flex-shrink-0">
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
