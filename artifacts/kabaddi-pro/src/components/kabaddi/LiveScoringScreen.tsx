'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Undo2, Pause, Play, Square, Timer, Swords, X, Check,
  Crown, Share2, Zap, Shield, Hand, Clock, ArrowLeftRight,
  ChevronUp, AlertTriangle, Sparkles, Flame,
  ArrowRight, ArrowRightLeft,
  MessageSquare, ChevronDown, UserPlus, Radio,
  Home, Plus,
} from 'lucide-react';
import { useKabaddiStore, type MatchPlayer, type MatchEvent } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import ShareScorecard from './ShareScorecard';
import ScorerTransferScreen from './ScorerTransferScreen';
import { matchNotification } from '@/lib/notifications';
import { triggerFeedback, SoundType, vibrate } from '@/lib/sounds';
import { cn } from '@/lib/utils';

// Raid flow states
type RaidPhase = 'idle' | 'result' | 'defenders';
type RaidResult = 'success' | 'caught' | 'empty' | null;
type ActionTab = 'raid' | 'defense' | 'special' | 'cards';

const RAID_TIME_LIMIT = 30; // seconds
const ON_COURT_MAX = 7; // kabaddi standard: 7 players on court
const RAID_GAP_TIMEOUT = 5; // seconds after raid ends before auto-pause
const MAX_TIMEOUTS = 2; // max timeouts per team (practice matches)
const TIMEOUT_DURATION = 120; // 2 minutes timeout duration

// Animations (Confetti, All Out, Super Raid) removed from scorer screen — these run on viewer's phone only

function MatchEndScreen({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  homeColor,
  awayColor,
  onShare,
  onDone,
  motm,
}: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeColor: string;
  awayColor: string;
  onShare: () => void;
  onDone: () => void;
  motm: { name: string; points: number } | null;
}) {
  const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
  const winnerName = winner === 'home' ? homeTeam : winner === 'away' ? awayTeam : 'Draw';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ background: `linear-gradient(135deg, ${homeColor}15, ${awayColor}15)` }}>
        <div className="px-6 pt-8 pb-4 text-center">
          <div className="text-5xl mb-3">🏆</div>
          <h2 className="text-2xl font-black text-gray-800 dark:text-warm-100">
            {winner === 'draw' ? "It's a Draw!" : `${winnerName} Wins!`}
          </h2>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md" style={{ backgroundColor: homeColor }}>{homeTeam.charAt(0)}</div>
              <p className="text-xs font-bold mt-1" style={{ color: homeColor }}>{homeTeam}</p>
              <p className="text-3xl font-black mt-1" style={{ color: homeColor }}>{homeScore}</p>
            </div>
            <span className="text-xl text-gray-300 font-bold">-</span>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md" style={{ backgroundColor: awayColor }}>{awayTeam.charAt(0)}</div>
              <p className="text-xs font-bold mt-1" style={{ color: awayColor }}>{awayTeam}</p>
              <p className="text-3xl font-black mt-1" style={{ color: awayColor }}>{awayScore}</p>
            </div>
          </div>
        </div>
        {motm && (
          <div className="mx-6 mb-4 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-[9px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">Man of the Match</p>
                <p className="text-sm font-black text-gray-800 dark:text-warm-100">{motm.name}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-bold">{motm.points} points</p>
              </div>
            </div>
          </div>
        )}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onShare} className="flex-1 py-3 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg">
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button onClick={onDone} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-warm-700 hover:bg-gray-200 text-gray-700 dark:text-warm-200 font-bold text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Half Time Transition Screen ────────────────────────────────────

function HalfTimeScreen({
  half,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  homeColor,
  awayColor,
  onContinue,
}: {
  half: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeColor: string;
  awayColor: string;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl p-6 text-center" style={{ background: `linear-gradient(135deg, ${homeColor}10, ${awayColor}10)` }}>
        <div className="text-4xl mb-3">⏱️</div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-warm-100 mb-1">Half Time!</h2>
        <p className="text-sm text-gray-500 dark:text-warm-400 mb-4">{half === 1 ? '1st Half Complete' : '2nd Half Starting'}</p>
        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-xs font-bold" style={{ color: homeColor }}>{homeTeam}</p>
            <p className="text-3xl font-black" style={{ color: homeColor }}>{homeScore}</p>
          </div>
          <span className="text-lg text-gray-300 font-bold">-</span>
          <div className="text-center">
            <p className="text-xs font-bold" style={{ color: awayColor }}>{awayTeam}</p>
            <p className="text-3xl font-black" style={{ color: awayColor }}>{awayScore}</p>
          </div>
        </div>
        <button onClick={onContinue} className="w-full py-3 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-sm shadow-lg">
          Continue to {half === 1 ? '2nd Half' : 'Match'}
        </button>
      </div>
    </div>
  );
}

// All Out & Super Raid celebration overlays removed from scorer screen — these run on viewer's phone only

// ─── Do or Die Indicator ────────────────────────────────────────────

function DoOrDieIndicator({ teamColor }: { teamColor: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mx-4 mt-1"
    >
      <motion.div
        animate={{ backgroundColor: [`${teamColor}30`, `${teamColor}60`, `${teamColor}30`] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="flex items-center justify-center gap-2 py-1.5 rounded-lg"
      >
        <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
          <Flame className="w-4 h-4" style={{ color: teamColor }} />
        </motion.div>
        <span className="text-xs font-black tracking-wider" style={{ color: teamColor }}>
          DO OR DIE RAID
        </span>
        <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
          <AlertTriangle className="w-4 h-4" style={{ color: teamColor }} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Event Confirmation Toast (inline) ──────────────────────────────

function EventConfirmation({
  message,
  teamColor,
  onUndo,
}: {
  message: string;
  teamColor: string;
  onUndo: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-center"
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border"
        style={{
          backgroundColor: teamColor + '15',
          borderColor: teamColor + '30',
        }}
      >
        <Check className="w-4 h-4" style={{ color: teamColor }} />
        <span className="text-xs font-bold" style={{ color: teamColor }}>{message}</span>
        <button
          onClick={() => { setVisible(false); onUndo(); }}
          className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-warm-800 text-gray-600 dark:text-warm-300 hover:bg-gray-100"
        >
          UNDO
        </button>
      </div>
    </motion.div>
  );
}

// ─── Event Log Entry ────────────────────────────────────────────────

function EventLogEntry({ event, matchInfo }: { event: MatchEvent; matchInfo: { homeTeamId: string; homeTeamColor: string; awayTeamColor: string } }) {
  const isHome = event.teamId === matchInfo.homeTeamId;
  const teamColor = isHome ? matchInfo.homeTeamColor : matchInfo.awayTeamColor;

  const eventIcons: Record<string, string> = {
    raid_point: '✅',
    bonus_point: '🎯',
    tackle_point: '🛡',
    super_tackle: '⚡',
    super_raid: '🔥',
    do_or_die_raid: '🔥',
    all_out: '💥',
    empty_raid: '⏭',
    self_out: '🚫',
    substitution: '🔄',
    timeout: '📋',
    yellow_card: '🟨',
    red_card: '🟥',
    green_card: '🟩',
  };

  const eventLabels: Record<string, string> = {
    raid_point: 'Raid Pt',
    bonus_point: 'Bonus Pt',
    tackle_point: 'Tackle Pt',
    super_tackle: 'Super Tackle',
    super_raid: 'Super Raid',
    do_or_die_raid: 'Do-or-Die',
    all_out: 'All Out',
    empty_raid: 'Empty',
    self_out: 'Self-Out',
    substitution: 'Sub',
    timeout: 'Timeout',
    yellow_card: 'Yellow Card',
    red_card: 'Red Card',
    green_card: 'Green Card',
  };

  const timeStr = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-warm-100 dark:hover:bg-warm-700/30 dark:hover:bg-gray-700/30 transition-colors"
    >
      <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400 w-14 shrink-0">{timeStr}</span>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
      <span className="text-xs truncate max-w-[80px] font-medium text-gray-700 dark:text-gray-300">{event.playerName || '—'}</span>
      <span className="text-xs">{eventIcons[event.eventType] || '📌'}</span>
      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex-1">{eventLabels[event.eventType] || event.eventType}</span>
      {event.value > 0 && (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${teamColor}20`, color: teamColor }}>
          +{event.value}
        </span>
      )}
    </motion.div>
  );
}

// ─── Animated Score Counter ─────────────────────────────────────────

function AnimatedScore({ value, color }: { value: number; color: string }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.5, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 12, stiffness: 300 }}
      className="text-3xl font-black tabular-nums leading-none"
      style={{ color }}
    >
      {value}
    </motion.span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function LiveScoringScreen() {
  const {
    activeMatch,
    addBatchEvents,
    addEvent,
    undoLastRaid,
    undoLastEvent,
    switchHalf,
    setTimer,
    endMatch,
    setDoOrDie,
    switchRaidQueue,
    callTimeout,
    addNotification,
    addPlayerToMatch,
    setActiveTab,
    // Card & Disciplinary Module
    issueGreenCard,
    issueYellowCard,
    releaseYellowCard,
    issueRedCard,
  } = useKabaddiStore();

  const { toast } = useToast();

  // Match timer state
  const [isPaused, setIsPaused] = useState(false);
  const [hasStartedRaiding, setHasStartedRaiding] = useState(false);
  const matchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Raid timer state
  const [raidTimer, setRaidTimer] = useState<number | null>(null);
  const raidTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Raid gap timer (5s after raid ends, auto-pause if no new raider)
  const [raidGapTimer, setRaidGapTimer] = useState<number | null>(null);
  const raidGapRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track consecutive empty raids per team for do-or-die
  const consecutiveEmptyRaidsRef = useRef<Record<string, number>>({});

  // Self-out confirmation state
  const [selfOutConfirm, setSelfOutConfirm] = useState<MatchPlayer | null>(null);

  // Super raid celebration state
  const [superRaidCelebration, setSuperRaidCelebration] = useState<{ teamName: string; teamColor: string; playerName: string } | null>(null);
  // Track if 5-min warning has fired for current half
  const fiveMinWarningFiredRef = useRef<boolean>(false);

  // Raid flow state
  const [raidPhase, setRaidPhase] = useState<RaidPhase>('idle');
  const [raider, setRaider] = useState<MatchPlayer | null>(null);
  const [raidResult, setRaidResult] = useState<RaidResult>(null);
  const [selectedDefenders, setSelectedDefenders] = useState<Set<string>>(new Set());
  const [bonusPoint, setBonusPoint] = useState(false);

  // Turn transition lock: briefly prevents raider selection after a raid ends
  // This ensures the state fully resets before the next team can pick a raider
  const [isTurnTransitioning, setIsTurnTransitioning] = useState(false);

  // Substitute mode
  const [showSubMode, setShowSubMode] = useState<'home' | 'away' | null>(null);
  const [subInPlayer, setSubInPlayer] = useState<MatchPlayer | null>(null);

  // Add player mid-match
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addPlayerTeam, setAddPlayerTeam] = useState<'home' | 'away' | null>(null);
  const [addPlayerName, setAddPlayerName] = useState('');
  const [addPlayerPhone, setAddPlayerPhone] = useState('');
  const [addPlayerSearchResults, setAddPlayerSearchResults] = useState<Array<{ id: string; name: string; phone?: string; jerseyNumber?: number; playerCode?: string }>>([]);

  // Match end state
  const [showEndMatchConfirm, setShowEndMatchConfirm] = useState(false);
  const [showEndHalfConfirm, setShowEndHalfConfirm] = useState(false);
  const [showMotmOverlay, setShowMotmOverlay] = useState(false);
  const [motmPlayer, setMotmPlayer] = useState<{ name: string; points: number } | null>(null);
  const [showShareScorecard, setShowShareScorecard] = useState(false);
  const [savedMatchData, setSavedMatchData] = useState<{
    homeTeam: string; awayTeam: string; homeScore: number; awayScore: number;
    homeTeamColor: string; awayTeamColor: string; gender: string;
    topRaider: { name: string; points: number } | null;
    topDefender: { name: string; points: number } | null;
    motm: { name: string; points: number } | null;
  } | null>(null);

  // New UI states
  const [showHalfTimeTransition, setShowHalfTimeTransition] = useState(false);
  const [showMatchEndCelebration, setShowMatchEndCelebration] = useState(false);
  const [allOutCelebration, setAllOutCelebration] = useState<{ teamName: string; teamColor: string } | null>(null);
  const [eventConfirm, setEventConfirm] = useState<{ message: string; teamColor: string } | null>(null);
  const [showTimeoutOverlay, setShowTimeoutOverlay] = useState(false);
  const [showTimeoutTypeSelector, setShowTimeoutTypeSelector] = useState(false);
  const [showActionsPanel, setShowActionsPanel] = useState(false);
  // Card selection: user picks team → player → card type
  const [cardSelection, setCardSelection] = useState<{
    step: 'team' | 'player' | 'type';
    team?: 'home' | 'away';
    player?: MatchPlayer;
    cardType?: 'green_card' | 'yellow_card' | 'red_card';
  } | null>(null);
  // Tech point selection: user picks which team gets the point
  const [techPointSelection, setTechPointSelection] = useState<'home' | 'away' | null>(null);
  // Self-out selection (from raid screen): raider or which defender
  const [selfOutSelection, setSelfOutSelection] = useState<'raider' | 'defender' | null>(null);
  // Specials panel (change raid team, add +1 point to team)
  const [showSpecialsPanel, setShowSpecialsPanel] = useState(false);
  // Add point team selector
  const [addPointSelection, setAddPointSelection] = useState<'home' | 'away' | null>(null);
  const [timeoutCountdown, setTimeoutCountdown] = useState(TIMEOUT_DURATION);
  const [timeoutTeam, setTimeoutTeam] = useState<'home' | 'away' | 'official'>('home');
  const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Player profiles (avatars)
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, { avatar?: string }>>({});

  // Action tab state
  const [actionTab, setActionTab] = useState<ActionTab>('raid');

  // Event log state
  const [showFullLog, setShowFullLog] = useState(false);
  const [showScorerTransfer, setShowScorerTransfer] = useState(false);
  const eventLogRef = useRef<HTMLDivElement>(null);

  const match = activeMatch;

  // Ref to allow processRaidResult to be called from useEffect before its declaration
  const processRaidResultRef = useRef<(result: RaidResult, touchedDefenders: Set<string>, hasBonus: boolean) => void>(() => {});

  // Fetch player profiles
  useEffect(() => {
    if (!match) return;
    const allPlayerIds = [
      ...match.homeLineup.map(p => p.id),
      ...match.awayLineup.map(p => p.id),
    ].filter(id => id && !id.startsWith('p_'));

    if (allPlayerIds.length === 0) return;

    Promise.all(
      allPlayerIds.map(async (id) => {
        try {
          const res = await fetch(`/api/players/${id}`);
          if (res.ok) {
            const data = await res.json();
            return { id, avatar: data.player?.avatar || null };
          }
        } catch { /* skip */ }
        return null;
      })
    ).then(results => {
      const profiles: Record<string, { avatar?: string }> = {};
      results.forEach(r => {
        if (r && r.id) profiles[r.id] = { avatar: r.avatar || undefined };
      });
      setPlayerProfiles(prev => ({ ...prev, ...profiles }));
    });
  }, [match?.homeLineup.length, match?.awayLineup.length]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  // ═══ CLEAR RAID GAP TIMER ═══
  const clearRaidGap = useCallback(() => {
    if (raidGapRef.current) clearInterval(raidGapRef.current);
    setRaidGapTimer(null);
  }, []);

  // ═══ MATCH TIMER LOGIC ═══
  useEffect(() => {
    if (!match?.isLive || isPaused || !hasStartedRaiding) {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      return;
    }

    matchTimerRef.current = setInterval(() => {
      const currentTimer = useKabaddiStore.getState().activeMatch?.timer ?? 0;
      if (currentTimer <= 0) {
        if (matchTimerRef.current) clearInterval(matchTimerRef.current);
        return;
      }
      setTimer(currentTimer - 1);
    }, 1000);

    return () => {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    };
  }, [match?.isLive, isPaused, hasStartedRaiding, setTimer]);

  // ═══ 5-MINUTE WARNING & HALF/END TIME DETECTION ═══
  useEffect(() => {
    if (!match?.isLive) return;
    const timer = match.timer;
    const halfDuration = match.halfDuration * 60;
    const fiveMinutes = 5 * 60;

    if (timer === fiveMinutes && !fiveMinWarningFiredRef.current) {
      fiveMinWarningFiredRef.current = true;
      triggerFeedback(SoundType.FIVE_MINUTE_WARNING);
      toast({
        title: match.currentHalf === 2 ? '5 minutes left in match!' : '5 minutes left in half!',
        description: 'Time is running out',
        duration: 3000,
      });
    }

    if (timer === halfDuration) {
      fiveMinWarningFiredRef.current = false;
    }

    if (timer === 0 && hasStartedRaiding) {
      if (match.currentHalf === 1) {
        triggerFeedback(SoundType.HALF_END);
        setShowHalfTimeTransition(true);
      } else {
        triggerFeedback(SoundType.HALF_END);
        setTimeout(() => {
          triggerFeedback(SoundType.MATCH_END);
        }, 800);
      }
    }
  }, [match?.timer, match?.isLive, match?.currentHalf, match?.halfDuration, hasStartedRaiding, toast]);

  // ═══ RAID TIMER LOGIC ═══
  useEffect(() => {
    if (raidTimer === null) {
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      return;
    }

    if (raidTimer <= 0) {
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      setRaidTimer(null);
      if (raidPhase !== 'idle' && raider) {
        triggerFeedback(SoundType.RAID_TIME_EXPIRED);
        // Per Pro Kabaddi rules: if raider doesn't complete raid within 30 seconds,
        // the raider is OUT and the defending team gets 1 point (like a tackle).
        processRaidResultRef.current('caught', new Set(), false);
        toast({ title: 'Raid time expired!', description: 'Raider is out — 1 point to defense', duration: 3000 });
      }
      return;
    }

    raidTimerRef.current = setInterval(() => {
      setRaidTimer(prev => {
        if (prev === null || prev <= 1) {
          if (raidTimerRef.current) clearInterval(raidTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
    };
  }, [raidTimer !== null, raidPhase, raider, toast]);

  // ═══ RAID TIMER HAPTIC COUNTDOWN ═══
  useEffect(() => {
    if (raidTimer === null || raidPhase === 'idle') return;

    if (raidTimer === 10) {
      vibrate([40]);
    }
    if (raidTimer === 5) {
      vibrate([60, 30, 60]);
    }
    if (raidTimer <= 3 && raidTimer > 0) {
      vibrate([30]);
    }
  }, [raidTimer, raidPhase]);

  // ═══ RAID GAP TIMER LOGIC ═══
  useEffect(() => {
    if (raidGapTimer === null) {
      if (raidGapRef.current) clearInterval(raidGapRef.current);
      return;
    }

    if (raidGapTimer <= 0) {
      if (raidGapRef.current) clearInterval(raidGapRef.current);
      setRaidGapTimer(null);
      if (raidPhase === 'idle' && hasStartedRaiding && !isPaused) {
        triggerFeedback(SoundType.RAID_GAP_WARNING);
        setIsPaused(true);
        toast({ title: 'Timer paused', description: 'Select a raider to resume', duration: 1500 });
      }
      return;
    }

    raidGapRef.current = setInterval(() => {
      setRaidGapTimer(prev => {
        if (prev === null || prev <= 1) {
          if (raidGapRef.current) clearInterval(raidGapRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (raidGapRef.current) clearInterval(raidGapRef.current);
    };
  }, [raidGapTimer, raidPhase, hasStartedRaiding, isPaused]);

  // ═══ TIMEOUT COUNTDOWN (2 minutes) ═══
  useEffect(() => {
    if (!showTimeoutOverlay) {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
      return;
    }
    setTimeoutCountdown(TIMEOUT_DURATION);
    timeoutRef.current = setInterval(() => {
      setTimeoutCountdown(prev => {
        if (prev <= 1) {
          if (timeoutRef.current) clearInterval(timeoutRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, [showTimeoutOverlay]);

  // Auto-resume when timeout reaches 0 — but start raid gap timer so clock
  // auto-pauses again if scorer doesn't act within 5 seconds
  useEffect(() => {
    if (showTimeoutOverlay && timeoutCountdown === 0) {
      setShowTimeoutOverlay(false);
      setIsPaused(false);
      // Start the 5-second raid gap timer so the match clock auto-pauses
      // if the scorer doesn't select a raider quickly after the timeout
      if (hasStartedRaiding) setRaidGapTimer(RAID_GAP_TIMEOUT);
    }
  }, [showTimeoutOverlay, timeoutCountdown, hasStartedRaiding]);

  // ═══ AUTO-SCROLL EVENT LOG ═══
  useEffect(() => {
    if (showFullLog && eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [match?.events.length, showFullLog]);

  // Calculate MOTM
  const calculateMotm = useCallback(() => {
    if (!match) return null;
    const playerPoints: Record<string, { name: string; points: number }> = {};
    for (const event of match.events) {
      if (event.playerId && event.playerName) {
        if (!playerPoints[event.playerId]) {
          playerPoints[event.playerId] = { name: event.playerName, points: 0 };
        }
        playerPoints[event.playerId].points += event.value;
      }
    }
    let topPlayer: { name: string; points: number } | null = null;
    for (const p of Object.values(playerPoints)) {
      if (!topPlayer || p.points > topPlayer.points) topPlayer = p;
    }
    return topPlayer;
  }, [match]);

  const calculateTopRaiderDefender = useCallback(() => {
    if (!match) return { topRaider: null, topDefender: null };
    const playerRaidPoints: Record<string, { name: string; points: number }> = {};
    const playerTacklePoints: Record<string, { name: string; points: number }> = {};

    for (const event of match.events) {
      if (!event.playerId || !event.playerName) continue;
      if (['raid_point', 'bonus_point', 'do_or_die_raid'].includes(event.eventType)) {
        if (!playerRaidPoints[event.playerId]) playerRaidPoints[event.playerId] = { name: event.playerName, points: 0 };
        playerRaidPoints[event.playerId].points += event.value;
      }
      if (['tackle_point', 'super_tackle'].includes(event.eventType)) {
        if (!playerTacklePoints[event.playerId]) playerTacklePoints[event.playerId] = { name: event.playerName, points: 0 };
        playerTacklePoints[event.playerId].points += event.value;
      }
    }

    let topRaider: { name: string; points: number } | null = null;
    for (const p of Object.values(playerRaidPoints)) {
      if (!topRaider || p.points > topRaider.points) topRaider = p;
    }
    let topDefender: { name: string; points: number } | null = null;
    for (const p of Object.values(playerTacklePoints)) {
      if (!topDefender || p.points > topDefender.points) topDefender = p;
    }
    return { topRaider, topDefender };
  }, [match]);

  // Get player points from match events (before early return for hooks rule)
  const getPlayerPoints = useCallback((playerId: string): { raid: number; tackle: number } => {
    if (!match) return { raid: 0, tackle: 0 };
    let raid = 0;
    let tackle = 0;
    for (const event of match.events) {
      if (event.playerId !== playerId) continue;
      if (['raid_point', 'super_raid', 'do_or_die_raid', 'bonus_point'].includes(event.eventType)) {
        raid += event.value;
      }
      if (['tackle_point', 'super_tackle'].includes(event.eventType)) {
        tackle += event.value;
      }
    }
    return { raid, tackle };
  }, [match?.events]);

  // Search for existing players when adding mid-match (must be before early return for hooks rules)
  useEffect(() => {
    if (!showAddPlayer || !addPlayerTeam || !activeMatch) {
      setAddPlayerSearchResults([]);
      return;
    }
    const query = addPlayerPhone.trim() || addPlayerName.trim();
    if (!query || query.length < 2) {
      setAddPlayerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const searchBy = addPlayerPhone.trim() ? 'phone' : 'name';
        const searchQuery = addPlayerPhone.trim() || addPlayerName.trim();
        const res = await fetch(`/api/players/search?${searchBy}=${encodeURIComponent(searchQuery)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          const teamId = addPlayerTeam === 'home' ? activeMatch.homeTeamId : activeMatch.awayTeamId;
          // Filter to players on this team only (or players with no team)
          const results = (data.players || []).filter((p: { teamId?: string }) => p.teamId === teamId || !p.teamId);
          setAddPlayerSearchResults(results.slice(0, 5));
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [addPlayerName, addPlayerPhone, addPlayerTeam, showAddPlayer, activeMatch?.homeTeamId, activeMatch?.awayTeamId]);

  if (!match) return null;

  // ═══ DERIVED STATE ═══
  const raidingTeam = match.raidQueue;
  const defendingTeam: 'home' | 'away' = raidingTeam === 'home' ? 'away' : 'home';

  const fullRaidingLineup = raidingTeam === 'home' ? match.homeLineup : match.awayLineup;
  const fullDefendingLineup = defendingTeam === 'home' ? match.homeLineup : match.awayLineup;

  const raidingOutIds = raidingTeam === 'home' ? match.homeOutPlayerIds : match.awayOutPlayerIds;
  const defendingOutIds = defendingTeam === 'home' ? match.homeOutPlayerIds : match.awayOutPlayerIds;

  const raidingTeamColor = raidingTeam === 'home' ? match.homeTeamColor : match.awayTeamColor;
  const defendingTeamColor = defendingTeam === 'home' ? match.homeTeamColor : match.awayTeamColor;

  const raidingTeamName = raidingTeam === 'home' ? match.homeTeam : match.awayTeam;
  const defendingTeamName = defendingTeam === 'home' ? match.homeTeam : match.awayTeam;

  // Half indicator
  const halfLabel = !hasStartedRaiding
    ? 'NOT STARTED'
    : match.timer === 0 && match.currentHalf === 1
      ? 'HALF TIME'
      : match.timer === 0 && match.currentHalf === 2
        ? 'FULL TIME'
        : match.currentHalf === 1
          ? '1ST HALF'
          : '2ND HALF';

  const isTimerPulsing = match.timer > 0 && match.timer < 60 && hasStartedRaiding && !isPaused;

  // Split lineup: first 7 = on court, rest = substitutes
  const splitLineup = (lineup: MatchPlayer[], outIds: string[]) => {
    const onCourt = lineup.slice(0, ON_COURT_MAX);
    const substitutes = lineup.slice(ON_COURT_MAX);
    const onCourtActive = onCourt.filter(p => !outIds.includes(p.id));
    const onCourtOut = onCourt.filter(p => outIds.includes(p.id));
    return { onCourt, substitutes, onCourtActive, onCourtOut };
  };

  // ═══ SCORE BREAKDOWN ═══
  const homeRaidPoints = match.events
    .filter(e => e.teamId === match.homeTeamId && ['raid_point', 'bonus_point', 'do_or_die_raid', 'all_out'].includes(e.eventType))
    .reduce((sum, e) => sum + e.value, 0);
  const homeTacklePoints = match.events
    .filter(e => e.teamId === match.homeTeamId && ['tackle_point', 'super_tackle'].includes(e.eventType))
    .reduce((sum, e) => sum + e.value, 0);
  const awayRaidPoints = match.events
    .filter(e => e.teamId === match.awayTeamId && ['raid_point', 'bonus_point', 'do_or_die_raid', 'all_out'].includes(e.eventType))
    .reduce((sum, e) => sum + e.value, 0);
  const awayTacklePoints = match.events
    .filter(e => e.teamId === match.awayTeamId && ['tackle_point', 'super_tackle'].includes(e.eventType))
    .reduce((sum, e) => sum + e.value, 0);

  // Handle raider selection → starts raid timer AND match timer
  const handleSelectRaider = (player: MatchPlayer) => {
    if (raidingOutIds.includes(player.id)) return;
    if (raidPhase !== 'idle') return;
    // Strict turn lock: prevent selection during turn transition
    if (isTurnTransitioning) return;

    if (!hasStartedRaiding) setHasStartedRaiding(true);
    if (isPaused) setIsPaused(false);
    clearRaidGap();

    setRaider(player);
    setRaidPhase('result');
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);
    setActionTab('raid');

    setRaidTimer(RAID_TIME_LIMIT);

    // Check if THIS team has a pending do-or-die
    const raidingTeamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    const isTeamDoOrDie = match.isDoOrDie && match.doOrDieTeamId === raidingTeamId;

    if (isTeamDoOrDie) {
      triggerFeedback(SoundType.DO_OR_DIE);
    } else {
      triggerFeedback(SoundType.WHISTLE);
    }
  };

  // Handle raid result selection
  const handleSelectResult = (result: RaidResult) => {
    if (result === 'empty') {
      processRaidResult(result, new Set(), false);
      return;
    }
    setRaidResult(result);
    setRaidPhase('defenders');
    setSelectedDefenders(new Set());
  };

  // Toggle defender selection
  const toggleDefender = (playerId: string) => {
    setSelectedDefenders(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  // Process raid result
  const processRaidResult = (result: RaidResult, touchedDefenders: Set<string>, hasBonus: boolean) => {
    if (!match || !raider) return;

    // Activate turn lock IMMEDIATELY to prevent any race conditions
    // during the state transition (addBatchEvents flips raidQueue in the store)
    setIsTurnTransitioning(true);

    if (!hasStartedRaiding) setHasStartedRaiding(true);

    // Stop raid timer
    setRaidTimer(null);
    if (raidTimerRef.current) clearInterval(raidTimerRef.current);

    const raidingTeamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    const defendingTeamId = defendingTeam === 'home' ? match.homeTeamId : match.awayTeamId;

    const events: Omit<MatchEvent, 'id' | 'timestamp'>[] = [];

    if (result === 'success') {
      const touchCount = touchedDefenders.size;
      if (touchCount > 0) {
        events.push({
          matchId: match.id, eventType: 'raid_point', teamId: raidingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name,
          value: touchCount,
          details: JSON.stringify({ touchedPlayerIds: Array.from(touchedDefenders), raiderId: raider.id }),
        });
      }
      if (hasBonus) {
        events.push({
          matchId: match.id, eventType: 'bonus_point', teamId: raidingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name,
          value: 1, details: JSON.stringify({ raiderId: raider.id }),
        });
      }

      // Super Raid auto-detection: 3+ defenders touched in a single raid
      // NOTE: Super raid is just a LABEL — it does NOT add extra points.
      // The points come from the raid_point event (1 per defender touched).
      // We push a super_raid event with value=0 for match history/celebration only.
      const totalRaidPoints = touchCount + (hasBonus ? 1 : 0);
      if (totalRaidPoints >= 3) {
        events.push({
          matchId: match.id, eventType: 'super_raid', teamId: raidingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name,
          value: 0, // NO extra points — super raid is just a label
          details: JSON.stringify({ raiderId: raider.id, touchCount, bonusPoint: hasBonus }),
        });
        // Show super raid celebration
        setSuperRaidCelebration({ teamName: raidingTeamName, teamColor: raidingTeamColor, playerName: raider.name });
      }

      // All out check: if ALL defenders on court will be out after this raid
      const { onCourtActive } = splitLineup(fullDefendingLineup, defendingOutIds);
      // Count how many active defenders will remain after touch points
      const remainingDefenders = onCourtActive.length - touchCount;
      if (remainingDefenders <= 0) {
        events.push({
          matchId: match.id, eventType: 'all_out', teamId: raidingTeamId,
          half: match.currentHalf, value: (match.allOutBonusPoints ?? 2),
        });
        // Trigger all-out celebration
        setAllOutCelebration({ teamName: raidingTeamName, teamColor: raidingTeamColor });
        triggerFeedback(SoundType.ALL_OUT);
      }
    } else if (result === 'caught') {
      const caughtByIds = Array.from(touchedDefenders);
      const primaryCatcher = caughtByIds.length > 0
        ? fullDefendingLineup.find(p => caughtByIds.includes(p.id))
        : null;

      events.push({
        matchId: match.id, eventType: 'tackle_point', teamId: defendingTeamId,
        half: match.currentHalf,
        playerId: primaryCatcher?.id || raider.id, playerName: primaryCatcher?.name || raider.name,
        value: 1,
        details: JSON.stringify({ caughtByIds, raiderId: raider.id }),
      });

      const { onCourtActive } = splitLineup(fullDefendingLineup, defendingOutIds);
      // Super Tackle: when defending team has 3 or fewer active players on court
      // Use match.superTackleThreshold with fallback to floor(P/2) for old matches
      const superTackleThreshold = match.superTackleThreshold ?? Math.floor(match.playersPerSide / 2);
      if (onCourtActive.length <= superTackleThreshold) {
        events.push({
          matchId: match.id, eventType: 'super_tackle', teamId: defendingTeamId,
          half: match.currentHalf,
          playerId: primaryCatcher?.id || raider.id, playerName: primaryCatcher?.name || raider.name,
          value: 1,
          details: JSON.stringify({ caughtByIds, raiderId: raider.id }),
        });
      }

      // All-Out check: if the raiding team's raider was their last active player
      const raidingOnCourtActive = splitLineup(fullRaidingLineup, raidingOutIds).onCourtActive;
      if (raidingOnCourtActive.length <= 1) {
        // This was the last raider → All Out for the raiding team
        events.push({
          matchId: match.id, eventType: 'all_out', teamId: defendingTeamId,
          half: match.currentHalf, value: (match.allOutBonusPoints ?? 2),
        });
        setAllOutCelebration({ teamName: defendingTeamName, teamColor: defendingTeamColor });
        triggerFeedback(SoundType.ALL_OUT);
      }
    } else if (result === 'empty') {
      // Do-or-Die: if this team has a pending do-or-die and raider has empty raid, raider is OUT
      const isTeamDoOrDie = match.isDoOrDie && match.doOrDieTeamId === raidingTeamId;
      if (isTeamDoOrDie) {
        // Do-or-die raid failed! Raider is out, defending team gets +1
        events.push({
          matchId: match.id, eventType: 'do_or_die_raid', teamId: defendingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name,
          value: 1,
          details: JSON.stringify({ raiderId: raider.id, failed: true }),
        });
        // Reset empty raid counter for the raiding team since they scored 0
        consecutiveEmptyRaidsRef.current[raidingTeamId] = 0;

        // All-Out check: if the raiding team's raider was their last active player
        const raidingOnCourtActive = splitLineup(fullRaidingLineup, raidingOutIds).onCourtActive;
        if (raidingOnCourtActive.length <= 1) {
          events.push({
            matchId: match.id, eventType: 'all_out', teamId: defendingTeamId,
            half: match.currentHalf, value: (match.allOutBonusPoints ?? 2),
          });
          setAllOutCelebration({ teamName: defendingTeamName, teamColor: defendingTeamColor });
          triggerFeedback(SoundType.ALL_OUT);
        }
      } else {
        events.push({
          matchId: match.id, eventType: 'empty_raid', teamId: raidingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name, value: 0,
        });

        // Track consecutive empty raids per team
        consecutiveEmptyRaidsRef.current[raidingTeamId] = (consecutiveEmptyRaidsRef.current[raidingTeamId] || 0) + 1;
      }
    }

    // Reset consecutive empty raids on any successful raid (points scored)
    if (result === 'success') {
      consecutiveEmptyRaidsRef.current[raidingTeamId] = 0;
    }
    if (result === 'caught') {
      // Defending team scored, reset THEIR counter
      consecutiveEmptyRaidsRef.current[defendingTeamId] = 0;
    }

    // ═══ DO-OR-DIE LOGIC (per team) ═══
    // Evaluate BEFORE the turn swaps (addBatchEvents flips raidQueue)
    const raidingEmptyCount = consecutiveEmptyRaidsRef.current[raidingTeamId] || 0;
    if (raidingEmptyCount >= 2) {
      // Do-or-die applies to this team's NEXT raid (after opponent raids)
      setDoOrDie(true, raidingTeamId);
      triggerFeedback(SoundType.DO_OR_DIE);
      toast({
        title: '🔥 DO OR DIE RAID!',
        description: `${raidingTeamName}'s next raid must score — or raider is out!`,
        duration: 3000,
      });
    } else {
      // Clear do-or-die ONLY if it belonged to this team
      if (match.doOrDieTeamId === raidingTeamId) {
        setDoOrDie(false);
      }
    }

    if (events.length > 0) {
      addBatchEvents(events);
    }

    // Show event confirmation
    const hasSuperTackle = events.some(e => e.eventType === 'super_tackle');
    const pointValue = result === 'success' ? (touchedDefenders.size + (hasBonus ? 1 : 0)) : result === 'caught' ? (hasSuperTackle ? 2 : 1) : 0;
    const confirmMsg = result === 'success'
      ? `${raider.name} +${pointValue} raid point${pointValue > 1 ? 's' : ''}`
      : result === 'caught'
        ? `${defendingTeamName} +${pointValue} ${hasSuperTackle ? 'super tackle' : 'tackle'}`
        : 'Empty raid recorded';
    setEventConfirm({ message: confirmMsg, teamColor: result === 'caught' ? defendingTeamColor : raidingTeamColor });

    // ═══ STRICT TURN TRANSITION ═══
    // Turn lock was already activated at the top of this function.
    // Now reset ALL raid state completely before the next team can select.
    setRaidPhase('idle');
    setRaider(null);
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);

    // Release the turn lock after a brief delay (800ms) to allow state to settle
    // and give visual feedback that the turn has swapped
    setTimeout(() => {
      setIsTurnTransitioning(false);
    }, 800);

    // Start 5-second raid gap timer
    setRaidGapTimer(RAID_GAP_TIMEOUT);
  };

  // Keep ref in sync with latest processRaidResult
  // This is a standard React pattern for accessing latest closure from effects
  // eslint-disable-next-line react-hooks/refs
  processRaidResultRef.current = processRaidResult;

  const cancelRaid = () => {
    setRaidTimer(null);
    if (raidTimerRef.current) clearInterval(raidTimerRef.current);
    setRaidPhase('idle');
    setRaider(null);
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);

    if (hasStartedRaiding) setRaidGapTimer(RAID_GAP_TIMEOUT);
  };

  const handleEndMatch = async () => {
    if (showEndMatchConfirm) {
      const motm = calculateMotm();
      const { topRaider, topDefender } = calculateTopRaiderDefender();

      setSavedMatchData({
        homeTeam: match.homeTeam, awayTeam: match.awayTeam,
        homeScore: match.homeScore, awayScore: match.awayScore,
        homeTeamColor: match.homeTeamColor, awayTeamColor: match.awayTeamColor,
        gender: match.gender, topRaider, topDefender, motm,
      });

      try {
        await fetch('/api/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeTeamName: match.homeTeam, awayTeamName: match.awayTeam,
            homeTeamColor: match.homeTeamColor, awayTeamColor: match.awayTeamColor,
            homeScore: match.homeScore, awayScore: match.awayScore,
            gender: match.gender, isPractice: match.isPractice,
            weightCategory: match.weightCategory,
            liveStreamUrl: match.liveStreamUrl,
            halfDuration: match.halfDuration, playersPerSide: match.playersPerSide,
            events: match.events.map(e => ({
              eventType: e.eventType, teamId: e.teamId, half: e.half,
              playerId: e.playerId, value: e.value, details: e.details,
            })),
          }),
        });
      } catch (err) {
        console.error('Failed to save match:', err);
      }

      addNotification(matchNotification(match.homeTeam, match.awayTeam, match.homeScore, match.awayScore));

      if (motm) {
        setMotmPlayer(motm);
      }

      endMatch();
      triggerFeedback(SoundType.MATCH_END);
      setShowEndMatchConfirm(false);
      setShowMatchEndCelebration(true);
    } else {
      setShowEndMatchConfirm(true);
      setTimeout(() => setShowEndMatchConfirm(false), 3000);
    }
  };

  const handleEndHalf = () => {
    if (showEndHalfConfirm) {
      triggerFeedback(SoundType.HALF_END);
      switchHalf();
      setHasStartedRaiding(false);
      setRaidTimer(null);
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      clearRaidGap();
      setRaidPhase('idle');
      setRaider(null);
      setDoOrDie(false);
      setIsTurnTransitioning(false);
      consecutiveEmptyRaidsRef.current = {};
      fiveMinWarningFiredRef.current = false;
      setShowEndHalfConfirm(false);
      setShowHalfTimeTransition(true);
    } else {
      setShowEndHalfConfirm(true);
      setTimeout(() => setShowEndHalfConfirm(false), 3000);
    }
  };

  const handlePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);

    if (newPaused) {
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      clearRaidGap();
    } else {
      if (raidTimer !== null) {
        raidTimerRef.current = setInterval(() => {
          setRaidTimer(prev => {
            if (prev === null || prev <= 1) {
              if (raidTimerRef.current) clearInterval(raidTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
  };

  const handleUndo = () => {
    undoLastRaid();
    clearRaidGap();
    if (hasStartedRaiding) setRaidGapTimer(RAID_GAP_TIMEOUT);
    toast({ title: 'Last raid undone', duration: 1500 });
  };

  const handleTimeout = (team?: 'home' | 'away' | 'official') => {
    // If no team specified, show the selector dialog
    if (!team) {
      setShowTimeoutTypeSelector(true);
      return;
    }

    // Official timeout doesn't count against team totals
    if (team === 'official') {
      setIsPaused(true);
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      clearRaidGap();
      addEvent({
        matchId: match.id, eventType: 'timeout', teamId: 'official',
        half: match.currentHalf, value: 0,
      });
      setTimeoutTeam('official');
      setShowTimeoutOverlay(true);
      setShowTimeoutTypeSelector(false);
      return;
    }

    const currentTimeouts = team === 'home' ? match.homeTimeouts : match.awayTimeouts;

    if (currentTimeouts >= MAX_TIMEOUTS) {
      toast({
        title: 'No timeouts left!',
        description: `${team === 'home' ? match.homeTeam : match.awayTeam} has used all ${MAX_TIMEOUTS} timeouts`,
        duration: 2000,
      });
      return;
    }

    if (!hasStartedRaiding) setHasStartedRaiding(true);
    const teamId = team === 'home' ? match.homeTeamId : match.awayTeamId;
    callTimeout(team);
    setIsPaused(true);
    if (raidTimerRef.current) clearInterval(raidTimerRef.current);
    clearRaidGap();
    addEvent({
      matchId: match.id, eventType: 'timeout', teamId,
      half: match.currentHalf, value: 0,
    });
    setTimeoutTeam(team);
    setShowTimeoutOverlay(true);
    setShowTimeoutTypeSelector(false);
  };

  // Quick action handlers for special events
  const handleBonusPoint = () => {
    if (!match) return;
    // Bonus point validation — P-based dynamic rule scaling with fallbacks for old matches
    const bonusEnabled = match.bonusEnabled ?? true;
    const bonusLineThreshold = match.bonusLineThreshold ?? Math.max(1, match.playersPerSide - 1);
    const { onCourtActive: activeDefenders } = splitLineup(fullDefendingLineup, defendingOutIds);
    if (!bonusEnabled) {
      toast({ title: 'Bonus disabled', description: 'Bonus line is turned off for this match format', duration: 2000 });
      return;
    }
    if (activeDefenders.length < bonusLineThreshold) {
      toast({ title: 'Bonus not available', description: `Bonus needs ${bonusLineThreshold}+ defenders on court (currently ${activeDefenders.length})`, duration: 2000 });
      return;
    }
    const teamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id, eventType: 'bonus_point', teamId,
      half: match.currentHalf, value: 1,
      playerId: raider?.id, playerName: raider?.name,
    });
    triggerFeedback(SoundType.WHISTLE);
    setEventConfirm({ message: 'Bonus Point!', teamColor: raidingTeamColor });
  };

  const handleAllOut = () => {
    if (!match) return;
    const teamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id, eventType: 'all_out', teamId,
      half: match.currentHalf, value: (match.allOutBonusPoints ?? 2),
    });
    triggerFeedback(SoundType.WHISTLE);
    setAllOutCelebration({ teamName: raidingTeamName, teamColor: raidingTeamColor });
    setEventConfirm({ message: `All Out! +${(match.allOutBonusPoints ?? 2)}`, teamColor: raidingTeamColor });
  };

  // New handleCardWithPlayer — takes explicit team + player + cardType
  // Used by the Actions panel flow (team → player → card type)
  const handleCardWithPlayer = (side: 'home' | 'away', player: MatchPlayer, cardType: 'green_card' | 'yellow_card' | 'red_card') => {
    if (!match) return;
    const teamId = side === 'home' ? match.homeTeamId : match.awayTeamId;
    const teamColor = side === 'home' ? match.homeTeamColor : match.awayTeamColor;
    // Log the card event for match history
    addEvent({
      matchId: match.id, eventType: cardType, teamId,
      half: match.currentHalf, value: 0,
      playerId: player.id, playerName: player.name,
    });
    // Apply card-specific effects via store actions
    if (cardType === 'green_card') {
      issueGreenCard(side, player.id, player.name);
      setEventConfirm({ message: `🟩 Green Card — Warning to ${player.name}`, teamColor });
    } else if (cardType === 'yellow_card') {
      issueYellowCard(side, player.id, player.name);
      setEventConfirm({ message: `🟨 Yellow Card — ${player.name} suspended 2 min`, teamColor });
    } else if (cardType === 'red_card') {
      issueRedCard(side, player.id, player.name);
      setEventConfirm({ message: `🟥 Red Card — ${player.name} expelled`, teamColor });
    }
  };

  const handleTacklePoint = () => {
    if (!match) return;
    const teamId = defendingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id, eventType: 'tackle_point', teamId,
      half: match.currentHalf, value: 1,
    });
    triggerFeedback(SoundType.WHISTLE);
    setEventConfirm({ message: `${defendingTeamName} +1 Tackle`, teamColor: defendingTeamColor });
  };

  const handleSuperTackle = () => {
    if (!match) return;
    const teamId = defendingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id, eventType: 'super_tackle', teamId,
      half: match.currentHalf, value: 1,
    });
    triggerFeedback(SoundType.WHISTLE);
    setEventConfirm({ message: `${defendingTeamName} +1 Super Tackle!`, teamColor: defendingTeamColor });
  };

  // Self-out handler — handles BOTH raider and defender self-out
  // Key rules:
  //   - Raider self-out → defending team gets +1, raider goes to out queue
  //   - Defender self-out → raiding team gets +1, defender goes to out queue,
  //     raider returns safe (valid empty raid, no points for raider but team gets +1)
  //   - In both cases, check for all-out
  const handleSelfOut = (selfOutPlayer: MatchPlayer) => {
    if (!match || !raider) return;
    const raidingTeamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    const defendingTeamId = defendingTeam === 'home' ? match.homeTeamId : match.awayTeamId;

    // Determine if the self-out player is the raider or a defender
    const isRaiderSelfOut = selfOutPlayer.id === raider.id;
    const events: Omit<MatchEvent, 'id' | 'timestamp'>[] = [];

    if (isRaiderSelfOut) {
      // Raider stepped out → defending team gets the point
      events.push({
        matchId: match.id, eventType: 'self_out', teamId: defendingTeamId,
        half: match.currentHalf,
        value: 1,
        playerId: selfOutPlayer.id,
        playerName: selfOutPlayer.name,
        details: JSON.stringify({ selfOutPlayerId: selfOutPlayer.id, selfOutRole: 'raider', raiderId: raider.id }),
      });
      // Check if raider's team is now all-out (raider was last player)
      const raidingOnCourtActive = splitLineup(fullRaidingLineup, raidingOutIds).onCourtActive;
      if (raidingOnCourtActive.length <= 1) {
        events.push({
          matchId: match.id, eventType: 'all_out', teamId: defendingTeamId,
          half: match.currentHalf, value: (match.allOutBonusPoints ?? 2),
        });
        setAllOutCelebration({ teamName: defendingTeamName, teamColor: defendingTeamColor });
      }
      addBatchEvents(events);
      triggerFeedback(SoundType.WHISTLE);
      setEventConfirm({ message: `Raider ${selfOutPlayer.name} self-out! +1 ${defendingTeamName}`, teamColor: defendingTeamColor });
    } else {
      // Defender stepped out → raiding team gets +1 as a technical point
      // (labeled 'self_out_point'). The raid CONTINUES — raider can still
      // score more points or come back empty. We do NOT end the raid.
      events.push({
        matchId: match.id, eventType: 'technical_point', teamId: raidingTeamId,
        half: match.currentHalf,
        value: 1,
        playerId: selfOutPlayer.id,
        playerName: selfOutPlayer.name,
        details: JSON.stringify({ selfOutPlayerId: selfOutPlayer.id, selfOutRole: 'defender', raiderId: raider.id, reason: 'Defender self-out' }),
      });
      // Send the defender to the out queue
      // (We need to add a self_out event with value=0 so the store knows to
      //  send the defender out, but it won't end the raid since it's a
      //  defender self-out — the raider's team already got the point via
      //  the technical_point event above)
      events.push({
        matchId: match.id, eventType: 'self_out', teamId: raidingTeamId,
        half: match.currentHalf,
        value: 0, // 0 points — the point was already given via technical_point
        playerId: selfOutPlayer.id,
        playerName: selfOutPlayer.name,
        details: JSON.stringify({ selfOutPlayerId: selfOutPlayer.id, selfOutRole: 'defender', raiderId: raider.id }),
      });
      // Check if defending team is now all-out
      const { onCourt } = splitLineup(fullDefendingLineup, defendingOutIds);
      const defendingOnCourtOut = onCourt.filter(p => [...defendingOutIds, selfOutPlayer.id].includes(p.id)).length;
      if (defendingOnCourtOut >= onCourt.length) {
        events.push({
          matchId: match.id, eventType: 'all_out', teamId: raidingTeamId,
          half: match.currentHalf, value: (match.allOutBonusPoints ?? 2),
        });
        setAllOutCelebration({ teamName: raidingTeamName, teamColor: raidingTeamColor });
      }
      addBatchEvents(events);
      triggerFeedback(SoundType.WHISTLE);
      setEventConfirm({ message: `Defender ${selfOutPlayer.name} self-out! +1 ${raidingTeamName} (raid continues)`, teamColor: raidingTeamColor });
      // Do NOT reset raid state — raid continues!
      // Just close the self-out modal
      setSelfOutConfirm(null);
      setSelfOutSelection(null);
      return; // Skip the raid-ending logic below
    }

    // End the raid (turn swaps to other team) — ONLY for raider self-out
    setRaidPhase('idle');
    setRaider(null);
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);
    setSelfOutConfirm(null);
  };

  // Substitute handler
  const handleSub = (outPlayer: MatchPlayer, inPlayer: MatchPlayer) => {
    const teamId = outPlayer.team === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id,
      eventType: 'substitution' as const,
      teamId,
      half: match.currentHalf,
      playerId: inPlayer.id,
      playerName: inPlayer.name,
      value: 0,
      details: JSON.stringify({ outPlayerId: outPlayer.id, outPlayerName: outPlayer.name, inPlayerId: inPlayer.id }),
    });

    const store = useKabaddiStore.getState();
    const m = store.activeMatch;
    if (!m) return;

    const swapInLineup = (lineup: MatchPlayer[]) => {
      const outIdx = lineup.findIndex(p => p.id === outPlayer.id);
      const inIdx = lineup.findIndex(p => p.id === inPlayer.id);
      if (outIdx === -1 || inIdx === -1) return lineup;
      const newLineup = [...lineup];
      [newLineup[outIdx], newLineup[inIdx]] = [newLineup[inIdx], newLineup[outIdx]];
      return newLineup;
    };

    if (outPlayer.team === 'home') {
      useKabaddiStore.setState({
        activeMatch: { ...m, homeLineup: swapInLineup(m.homeLineup) },
      });
    } else {
      useKabaddiStore.setState({
        activeMatch: { ...m, awayLineup: swapInLineup(m.awayLineup) },
      });
    }

    setShowSubMode(null);
    setSubInPlayer(null);
    toast({ title: `${inPlayer.name} subs in for ${outPlayer.name}`, duration: 2000 });
  };

  // Add player mid-match handler
  const handleAddPlayer = () => {
    if (!addPlayerTeam || !addPlayerName.trim() || !addPlayerPhone.trim()) return;
    const lineup = addPlayerTeam === 'home' ? match.homeLineup : match.awayLineup;
    const maxSquad = match.playersPerSide + 5;
    if (lineup.length >= maxSquad) {
      toast({ title: 'Squad full', description: `Maximum ${maxSquad} players allowed`, duration: 2000 });
      return;
    }
    // Check if phone number already exists in the lineup (one phone = one player)
    const phoneExists = lineup.some(p => p.phone === addPlayerPhone.trim());
    if (phoneExists) {
      toast({ title: 'Player already in squad', description: 'This phone number is already registered for a player in this team', duration: 3000 });
      return;
    }
    // Check search results for an existing user ID to use
    const existingPlayer = addPlayerSearchResults.find(p => p.phone === addPlayerPhone.trim());
    const newPlayer: MatchPlayer = {
      id: existingPlayer?.id || `phone_${addPlayerPhone.trim()}`,
      name: addPlayerName.trim(),
      phone: addPlayerPhone.trim(),
      jerseyNumber: existingPlayer?.jerseyNumber || lineup.length + 1,
      team: addPlayerTeam,
      playerCode: existingPlayer?.playerCode || undefined,
    };
    addPlayerToMatch(addPlayerTeam, newPlayer);
    const teamName = addPlayerTeam === 'home' ? match.homeTeam : match.awayTeam;
    toast({ title: `${newPlayer.name} added to ${teamName}`, description: `📱 ${newPlayer.phone} • Squad: ${lineup.length + 1}`, duration: 2000 });
    triggerFeedback(SoundType.WHISTLE);
    setAddPlayerName('');
    setAddPlayerPhone('');
    setAddPlayerSearchResults([]);
    setShowAddPlayer(false);
    setAddPlayerTeam(null);
  };

  // ─── Player Card Component (Rectangular) ───
  const PlayerCard = ({
    player,
    isOut,
    isRaiding,
    isSelectable,
    isDefending,
    isSelected,
    teamColor,
    onSelect,
    showCheck,
    size = 'normal',
  }: {
    player: MatchPlayer;
    isOut: boolean;
    isRaiding?: boolean;
    isSelectable?: boolean;
    /** True when this player is on the defending team and cannot be selected as raider */
    isDefending?: boolean;
    isSelected?: boolean;
    teamColor: string;
    onSelect?: (p: MatchPlayer) => void;
    showCheck?: boolean;
    size?: 'normal' | 'small';
  }) => {
    const profile = playerProfiles[player.id];
    const initials = player.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const isSmall = size === 'small';

    // Player stat bubbles (only for normal size)
    const pts = !isSmall ? getPlayerPoints(player.id) : null;

    // Position label
    const positionLabel = player.isCaptain ? 'Captain' : '';

    return (
      <motion.button
        whileTap={isSelectable && !isOut ? { scale: 0.95 } : {}}
        onClick={() => isSelectable && !isOut && onSelect?.(player)}
        className={`relative w-full rounded-md overflow-hidden transition-all text-left ${
          isSelectable && !isOut ? 'cursor-pointer' : 'cursor-default'
        } ${isOut ? 'opacity-40' : isDefending ? 'opacity-60' : ''} ${
          isRaiding ? 'ring-1 ring-yellow-400' : isSelected ? 'ring-1 ring-white scale-[1.02]' : ''
        }`}
        style={{
          backgroundColor: isOut ? '#1f2937' : `${teamColor}18`,
          borderLeft: `3px solid ${isOut ? '#4b5563' : teamColor}`,
        }}
      >
        <div className={`flex items-center gap-2.5 ${isSmall ? 'px-1.5 py-1' : 'px-3 py-2.5'}`}>
          {/* Avatar circle — MUCH bigger for clear player identification */}
          <div
            className={`relative flex-shrink-0 rounded-full overflow-hidden ${isSmall ? 'w-8 h-8' : 'w-14 h-14'}`}
            style={{
              borderWidth: '2px',
              borderStyle: isOut ? 'dashed' : 'solid',
              borderColor: isOut ? '#6b7280' : teamColor,
            }}
          >
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={player.name}
                className="w-full h-full object-cover"
                style={{ filter: isOut ? 'grayscale(100%)' : 'none' }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: `${teamColor}30` }}
              >
                <span className={(isSmall ? 'text-[8px] ' : 'text-base ') + 'font-black'} style={{ color: isOut ? '#6b7280' : teamColor }}>
                  {initials}
                </span>
              </div>
            )}

            {/* OUT overlay */}
            {isOut && (
              <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center">
                <X className={`${isSmall ? 'w-3 h-3' : 'w-5 h-5'} text-red-400`} strokeWidth={3} />
              </div>
            )}

            {/* Selected checkmark */}
            {isSelected && showCheck && (
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center border border-white">
                <Check className="w-2 h-2 text-white" />
              </div>
            )}
          </div>

          {/* Player info — bigger and bolder for better readability */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {player.jerseyNumber && (
                <span
                  className={(isSmall ? 'text-[8px] ' : 'text-sm ') + 'font-black leading-none px-1.5 py-0.5 rounded-md'}
                  style={{ color: isOut ? '#6b7280' : '#fff', backgroundColor: isOut ? 'transparent' : (teamColor + '40') }}
                >
                  #{player.jerseyNumber}
                </span>
              )}
              <span className={(isSmall ? 'text-[8px] ' : 'text-sm ') + 'font-bold text-warm-800 dark:text-gray-100 truncate leading-tight'}>
                {player.name.split(' ').length > 1
                  ? `${player.name.split(' ')[0]} ${player.name.split(' ')[1][0]}.`
                  : player.name.split(' ')[0]
                }
              </span>
            </div>
            {/* Position / Captain label */}
            {(positionLabel || (pts && (pts.raid > 0 || pts.tackle > 0) && !isOut)) && (
              <div className="flex items-center gap-1 mt-0.5">
                {positionLabel && !isOut && (
                  <span
                    className={(isSmall ? 'text-[5px] ' : 'text-[6px] ') + 'font-bold uppercase tracking-wider px-1 py-0 rounded-sm'}
                    style={{ backgroundColor: `${teamColor}30`, color: teamColor }}
                  >
                    {positionLabel}
                  </span>
                )}
                {pts && pts.raid > 0 && !isOut && (
                  <span className="inline-flex items-center gap-0.5 text-[5px] font-bold px-0.5 rounded-sm bg-red-900/40 text-red-400">
                    <Zap className="w-1.5 h-1.5" />{pts.raid}
                  </span>
                )}
                {pts && pts.tackle > 0 && !isOut && (
                  <span className="inline-flex items-center gap-0.5 text-[5px] font-bold px-0.5 rounded-sm bg-teal-900/40 text-teal-400">
                    <Shield className="w-1.5 h-1.5" />{pts.tackle}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Raiding glow animation */}
        {isRaiding && (
          <motion.div
            className="absolute inset-0 rounded-md pointer-events-none"
            animate={{
              boxShadow: [
                `0 0 4px 1px rgba(234, 179, 8, 0.2)`,
                `0 0 12px 4px rgba(234, 179, 8, 0.4)`,
                `0 0 4px 1px rgba(234, 179, 8, 0.2)`,
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </motion.button>
    );
  };

  // ─── Render Team Panel (Side-by-side / Horizontal Layout) ───
  const TeamPanel = ({
    side,
    teamName,
    teamColor,
    score,
    raidPts,
    tacklePts,
    fullLineup,
    outIds,
    isRaidingSide,
    timeoutsUsed,
  }: {
    side: 'home' | 'away';
    teamName: string;
    teamColor: string;
    score: number;
    raidPts: number;
    tacklePts: number;
    fullLineup: MatchPlayer[];
    outIds: string[];
    isRaidingSide: boolean;
    timeoutsUsed: number;
  }) => {
    const isIdle = raidPhase === 'idle';
    // Strict turn lock: can only select raider when it's your turn AND not in transition
    const canSelect = isRaidingSide && isIdle && !isTurnTransitioning;
    const { onCourt, substitutes, onCourtActive, onCourtOut } = splitLineup(fullLineup, outIds);
    const timeoutsLeft = Math.max(0, MAX_TIMEOUTS - timeoutsUsed);

    return (
      <div className={`flex flex-col h-full transition-colors duration-300 ${
        isRaidingSide && isIdle
          ? 'bg-gradient-to-b from-warm-100 to-warm-200 dark:from-gray-900 dark:to-gray-950'
          : isRaidingSide
            ? 'bg-gradient-to-b from-warm-100/90 to-warm-200/90 dark:from-gray-900/90 dark:to-gray-950/90'
            : 'bg-warm-100/95 dark:bg-gray-900/95'
      }`} style={{ borderRight: side === 'home' ? `2px solid ${teamColor}30` : undefined, borderLeft: side === 'away' ? `2px solid ${teamColor}30` : undefined }}>
        {/* Team header with name, score, turn indicator */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b" style={{ borderColor: `${teamColor}30`, backgroundColor: `${teamColor}10` }}>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0"
              style={{ backgroundColor: teamColor }}
            >
              {teamName.charAt(0)}
            </div>
            <span className="text-xs font-black text-white truncate" style={{ color: teamColor }}>
              {teamName}
            </span>
            {/* Turn indicator badge */}
            {isRaidingSide ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-0.5 text-[6px] font-black px-1 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 uppercase tracking-wider"
              >
                <Swords className="w-2 h-2" />
                RAID
              </motion.span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[6px] font-bold px-1 py-0.5 rounded-full bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-400 uppercase tracking-wider">
                <Shield className="w-2 h-2" />
                DEF
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] text-gray-400">
              {onCourtActive.length}/{onCourt.length}
            </span>
            {onCourtOut.length > 0 && (
              <span className="text-[7px] font-bold text-red-400">
                {onCourtOut.length} out
              </span>
            )}
            <span className="text-[7px] text-orange-400/70">
              ⏱{timeoutsLeft}
            </span>
            {/* Substitute button */}
            {substitutes.length > 0 && (
              <button
                onClick={() => setShowSubMode(side)}
                className="flex items-center gap-0.5 text-[7px] font-bold px-1.5 py-0.5 rounded-md transition-colors"
                style={{
                  backgroundColor: `${teamColor}20`,
                  color: teamColor,
                }}
              >
                <ArrowLeftRight className="w-2.5 h-2.5" />
                SUB
              </button>
            )}
          </div>
        </div>

        {/* Score display for this team */}
        <div className="flex items-center justify-center py-1" style={{ backgroundColor: `${teamColor}08` }}>
          <span className="text-3xl font-black" style={{ color: teamColor }}>{score}</span>
          <div className="flex flex-col ml-2 gap-0">
            <span className="text-[7px] text-emerald-400 font-bold">⚡{raidPts}</span>
            <span className="text-[7px] text-teal-400 font-bold">🛡{tacklePts}</span>
          </div>
        </div>

        {/* On Court players (vertical list of cards) — substitutes NOT shown here */}
        <div className="flex-1 overflow-y-auto min-h-0 px-1.5 py-1">
          <div className="flex flex-col gap-1">
            {onCourt.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                isOut={outIds.includes(player.id)}
                isRaiding={isRaidingSide && raider?.id === player.id && raidPhase !== 'idle'}
                isSelectable={canSelect && !outIds.includes(player.id)}
                isDefending={!isRaidingSide && !outIds.includes(player.id) && raidPhase === 'idle'}
                teamColor={teamColor}
                onSelect={handleSelectRaider}
              />
            ))}
          </div>
        </div>

        {/* Substitutes tab — tap to open substitution modal (not shown inline) */}
        {substitutes.length > 0 && (
          <div className="px-1.5 pb-1 shrink-0">
            <button
              onClick={() => setShowSubMode(side)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-colors"
              style={{
                backgroundColor: `${teamColor}15`,
                border: `1px dashed ${teamColor}40`,
              }}
            >
              <ArrowLeftRight className="w-3 h-3" style={{ color: teamColor }} />
              <span className="text-[9px] font-bold" style={{ color: teamColor }}>
                SUBSTITUTES ({substitutes.length})
              </span>
            </button>
          </div>
        )}

        {/* Raid / Defending indicator */}
        {isRaidingSide && isIdle && (
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="px-2 pb-1.5 text-center shrink-0"
          >
            <span
              className="inline-flex items-center gap-0.5 text-[7px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${teamColor}20`, color: teamColor }}
            >
              <motion.span animate={{ y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
                <ChevronUp className="w-2 h-2" />
              </motion.span>
              TAP TO RAID
            </span>
          </motion.div>
        )}
        {!isRaidingSide && isIdle && (
          <div className="px-2 pb-1.5 text-center shrink-0">
            <span className="inline-flex items-center gap-0.5 text-[7px] font-bold px-2 py-0.5 rounded-full bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-400 uppercase tracking-wider">
              <Shield className="w-2 h-2" />
              DEFENDING
            </span>
          </div>
        )}
      </div>
    );
  };

  // Raid timer progress percentage
  const raidTimerPercent = raidTimer !== null ? (raidTimer / RAID_TIME_LIMIT) * 100 : 100;
  const raidTimerColor = raidTimer !== null
    ? raidTimer > 15 ? '#22c55e'
      : raidTimer > 5 ? '#f59e0b'
        : '#ef4444'
    : '#22c55e';

  // Raid gap indicator
  const showGapIndicator = raidGapTimer !== null && raidGapTimer > 0 && raidPhase === 'idle';

  // Recent events for compact log (last 5)
  const recentEvents = match.events.slice(-5);
  const allEvents = match.events;

  return (
    <div className="flex flex-col h-screen bg-warm-50 dark:bg-warm-950">
      {/* Share Scorecard Overlay */}
      {showShareScorecard && savedMatchData && (
        <ShareScorecard onClose={() => setShowShareScorecard(false)} matchData={savedMatchData} />
      )}

      {/* Scorer Transfer Overlay */}
      {showScorerTransfer && (
        <ScorerTransferScreen
          onClose={() => setShowScorerTransfer(false)}
          activeMatch={match}
        />
      )}

      {/* Match End Screen (no animations for scorer) */}
      {showMatchEndCelebration && savedMatchData && (
        <MatchEndScreen
          homeTeam={savedMatchData.homeTeam}
          awayTeam={savedMatchData.awayTeam}
          homeScore={savedMatchData.homeScore}
          awayScore={savedMatchData.awayScore}
          homeColor={savedMatchData.homeTeamColor}
          awayColor={savedMatchData.awayTeamColor}
          motm={motmPlayer}
          onShare={() => setShowShareScorecard(true)}
          onDone={() => setShowMatchEndCelebration(false)}
        />
      )}

      {/* Half Time Screen (no animations for scorer) */}
      {showHalfTimeTransition && (
        <HalfTimeScreen
          half={match.currentHalf}
          homeTeam={match.homeTeam}
          awayTeam={match.awayTeam}
          homeScore={match.homeScore}
          awayScore={match.awayScore}
          homeColor={match.homeTeamColor}
          awayColor={match.awayTeamColor}
          onContinue={() => setShowHalfTimeTransition(false)}
        />
      )}

      {/* All Out / Super Raid celebrations removed from scorer screen */}

      {/* Self-Out Confirmation Popup */}
      <AnimatePresence>
        {selfOutConfirm && raidPhase === 'result' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-xs rounded-2xl p-5 text-center bg-white dark:bg-warm-800 border border-red-700/50"
            >
              <div className="text-3xl mb-2">🚫</div>
              <h3 className="text-base font-black text-warm-800 dark:text-warm-100">Self-Out?</h3>
              <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
                Did <span className="font-bold text-white">{selfOutConfirm.name}</span> step off the mat?
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                {raidingTeamName} gets +1 point
              </p>
              <div className="flex gap-3 mt-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelfOutConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-700 dark:bg-warm-700 text-gray-300 font-bold text-sm"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelfOut(selfOutConfirm)}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm"
                >
                  Confirm Self-Out
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeout Type Selector */}
      {showTimeoutTypeSelector && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xs rounded-2xl p-5 text-center bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700">
            <Hand className="w-8 h-8 text-orange-500 mx-auto mb-3" />
            <h3 className="text-lg font-black text-warm-800 dark:text-warm-100 mb-1">Timeout</h3>
            <p className="text-xs text-gray-400 mb-4">Who called this timeout?</p>

            <div className="space-y-2">
              {/* Home Team */}
              <button
                onClick={() => handleTimeout('home')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-warm-300 dark:border-warm-600 hover:border-warm-400 dark:hover:border-warm-500 transition-colors"
                style={{ backgroundColor: `${match.homeTeamColor}15` }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: match.homeTeamColor }}>
                  {match.homeTeam.charAt(0)}
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-white">{match.homeTeam}</p>
                  <p className="text-[10px] text-gray-400">{match.homeTimeouts}/{MAX_TIMEOUTS} used</p>
                </div>
                {match.homeTimeouts >= MAX_TIMEOUTS && (
                  <span className="text-[9px] font-bold text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">MAX</span>
                )}
              </button>

              {/* Away Team */}
              <button
                onClick={() => handleTimeout('away')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-warm-300 dark:border-warm-600 hover:border-warm-400 dark:hover:border-warm-500 transition-colors"
                style={{ backgroundColor: `${match.awayTeamColor}15` }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: match.awayTeamColor }}>
                  {match.awayTeam.charAt(0)}
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-white">{match.awayTeam}</p>
                  <p className="text-[10px] text-gray-400">{match.awayTimeouts}/{MAX_TIMEOUTS} used</p>
                </div>
                {match.awayTimeouts >= MAX_TIMEOUTS && (
                  <span className="text-[9px] font-bold text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">MAX</span>
                )}
              </button>

              {/* Official Timeout */}
              <button
                onClick={() => handleTimeout('official')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-warm-300 dark:border-warm-600 hover:border-warm-400 dark:hover:border-warm-500 transition-colors bg-gray-800/50"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-600 text-white">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-white">Official Timeout</p>
                  <p className="text-[10px] text-gray-400">No team limit</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowTimeoutTypeSelector(false)}
              className="w-full mt-3 py-2.5 rounded-xl border border-gray-600 text-warm-600 dark:text-gray-300 font-semibold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timeout Overlay (2 minutes) */}
      {showTimeoutOverlay && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-xs rounded-2xl p-6 text-center bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700"
            style={{ borderTopColor: timeoutTeam === 'home' ? match.homeTeamColor : timeoutTeam === 'away' ? match.awayTeamColor : '#f97316', borderTopWidth: '4px' }}
          >
            <Hand className="w-10 h-10 text-orange-500 mx-auto mb-3" />
            <h3 className="text-lg font-black text-warm-800 dark:text-warm-100">
              {timeoutTeam === 'official' ? 'Official Timeout' : 'Timeout'}
            </h3>
            <p className="text-sm text-warm-500 dark:text-warm-400 mb-3">
              {timeoutTeam === 'official'
                ? 'Officials called a timeout'
                : timeoutTeam === 'home'
                  ? `${match.homeTeam} called a timeout (${match.homeTimeouts}/${MAX_TIMEOUTS})`
                  : `${match.awayTeam} called a timeout (${match.awayTimeouts}/${MAX_TIMEOUTS})`
              }
            </p>
            <div className="relative w-24 h-24 mx-auto mb-3">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="42" fill="none" stroke="#374151" strokeWidth="4" />
                <circle cx="48" cy="48" r="42" fill="none" stroke="#f97316" strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - timeoutCountdown / TIMEOUT_DURATION)}`}
                  strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-black text-orange-500 font-mono">{formatTime(timeoutCountdown)}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-1 mb-3 text-[10px] text-gray-400">
              <Clock className="w-3 h-3" />
              <span>{Math.floor(timeoutCountdown / 60)}:{(timeoutCountdown % 60).toString().padStart(2, '0')} remaining</span>
            </div>
            <button
              onClick={() => {
                setShowTimeoutOverlay(false);
                setIsPaused(false);
              }}
              className="w-full py-2.5 rounded-xl bg-brand-red text-white font-bold text-sm"
            >
              Resume Play
            </button>
          </div>
        </div>
      )}

      {/* Substitute Mode Overlay — Tap sub IN first, then pick who goes OUT */}
      {showSubMode && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center">
          <div className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-black text-warm-800 dark:text-warm-100">Substitution</div>
                <div className="text-[10px] text-gray-400 dark:text-warm-500">
                  {subInPlayer
                    ? `Now tap an on-court player to sub OUT for ${subInPlayer.name}`
                    : 'Tap a substitute player to bring IN'}
                </div>
              </div>
              <button
                onClick={() => { setShowSubMode(null); setSubInPlayer(null); }}
                className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-warm-500 dark:text-warm-400" />
              </button>
            </div>

            {(() => {
              const lineup = showSubMode === 'home' ? match.homeLineup : match.awayLineup;
              const teamColor = showSubMode === 'home' ? match.homeTeamColor : match.awayTeamColor;
              const outIds = showSubMode === 'home' ? match.homeOutPlayerIds : match.awayOutPlayerIds;
              const { onCourt, substitutes: subs } = splitLineup(lineup, outIds);

              return (
                <div>
                  {/* If no sub selected yet, show substitutes to pick from */}
                  {!subInPlayer ? (
                    <div>
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        Substitutes — Tap who comes IN
                      </div>
                      {subs.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">No substitutes available</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {subs.map(player => (
                            <button
                              key={player.id}
                              onClick={() => setSubInPlayer(player)}
                              className="flex items-center gap-2 p-2 rounded-xl hover:bg-warm-100 dark:hover:bg-warm-700 transition-colors text-left"
                            >
                              <PlayerCard
                                player={player}
                                isOut={false}
                                isSelectable={false}
                                teamColor={teamColor}
                              />
                              <ChevronUp className="w-4 h-4 text-green-400 ml-auto" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Sub selected — show on-court players to pick who goes OUT */
                    <div>
                      {/* Selected sub indicator */}
                      <div className="flex items-center gap-2 p-2 rounded-xl mb-3 border border-green-700/40" style={{ backgroundColor: `${teamColor}15` }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: teamColor }}>
                          {subInPlayer.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-green-400">COMING IN:</span>
                          <span className="text-[11px] font-bold text-gray-200 ml-1">{subInPlayer.name}</span>
                          {subInPlayer.jerseyNumber && <span className="text-[10px] text-gray-400 ml-1">#{subInPlayer.jerseyNumber}</span>}
                        </div>
                        <button onClick={() => setSubInPlayer(null)} className="text-[9px] text-gray-400 hover:text-white">Change</button>
                      </div>

                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                        On Court — Tap who goes OUT
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {onCourt.map(player => {
                          const isOut = outIds.includes(player.id);
                          return (
                            <button
                              key={player.id}
                              onClick={() => !isOut && handleSub(player, subInPlayer)}
                              disabled={isOut}
                              className={`flex items-center gap-2 p-2 rounded-xl transition-colors text-left ${
                                isOut ? 'opacity-40 cursor-not-allowed' : 'hover:bg-red-900/20 cursor-pointer'
                              }`}
                            >
                              <PlayerCard
                                player={player}
                                isOut={isOut}
                                isSelectable={!isOut}
                                teamColor={teamColor}
                              />
                              {!isOut && (
                                <span className="ml-auto text-[9px] font-bold text-red-400 flex items-center gap-0.5">
                                  <ArrowLeftRight className="w-3 h-3" /> OUT
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* MOTM Celebration Overlay (legacy path) */}
      <AnimatePresence>
        {showMotmOverlay && motmPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="w-full max-w-sm bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/20 dark:to-warm-800 rounded-3xl p-6 text-center"
            >
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, -5, 0] }} transition={{ duration: 1, repeat: 3 }} className="text-5xl mb-3">🏆</motion.div>
              <div className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 rounded-full inline-flex items-center gap-1 mb-3">
                <Crown className="w-3 h-3" /> MAN OF THE MATCH
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-warm-100">{motmPlayer.name}</h3>
              <p className="text-yellow-700 dark:text-yellow-400 font-bold text-lg mt-1">{motmPlayer.points} points</p>
              <p className="text-gray-500 dark:text-warm-400 text-sm mt-2">Top scorer in {match.homeTeam} vs {match.awayTeam}</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowShareScorecard(true)} className="flex-1 bg-brand-red hover:bg-red-700 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-1">
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button onClick={() => setShowMotmOverlay(false)} className="flex-1 bg-gray-100 dark:bg-warm-700 hover:bg-gray-200 dark:hover:bg-warm-600 text-gray-700 dark:text-warm-200 font-bold rounded-xl py-3">
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Confirmation Toast */}
      <AnimatePresence>
        {eventConfirm && (
          <EventConfirmation
            message={eventConfirm.message}
            teamColor={eventConfirm.teamColor}
            onUndo={() => {
              undoLastEvent();
              toast({ title: 'Event undone', duration: 1500 });
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══ COMPACT TOP INFO BAR ═══ */}
      <div className="relative overflow-hidden shrink-0 bg-warm-100 dark:bg-gray-900 border-b border-warm-200 dark:border-gray-800">
        {/* Top info row */}
        <div className="relative px-2 pt-1 pb-0.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[8px] bg-gray-700/80 px-1.5 py-0.5 rounded font-medium text-gray-300">
              7v7
            </span>
            {match.isPractice && (
              <span className="text-[8px] bg-green-900/60 text-green-300 px-1.5 py-0.5 rounded font-medium">Practice</span>
            )}
          </div>
          {/* ═══ PROMINENT MATCH TIMER ═══ */}
          <div className="flex items-center gap-1.5">
            <span className={`text-[7px] font-bold tracking-wider uppercase ${
              match.currentHalf === 1 ? 'text-emerald-400' : 'text-purple-400'
            }`}>
              {match.currentHalf === 1 ? '1st Half' : '2nd Half'}
            </span>
            <motion.div
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono font-black tabular-nums',
                isTimerPulsing && 'animate-pulse',
              )}
              style={{
                backgroundColor: isTimerPulsing ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isTimerPulsing ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
              }}
              animate={isTimerPulsing ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.8, repeat: isTimerPulsing ? Infinity : 0 }}
            >
              <Clock className="w-3 h-3" style={{ color: isTimerPulsing ? '#ef4444' : '#9ca3af' }} />
              <span className="text-sm font-black" style={{ color: isTimerPulsing ? '#ef4444' : '#e5e7eb' }}>
                {!hasStartedRaiding ? '--:--' : formatTime(match.timer)}
              </span>
            </motion.div>
            {/* Half indicator badge */}
            <motion.div
              key={halfLabel}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-[8px] font-black tracking-[0.12em] px-2 py-0.5 rounded-full ${
                halfLabel === 'HALF TIME' || halfLabel === 'FULL TIME'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : halfLabel === 'NOT STARTED'
                    ? 'bg-gray-600/40 text-gray-400 border border-gray-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {halfLabel}
            </motion.div>
          </div>
          <div className="text-[8px] text-gray-400 font-medium flex items-center gap-1">
            <span>{match.gender === 'male' ? '♂' : '♀'}</span>
            {match.weightCategory && (
              <span className="text-amber-400/80">⚖️{match.weightCategory === 'open' ? 'Open' : match.weightCategory}</span>
            )}
            {match.liveStreamUrl && (
              <button
                onClick={() => window.open(match.liveStreamUrl, '_blank')}
                className="ml-1 px-1.5 py-0.5 rounded bg-red-500/80 text-white text-[7px] font-bold flex items-center gap-0.5 hover:bg-red-500 transition-colors"
              >
                <Radio className="w-2 h-2" />LIVE
              </button>
            )}
            {/* Permanent Actions button — always visible during the match */}
            <button
              onClick={() => setShowActionsPanel(true)}
              className="ml-1 px-2 py-0.5 rounded bg-white/10 text-white text-[8px] font-bold flex items-center gap-0.5 hover:bg-white/20 transition-colors"
            >
              ⚡ Actions
            </button>
          </div>
        </div>

        {/* ═══ RAID TIMER BAR ═══ */}
        <AnimatePresence>
          {raidTimer !== null && raidPhase !== 'idle' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-3 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 flex-shrink-0" style={{ color: raidTimerColor }} />
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: raidTimerColor }} animate={{ width: `${raidTimerPercent}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <span className="text-xs font-mono font-black min-w-[24px] text-right" style={{ color: raidTimerColor }}>{raidTimer}</span>
                </div>
                {raidTimer <= 5 && raidTimer > 0 && (
                  <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-center text-[8px] font-bold mt-0.5" style={{ color: raidTimerColor }}>
                    RAID TIME RUNNING OUT!
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ RAID GAP INDICATOR ═══ */}
        <AnimatePresence>
          {showGapIndicator && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-3 pb-1 flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[8px] text-amber-400 font-bold">
                  Timer pauses in {raidGapTimer}s — Select a raider!
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ YELLOW CARD SUSPENSION TIMERS ═══ */}
      {/* Shows active 2-min suspensions with live countdown. When timer hits 0,
          a "Release" button appears so the scorer can let the player back on. */}
      {match.yellowCardSuspensions?.filter(s => !s.released).length > 0 && (
        <div className="px-2 py-1.5 bg-yellow-900/30 border-b border-yellow-700/30">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[8px] font-bold text-yellow-400 uppercase tracking-wider shrink-0">
              🟨 Suspended:
            </span>
            {match.yellowCardSuspensions.filter(s => !s.released).map(s => {
              // 2-min countdown: 120 seconds from suspension time
              const elapsed = s.suspendedAtMatchTime - match.timer;
              const remaining = Math.max(0, 120 - elapsed);
              const isReady = remaining <= 0;
              return (
                <div
                  key={s.playerId}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    isReady ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-600/50 animate-pulse' : 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
                  }`}
                >
                  <span className="truncate max-w-[60px]">{s.playerName}</span>
                  {isReady ? (
                    <>
                      <span className="text-emerald-400">READY</span>
                      <button
                        onClick={() => releaseYellowCard(s.playerId)}
                        className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] font-black hover:bg-emerald-400 transition-colors"
                      >
                        RELEASE
                      </button>
                    </>
                  ) : (
                    <span className="font-mono tabular-nums">
                      {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ TURN INDICATOR — Always visible during idle, enhanced during transition ═══ */}
      {hasStartedRaiding && raidPhase === 'idle' && (
        <AnimatePresence mode="wait">
          <motion.div
            key={raidingTeam + (isTurnTransitioning ? '-swap' : '-idle')}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.3 }}
            className="origin-top overflow-hidden"
          >
            <div
              className="flex items-center justify-center gap-2 py-1.5 px-3"
              style={{
                backgroundColor: isTurnTransitioning ? `${raidingTeamColor}25` : `${raidingTeamColor}10`,
                borderBottom: `2px solid ${raidingTeamColor}${isTurnTransitioning ? '60' : '25'}`,
              }}
            >
              {isTurnTransitioning ? (
                /* Dramatic turn-swap animation */
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ x: raidingTeam === 'home' ? 30 : -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                >
                  <motion.div
                    animate={{ rotate: [0, raidingTeam === 'home' ? -180 : 180, 0] }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                  >
                    <ArrowRightLeft className="w-4 h-4" style={{ color: raidingTeamColor }} />
                  </motion.div>
                  <span className="text-[10px] font-black tracking-wider" style={{ color: raidingTeamColor }}>
                    TURN → {raidingTeamName}'S RAID
                  </span>
                  {match.isDoOrDie && match.doOrDieTeamId === (raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId) && (
                    <motion.span
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="text-xs"
                    >
                      🔥
                    </motion.span>
                  )}
                </motion.div>
              ) : (
                /* Subtle persistent turn indicator */
                <div className="flex items-center gap-1.5">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Swords className="w-3 h-3" style={{ color: raidingTeamColor }} />
                  </motion.div>
                  <span className="text-[9px] font-black tracking-wider" style={{ color: raidingTeamColor }}>
                    {raidingTeamName}'S RAID
                  </span>
                  {match.isDoOrDie && match.doOrDieTeamId === (raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId) && (
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      <Flame className="w-3 h-3 text-orange-500" />
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ═══ SIDEWAYS KABADDI MAT: Home (left) | Center | Away (right) ═══ */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Home Team - LEFT */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TeamPanel
            side="home"
            teamName={match.homeTeam}
            teamColor={match.homeTeamColor}
            score={match.homeScore}
            raidPts={homeRaidPoints}
            tacklePts={homeTacklePoints}
            fullLineup={match.homeLineup}
            outIds={match.homeOutPlayerIds}
            isRaidingSide={raidingTeam === 'home'}
            timeoutsUsed={match.homeTimeouts}
          />
        </div>

        {/* ═══ Thin divider line between teams ═══ */}
        <div className="shrink-0 w-[2px] border-x border-gray-700/30" style={{
          background: `linear-gradient(180deg, ${match.homeTeamColor}40, ${match.awayTeamColor}40)`,
        }} />

        {/* Away Team - RIGHT */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TeamPanel
            side="away"
            teamName={match.awayTeam}
            teamColor={match.awayTeamColor}
            score={match.awayScore}
            raidPts={awayRaidPoints}
            tacklePts={awayTacklePoints}
            fullLineup={match.awayLineup}
            outIds={match.awayOutPlayerIds}
            isRaidingSide={raidingTeam === 'away'}
            timeoutsUsed={match.awayTimeouts}
          />
        </div>
      </div>

      {/* ═══ OUT PLAYERS SECTION ═══ */}
      {(match.homeOutPlayerIds.length > 0 || match.awayOutPlayerIds.length > 0) && (
        <div className="shrink-0 border-t border-gray-700/50 px-2 py-1.5" style={{
          background: `linear-gradient(135deg, rgba(239,68,68,0.05), #111827, rgba(239,68,68,0.05))`,
        }}>
          <div className="flex items-start gap-3">
            {/* Home OUT players */}
            <div className="flex-1 min-w-0">
              {match.homeOutPlayerIds.length > 0 && (
                <div>
                  <div className="text-[7px] font-bold text-red-400/80 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                    <X className="w-2 h-2" />
                    OUT ({match.homeOutPlayerIds.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {match.homeOutPlayerIds.map((pid, idx) => {
                      const player = match.homeLineup.find(p => p.id === pid);
                      if (!player) return null;
                      return (
                        <motion.div
                          key={pid}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-red-900/20 border border-red-800/30"
                        >
                          <span className="text-[7px] font-bold text-red-400/70">{idx + 1}.</span>
                          {player.jerseyNumber && (
                            <span className="text-[8px] font-black" style={{ color: match.homeTeamColor }}>#{player.jerseyNumber}</span>
                          )}
                          <span className="text-[8px] font-semibold text-gray-300 truncate max-w-[60px]">
                            {player.name.split(' ').length > 1
                              ? `${player.name.split(' ')[0]} ${player.name.split(' ')[1][0]}.`
                              : player.name.split(' ')[0]
                            }
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {/* Away OUT players */}
            <div className="flex-1 min-w-0">
              {match.awayOutPlayerIds.length > 0 && (
                <div>
                  <div className="text-[7px] font-bold text-red-400/80 uppercase tracking-wider mb-0.5 flex items-center gap-1 justify-end">
                    OUT ({match.awayOutPlayerIds.length})
                    <X className="w-2 h-2" />
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {match.awayOutPlayerIds.map((pid, idx) => {
                      const player = match.awayLineup.find(p => p.id === pid);
                      if (!player) return null;
                      return (
                        <motion.div
                          key={pid}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-red-900/20 border border-red-800/30"
                        >
                          <span className="text-[7px] font-bold text-red-400/70">{idx + 1}.</span>
                          {player.jerseyNumber && (
                            <span className="text-[8px] font-black" style={{ color: match.awayTeamColor }}>#{player.jerseyNumber}</span>
                          )}
                          <span className="text-[8px] font-semibold text-gray-300 truncate max-w-[60px]">
                            {player.name.split(' ').length > 1
                              ? `${player.name.split(' ')[0]} ${player.name.split(' ')[1][0]}.`
                              : player.name.split(' ')[0]
                            }
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ RAID FLOW OVERLAYS — Tabbed Quick Actions ═══ */}
      <AnimatePresence>
        {raidPhase === 'result' && raider && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed inset-x-0 bottom-[76px] z-40 px-4">
            <div className="bg-white dark:bg-warm-800 rounded-2xl shadow-2xl border border-warm-200 dark:border-warm-700 p-4 max-w-md mx-auto">
              {/* Header: Raider info + Timer + Cancel */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md" style={{ backgroundColor: raidingTeamColor }}>
                  {raider.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="text-base font-black text-warm-800 dark:text-warm-100">#{raider.jerseyNumber || '?'} {raider.name}</div>
                  <div className="text-xs text-gray-400 dark:text-warm-500">raiding for {raidingTeamName}</div>
                </div>
                {raidTimer !== null && (
                  <div className="relative w-11 h-11 flex-shrink-0">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="19" fill="none" stroke="#374151" strokeWidth="3" />
                      <circle cx="22" cy="22" r="19" fill="none" stroke={raidTimerColor} strokeWidth="3"
                        strokeDasharray={`${2 * Math.PI * 19}`} strokeDashoffset={`${2 * Math.PI * 19 * (1 - raidTimer / RAID_TIME_LIMIT)}`}
                        strokeLinecap="round" className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-black" style={{ color: raidTimerColor }}>{raidTimer}</span>
                    </div>
                  </div>
                )}
                <button onClick={cancelRaid} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-warm-500 dark:text-warm-400" />
                </button>
              </div>

              {/* 3 BIG RESULT BUTTONS — the main flow */}
              <div className="text-[10px] font-bold text-gray-500 dark:text-warm-500 uppercase tracking-wider mb-2 text-center">What happened?</div>
              <div className="grid grid-cols-3 gap-2.5 mb-3">
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleSelectResult('success')}
                  className="py-5 px-2 rounded-2xl flex flex-col items-center gap-2 transition-all"
                  style={{ background: 'linear-gradient(135deg, #22c55e30, #22c55e10)', border: '2px solid #22c55e60' }}
                >
                  <div className="text-3xl">✅</div>
                  <span className="text-xs font-black text-green-400">SUCCESSFUL</span>
                  <span className="text-[8px] text-green-400/60">Raider scored</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleSelectResult('caught')}
                  className="py-5 px-2 rounded-2xl flex flex-col items-center gap-2 transition-all"
                  style={{ background: 'linear-gradient(135deg, #ef444430, #ef444410)', border: '2px solid #ef444460' }}
                >
                  <div className="text-3xl">❌</div>
                  <span className="text-xs font-black text-red-400">UNSUCCESSFUL</span>
                  <span className="text-[8px] text-red-400/60">Raider caught</span>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => handleSelectResult('empty')}
                  className="py-5 px-2 rounded-2xl flex flex-col items-center gap-2 transition-all"
                  style={{ background: 'linear-gradient(135deg, #9ca3af30, #9ca3af10)', border: '2px solid #9ca3af60' }}
                >
                  <div className="text-3xl">⏭️</div>
                  <span className="text-xs font-black text-gray-400">EMPTY</span>
                  <span className="text-[8px] text-gray-400/60">No points</span>
                </motion.button>
              </div>

              {/* Self-Out button — present on the raid result screen so the
                  scorer can quickly log a self-out without going to Actions */}
              <button
                onClick={() => setSelfOutSelection('raider')}
                className="w-full mt-2 py-2.5 rounded-xl bg-warm-100 dark:bg-warm-700 border border-warm-300 dark:border-warm-600 text-warm-700 dark:text-warm-200 font-bold text-sm flex items-center justify-center gap-2"
              >
                🚫 Self-Out (Raider or Defender stepped out)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {raidPhase === 'defenders' && raider && raidResult && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed inset-x-0 bottom-[76px] z-40 px-4">
            <div className="bg-white dark:bg-warm-800 rounded-2xl shadow-2xl border border-warm-200 dark:border-warm-700 p-4 max-w-md mx-auto max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  {raidResult === 'success' ? (
                    <><div className="text-sm font-black text-green-400">✅ Tap defenders the raider touched</div>
                    <div className="text-[10px] text-gray-400 dark:text-warm-500 mt-0.5">Each selected defender = 1 point for {raidingTeamName}</div></>
                  ) : (
                    <><div className="text-sm font-black text-red-400">❌ Who caught the raider?</div>
                    <div className="text-[10px] text-gray-400 dark:text-warm-500 mt-0.5">Select the defender(s) who tackled</div></>
                  )}
                </div>
                {raidTimer !== null && (
                  <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                    <Clock className="w-3.5 h-3.5" style={{ color: raidTimerColor }} />
                    <span className="text-sm font-black font-mono" style={{ color: raidTimerColor }}>{raidTimer}</span>
                  </div>
                )}
                <button onClick={() => { setRaidPhase('result'); setSelectedDefenders(new Set()); setBonusPoint(false); }} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-warm-500 dark:text-warm-400" />
                </button>
              </div>

              {/* Only show on-court defenders (first 7) */}
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 py-2">
                {(() => {
                  const { onCourt } = splitLineup(fullDefendingLineup, defendingOutIds);
                  return onCourt.map(player => {
                    const isOut = defendingOutIds.includes(player.id);
                    const isSelected = selectedDefenders.has(player.id);
                    const canSelect = !isOut;
                    return (
                      <PlayerCard key={player.id} player={player} isOut={isOut} isSelectable={canSelect}
                        isSelected={isSelected} teamColor={defendingTeamColor}
                        onSelect={() => canSelect && toggleDefender(player.id)} showCheck />
                    );
                  });
                })()}
              </div>

              {raidResult === 'success' && (() => {
                const { onCourtActive: activeDefenders } = splitLineup(fullDefendingLineup, defendingOutIds);
                const canGetBonus = (match.bonusEnabled ?? true) && activeDefenders.length >= (match.bonusLineThreshold ?? Math.max(1, match.playersPerSide - 1));
                return (
                  <button
                    onClick={() => canGetBonus && setBonusPoint(!bonusPoint)}
                    disabled={!canGetBonus}
                    className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      bonusPoint ? 'bg-yellow-900/30 border-2 border-yellow-400 text-yellow-400' : canGetBonus ? 'bg-warm-100 dark:bg-warm-700 border-2 border-gray-600 dark:border-warm-600 text-warm-500 dark:text-warm-400' : 'bg-warm-100/50 dark:bg-warm-700/50 border-2 border-gray-700 dark:border-warm-600 text-gray-600 dark:text-warm-600 cursor-not-allowed opacity-50'
                    }`}
                    title={canGetBonus ? 'Toggle Bonus Point' : !(match.bonusEnabled ?? true) ? 'Bonus disabled for this format' : `Bonus only with ${match.bonusLineThreshold}+ defenders on court`}
                  >
                    <span className="text-lg">⭐</span>Bonus Point {bonusPoint ? 'ON' : 'OFF'}
                    {!canGetBonus && <span className="text-[8px] ml-1">{!(match.bonusEnabled ?? true) ? '(disabled)' : `(${match.bonusLineThreshold}+ needed)`}</span>}
                  </button>
                );
              })()}

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  {raidResult === 'success' && (
                    <div className="text-xs text-gray-400">
                      <span className="font-bold text-green-400">+{selectedDefenders.size + (bonusPoint ? 1 : 0)}</span> point{selectedDefenders.size + (bonusPoint ? 1 : 0) !== 1 ? 's' : ''} for {raidingTeamName}
                    </div>
                  )}
                  {raidResult === 'caught' && (() => {
                    const { onCourtActive } = splitLineup(fullDefendingLineup, defendingOutIds);
                    return (
                      <div className="text-xs text-gray-400">
                        <span className="font-bold text-red-400">+1</span> tackle point for {defendingTeamName}
                        {onCourtActive.length <= (match.superTackleThreshold ?? Math.floor(match.playersPerSide / 2)) && <span className="ml-1 text-purple-400 font-bold">(+1 super tackle!)</span>}
                      </div>
                    );
                  })()}
                </div>
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => processRaidResult(raidResult, selectedDefenders, bonusPoint)}
                  disabled={raidResult === 'success' && selectedDefenders.size === 0 && !bonusPoint}
                  className="px-6 py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ backgroundColor: raidResult === 'success' ? '#16a34a' : '#dc2626' }}>
                  <Check className="w-4 h-4 inline mr-1" />Confirm
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* ═══ BOTTOM CONTROL BAR ═══ */}
      <div className="border-t border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800 px-2 py-1.5 shrink-0">
        <div className="grid grid-cols-6 gap-0.5">
          {/* HOME — go to home screen (match stays live, come back via Quick Score tab) */}
          <button onClick={() => setActiveTab('home')} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-warm-100 dark:active:bg-warm-700">
            <div className="w-7 h-7 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center"><Home className="w-3.5 h-3.5 text-gray-400 dark:text-warm-300" /></div>
            <span className="text-[8px] font-semibold text-warm-500 dark:text-warm-400">HOME</span>
          </button>
          {/* UNDO */}
          <button onClick={handleUndo} disabled={match.events.length === 0} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-warm-100 dark:active:bg-warm-700 disabled:opacity-30">
            <div className="w-7 h-7 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center"><Undo2 className="w-3.5 h-3.5 text-gray-400 dark:text-warm-300" /></div>
            <span className="text-[8px] font-semibold text-warm-500 dark:text-warm-400">UNDO</span>
          </button>
          {/* PAUSE / PLAY */}
          <button onClick={handlePause} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-warm-100 dark:active:bg-warm-700">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isPaused ? 'bg-teal-900/40 text-teal-400' : 'bg-gray-700 dark:bg-warm-700 text-gray-400 dark:text-warm-300'}`}>
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </div>
            <span className="text-[8px] font-semibold text-warm-500 dark:text-warm-400">{isPaused ? 'PLAY' : 'PAUSE'}</span>
          </button>
          {/* ADD PLAYER */}
          <button onClick={() => setShowAddPlayer(true)} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-warm-100 dark:active:bg-warm-700">
            <div className="w-7 h-7 rounded-full bg-emerald-900/30 flex items-center justify-center"><UserPlus className="w-3.5 h-3.5 text-emerald-400" /></div>
            <span className="text-[8px] font-semibold text-warm-500 dark:text-warm-400">ADD</span>
          </button>
          {/* SPECIALS — change raid team, add +1 point, end half */}
          <button onClick={() => setShowSpecialsPanel(true)} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-warm-100 dark:active:bg-warm-700">
            <div className="w-7 h-7 rounded-full bg-yellow-900/30 flex items-center justify-center"><Zap className="w-3.5 h-3.5 text-yellow-400" /></div>
            <span className="text-[8px] font-semibold text-warm-500 dark:text-warm-400">SPECIALS</span>
          </button>
          {/* END MATCH */}
          <button onClick={handleEndMatch} className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors ${showEndMatchConfirm ? 'bg-red-900/20' : 'active:bg-warm-100 dark:active:bg-warm-700'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${showEndMatchConfirm ? 'bg-red-800 text-red-300 animate-pulse' : 'bg-red-900/30 text-red-400'}`}><Square className="w-3.5 h-3.5" /></div>
            <span className={`text-[8px] font-semibold ${showEndMatchConfirm ? 'text-red-300' : 'text-warm-500 dark:text-warm-400'}`}>{showEndMatchConfirm ? 'SURE?' : 'END'}</span>
          </button>
        </div>
      </div>

      {/* ═══ ADD PLAYER MODAL ═══ */}
      {showAddPlayer && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
          onClick={() => { setShowAddPlayer(false); setAddPlayerTeam(null); setAddPlayerName(''); setAddPlayerPhone(''); setAddPlayerSearchResults([]); }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-3xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              Add Player
            </h3>
            <p className="text-[11px] text-gray-400 mb-4">Phone number links the player to their account for match records</p>

            {/* Team Selection */}
            {!addPlayerTeam ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-400">Which team is the player joining?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setAddPlayerTeam('home')}
                    className="flex items-center gap-2 p-3 rounded-xl border-2 border-warm-300 dark:border-warm-600 hover:border-warm-400 dark:hover:border-warm-500 transition-colors"
                    style={{ backgroundColor: `${match.homeTeamColor}15` }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: match.homeTeamColor }}>
                      {match.homeTeam.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{match.homeTeam}</p>
                      <p className="text-[10px] text-gray-400">{match.homeLineup.length} players</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setAddPlayerTeam('away')}
                    className="flex items-center gap-2 p-3 rounded-xl border-2 border-warm-300 dark:border-warm-600 hover:border-warm-400 dark:hover:border-warm-500 transition-colors"
                    style={{ backgroundColor: `${match.awayTeamColor}15` }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: match.awayTeamColor }}>
                      {match.awayTeam.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{match.awayTeam}</p>
                      <p className="text-[10px] text-gray-400">{match.awayLineup.length} players</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              /* Player Details Form */
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: addPlayerTeam === 'home' ? match.homeTeamColor : match.awayTeamColor }}>
                    {(addPlayerTeam === 'home' ? match.homeTeam : match.awayTeam).charAt(0)}
                  </div>
                  <span className="text-sm font-semibold text-white">{addPlayerTeam === 'home' ? match.homeTeam : match.awayTeam}</span>
                  <button onClick={() => setAddPlayerTeam(null)} className="ml-auto text-[10px] text-gray-400 hover:text-white">Change</button>
                </div>

                {/* Phone Number - Primary identifier */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    📱 Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={addPlayerPhone}
                    onChange={(e) => setAddPlayerPhone(e.target.value.replace(/[^\d+\-() ]/g, ''))}
                    placeholder="Enter phone number"
                    className="w-full mt-1 px-3 py-2.5 bg-gray-800 dark:bg-warm-700 border border-gray-600 dark:border-warm-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    autoFocus
                  />
                  <p className="text-[9px] text-gray-500 mt-1">This number links the player to their account. One number per player.</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Player Name *</label>
                  <input
                    type="text"
                    value={addPlayerName}
                    onChange={(e) => setAddPlayerName(e.target.value)}
                    placeholder="Enter player name"
                    className="w-full mt-1 px-3 py-2.5 bg-gray-800 dark:bg-warm-700 border border-gray-600 dark:border-warm-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>

                {/* Search results - auto-detected players by phone */}
                {addPlayerSearchResults.length > 0 && (
                  <div>
                    <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">🔍 Found existing player — Tap to auto-fill</label>
                    <div className="mt-1 space-y-1">
                      {addPlayerSearchResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setAddPlayerName(p.name);
                            setAddPlayerPhone(p.phone || '');
                            setAddPlayerSearchResults([]);
                          }}
                          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-emerald-900/20 transition-colors text-left border border-emerald-800/30"
                        >
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: addPlayerTeam === 'home' ? match.homeTeamColor : match.awayTeamColor }}>
                            {p.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{p.name}</p>
                            <p className="text-[9px] text-gray-400">
                              📱 {p.phone || 'No phone'} {p.jerseyNumber ? `• #${p.jerseyNumber}` : ''} {p.playerCode ? `• ${p.playerCode}` : ''}
                            </p>
                          </div>
                          <span className="text-[9px] text-emerald-400 font-bold">USE</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => { setShowAddPlayer(false); setAddPlayerTeam(null); setAddPlayerName(''); setAddPlayerPhone(''); setAddPlayerSearchResults([]); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-600 text-warm-600 dark:text-gray-300 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPlayer}
                    disabled={!addPlayerName.trim() || !addPlayerPhone.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Add Player
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ SPECIALS PANEL (change raid, add point, end half) ═══ */}
      <AnimatePresence>
        {showSpecialsPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/70 flex items-end justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSpecialsPanel(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white">⚡ Specials</h3>
                <button onClick={() => setShowSpecialsPanel(false)} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Change Raid Team — flips raid to the other team */}
              <button
                onClick={() => {
                  switchRaidQueue();
                  setShowSpecialsPanel(false);
                  toast({ title: 'Raid changed', description: `Now ${raidingTeam === 'home' ? match.awayTeam : match.homeTeam} will raid`, duration: 2000 });
                }}
                className="w-full py-3 rounded-xl bg-blue-900/30 border border-blue-700/40 text-blue-400 font-bold text-sm flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Change Raid Team (other team raids)
              </button>

              {/* Add +1 Point to Team — asks which team */}
              <button
                onClick={() => { setShowSpecialsPanel(false); setAddPointSelection('home'); }}
                className="w-full py-3 rounded-xl bg-purple-900/30 border border-purple-700/40 text-purple-400 font-bold text-sm flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add +1 Point to Team (mistake correction)
              </button>

              {/* End Half */}
              <button
                onClick={() => { setShowSpecialsPanel(false); handleEndHalf(); }}
                className="w-full py-3 rounded-xl bg-yellow-900/30 border border-yellow-700/40 text-yellow-400 font-bold text-sm flex items-center justify-center gap-2"
              >
                <Timer className="w-4 h-4" />
                End Half {match.currentHalf}
              </button>

              <button
                onClick={() => setShowSpecialsPanel(false)}
                className="w-full py-2.5 rounded-xl border border-gray-600 text-warm-600 dark:text-gray-300 font-semibold text-sm"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ ADD POINT TEAM SELECTOR ═══ */}
      <AnimatePresence>
        {addPointSelection !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[56] bg-black/70 flex items-end justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setAddPointSelection(null); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-2xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-white">Add +1 Point to which team?</h3>
                <button onClick={() => setAddPointSelection(null)} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    addEvent({ matchId: match.id, eventType: 'technical_point', teamId: match.homeTeamId, half: match.currentHalf, value: 1, details: JSON.stringify({ reason: 'Manual point addition' }) });
                    toast({ title: '+1 point added', description: `${match.homeTeam} +1`, duration: 2000 });
                    setAddPointSelection(null);
                  }}
                  className="p-4 rounded-xl flex flex-col items-center gap-2 text-white font-bold"
                  style={{ backgroundColor: `${match.homeTeamColor}30`, border: `2px solid ${match.homeTeamColor}` }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black" style={{ backgroundColor: match.homeTeamColor }}>
                    {match.homeTeam.charAt(0)}
                  </div>
                  {match.homeTeam} +1
                </button>
                <button
                  onClick={() => {
                    addEvent({ matchId: match.id, eventType: 'technical_point', teamId: match.awayTeamId, half: match.currentHalf, value: 1, details: JSON.stringify({ reason: 'Manual point addition' }) });
                    toast({ title: '+1 point added', description: `${match.awayTeam} +1`, duration: 2000 });
                    setAddPointSelection(null);
                  }}
                  className="p-4 rounded-xl flex flex-col items-center gap-2 text-white font-bold"
                  style={{ backgroundColor: `${match.awayTeamColor}30`, border: `2px solid ${match.awayTeamColor}` }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black" style={{ backgroundColor: match.awayTeamColor }}>
                    {match.awayTeam.charAt(0)}
                  </div>
                  {match.awayTeam} +1
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ CARD SELECTION MODAL (team → player → confirm) ═══ */}
      <AnimatePresence>
        {cardSelection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[56] bg-black/70 flex items-end justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setCardSelection(null); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-white">
                  {cardSelection.step === 'team' ? 'Select Team' : 'Select Player'}
                  {cardSelection.cardType === 'green_card' && ' 🟩'}
                  {cardSelection.cardType === 'yellow_card' && ' 🟨'}
                  {cardSelection.cardType === 'red_card' && ' 🟥'}
                </h3>
                <button onClick={() => setCardSelection(null)} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step 1: Pick team */}
              {cardSelection.step === 'team' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCardSelection({ ...cardSelection, step: 'player', team: 'home' })}
                    className="p-4 rounded-xl flex flex-col items-center gap-2 text-white font-bold"
                    style={{ backgroundColor: `${match.homeTeamColor}30`, border: `2px solid ${match.homeTeamColor}` }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black" style={{ backgroundColor: match.homeTeamColor }}>
                      {match.homeTeam.charAt(0)}
                    </div>
                    {match.homeTeam}
                  </button>
                  <button
                    onClick={() => setCardSelection({ ...cardSelection, step: 'player', team: 'away' })}
                    className="p-4 rounded-xl flex flex-col items-center gap-2 text-white font-bold"
                    style={{ backgroundColor: `${match.awayTeamColor}30`, border: `2px solid ${match.awayTeamColor}` }}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black" style={{ backgroundColor: match.awayTeamColor }}>
                      {match.awayTeam.charAt(0)}
                    </div>
                    {match.awayTeam}
                  </button>
                </div>
              )}

              {/* Step 2: Pick player from the selected team */}
              {cardSelection.step === 'player' && cardSelection.team && (
                <div className="space-y-1.5">
                  {(cardSelection.team === 'home' ? match.homeLineup : match.awayLineup).map(player => {
                    const teamColor = cardSelection.team === 'home' ? match.homeTeamColor : match.awayTeamColor;
                    return (
                      <button
                        key={player.id}
                        onClick={() => {
                          if (cardSelection.cardType) {
                            handleCardWithPlayer(cardSelection.team!, player, cardSelection.cardType);
                          }
                          setCardSelection(null);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800 dark:bg-warm-700/50 hover:bg-gray-700 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: teamColor }}>
                          {player.jerseyNumber || '?'}
                        </div>
                        <span className="text-sm font-bold text-white flex-1 text-left">{player.name}</span>
                        <span className="text-[9px] text-gray-400">{cardSelection.cardType === 'green_card' ? '🟩' : cardSelection.cardType === 'yellow_card' ? '🟨' : '🟥'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ TECH POINT SELECTION MODAL (which team gets the point) ═══ */}
      <AnimatePresence>
        {techPointSelection !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[56] bg-black/70 flex items-end justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setTechPointSelection(null); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-2xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-white">⚖️ Technical Point — Award to which team?</h3>
                <button onClick={() => setTechPointSelection(null)} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const teamId = match.homeTeamId;
                    addEvent({ matchId: match.id, eventType: 'technical_point', teamId, half: match.currentHalf, value: 1, details: JSON.stringify({ reason: 'Umpire decision' }) });
                    toast({ title: 'Tech point awarded', description: `${match.homeTeam} +1`, duration: 2000 });
                    setTechPointSelection(null);
                  }}
                  className="p-4 rounded-xl flex flex-col items-center gap-2 text-white font-bold"
                  style={{ backgroundColor: `${match.homeTeamColor}30`, border: `2px solid ${match.homeTeamColor}` }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black" style={{ backgroundColor: match.homeTeamColor }}>
                    {match.homeTeam.charAt(0)}
                  </div>
                  {match.homeTeam} +1
                </button>
                <button
                  onClick={() => {
                    const teamId = match.awayTeamId;
                    addEvent({ matchId: match.id, eventType: 'technical_point', teamId, half: match.currentHalf, value: 1, details: JSON.stringify({ reason: 'Umpire decision' }) });
                    toast({ title: 'Tech point awarded', description: `${match.awayTeam} +1`, duration: 2000 });
                    setTechPointSelection(null);
                  }}
                  className="p-4 rounded-xl flex flex-col items-center gap-2 text-white font-bold"
                  style={{ backgroundColor: `${match.awayTeamColor}30`, border: `2px solid ${match.awayTeamColor}` }}
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black" style={{ backgroundColor: match.awayTeamColor }}>
                    {match.awayTeam.charAt(0)}
                  </div>
                  {match.awayTeam} +1
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ SELF-OUT SELECTION MODAL (raider or which defender) ═══ */}
      <AnimatePresence>
        {selfOutSelection !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[56] bg-black/70 flex items-end justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setSelfOutSelection(null); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-white">🚫 Self-Out — Who stepped out?</h3>
                <button onClick={() => setSelfOutSelection(null)} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Option 1: Raider self-out */}
              {raider && (
                <button
                  onClick={() => {
                    handleSelfOut(raider);
                    setSelfOutSelection(null);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800 dark:bg-warm-700/50 hover:bg-gray-700 transition-colors mb-2"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: raidingTeamColor }}>
                    {raider.jerseyNumber || '?'}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-white">{raider.name}</p>
                    <p className="text-[9px] text-gray-400">RAIDER — steps out, defending team gets +1</p>
                  </div>
                </button>
              )}

              {/* Option 2: Defender self-out — show all defenders */}
              <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-3 mb-1">Defenders (self-out = raider team gets +1, valid empty raid)</div>
              {splitLineup(fullDefendingLineup, defendingOutIds).onCourtActive.map(player => (
                <button
                  key={player.id}
                  onClick={() => {
                    handleSelfOut(player);
                    setSelfOutSelection(null);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800 dark:bg-warm-700/50 hover:bg-gray-700 transition-colors mb-1.5"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: defendingTeamColor }}>
                    {player.jerseyNumber || '?'}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-white">{player.name}</p>
                    <p className="text-[9px] text-gray-400">DEFENDER — self-out, raider team +1, raider returns safe</p>
                  </div>
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ PERMANENT ACTIONS PANEL ═══ */}
      {/* Always-accessible panel with Cards, Timeout, Tech Point, Self-Out, Bonus */}
      <AnimatePresence>
        {showActionsPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] bg-black/70 flex items-end justify-center"
            onClick={(e) => { if (e.target === e.currentTarget) setShowActionsPanel(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-2xl p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white">Match Actions</h3>
                <button onClick={() => setShowActionsPanel(false)} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action buttons grid — Self-Out removed (now on raid screen) */}
              <div className="grid grid-cols-3 gap-2">
                {/* Green Card */}
                <button
                  onClick={() => { setShowActionsPanel(false); setCardSelection({ step: 'team', cardType: 'green_card' }); }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-green-900/30 border border-green-700/40 hover:bg-green-900/50 transition-colors"
                >
                  <span className="text-2xl">🟩</span>
                  <span className="text-[9px] font-bold text-green-400">Green Card</span>
                  <span className="text-[7px] text-gray-400">Warning</span>
                </button>
                {/* Yellow Card */}
                <button
                  onClick={() => { setShowActionsPanel(false); setCardSelection({ step: 'team', cardType: 'yellow_card' }); }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-yellow-900/30 border border-yellow-700/40 hover:bg-yellow-900/50 transition-colors"
                >
                  <span className="text-2xl">🟨</span>
                  <span className="text-[9px] font-bold text-yellow-400">Yellow Card</span>
                  <span className="text-[7px] text-gray-400">2 min suspend</span>
                </button>
                {/* Red Card */}
                <button
                  onClick={() => { setShowActionsPanel(false); setCardSelection({ step: 'team', cardType: 'red_card' }); }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-red-900/30 border border-red-700/40 hover:bg-red-900/50 transition-colors"
                >
                  <span className="text-2xl">🟥</span>
                  <span className="text-[9px] font-bold text-red-400">Red Card</span>
                  <span className="text-[7px] text-gray-400">Expulsion</span>
                </button>
                {/* Timeout */}
                <button
                  onClick={() => { setShowActionsPanel(false); handleTimeout(); }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-orange-900/30 border border-orange-700/40 hover:bg-orange-900/50 transition-colors"
                >
                  <span className="text-2xl">📋</span>
                  <span className="text-[9px] font-bold text-orange-400">Timeout</span>
                  <span className="text-[7px] text-gray-400">2 min break</span>
                </button>
                {/* Tech Point — asks which team first */}
                <button
                  onClick={() => { setShowActionsPanel(false); setTechPointSelection('home'); }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-purple-900/30 border border-purple-700/40 hover:bg-purple-900/50 transition-colors"
                >
                  <span className="text-2xl">⚖️</span>
                  <span className="text-[9px] font-bold text-purple-400">Tech Point</span>
                  <span className="text-[7px] text-gray-400">Umpire decision</span>
                </button>
              </div>

              {/* Bonus point (if enabled) */}
              {(match.bonusEnabled ?? true) && (
                <button
                  onClick={() => {
                    setShowActionsPanel(false);
                    const { onCourtActive: activeDefenders } = splitLineup(fullDefendingLineup, defendingOutIds);
                    if (activeDefenders.length >= (match.bonusLineThreshold ?? Math.max(1, match.playersPerSide - 1))) {
                      handleBonusPoint();
                    } else {
                      toast({ title: `Bonus needs ${match.bonusLineThreshold ?? Math.max(1, match.playersPerSide - 1)}+ defenders`, duration: 1500 });
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-yellow-900/30 border border-yellow-700/40 text-yellow-400 font-bold text-sm flex items-center justify-center gap-2"
                >
                  🎯 Bonus Point ({match.bonusLineThreshold ?? Math.max(1, match.playersPerSide - 1)}+ defenders needed)
                </button>
              )}

              {/* Close button */}
              <button
                onClick={() => setShowActionsPanel(false)}
                className="w-full py-2.5 rounded-xl border border-gray-600 text-warm-600 dark:text-gray-300 font-semibold text-sm"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
