'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Zap, Shield, Target, Flame, Lock, Clock,
  ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RaidEvent {
  id: string;
  matchId: string;
  teamId: string;
  playerId?: string;
  playerName?: string;
  eventType: string;
  value: number;
  details?: string;
  half: number;
  timestamp: number;
}

interface MatchInfo {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamColor: string;
  awayTeamColor: string;
  homeScore: number;
  awayScore: number;
}

interface RaidTimelineScreenProps {
  matchId: string;
  onBack: () => void;
}

// ─── Raid color mapping ──────────────────────────────────────────────────────

const RAID_COLORS: Record<string, { bg: string; border: string; label: string; icon: string }> = {
  raid_point:     { bg: 'bg-green-500',       border: 'border-green-400',   label: 'Raid Point',     icon: 'Zap' },
  bonus_point:    { bg: 'bg-yellow-500',      border: 'border-yellow-400',  label: 'Bonus Point',    icon: 'Target' },
  tackle_point:   { bg: 'bg-red-500',         border: 'border-red-400',     label: 'Tackle Against', icon: 'Shield' },
  empty_raid:     { bg: 'bg-gray-400',        border: 'border-gray-300',    label: 'Empty Raid',     icon: 'ChevronRight' },
  all_out:        { bg: 'bg-purple-500',      border: 'border-purple-400',  label: 'All Out',        icon: 'Flame' },
  super_tackle:   { bg: 'bg-blue-500',        border: 'border-blue-400',    label: 'Super Tackle',   icon: 'Lock' },
  super_raid:     { bg: 'bg-green-600',       border: 'border-green-500',   label: 'Super Raid',     icon: 'Zap' },
  do_or_die_raid: { bg: 'bg-orange-500',      border: 'border-orange-400',  label: 'Do-or-Die',      icon: 'Flame' },
  self_out:       { bg: 'bg-red-400',         border: 'border-red-300',     label: 'Self Out',       icon: 'X' },
  substitution:   { bg: 'bg-slate-400',       border: 'border-slate-300',   label: 'Substitution',   icon: 'ChevronRight' },
  timeout:        { bg: 'bg-amber-400',       border: 'border-amber-300',   label: 'Timeout',        icon: 'Clock' },
  yellow_card:    { bg: 'bg-yellow-400',      border: 'border-yellow-300',  label: 'Yellow Card',    icon: 'X' },
  red_card:       { bg: 'bg-red-600',         border: 'border-red-500',     label: 'Red Card',       icon: 'X' },
  green_card:     { bg: 'bg-green-400',       border: 'border-green-300',   label: 'Green Card',     icon: 'X' },
};

function RaidIcon({ iconName, className }: { iconName: string; className?: string }) {
  const props = { className };
  switch (iconName) {
    case 'Zap': return <Zap {...props} />;
    case 'Shield': return <Shield {...props} />;
    case 'Target': return <Target {...props} />;
    case 'Flame': return <Flame {...props} />;
    case 'Lock': return <Lock {...props} />;
    case 'Clock': return <Clock {...props} />;
    case 'ChevronRight': return <ChevronRight {...props} />;
    default: return <Zap {...props} />;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RaidTimelineScreen({ matchId, onBack }: RaidTimelineScreenProps) {
  const { language } = useKabaddiStore();
  const [events, setEvents] = useState<RaidEvent[]>([]);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<RaidEvent | null>(null);
  const [halfFilter, setHalfFilter] = useState<1 | 2 | 'all'>('all');
  const [runningScores, setRunningScores] = useState<{ home: number; away: number }[]>([]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/match-events?matchId=${matchId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const formattedEvents: RaidEvent[] = (data.events || []).map((e: RaidEvent) => ({
        ...e,
        timestamp: typeof e.timestamp === 'number' ? e.timestamp : new Date(e.timestamp).getTime(),
      }));
      setEvents(formattedEvents);
      setMatchInfo({
        id: data.match.id,
        homeTeamId: data.match.homeTeamId,
        awayTeamId: data.match.awayTeamId,
        homeTeam: data.match.homeTeam,
        awayTeam: data.match.awayTeam,
        homeTeamColor: data.match.homeTeamColor,
        awayTeamColor: data.match.awayTeamColor,
        homeScore: data.match.homeScore,
        awayScore: data.match.awayScore,
      });
    } catch (err) {
      console.error('Raid timeline fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Calculate running scores
  useEffect(() => {
    if (!matchInfo) return;
    let homeScore = 0;
    let awayScore = 0;
    const scores: { home: number; away: number }[] = [];
    for (const evt of events) {
      if (evt.teamId === matchInfo.homeTeamId) {
        homeScore += evt.value;
      } else {
        awayScore += evt.value;
      }
      scores.push({ home: homeScore, away: awayScore });
    }
    setRunningScores(scores);
  }, [events, matchInfo]);

  const filteredEvents = useMemo(() => {
    if (halfFilter === 'all') return events;
    return events.filter((e) => e.half === halfFilter);
  }, [events, halfFilter]);

  const getPlayerName = useCallback((evt: RaidEvent) => {
    if (evt.playerName) return evt.playerName;
    // Try to extract from details
    if (evt.details) {
      try {
        const d = JSON.parse(evt.details);
        if (d.playerName) return d.playerName;
      } catch { /* ignore */ }
    }
    return null;
  }, []);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col"
      >
        {/* ─── Header ─── */}
        <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
                {t('raidTimeline.title', language)}
              </h1>
            </div>
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Half filter */}
          <div className="px-4 pb-3 flex items-center gap-2">
            <Filter className="w-4 h-4 text-warm-500" />
            {(['all', 1, 2] as const).map((h) => (
              <Button
                key={h}
                variant={halfFilter === h ? 'default' : 'outline'}
                size="sm"
                onClick={() => setHalfFilter(h)}
                className={halfFilter === h
                  ? 'bg-brand-red text-white hover:bg-brand-red/90 text-xs'
                  : 'text-xs'
                }
              >
                {h === 'all'
                  ? t('home.all', language)
                  : h === 1
                    ? t('scoring.firstHalf', language)
                    : t('scoring.secondHalf', language)}
              </Button>
            ))}
            <span className="ml-auto text-xs text-warm-500">
              {filteredEvents.length} {t('raidTimeline.raids', language)}
            </span>
          </div>
        </header>

        {/* ─── Match info bar ─── */}
        {matchInfo && (
          <div className="px-4 py-2 bg-warm-100/60 dark:bg-warm-800/60 border-b border-warm-200/40 dark:border-warm-700/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: matchInfo.homeTeamColor }} />
              <span className="text-sm font-bold text-warm-800 dark:text-warm-200">{matchInfo.homeTeam}</span>
              <span className="text-lg font-black text-warm-800 dark:text-warm-100">{matchInfo.homeScore}</span>
            </div>
            <span className="text-xs text-warm-500 font-bold">VS</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-warm-800 dark:text-warm-100">{matchInfo.awayScore}</span>
              <span className="text-sm font-bold text-warm-800 dark:text-warm-200">{matchInfo.awayTeam}</span>
              <div className="w-3 h-3 rounded-full" style={{ background: matchInfo.awayTeamColor }} />
            </div>
          </div>
        )}

        {/* ─── Timeline strip ─── */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-warm-100 dark:bg-warm-800 animate-pulse" />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-warm-500">
              <Zap className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('raidTimeline.noRaids', language)}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredEvents.map((evt, idx) => {
                const meta = RAID_COLORS[evt.eventType] || RAID_COLORS.empty_raid;
                const originalIdx = events.indexOf(evt);
                const score = runningScores[originalIdx] || { home: 0, away: 0 };
                const isHome = matchInfo && evt.teamId === matchInfo.homeTeamId;
                const prevScore = originalIdx > 0 ? runningScores[originalIdx - 1] : { home: 0, away: 0 };

                return (
                  <div key={evt.id}>
                    {/* Half separator */}
                    {idx > 0 && evt.half !== filteredEvents[idx - 1].half && (
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-warm-200 dark:bg-warm-700" />
                        <Badge variant="outline" className="text-xs font-bold text-warm-500">
                          {evt.half === 2 ? t('scoring.secondHalf', language) : t('scoring.firstHalf', language)}
                        </Badge>
                        <div className="flex-1 h-px bg-warm-200 dark:bg-warm-700" />
                      </div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => setSelectedEvent(evt === selectedEvent ? null : evt)}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedEvent?.id === evt.id
                          ? 'bg-warm-100 dark:bg-warm-800 ring-2 ring-brand-red/30'
                          : 'hover:bg-warm-100/60 dark:hover:bg-warm-800/60'
                      }`}
                    >
                      {/* Color block */}
                      <div className={`w-10 h-10 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                        <RaidIcon iconName={meta.icon} className="w-5 h-5 text-white" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-warm-800 dark:text-warm-100">
                            {meta.label}
                          </span>
                          {isHome ? (
                            <div className="w-2 h-2 rounded-full" style={{ background: matchInfo?.homeTeamColor }} />
                          ) : (
                            <div className="w-2 h-2 rounded-full" style={{ background: matchInfo?.awayTeamColor }} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-warm-500">
                          <span>{isHome ? matchInfo?.homeTeam : matchInfo?.awayTeam}</span>
                          {evt.value > 0 && (
                            <Badge className="bg-brand-gold/20 text-brand-gold-dark text-[10px] px-1 py-0">
                              +{evt.value}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Running score */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-warm-800 dark:text-warm-100 tabular-nums">
                          {score.home} - {score.away}
                        </div>
                        <div className="text-[10px] text-warm-400">
                          {formatTime(evt.timestamp)}
                        </div>
                      </div>
                    </motion.div>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {selectedEvent?.id === evt.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <Card className="mx-4 mb-2 border-warm-200 dark:border-warm-700">
                            <CardContent className="p-3 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-warm-500">{t('raidTimeline.player', language)}</span>
                                <span className="font-bold text-warm-800 dark:text-warm-100">
                                  {getPlayerName(evt) || '—'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-warm-500">{t('raidTimeline.points', language)}</span>
                                <span className="font-bold text-warm-800 dark:text-warm-100">{evt.value}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-warm-500">{t('raidTimeline.half', language)}</span>
                                <span className="font-bold text-warm-800 dark:text-warm-100">
                                  {evt.half === 1 ? t('scoring.firstHalf', language) : t('scoring.secondHalf', language)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-warm-500">{t('raidTimeline.time', language)}</span>
                                <span className="font-bold text-warm-800 dark:text-warm-100">{formatTime(evt.timestamp)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-warm-500">{t('raidTimeline.scoreAtPoint', language)}</span>
                                <span className="font-bold text-warm-800 dark:text-warm-100">
                                  {prevScore.home}-{prevScore.home} → {score.home}-{score.away}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Horizontal timeline strip at bottom ─── */}
        {filteredEvents.length > 0 && (
          <div className="border-t border-warm-200/60 dark:border-warm-700/60 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md px-4 py-3">
            <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {filteredEvents.map((evt, idx) => {
                const meta = RAID_COLORS[evt.eventType] || RAID_COLORS.empty_raid;
                return (
                  <motion.div
                    key={evt.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    onClick={() => setSelectedEvent(evt === selectedEvent ? null : evt)}
                    className={`w-8 h-8 rounded-md ${meta.bg} flex items-center justify-center cursor-pointer shrink-0 transition-transform hover:scale-110 ${
                      selectedEvent?.id === evt.id ? 'ring-2 ring-white scale-110' : ''
                    }`}
                    title={`${meta.label} +${evt.value}`}
                  >
                    <RaidIcon iconName={meta.icon} className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
