'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Radio, Clock, Swords, Shield,
  Zap, Award, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface BroadcastScreenProps {
  onClose: () => void;
  matchId: string;
}

interface BroadcastData {
  match: {
    id: string;
    homeTeam: {
      id: string;
      name: string;
      shortName: string;
      color: string;
    };
    awayTeam: {
      id: string;
      name: string;
      shortName: string;
      color: string;
    };
    homeScore: number;
    awayScore: number;
    currentHalf: number;
    timer: number;
    isLive: boolean;
    status: string;
  };
  events: BroadcastEvent[];
  stats: {
    homeRaids: number;
    awayRaids: number;
    homeTackles: number;
    awayTackles: number;
    homeBonus: number;
    awayBonus: number;
  };
  poll: BroadcastPoll | null;
}

interface BroadcastEvent {
  id: string;
  type: string;
  team: 'home' | 'away';
  playerName?: string;
  value: number;
  timestamp: string;
}

interface BroadcastPoll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number }[];
  totalVotes: number;
  userVotedOptionId?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const EVENT_DOT_COLORS: Record<string, string> = {
  raid_point: 'bg-brand-red',
  bonus_point: 'bg-brand-gold',
  tackle_point: 'bg-brand-navy',
  super_raid: 'bg-brand-teal',
  super_tackle: 'bg-brand-teal',
  all_out: 'bg-brand-red',
  timeout: 'bg-warm-400',
  yellow_card: 'bg-yellow-400',
  red_card: 'bg-brand-red',
  green_card: 'bg-green-500',
};

function getEventText(event: BroadcastEvent, data: BroadcastData): string {
  const teamName = event.team === 'home' ? data.match.homeTeam.shortName : data.match.awayTeam.shortName;
  const playerName = event.playerName || 'Player';

  switch (event.type) {
    case 'raid_point':
      return `${playerName} scores a raid point for ${teamName}`;
    case 'bonus_point':
      return `${playerName} earns a bonus point for ${teamName}`;
    case 'tackle_point':
      return `${playerName} makes a successful tackle for ${teamName}`;
    case 'super_raid':
      return `🔥 ${playerName} SUPER RAID for ${teamName}!`;
    case 'super_tackle':
      return `🛡️ ${playerName} SUPER TACKLE for ${teamName}!`;
    case 'all_out':
      return `💥 ALL OUT! ${teamName} gets bonus points`;
    case 'timeout':
      return `${teamName} calls a timeout`;
    case 'yellow_card':
      return `🟨 Yellow card to ${playerName}`;
    case 'red_card':
      return `🟥 Red card to ${playerName}`;
    case 'green_card':
      return `🟩 Green card to ${playerName}`;
    default:
      return `${playerName} - ${event.type.replace(/_/g, ' ')}`;
  }
}

// ─── Animation ────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function BroadcastScreen({ onClose, matchId }: BroadcastScreenProps) {
  const { toast } = useToast();
  const [data, setData] = useState<BroadcastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch broadcast data ─────────────────────────────────────

  const fetchBroadcast = useCallback(async () => {
    try {
      const res = await fetch(`/api/broadcast?matchId=${matchId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        // If API doesn't exist yet, set empty mock data for graceful UI
        if (!data) {
          setData({
            match: {
              id: matchId,
              homeTeam: { id: 'h1', name: 'Home Team', shortName: 'HOM', color: '#DC2626' },
              awayTeam: { id: 'a1', name: 'Away Team', shortName: 'AWY', color: '#1E293B' },
              homeScore: 0,
              awayScore: 0,
              currentHalf: 1,
              timer: 1200,
              isLive: false,
              status: 'upcoming',
            },
            events: [],
            stats: { homeRaids: 0, awayRaids: 0, homeTackles: 0, awayTackles: 0, homeBonus: 0, awayBonus: 0 },
            poll: null,
          });
        }
      }
    } catch {
      if (!data) {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [matchId, data]);

  useEffect(() => {
    fetchBroadcast();
  }, [fetchBroadcast]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchBroadcast();
    }, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchBroadcast]);

  // ─── Vote on poll ─────────────────────────────────────────────

  const handleVote = async (optionId: string) => {
    if (!data?.poll || votingOptionId) return;
    setVotingOptionId(optionId);
    try {
      const res = await fetch(`/api/polls/${data.poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });
      if (res.ok) {
        toast({ title: 'Vote recorded!' });
        fetchBroadcast();
      } else {
        const json = await res.json();
        toast({ title: 'Error', description: json.error || 'Vote failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to submit vote', variant: 'destructive' });
    } finally {
      setVotingOptionId(null);
    }
  };

  // ─── Loading State ────────────────────────────────────────────

  if (loading) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-warm-50 flex flex-col"
      >
        <header className="sticky top-0 z-10 bg-gradient-to-r from-brand-red to-brand-red-dark">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-white" />
              <h1 className="text-lg font-bold text-white">LIVE BROADCAST</h1>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </header>
        <div className="flex-1 px-4 py-4 space-y-4">
          <div className="h-40 bg-warm-100 rounded-2xl animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-warm-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="fixed inset-0 z-50 bg-warm-50 flex flex-col items-center justify-center gap-4"
      >
        <Radio className="w-12 h-12 text-warm-300" />
        <p className="text-warm-600 font-medium">Unable to load broadcast</p>
        <Button onClick={onClose} variant="outline" className="rounded-xl">
          Go Back
        </Button>
      </motion.div>
    );
  }

  const recentEvents = data.events.slice(-10).reverse();
  const match = data.match;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 overflow-y-auto"
    >
      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-red to-brand-red-dark">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            {match.isLive && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full bg-white"
              />
            )}
            <Radio className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">LIVE BROADCAST</h1>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* ═══ Score Display ═══ */}
      <div className="px-4 -mt-2">
        <Card className="bg-gradient-to-br from-brand-navy to-brand-navy-dark border-0 shadow-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              {/* Home Team */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg"
                  style={{ backgroundColor: match.homeTeam.color }}
                >
                  {match.homeTeam.shortName.slice(0, 2)}
                </div>
                <span className="text-xs text-white/70 font-semibold truncate max-w-[80px]">
                  {match.homeTeam.shortName}
                </span>
                <span className="text-4xl font-black text-white">{match.homeScore}</span>
              </div>

              {/* VS & Timer */}
              <div className="flex flex-col items-center gap-1 px-4">
                <Badge className="bg-brand-red/20 text-brand-red-light text-[9px] font-bold border-0">
                  Half {match.currentHalf}
                </Badge>
                <span className="text-warm-400 text-sm font-bold">vs</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-warm-400" />
                  <span className="text-warm-300 text-sm font-mono font-bold">
                    {formatTimer(match.timer)}
                  </span>
                </div>
              </div>

              {/* Away Team */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg"
                  style={{ backgroundColor: match.awayTeam.color }}
                >
                  {match.awayTeam.shortName.slice(0, 2)}
                </div>
                <span className="text-xs text-white/70 font-semibold truncate max-w-[80px]">
                  {match.awayTeam.shortName}
                </span>
                <span className="text-4xl font-black text-white">{match.awayScore}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Content ═══ */}
      <div className="px-4 py-4 space-y-4">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Match Stats Summary ─────────────────────── */}
          <motion.div variants={itemVariants}>
            <Card className="border-warm-200/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <h2 className="text-xs font-black tracking-wider text-warm-800">
                    MATCH STATS
                  </h2>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-warm-500 font-semibold uppercase">Raids</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm font-bold text-brand-red">{data.stats.homeRaids}</span>
                      <span className="text-warm-300">|</span>
                      <span className="text-sm font-bold text-brand-navy">{data.stats.awayRaids}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-warm-500 font-semibold uppercase">Tackles</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm font-bold text-brand-red">{data.stats.homeTackles}</span>
                      <span className="text-warm-300">|</span>
                      <span className="text-sm font-bold text-brand-navy">{data.stats.awayTackles}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-warm-500 font-semibold uppercase">Bonus</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-sm font-bold text-brand-red">{data.stats.homeBonus}</span>
                      <span className="text-warm-300">|</span>
                      <span className="text-sm font-bold text-brand-navy">{data.stats.awayBonus}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Live Event Feed ─────────────────────────── */}
          <motion.div variants={itemVariants}>
            <Card className="border-warm-200/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-brand-red/10 flex items-center justify-center">
                    <Swords className="w-3.5 h-3.5 text-brand-red" />
                  </div>
                  <h2 className="text-xs font-black tracking-wider text-warm-800">
                    LIVE EVENTS
                  </h2>
                  {match.isLive && (
                    <motion.div
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="ml-auto"
                    >
                      <Badge className="bg-brand-red/15 text-brand-red text-[8px] font-bold border-0">
                        LIVE
                      </Badge>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {recentEvents.length === 0 ? (
                    <p className="text-xs text-warm-400 text-center py-4">
                      No events yet. Match is about to start!
                    </p>
                  ) : (
                    recentEvents.map((event, i) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-warm-100/60 transition-colors"
                      >
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            EVENT_DOT_COLORS[event.type] || 'bg-warm-400'
                          }`}
                        />
                        <p className="text-xs text-warm-700 leading-relaxed">
                          {getEventText(event, data)}
                        </p>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ── Active Poll ─────────────────────────────── */}
          {data.poll && (
            <motion.div variants={itemVariants}>
              <Card className="border-brand-gold/30 bg-brand-gold/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-md bg-brand-gold/20 flex items-center justify-center">
                      <Award className="w-3.5 h-3.5 text-brand-gold" />
                    </div>
                    <h2 className="text-xs font-black tracking-wider text-warm-800">
                      POLL
                    </h2>
                    <Badge className="bg-brand-gold/15 text-brand-gold-dark text-[8px] font-bold border-0 ml-auto">
                      {data.poll.totalVotes} votes
                    </Badge>
                  </div>

                  <p className="text-sm font-semibold text-warm-800 mb-3">
                    {data.poll.question}
                  </p>

                  <div className="space-y-2">
                    {data.poll.options.map((option) => {
                      const percentage =
                        data.poll!.totalVotes > 0
                          ? Math.round((option.votes / data.poll!.totalVotes) * 100)
                          : 0;
                      const isVoted = data.poll!.userVotedOptionId === option.id;

                      return (
                        <button
                          key={option.id}
                          onClick={() => handleVote(option.id)}
                          disabled={!!data.poll!.userVotedOptionId || !!votingOptionId}
                          className={`relative w-full text-left p-3 rounded-xl border transition-all overflow-hidden ${
                            isVoted
                              ? 'border-brand-teal bg-brand-teal/5'
                              : 'border-warm-200 bg-white hover:border-brand-teal/40'
                          } ${!!data.poll!.userVotedOptionId ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {/* Progress bar background */}
                          {!!data.poll!.userVotedOptionId && (
                            <motion.div
                              className="absolute inset-y-0 left-0 bg-brand-teal/10 rounded-xl"
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                          )}
                          <div className="relative flex items-center justify-between">
                            <span className="text-xs font-semibold text-warm-800">
                              {option.text}
                            </span>
                            {!!data.poll!.userVotedOptionId && (
                              <span className="text-xs font-bold text-brand-teal">
                                {percentage}%
                              </span>
                            )}
                          </div>
                          {isVoted && (
                            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-teal" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Auto-refresh notice */}
          <motion.div variants={itemVariants} className="text-center pb-4">
            <p className="text-[10px] text-warm-400 font-medium">
              <Shield className="w-3 h-3 inline mr-1" />
              Spectator mode · Auto-refreshes every 10s
            </p>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
