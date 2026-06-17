'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  X, Radio, Clock, Swords, Shield,
  Zap, Award, ChevronRight, Eye, Bell,
  BellOff, Play, Calendar, Users,
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
    viewers?: number;
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

interface UpcomingMatch {
  id: string;
  homeTeam: { name: string; shortName: string; color: string };
  awayTeam: { name: string; shortName: string; color: string };
  startTime: string;
  tournament: string;
  reminderSet: boolean;
}

interface LiveMatch {
  id: string;
  homeTeam: { name: string; shortName: string; color: string };
  awayTeam: { name: string; shortName: string; color: string };
  homeScore: number;
  awayScore: number;
  currentHalf: number;
  viewers: number;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatViewers(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

function getTimeUntil(dateStr: string): { days: number; hours: number; mins: number; secs: number } {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    mins: Math.floor((diff / (1000 * 60)) % 60),
    secs: Math.floor((diff / 1000) % 60),
  };
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
    case 'raid_point': return `${playerName} scores a raid point for ${teamName}`;
    case 'bonus_point': return `${playerName} earns a bonus point for ${teamName}`;
    case 'tackle_point': return `${playerName} makes a successful tackle for ${teamName}`;
    case 'super_raid': return `🔥 ${playerName} SUPER RAID for ${teamName}!`;
    case 'super_tackle': return `🛡️ ${playerName} SUPER TACKLE for ${teamName}!`;
    case 'all_out': return `💥 ALL OUT! ${teamName} gets bonus points`;
    case 'timeout': return `${teamName} calls a timeout`;
    case 'yellow_card': return `🟨 Yellow card to ${playerName}`;
    case 'red_card': return `🟥 Red card to ${playerName}`;
    case 'green_card': return `🟩 Green card to ${playerName}`;
    default: return `${playerName} - ${event.type.replace(/_/g, ' ')}`;
  }
}

// ─── Animation ────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── Countdown Component ──────────────────────────────────────────

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState(getTimeUntil(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeUntil(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="flex items-center justify-center gap-1">
      {timeLeft.days > 0 && (
        <>
          <span className="countdown-digit">{timeLeft.days}</span>
          <span className="countdown-separator">:</span>
        </>
      )}
      <span className="countdown-digit">{timeLeft.hours.toString().padStart(2, '0')}</span>
      <span className="countdown-separator">:</span>
      <span className="countdown-digit">{timeLeft.mins.toString().padStart(2, '0')}</span>
      <span className="countdown-separator">:</span>
      <span className="countdown-digit">{timeLeft.secs.toString().padStart(2, '0')}</span>
    </div>
  );
}

// ─── Simulated Data ───────────────────────────────────────────────

function generateLiveMatches(): LiveMatch[] {
  return [
    {
      id: 'live1',
      homeTeam: { name: 'Bengal Warriors', shortName: 'BW', color: '#DC2626' },
      awayTeam: { name: 'Patna Pirates', shortName: 'PP', color: '#1E293B' },
      homeScore: 18,
      awayScore: 15,
      currentHalf: 2,
      viewers: 12500,
    },
    {
      id: 'live2',
      homeTeam: { name: 'Jaipur Pink Panthers', shortName: 'JPP', color: '#F59E0B' },
      awayTeam: { name: 'U Mumba', shortName: 'UM', color: '#14B8A6' },
      homeScore: 22,
      awayScore: 20,
      currentHalf: 1,
      viewers: 8700,
    },
  ];
}

function generateUpcomingMatches(): UpcomingMatch[] {
  const now = Date.now();
  return [
    {
      id: 'up1',
      homeTeam: { name: 'Dabang Delhi', shortName: 'DD', color: '#DC2626' },
      awayTeam: { name: 'Gujarat Giants', shortName: 'GG', color: '#F59E0B' },
      startTime: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      tournament: 'Pro Kabaddi League S10',
      reminderSet: false,
    },
    {
      id: 'up2',
      homeTeam: { name: 'Haryana Steelers', shortName: 'HS', color: '#14B8A6' },
      awayTeam: { name: 'Tamil Thalaivas', shortName: 'TT', color: '#F59E0B' },
      startTime: new Date(now + 5 * 60 * 60 * 1000).toISOString(),
      tournament: 'Pro Kabaddi League S10',
      reminderSet: false,
    },
    {
      id: 'up3',
      homeTeam: { name: 'Puneri Paltan', shortName: 'PP', color: '#DC2626' },
      awayTeam: { name: 'Telugu Titans', shortName: 'TT', color: '#F59E0B' },
      startTime: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      tournament: 'Pro Kabaddi League S10',
      reminderSet: false,
    },
  ];
}

// ─── Main Component ───────────────────────────────────────────────

export default function BroadcastScreen({ onClose, matchId }: BroadcastScreenProps) {
  const { toast } = useToast();
  const [data, setData] = useState<BroadcastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [view, setView] = useState<'list' | 'broadcast'>('list');
  const [reminders, setReminders] = useState<Set<string>>(new Set());
  const [prevHomeScore, setPrevHomeScore] = useState(0);
  const [prevAwayScore, setPrevAwayScore] = useState(0);
  const [homeScoreFlash, setHomeScoreFlash] = useState(false);
  const [awayScoreFlash, setAwayScoreFlash] = useState(false);

  const liveMatches = useMemo(() => generateLiveMatches(), []);
  const upcomingMatches = useMemo(() => generateUpcomingMatches(), []);

  // ─── Fetch broadcast data ─────────────────────────────────────

  const fetchBroadcast = useCallback(async () => {
    try {
      const res = await fetch(`/api/broadcast?matchId=${matchId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
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
              viewers: 0,
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

  // Score change detection
  useEffect(() => {
    if (!data) return;
    if (data.match.homeScore !== prevHomeScore && prevHomeScore !== 0) {
      setHomeScoreFlash(true);
      setTimeout(() => setHomeScoreFlash(false), 500);
    }
    if (data.match.awayScore !== prevAwayScore && prevAwayScore !== 0) {
      setAwayScoreFlash(true);
      setTimeout(() => setAwayScoreFlash(false), 500);
    }
    setPrevHomeScore(data.match.homeScore);
    setPrevAwayScore(data.match.awayScore);
  }, [data?.match.homeScore, data?.match.awayScore, prevHomeScore, prevAwayScore]);

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

  const handleSetReminder = (matchId: string) => {
    setReminders((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) {
        next.delete(matchId);
        toast({ title: 'Reminder removed' });
      } else {
        next.add(matchId);
        toast({ title: 'Reminder set!', description: 'We\'ll notify you before the match starts' });
      }
      return next;
    });
  };

  const handleWatchMatch = (id: string) => {
    if (id === matchId) {
      setView('broadcast');
    } else {
      toast({ title: 'Switching broadcast...', description: 'Loading match data' });
      setView('broadcast');
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
        className="fixed inset-0 z-50 broadcast-dark flex flex-col"
      >
        <header className="sticky top-0 z-10 bg-gradient-to-r from-brand-red to-brand-red-dark">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-white" />
              <h1 className="text-lg font-bold text-white tracking-wide">BROADCAST</h1>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </header>
        <div className="flex-1 px-4 py-4 space-y-4">
          <div className="h-40 bg-warm-800/50 rounded-2xl skeleton-shimmer" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-warm-800/50 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!data && view === 'broadcast') {
    return (
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="fixed inset-0 z-50 broadcast-dark flex flex-col items-center justify-center gap-4"
      >
        <Radio className="w-12 h-12 text-warm-500" />
        <p className="text-warm-300 font-medium">Unable to load broadcast</p>
        <Button onClick={onClose} variant="outline" className="rounded-xl border-warm-600 text-warm-300">
          Go Back
        </Button>
      </motion.div>
    );
  }

  const match = data?.match;
  const recentEvents = data?.events.slice(-10).reverse() || [];

  // ─── Render ─────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 broadcast-dark overflow-y-auto custom-scrollbar"
    >
      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-red to-brand-red-dark">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white tracking-wide">BROADCAST</h1>
          </div>
          <div className="flex items-center gap-2">
            {view === 'broadcast' && (
              <button
                onClick={() => setView('list')}
                className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold hover:bg-white/25 transition-colors"
              >
                All Matches
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="px-4 py-4 space-y-4">
        <AnimatePresence mode="wait">
          {view === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* ── Live Matches ──────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="broadcast-live">Live</div>
                  <span className="text-sm font-bold text-warm-300">{liveMatches.length} match{liveMatches.length !== 1 ? 'es' : ''}</span>
                </div>

                <div className="space-y-3">
                  {liveMatches.map((lm) => (
                    <Card key={lm.id} className="bg-brand-navy-light/80 border-warm-600/30 overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="viewer-count">
                            <span className="viewer-count-dot" />
                            <Eye className="w-3 h-3" />
                            {formatViewers(lm.viewers)} watching
                          </div>
                          <Badge className="bg-brand-red/20 text-brand-red-light text-[9px] font-bold border-0">
                            Half {lm.currentHalf}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between mb-3">
                          {/* Home team */}
                          <div className="flex items-center gap-2 flex-1">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md"
                              style={{ backgroundColor: lm.homeTeam.color }}
                            >
                              {lm.homeTeam.shortName.slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-warm-200">{lm.homeTeam.name}</p>
                            </div>
                          </div>
                          {/* Score */}
                          <div className="flex items-center gap-3 px-4">
                            <span className="text-2xl font-black text-warm-100">{lm.homeScore}</span>
                            <span className="text-xs font-bold text-warm-500">vs</span>
                            <span className="text-2xl font-black text-warm-100">{lm.awayScore}</span>
                          </div>
                          {/* Away team */}
                          <div className="flex items-center gap-2 flex-1 justify-end">
                            <div className="text-right">
                              <p className="text-xs font-bold text-warm-200">{lm.awayTeam.name}</p>
                            </div>
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shadow-md"
                              style={{ backgroundColor: lm.awayTeam.color }}
                            >
                              {lm.awayTeam.shortName.slice(0, 2)}
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() => handleWatchMatch(lm.id)}
                          className="w-full bg-brand-red/20 hover:bg-brand-red/30 text-brand-red-light border border-brand-red/30 h-9 text-xs font-bold"
                          variant="outline"
                        >
                          <Play className="w-3.5 h-3.5 mr-1.5" />
                          Watch Live
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* ── Upcoming Broadcasts ───────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-warm-400" />
                  <span className="text-sm font-bold text-warm-300">Upcoming</span>
                </div>

                <div className="space-y-3">
                  {upcomingMatches.map((um) => (
                    <Card key={um.id} className="bg-brand-navy/50 border-warm-600/20 overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-warm-500">{um.tournament}</span>
                        </div>

                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-[10px]"
                              style={{ backgroundColor: um.homeTeam.color }}
                            >
                              {um.homeTeam.shortName.slice(0, 2)}
                            </div>
                            <span className="text-xs font-bold text-warm-300">{um.homeTeam.shortName}</span>
                          </div>
                          <span className="text-[10px] font-bold text-warm-500">vs</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-warm-300">{um.awayTeam.shortName}</span>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-[10px]"
                              style={{ backgroundColor: um.awayTeam.color }}
                            >
                              {um.awayTeam.shortName.slice(0, 2)}
                            </div>
                          </div>
                        </div>

                        {/* Countdown */}
                        <div className="mb-3">
                          <CountdownTimer targetDate={um.startTime} />
                        </div>

                        <Button
                          onClick={() => handleSetReminder(um.id)}
                          className={`w-full h-9 text-xs font-bold transition-all ${
                            reminders.has(um.id)
                              ? 'bg-brand-teal/20 text-brand-teal-light border border-brand-teal/30 hover:bg-brand-teal/30'
                              : 'bg-warm-700/30 text-warm-300 border border-warm-600/30 hover:bg-warm-700/50'
                          }`}
                          variant="outline"
                        >
                          {reminders.has(um.id) ? (
                            <>
                              <BellOff className="w-3.5 h-3.5 mr-1.5" />
                              Reminder Set
                            </>
                          ) : (
                            <>
                              <Bell className="w-3.5 h-3.5 mr-1.5" />
                              Set Reminder
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* ── Broadcast View ─────────────────────────────── */
            <motion.div
              key="broadcast"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
              variants={containerVariants}
            >
              {/* ═══ Score Display ═══ */}
              {match && (
                <Card className="bg-gradient-to-br from-brand-navy to-brand-navy-dark border-0 shadow-xl overflow-hidden">
                  <CardContent className="p-5">
                    {/* Live indicator & viewer count */}
                    <div className="flex items-center justify-between mb-3">
                      {match.isLive ? (
                        <div className="broadcast-live">Live</div>
                      ) : (
                        <Badge className="bg-warm-600/30 text-warm-400 text-[9px] font-bold border-0">
                          {match.status === 'upcoming' ? 'Upcoming' : 'Finished'}
                        </Badge>
                      )}
                      {match.isLive && (match.viewers || 0) > 0 && (
                        <div className="viewer-count">
                          <span className="viewer-count-dot" />
                          <Eye className="w-3 h-3" />
                          {formatViewers(match.viewers || 0)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      {/* Home Team */}
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg shadow-lg"
                          style={{
                            backgroundColor: match.homeTeam.color,
                            boxShadow: `0 4px 16px ${match.homeTeam.color}40`,
                          }}
                        >
                          {match.homeTeam.shortName.slice(0, 2)}
                        </div>
                        <span className="text-xs text-white/70 font-semibold truncate max-w-[80px]">
                          {match.homeTeam.shortName}
                        </span>
                        <motion.span
                          className="text-4xl font-black text-white"
                          key={match.homeScore}
                          animate={homeScoreFlash ? { scale: [1, 1.3, 1], color: ['#FFFFFF', '#FBBF24', '#FFFFFF'] } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          {match.homeScore}
                        </motion.span>
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
                          style={{
                            backgroundColor: match.awayTeam.color,
                            boxShadow: `0 4px 16px ${match.awayTeam.color}40`,
                          }}
                        >
                          {match.awayTeam.shortName.slice(0, 2)}
                        </div>
                        <span className="text-xs text-white/70 font-semibold truncate max-w-[80px]">
                          {match.awayTeam.shortName}
                        </span>
                        <motion.span
                          className="text-4xl font-black text-white"
                          key={match.awayScore}
                          animate={awayScoreFlash ? { scale: [1, 1.3, 1], color: ['#FFFFFF', '#FBBF24', '#FFFFFF'] } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          {match.awayScore}
                        </motion.span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Match Stats Summary ─────────────────────── */}
              {data && (
                <motion.div variants={itemVariants}>
                  <Card className="bg-brand-navy-light/60 border-warm-600/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-brand-teal/15 flex items-center justify-center">
                          <Zap className="w-3.5 h-3.5 text-brand-teal-light" />
                        </div>
                        <h2 className="text-xs font-black tracking-wider text-warm-200">
                          MATCH STATS
                        </h2>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-[10px] text-warm-500 font-semibold uppercase">Raids</p>
                          <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="text-sm font-bold text-brand-red-light">{data.stats.homeRaids}</span>
                            <span className="text-warm-600 dark:text-warm-300">|</span>
                            <span className="text-sm font-bold text-brand-teal-light">{data.stats.awayRaids}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-warm-500 font-semibold uppercase">Tackles</p>
                          <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="text-sm font-bold text-brand-red-light">{data.stats.homeTackles}</span>
                            <span className="text-warm-600 dark:text-warm-300">|</span>
                            <span className="text-sm font-bold text-brand-teal-light">{data.stats.awayTackles}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-warm-500 font-semibold uppercase">Bonus</p>
                          <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="text-sm font-bold text-brand-red-light">{data.stats.homeBonus}</span>
                            <span className="text-warm-600 dark:text-warm-300">|</span>
                            <span className="text-sm font-bold text-brand-teal-light">{data.stats.awayBonus}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ── Live Event Feed ─────────────────────────── */}
              {data && (
                <motion.div variants={itemVariants}>
                  <Card className="bg-brand-navy-light/60 border-warm-600/20">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-brand-red/15 flex items-center justify-center">
                          <Swords className="w-3.5 h-3.5 text-brand-red-light" />
                        </div>
                        <h2 className="text-xs font-black tracking-wider text-warm-200">
                          COMMENTARY
                        </h2>
                        {match?.isLive && (
                          <div className="ml-auto">
                            <Badge className="bg-brand-red/15 text-brand-red-light text-[8px] font-bold border-0">
                              LIVE
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {recentEvents.length === 0 ? (
                          <p className="text-xs text-warm-500 text-center py-4">
                            No events yet. Match is about to start!
                          </p>
                        ) : (
                          recentEvents.map((event, i) => (
                            <motion.div
                              key={event.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-warm-800/40 transition-colors"
                            >
                              <div
                                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                  EVENT_DOT_COLORS[event.type] || 'bg-warm-500'
                                }`}
                              />
                              <p className="text-xs text-warm-300 leading-relaxed">
                                {getEventText(event, data)}
                              </p>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* ── Active Poll ─────────────────────────────── */}
              {data?.poll && (
                <motion.div variants={itemVariants}>
                  <Card className="bg-brand-navy-light/60 border-brand-gold/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-brand-gold/20 flex items-center justify-center">
                          <Award className="w-3.5 h-3.5 text-brand-gold-light" />
                        </div>
                        <h2 className="text-xs font-black tracking-wider text-warm-200">
                          POLL
                        </h2>
                        <Badge className="bg-brand-gold/15 text-brand-gold-light text-[8px] font-bold border-0 ml-auto">
                          {data.poll.totalVotes} votes
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-warm-200 mb-3">
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
                                  ? 'border-brand-teal bg-brand-teal/10'
                                  : 'border-warm-600/30 bg-warm-800/30 hover:border-brand-teal/40'
                              } ${!!data.poll!.userVotedOptionId ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              {!!data.poll!.userVotedOptionId && (
                                <motion.div
                                  className="absolute inset-y-0 left-0 bg-brand-teal/10 rounded-xl"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ duration: 0.5, ease: 'easeOut' }}
                                />
                              )}
                              <div className="relative flex items-center justify-between">
                                <span className="text-xs font-semibold text-warm-200">
                                  {option.text}
                                </span>
                                {!!data.poll!.userVotedOptionId && (
                                  <span className="text-xs font-bold text-brand-teal-light">
                                    {percentage}%
                                  </span>
                                )}
                              </div>
                              {isVoted && (
                                <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-teal-light" />
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
                <p className="text-[10px] text-warm-600 dark:text-warm-300 font-medium">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Spectator mode · Auto-refreshes every 10s
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
